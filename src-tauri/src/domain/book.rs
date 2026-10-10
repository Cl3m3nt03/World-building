//! The book of a story, as the exports write it (M10, ADR 0010): the chapters
//! chosen, each from the draft chosen, read from their TipTap text into one
//! model that the ePub, PDF and Word writers share. Mentions become their
//! text; notes and sounds are not exported.

use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;
use sqlx::SqlitePool;

use crate::db::quill as queries;
use crate::domain::quill::reader::ChapterLayout;
use crate::domain::quill::{ReaderSettings, reader_settings};
use crate::error::{AppError, AppResult};
use crate::world::assets;

pub mod epub;
pub mod pdf;

/// The formats a story is exported to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ExportFormat {
    Epub,
    Pdf,
}

impl ExportFormat {
    /// The file extension of the format.
    pub fn extension(self) -> &'static str {
        match self {
            Self::Epub => "epub",
            Self::Pdf => "pdf",
        }
    }
}

/// A chapter to export, and the draft to take its text from.
#[derive(Debug, Clone, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ExportChapter {
    pub chapter_id: String,
    pub draft_id: String,
}

/// A piece of text with its look.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Run {
    pub text: String,
    pub bold: bool,
    pub italic: bool,
    pub strike: bool,
    pub underline: bool,
    pub code: bool,
    /// A line break (the text is empty).
    pub line_break: bool,
}

/// A block of a chapter's text.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Block {
    Heading {
        level: u8,
        runs: Vec<Run>,
    },
    Paragraph(Vec<Run>),
    Quote(Vec<Block>),
    List {
        ordered: bool,
        items: Vec<Vec<Block>>,
    },
    Code(String),
    Rule,
    Image {
        asset_id: String,
    },
}

/// An image of the book: its file in the world's media library.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BookImage {
    pub asset_id: String,
    pub bytes: Vec<u8>,
    pub mime: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BookChapter {
    pub title: String,
    /// The image over the chapter's title (none if its layout has none).
    pub header: Option<String>,
    pub blocks: Vec<Block>,
}

/// What a writer needs to make the file.
#[derive(Debug, Clone)]
pub struct Book {
    pub title: String,
    /// The language of the text (the app's), as a BCP 47 tag.
    pub language: String,
    pub settings: ReaderSettings,
    /// The cover, drawn by the front (PNG).
    pub cover: Option<Vec<u8>>,
    pub chapters: Vec<BookChapter>,
    /// The images of the chapters (headers and in the text), each once.
    pub images: Vec<BookImage>,
}

fn invalid(message: impl Into<String>) -> AppError {
    AppError::InvalidInput(message.into())
}

fn runs(node: &Value, marks: &Run, out: &mut Vec<Run>) {
    match node.get("type").and_then(Value::as_str) {
        Some("text") => {
            let mut run = marks.clone();
            run.text = node
                .get("text")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_owned();
            for mark in node
                .get("marks")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
            {
                match mark.get("type").and_then(Value::as_str) {
                    Some("bold") => run.bold = true,
                    Some("italic") => run.italic = true,
                    Some("strike") => run.strike = true,
                    Some("underline") => run.underline = true,
                    Some("code") => run.code = true,
                    _ => {}
                }
            }
            if !run.text.is_empty() {
                out.push(run);
            }
        }
        Some("mention") => {
            let label = node
                .pointer("/attrs/label")
                .and_then(Value::as_str)
                .unwrap_or_default();
            if !label.is_empty() {
                out.push(Run {
                    text: label.to_owned(),
                    ..marks.clone()
                });
            }
        }
        Some("hardBreak") => out.push(Run {
            line_break: true,
            ..Run::default()
        }),
        _ => {
            for child in children(node) {
                runs(child, marks, out);
            }
        }
    }
}

fn children(node: &Value) -> impl Iterator<Item = &Value> {
    node.get("content")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
}

fn inline(node: &Value) -> Vec<Run> {
    let mut out = Vec::new();
    for child in children(node) {
        runs(child, &Run::default(), &mut out);
    }
    out
}

fn plain(node: &Value) -> String {
    inline(node)
        .into_iter()
        .map(|run| {
            if run.line_break {
                "\n".to_owned()
            } else {
                run.text
            }
        })
        .collect()
}

fn block(node: &Value) -> Option<Block> {
    match node.get("type").and_then(Value::as_str)? {
        "paragraph" => Some(Block::Paragraph(inline(node))),
        "heading" => {
            let level = node
                .pointer("/attrs/level")
                .and_then(Value::as_u64)
                .unwrap_or(1)
                .clamp(1, 3);
            Some(Block::Heading {
                level: u8::try_from(level).unwrap_or(1),
                runs: inline(node),
            })
        }
        "blockquote" => Some(Block::Quote(blocks(node))),
        kind @ ("bulletList" | "orderedList") => Some(Block::List {
            ordered: kind == "orderedList",
            items: children(node).map(blocks).collect(),
        }),
        "codeBlock" => Some(Block::Code(plain(node))),
        "horizontalRule" => Some(Block::Rule),
        "image" => {
            let id = node.pointer("/attrs/assetId").and_then(Value::as_str)?;
            assets::is_valid_id(id).then(|| Block::Image {
                asset_id: id.to_owned(),
            })
        }
        _ => {
            let runs = inline(node);
            (!runs.is_empty()).then_some(Block::Paragraph(runs))
        }
    }
}

fn blocks(node: &Value) -> Vec<Block> {
    children(node).filter_map(block).collect()
}

/// The blocks of a draft's text (its TipTap JSON). A text that cannot be
/// read gives no block.
pub fn read_text(content: &str) -> Vec<Block> {
    serde_json::from_str::<Value>(content)
        .map(|doc| blocks(&doc))
        .unwrap_or_default()
}

/// The images a chapter shows: its header, then those in its text.
fn chapter_images(chapter: &BookChapter) -> Vec<String> {
    fn walk(blocks: &[Block], out: &mut Vec<String>) {
        for block in blocks {
            match block {
                Block::Image { asset_id } => out.push(asset_id.clone()),
                Block::Quote(inner) => walk(inner, out),
                Block::List { items, .. } => {
                    for item in items {
                        walk(item, out);
                    }
                }
                _ => {}
            }
        }
    }
    let mut out: Vec<String> = chapter.header.iter().cloned().collect();
    walk(&chapter.blocks, &mut out);
    out
}

fn image_mime(asset_id: &str) -> Option<&'static str> {
    let extension = asset_id.rsplit('.').next()?.to_ascii_lowercase();
    match extension.as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "svg" => Some("image/svg+xml"),
        _ => None,
    }
}

/// The book of a story: its chapters in the order asked, each from the draft
/// asked (which must be one of the chapter's), with their images read from
/// the media library (one that is gone is left out).
pub async fn load(
    pool: &SqlitePool,
    assets_dir: &Path,
    story_id: &str,
    chosen: &[ExportChapter],
    language: &str,
    cover: Option<Vec<u8>>,
) -> AppResult<Book> {
    let story = queries::story(pool, story_id)
        .await?
        .ok_or_else(|| invalid(format!("story not found: {story_id}")))?;
    if chosen.is_empty() {
        return Err(invalid("an export holds at least one chapter"));
    }
    let settings = reader_settings(pool, story_id).await?;
    let with_image = settings.chapter_layout != ChapterLayout::NoImage;
    let mut chapters = Vec::with_capacity(chosen.len());
    for item in chosen {
        let chapter = queries::chapter(pool, &item.chapter_id)
            .await?
            .filter(|chapter| chapter.story_id == story_id)
            .ok_or_else(|| invalid(format!("chapter not in the story: {}", item.chapter_id)))?;
        let draft = queries::draft(pool, &item.draft_id)
            .await?
            .filter(|draft| draft.chapter_id == chapter.id)
            .ok_or_else(|| invalid(format!("draft not in the chapter: {}", item.draft_id)))?;
        chapters.push(BookChapter {
            title: chapter.title,
            header: chapter
                .header_asset_id
                .filter(|id| with_image && assets::is_valid_id(id)),
            blocks: read_text(&draft.content),
        });
    }
    let mut images: Vec<BookImage> = Vec::new();
    for asset_id in chapters.iter().flat_map(chapter_images) {
        if images.iter().any(|image| image.asset_id == asset_id) {
            continue;
        }
        let Some(mime) = image_mime(&asset_id) else {
            continue;
        };
        if let Ok(bytes) = tokio::fs::read(assets_dir.join(&asset_id)).await {
            images.push(BookImage {
                asset_id,
                bytes,
                mime,
            });
        }
    }
    // An image that could not be read is not shown.
    let known = |id: &str| images.iter().any(|image| image.asset_id == id);
    for chapter in &mut chapters {
        if chapter.header.as_deref().is_some_and(|id| !known(id)) {
            chapter.header = None;
        }
        drop_images(&mut chapter.blocks, &known);
    }
    Ok(Book {
        title: story.title,
        language: language.to_owned(),
        settings,
        cover,
        chapters,
        images,
    })
}

fn drop_images(blocks: &mut Vec<Block>, known: &dyn Fn(&str) -> bool) {
    blocks.retain(|block| match block {
        Block::Image { asset_id } => known(asset_id),
        _ => true,
    });
    for block in blocks {
        match block {
            Block::Quote(inner) => drop_images(inner, known),
            Block::List { items, .. } => {
                for item in items {
                    drop_images(item, known);
                }
            }
            _ => {}
        }
    }
}

/// The path to write to: the one chosen, with the format's extension.
pub fn target(path: &str, format: ExportFormat) -> AppResult<std::path::PathBuf> {
    let path = Path::new(path);
    if !path.is_absolute() {
        return Err(invalid(format!("not an absolute path: {}", path.display())));
    }
    let extension = format.extension();
    let has = path
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case(extension));
    Ok(if has {
        path.to_path_buf()
    } else {
        let mut name = path.as_os_str().to_owned();
        name.push(format!(".{extension}"));
        name.into()
    })
}

/// Writes the book in `format` to `path` (made at once, written whole).
pub fn write(book: &Book, format: ExportFormat, path: &Path) -> AppResult<()> {
    let bytes = match format {
        ExportFormat::Epub => epub::write(book)?,
        ExportFormat::Pdf => pdf::write(book)?,
    };
    if let Some(parent) = path.parent()
        && !parent.as_os_str().is_empty()
    {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, bytes)?;
    Ok(())
}

#[cfg(test)]
mod tests;
