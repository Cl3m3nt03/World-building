//! The ePub 3 of a book (`epub-builder`): its cover, a table of contents and
//! one page per chapter, with the images and the reading settings' look.

use epub_builder::{EpubBuilder, EpubContent, EpubVersion, ReferenceType, ZipLibrary};

use super::{Block, Book, Run};
use crate::domain::quill::reader::{PageTheme, TextSize};
use crate::error::{AppError, AppResult};

fn failed(error: epub_builder::Error) -> AppError {
    AppError::Internal(format!("epub: {error}"))
}

/// Text safe in XHTML.
pub fn escape(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(c),
        }
    }
    out
}

/// The CSS name of a reading font (the app's free fonts), with a fallback.
pub fn font_family(key: &str) -> &'static str {
    match key {
        "inter" => "\"Inter\", sans-serif",
        "cinzel" => "\"Cinzel\", serif",
        "playfair" => "\"Playfair Display\", serif",
        "lora" => "\"Lora\", serif",
        "source-serif" => "\"Source Serif 4\", serif",
        _ => "\"EB Garamond\", Georgia, serif",
    }
}

fn stylesheet(book: &Book) -> String {
    let (page, text) = match book.settings.theme {
        PageTheme::Light => ("#fbf8f1", "#221d17"),
        PageTheme::Sepia => ("#f2e7d0", "#3a2d1f"),
        PageTheme::Dark => ("#17171c", "#e7e2d8"),
    };
    let page = book.settings.background.as_deref().unwrap_or(page);
    let size = match book.settings.text_size {
        TextSize::Small => "0.95em",
        TextSize::Medium => "1em",
        TextSize::Large => "1.15em",
    };
    format!(
        "body {{ font-family: {font}; font-size: {size}; line-height: 1.6; background: {page}; color: {text}; }}\n\
         h1 {{ text-align: center; font-size: 1.8em; margin: 1em 0; }}\n\
         h2 {{ font-size: 1.4em; }} h3 {{ font-size: 1.2em; }} h4 {{ font-size: 1.05em; }}\n\
         p {{ margin: 0 0 0.8em; text-align: justify; }}\n\
         blockquote {{ margin: 1em 1.5em; font-style: italic; }}\n\
         hr {{ width: 30%; margin: 1.5em auto; border: none; border-top: 1px solid currentColor; }}\n\
         figure {{ margin: 1em 0; text-align: center; }}\n\
         img {{ max-width: 100%; }}\n\
         .opening img {{ width: 100%; }}\n",
        font = font_family(&book.settings.font),
    )
}

fn runs(runs: &[Run]) -> String {
    let mut out = String::new();
    for run in runs {
        if run.line_break {
            out.push_str("<br/>");
            continue;
        }
        let mut text = escape(&run.text);
        if run.code {
            text = format!("<code>{text}</code>");
        }
        if run.bold {
            text = format!("<strong>{text}</strong>");
        }
        if run.italic {
            text = format!("<em>{text}</em>");
        }
        if run.strike {
            text = format!("<s>{text}</s>");
        }
        if run.underline {
            text = format!("<u>{text}</u>");
        }
        out.push_str(&text);
    }
    out
}

fn image_path(asset_id: &str) -> String {
    format!("images/{asset_id}")
}

fn blocks(blocks: &[Block], out: &mut String) {
    for block in blocks {
        match block {
            Block::Heading { level, runs: text } => {
                let tag = format!("h{}", level + 1);
                out.push_str(&format!("<{tag}>{}</{tag}>\n", runs(text)));
            }
            Block::Paragraph(text) => out.push_str(&format!("<p>{}</p>\n", runs(text))),
            Block::Quote(inner) => {
                out.push_str("<blockquote>\n");
                self::blocks(inner, out);
                out.push_str("</blockquote>\n");
            }
            Block::List { ordered, items } => {
                let tag = if *ordered { "ol" } else { "ul" };
                out.push_str(&format!("<{tag}>\n"));
                for item in items {
                    out.push_str("<li>");
                    self::blocks(item, out);
                    out.push_str("</li>\n");
                }
                out.push_str(&format!("</{tag}>\n"));
            }
            Block::Code(text) => {
                out.push_str(&format!("<pre><code>{}</code></pre>\n", escape(text)))
            }
            Block::Rule => out.push_str("<hr/>\n"),
            Block::Image { asset_id } => out.push_str(&format!(
                "<figure><img src=\"{}\" alt=\"\"/></figure>\n",
                image_path(asset_id)
            )),
        }
    }
}

fn page(book: &Book, title: &str, body: &str) -> String {
    let lang = escape(&book.language);
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
         <!DOCTYPE html>\n\
         <html xmlns=\"http://www.w3.org/1999/xhtml\" xmlns:epub=\"http://www.idpf.org/2007/ops\" xml:lang=\"{lang}\" lang=\"{lang}\">\n\
         <head>\n<meta charset=\"UTF-8\"/>\n<title>{title}</title>\n\
         <link rel=\"stylesheet\" type=\"text/css\" href=\"stylesheet.css\"/>\n</head>\n\
         <body>\n{body}</body>\n</html>\n",
        title = escape(title),
    )
}

/// The chapter's page: its opening (header image, title), then its text.
pub fn chapter_page(book: &Book, index: usize) -> String {
    let Some(chapter) = book.chapters.get(index) else {
        return String::new();
    };
    let mut body = String::from("<section epub:type=\"chapter\">\n");
    if let Some(header) = &chapter.header {
        body.push_str(&format!(
            "<figure class=\"opening\"><img src=\"{}\" alt=\"\"/></figure>\n",
            image_path(header)
        ));
    }
    body.push_str(&format!("<h1>{}</h1>\n", escape(&chapter.title)));
    blocks(&chapter.blocks, &mut body);
    body.push_str("</section>\n");
    page(book, &chapter.title, &body)
}

/// The ePub file of the book.
pub fn write(book: &Book) -> AppResult<Vec<u8>> {
    let mut builder = EpubBuilder::new(ZipLibrary::new().map_err(failed)?).map_err(failed)?;
    builder.epub_version(EpubVersion::V30);
    builder.set_title(book.title.clone());
    builder.set_languages(vec![book.language.clone()]);
    builder.set_generator("BuilderZ");
    builder
        .stylesheet(stylesheet(book).as_bytes())
        .map_err(failed)?;
    if let Some(cover) = &book.cover {
        builder
            .add_cover_image("cover.png", cover.as_slice(), "image/png")
            .map_err(failed)?;
        let body = format!(
            "<section epub:type=\"cover\"><figure><img src=\"cover.png\" alt=\"{}\"/></figure></section>\n",
            escape(&book.title)
        );
        builder
            .add_content(
                EpubContent::new("cover.xhtml", page(book, &book.title, &body).as_bytes())
                    .reftype(ReferenceType::Cover),
            )
            .map_err(failed)?;
    }
    for image in &book.images {
        builder
            .add_resource(
                image_path(&image.asset_id),
                image.bytes.as_slice(),
                image.mime,
            )
            .map_err(failed)?;
    }
    builder.inline_toc();
    for (index, chapter) in book.chapters.iter().enumerate() {
        let xhtml = chapter_page(book, index);
        let content = EpubContent::new(format!("chapter_{}.xhtml", index + 1), xhtml.as_bytes())
            .title(chapter.title.clone())
            .reftype(ReferenceType::Text);
        builder.add_content(content).map_err(failed)?;
    }
    let mut out = Vec::new();
    builder.generate(&mut out).map_err(failed)?;
    Ok(out)
}
