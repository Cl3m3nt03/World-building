//! The Word file of a book (`docx-rs`): A5 pages like the PDF, the cover,
//! the title, then each chapter from a new page with its title in the
//! « Titre 1 » style (Word's navigation lists the chapters), the text's own
//! titles in the next ones, numbered pages.

use docx_rs::{
    AlignmentType, BreakType, Docx, Footer, PageMargin, PageNum, Paragraph, Pic, Run as DocxRun,
    RunFonts, SpecialIndentType, Style, StyleType,
};

use super::{Block, Book, Run};
use crate::domain::quill::reader::TextSize;
use crate::error::{AppError, AppResult};

// A5 in twentieths of a point, margins 1.8 × 2 cm (as the PDF).
const PAGE_WIDTH: u32 = 8391;
const PAGE_HEIGHT: u32 = 11906;
const MARGIN_X: i32 = 1020;
const MARGIN_Y: i32 = 1134;

/// English Metric Units per twip (images are sized in EMU).
const EMU_PER_TWIP: u32 = 635;

/// The width and height the text can use, in EMU.
fn text_box() -> (u32, u32) {
    let width = PAGE_WIDTH - 2 * MARGIN_X.unsigned_abs();
    let height = PAGE_HEIGHT - 2 * MARGIN_Y.unsigned_abs();
    (width * EMU_PER_TWIP, height * EMU_PER_TWIP)
}

/// The font names to write for a reading font (Word replaces one it lacks).
fn font_name(key: &str) -> &'static str {
    match key {
        "inter" => "Inter",
        "cinzel" => "Cinzel",
        "playfair" => "Playfair Display",
        "lora" => "Lora",
        "source-serif" => "Source Serif 4",
        _ => "EB Garamond",
    }
}

/// An image as Word takes it: PNG, sized to fit `max` (width, height in EMU)
/// without being enlarged. None for an image that cannot be read (or SVG).
fn picture(bytes: &[u8], max: (u32, u32)) -> Option<Pic> {
    let image = image::load_from_memory(bytes).ok()?;
    let (width, height) = (image.width().max(1), image.height().max(1));
    let mut png = Vec::new();
    image
        .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
        .ok()?;
    // 96 pixels per inch, 914 400 EMU per inch.
    let natural = (u64::from(width) * 9525, u64::from(height) * 9525);
    let scale = (f64::from(max.0) / natural.0 as f64)
        .min(f64::from(max.1) / natural.1 as f64)
        .min(1.0);
    let size = (
        (natural.0 as f64 * scale).round() as u32,
        (natural.1 as f64 * scale).round() as u32,
    );
    Some(Pic::new_with_dimensions(png, width, height).size(size.0, size.1))
}

fn runs(paragraph: Paragraph, runs: &[Run]) -> Paragraph {
    runs.iter().fold(paragraph, |paragraph, run| {
        if run.line_break {
            return paragraph.add_run(DocxRun::new().add_break(BreakType::TextWrapping));
        }
        let mut item = DocxRun::new().add_text(run.text.clone());
        if run.bold {
            item = item.bold();
        }
        if run.italic {
            item = item.italic();
        }
        if run.strike {
            item = item.strike();
        }
        if run.underline {
            item = item.underline("single");
        }
        if run.code {
            item = item.fonts(RunFonts::new().ascii("Consolas").hi_ansi("Consolas"));
        }
        paragraph.add_run(item)
    })
}

struct Writer<'a> {
    book: &'a Book,
    docx: Docx,
}

impl Writer<'_> {
    fn image(&self, asset_id: &str) -> Option<Pic> {
        let image = self
            .book
            .images
            .iter()
            .find(|image| image.asset_id == asset_id)?;
        picture(&image.bytes, text_box())
    }

    fn add(&mut self, paragraph: Paragraph) {
        let docx = std::mem::take(&mut self.docx);
        self.docx = docx.add_paragraph(paragraph);
    }

    fn blocks(&mut self, blocks: &[Block], indent: i32) {
        for block in blocks {
            match block {
                Block::Heading { level, runs: text } => {
                    let style = format!("Heading{}", level + 1);
                    self.add(runs(Paragraph::new().style(&style), text));
                }
                Block::Paragraph(text) => {
                    let paragraph = Paragraph::new().style("BookText");
                    let paragraph = if indent > 0 {
                        paragraph.indent(Some(indent), None, None, None)
                    } else {
                        paragraph
                    };
                    self.add(runs(paragraph, text));
                }
                Block::Quote(inner) => self.blocks(inner, indent + 567),
                Block::List { ordered, items } => {
                    for (index, item) in items.iter().enumerate() {
                        let mark = if *ordered {
                            format!("{}.\t", index + 1)
                        } else {
                            "•\t".to_owned()
                        };
                        // The mark, then the item's first paragraph after it.
                        let (first, rest) = match item.split_first() {
                            Some((Block::Paragraph(text), rest)) => (text.clone(), rest),
                            _ => (Vec::new(), item.as_slice()),
                        };
                        let paragraph = Paragraph::new()
                            .style("BookText")
                            .indent(
                                Some(indent + 567),
                                Some(SpecialIndentType::Hanging(283)),
                                None,
                                None,
                            )
                            .add_run(DocxRun::new().add_text(mark));
                        self.add(runs(paragraph, &first));
                        self.blocks(rest, indent + 567);
                    }
                }
                Block::Code(text) => {
                    let mut paragraph = Paragraph::new();
                    for (index, line) in text.split('\n').enumerate() {
                        let mut run = DocxRun::new()
                            .fonts(RunFonts::new().ascii("Consolas").hi_ansi("Consolas"));
                        if index > 0 {
                            run = run.add_break(BreakType::TextWrapping);
                        }
                        paragraph = paragraph.add_run(run.add_text(line));
                    }
                    self.add(paragraph);
                }
                Block::Rule => self.add(
                    Paragraph::new()
                        .align(AlignmentType::Center)
                        .add_run(DocxRun::new().add_text("*   *   *")),
                ),
                Block::Image { asset_id } => {
                    if let Some(pic) = self.image(asset_id) {
                        self.add(
                            Paragraph::new()
                                .align(AlignmentType::Center)
                                .add_run(DocxRun::new().add_image(pic)),
                        );
                    }
                }
            }
        }
    }
}

fn page_break() -> Paragraph {
    Paragraph::new().add_run(DocxRun::new().add_break(BreakType::Page))
}

/// The Word file of the book.
pub fn write(book: &Book) -> AppResult<Vec<u8>> {
    let font = font_name(&book.settings.font);
    let fonts = RunFonts::new().ascii(font).hi_ansi(font).cs(font);
    // Sizes in half points.
    let size = match book.settings.text_size {
        TextSize::Small => 20,
        TextSize::Medium => 22,
        TextSize::Large => 25,
    };
    let docx = Docx::new()
        .page_size(PAGE_WIDTH, PAGE_HEIGHT)
        .page_margin(PageMargin {
            top: MARGIN_Y,
            left: MARGIN_X,
            bottom: MARGIN_Y,
            right: MARGIN_X,
            header: 567,
            footer: 567,
            gutter: 0,
        })
        .default_fonts(fonts.clone())
        .default_size(size)
        .add_style(
            Style::new("BookText", StyleType::Paragraph)
                .name("Book Text")
                .align(AlignmentType::Both)
                .first_line_chars(100),
        )
        .add_style(
            Style::new("Heading1", StyleType::Paragraph)
                .name("Heading 1")
                .bold()
                .size(size * 17 / 10)
                .align(AlignmentType::Center)
                .outline_lvl(0),
        )
        .add_style(
            Style::new("Heading2", StyleType::Paragraph)
                .name("Heading 2")
                .bold()
                .size(size * 13 / 10)
                .outline_lvl(1),
        )
        .add_style(
            Style::new("Heading3", StyleType::Paragraph)
                .name("Heading 3")
                .bold()
                .size(size * 115 / 100)
                .outline_lvl(2),
        )
        .add_style(
            Style::new("Heading4", StyleType::Paragraph)
                .name("Heading 4")
                .bold()
                .size(size)
                .outline_lvl(3),
        )
        .footer(
            Footer::new().add_paragraph(
                Paragraph::new()
                    .align(AlignmentType::Center)
                    .add_page_num(PageNum::new()),
            ),
        );
    let mut writer = Writer { book, docx };

    if let Some(cover) = &book.cover
        && let Some(pic) = picture(cover, text_box())
    {
        writer.add(
            Paragraph::new()
                .align(AlignmentType::Center)
                .add_run(DocxRun::new().add_image(pic)),
        );
        writer.add(page_break());
    }
    writer.add(
        Paragraph::new().align(AlignmentType::Center).add_run(
            DocxRun::new()
                .add_text(book.title.clone())
                .bold()
                .size(size * 2),
        ),
    );
    for chapter in &book.chapters {
        writer.add(page_break());
        if let Some(header) = chapter.header.as_deref().and_then(|id| writer.image(id)) {
            writer.add(
                Paragraph::new()
                    .align(AlignmentType::Center)
                    .add_run(DocxRun::new().add_image(header)),
            );
        }
        writer.add(
            Paragraph::new()
                .style("Heading1")
                .add_run(DocxRun::new().add_text(chapter.title.clone())),
        );
        writer.blocks(&chapter.blocks, 0);
    }

    let mut out = std::io::Cursor::new(Vec::new());
    writer
        .docx
        .build()
        .pack(&mut out)
        .map_err(|error| AppError::Internal(format!("docx: {error}")))?;
    Ok(out.into_inner())
}
