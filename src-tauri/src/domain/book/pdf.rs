//! The PDF of a book (Typst, ADR 0001 and 0010): the book is written as a
//! Typst source, compiled in memory with its cover and images, then exported
//! by `typst-pdf`. A5 pages: the cover, the title, the table of contents
//! (several chapters), then each chapter from a new page, numbered.

use std::collections::HashMap;
use std::sync::OnceLock;

use typst::diag::{FileError, FileResult};
use typst::foundations::{Bytes, Datetime};
use typst::syntax::{FileId, RootedPath, Source, VirtualPath, VirtualRoot};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::{Library, LibraryExt, World};
use typst_kit::fonts::FontStore;
use typst_layout::PagedDocument;

use super::{Block, Book, Run};
use crate::domain::quill::reader::{PageTheme, TextSize};
use crate::error::{AppError, AppResult};

/// The fonts Typst can use: its own (Libertinus Serif, New Computer Modern,
/// DejaVu Sans Mono), then the PC's. Found once.
fn fonts() -> &'static FontStore {
    static FONTS: OnceLock<FontStore> = OnceLock::new();
    FONTS.get_or_init(|| {
        let mut store = FontStore::new();
        store.extend(typst_kit::fonts::embedded());
        store.extend(typst_kit::fonts::system());
        store
    })
}

fn library() -> &'static LazyHash<Library> {
    static LIBRARY: OnceLock<LazyHash<Library>> = OnceLock::new();
    LIBRARY.get_or_init(|| LazyHash::new(Library::default()))
}

fn file_id(path: &str) -> AppResult<FileId> {
    let vpath = VirtualPath::new(path)
        .map_err(|error| AppError::Internal(format!("typst path {path}: {error:?}")))?;
    Ok(FileId::new(RootedPath::new(VirtualRoot::Project, vpath)))
}

/// The book as Typst sees it: one source and the files it reads.
struct BookWorld {
    main: Source,
    files: HashMap<FileId, Bytes>,
    today: Option<Datetime>,
}

impl World for BookWorld {
    fn library(&self) -> &LazyHash<Library> {
        library()
    }

    fn book(&self) -> &LazyHash<FontBook> {
        fonts().book()
    }

    fn main(&self) -> FileId {
        self.main.id()
    }

    fn source(&self, id: FileId) -> FileResult<Source> {
        if id == self.main.id() {
            Ok(self.main.clone())
        } else {
            Err(FileError::NotFound(
                id.get().vpath().get_without_slash().into(),
            ))
        }
    }

    fn file(&self, id: FileId) -> FileResult<Bytes> {
        self.files
            .get(&id)
            .cloned()
            .ok_or_else(|| FileError::NotFound(id.get().vpath().get_without_slash().into()))
    }

    fn font(&self, index: usize) -> Option<Font> {
        fonts().font(index)
    }

    fn today(&self, _offset: Option<typst::foundations::Duration>) -> Option<Datetime> {
        self.today
    }
}

/// A Typst string literal: the text as is, whatever it holds.
pub fn string(text: &str) -> String {
    let mut out = String::with_capacity(text.len() + 2);
    out.push('"');
    for c in text.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\n' => out.push_str("\\n"),
            '\r' => {}
            '\t' => out.push_str("\\t"),
            _ => out.push(c),
        }
    }
    out.push('"');
    out
}

/// The fonts to try for a reading font: its own if the PC has it, then a
/// near one, then one Typst always has.
fn font_list(key: &str) -> &'static str {
    match key {
        "inter" => {
            r#"("Inter", "Segoe UI", "Arial", "New Computer Modern Sans", "Libertinus Serif")"#
        }
        "cinzel" => r#"("Cinzel", "Trajan Pro", "Libertinus Serif")"#,
        "playfair" => r#"("Playfair Display", "Georgia", "Libertinus Serif")"#,
        "lora" => r#"("Lora", "Georgia", "Libertinus Serif")"#,
        "source-serif" => {
            r#"("Source Serif 4", "Source Serif Pro", "Georgia", "Libertinus Serif")"#
        }
        _ => r#"("EB Garamond", "Garamond", "Libertinus Serif")"#,
    }
}

fn image_path(asset_id: &str) -> String {
    format!("img/{asset_id}")
}

fn runs(runs: &[Run]) -> String {
    let mut out = String::new();
    for run in runs {
        if run.line_break {
            out.push_str("#linebreak()");
            continue;
        }
        let mut expr = if run.code {
            format!("raw({})", string(&run.text))
        } else {
            string(&run.text)
        };
        if run.bold {
            expr = format!("strong({expr})");
        }
        if run.italic {
            expr = format!("emph({expr})");
        }
        if run.strike {
            expr = format!("strike({expr})");
        }
        if run.underline {
            expr = format!("underline({expr})");
        }
        out.push('#');
        out.push_str(&expr);
    }
    out
}

fn blocks(blocks: &[Block], out: &mut String) {
    for block in blocks {
        match block {
            Block::Heading { level, runs: text } => {
                // The text's titles sit under the chapter's (level 1).
                out.push_str(&format!(
                    "#heading(level: {}, outlined: false)[{}]\n\n",
                    level + 1,
                    runs(text)
                ));
            }
            Block::Paragraph(text) => {
                out.push_str(&runs(text));
                out.push_str("\n\n");
            }
            Block::Quote(inner) => {
                out.push_str("#quote(block: true)[\n");
                self::blocks(inner, out);
                out.push_str("]\n\n");
            }
            Block::List { ordered, items } => {
                out.push_str(if *ordered { "#enum(" } else { "#list(" });
                for item in items {
                    out.push('[');
                    self::blocks(item, out);
                    out.push_str("],");
                }
                out.push_str(")\n\n");
            }
            Block::Code(text) => {
                out.push_str(&format!("#raw(block: true, {})\n\n", string(text)));
            }
            Block::Rule => out.push_str("#align(center, line(length: 30%, stroke: 0.5pt))\n\n"),
            Block::Image { asset_id } => out.push_str(&format!(
                "#align(center, image({}, width: 80%))\n\n",
                string(&image_path(asset_id))
            )),
        }
    }
}

/// The Typst source of the book.
pub fn source(book: &Book) -> String {
    let settings = &book.settings;
    let (page, text) = match settings.theme {
        PageTheme::Light => ("#ffffff", "#1f1b16"),
        PageTheme::Sepia => ("#f2e7d0", "#3a2d1f"),
        PageTheme::Dark => ("#17171c", "#e7e2d8"),
    };
    let page = settings.background.as_deref().unwrap_or(page);
    let size = match settings.text_size {
        TextSize::Small => "10pt",
        TextSize::Medium => "11pt",
        TextSize::Large => "12.5pt",
    };
    let lang = book
        .language
        .split(['-', '_'])
        .next()
        .unwrap_or("fr")
        .to_ascii_lowercase();
    let mut out = format!(
        "#set document(title: {title})\n\
         #set page(paper: \"a5\", margin: (x: 1.8cm, y: 2cm), fill: rgb({page}))\n\
         #set text(font: {fonts}, size: {size}, lang: {lang}, fill: rgb({text}))\n\
         #set par(justify: true, first-line-indent: 1.2em, leading: 0.7em)\n\
         #show heading.where(level: 1): it => block(width: 100%, above: 2em, below: 2em)[\n\
           #align(center, text(size: 1.7em, weight: \"bold\", it.body))\n\
         ]\n\
         #show heading.where(level: 2): set text(size: 1.3em)\n\
         #show heading.where(level: 3): set text(size: 1.15em)\n\
         #show heading.where(level: 4): set text(size: 1.05em)\n",
        title = string(&book.title),
        page = string(page),
        fonts = font_list(&settings.font),
        lang = string(&lang),
        text = string(text),
    );
    if book.cover.is_some() {
        out.push_str(
            "#page(margin: 0pt, fill: none)[#image(\"cover.png\", width: 100%, height: 100%, fit: \"cover\")]\n",
        );
    }
    out.push_str(&format!(
        "#page[#align(center + horizon)[#text(size: 2.2em, weight: \"bold\", {})]]\n",
        string(&book.title)
    ));
    if book.chapters.len() > 1 {
        out.push_str("#page[#outline(depth: 1)]\n");
    }
    out.push_str(
        "#set page(footer: context align(center, text(size: 0.8em, counter(page).display())))\n\
         #counter(page).update(1)\n",
    );
    for (index, chapter) in book.chapters.iter().enumerate() {
        if index > 0 {
            out.push_str("#pagebreak()\n");
        }
        // A chapter opens lower on its page, as in a printed book.
        match &chapter.header {
            Some(header) => out.push_str(&format!(
                "#image({}, width: 100%, height: 30%, fit: \"cover\")\n",
                string(&image_path(header))
            )),
            None => out.push_str("#v(12%)\n"),
        }
        out.push_str(&format!(
            "#heading(level: 1)[#{}]\n\n",
            string(&chapter.title)
        ));
        blocks(&chapter.blocks, &mut out);
    }
    out
}

/// A raster image Typst reads as is, or the same image turned to PNG (WebP,
/// BMP); None when it cannot be read.
fn typst_image(bytes: &[u8], mime: &str) -> Option<Vec<u8>> {
    match mime {
        "image/png" | "image/jpeg" | "image/gif" | "image/svg+xml" => Some(bytes.to_vec()),
        _ => {
            let image = image::load_from_memory(bytes).ok()?;
            let mut png = Vec::new();
            image
                .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
                .ok()?;
            Some(png)
        }
    }
}

/// The book laid out in pages (Typst).
pub fn compile(book: &Book) -> AppResult<PagedDocument> {
    let mut files = HashMap::new();
    let mut book = book.clone();
    if let Some(cover) = &book.cover {
        files.insert(file_id("/cover.png")?, Bytes::new(cover.clone()));
    }
    let mut unreadable = Vec::new();
    for image in &book.images {
        match typst_image(&image.bytes, image.mime) {
            Some(bytes) => {
                files.insert(
                    file_id(&format!("/{}", image_path(&image.asset_id)))?,
                    Bytes::new(bytes),
                );
            }
            None => unreadable.push(image.asset_id.clone()),
        }
    }
    // An image Typst could not read would stop the whole book: it is left out.
    if !unreadable.is_empty() {
        let known = |id: &str| !unreadable.iter().any(|bad| bad == id);
        for chapter in &mut book.chapters {
            if chapter.header.as_deref().is_some_and(|id| !known(id)) {
                chapter.header = None;
            }
            super::drop_images(&mut chapter.blocks, &known);
        }
    }
    let now = time::OffsetDateTime::now_utc();
    let world = BookWorld {
        main: Source::new(file_id("/main.typ")?, source(&book)),
        files,
        today: Datetime::from_ymd(now.year(), u8::from(now.month()), now.day()),
    };
    typst::compile::<PagedDocument>(&world)
        .output
        .map_err(|errors| {
            let messages: Vec<String> = errors
                .iter()
                .map(|error| error.message.to_string())
                .collect();
            AppError::Internal(format!("pdf: {}", messages.join("; ")))
        })
}

/// The PDF file of the book.
pub fn write(book: &Book) -> AppResult<Vec<u8>> {
    let document = compile(book)?;
    typst_pdf::pdf(&document, &typst_pdf::PdfOptions::default()).map_err(|errors| {
        let messages: Vec<String> = errors
            .iter()
            .map(|error| error.message.to_string())
            .collect();
        AppError::Internal(format!("pdf: {}", messages.join("; ")))
    })
}
