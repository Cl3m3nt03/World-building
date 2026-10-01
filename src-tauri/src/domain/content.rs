//! A card's content: an ordered list of blocks, stored as JSON. The front
//! owns the blocks' inner shape (a TipTap document for a text block…); the
//! Rust side checks the outline, bounds the size, and derives the plain text
//! used by search.
//!
//! ```json
//! [{ "id": "…", "type": "text", "doc": { "type": "doc", "content": [ … ] } },
//!  { "id": "…", "type": "image", "images": [{ "id": "…", "assetId": "…", "caption": "…" }] }]
//! ```
//!
//! An image block is a gallery (M3 step 3.10). Blocks saved before hold one
//! image as `assetId` and `caption`, still read.

use serde_json::Value;

use crate::error::{AppError, AppResult};

/// Block types the app knows.
pub const BLOCK_TYPES: [&str; 4] = ["text", "image", "stats5e", "map"];
/// Largest content, in bytes of JSON.
pub const MAX_CONTENT_BYTES: usize = 4 * 1024 * 1024;
/// Most blocks in one card.
pub const MAX_BLOCKS: usize = 500;
/// Most images in one image block.
pub const MAX_GALLERY_IMAGES: usize = 50;

/// Checks the outline of `json` (an array of blocks with a unique string id
/// and a known type) and returns its blocks.
pub fn parse(json: &str) -> AppResult<Vec<Value>> {
    if json.len() > MAX_CONTENT_BYTES {
        return Err(AppError::InvalidInput(format!(
            "a card's content is at most {MAX_CONTENT_BYTES} bytes"
        )));
    }
    let value: Value = serde_json::from_str(json)
        .map_err(|error| AppError::InvalidInput(format!("content is not JSON: {error}")))?;
    let Value::Array(blocks) = value else {
        return Err(AppError::InvalidInput(
            "content must be a list of blocks".into(),
        ));
    };
    if blocks.len() > MAX_BLOCKS {
        return Err(AppError::InvalidInput(format!(
            "a card has at most {MAX_BLOCKS} blocks"
        )));
    }
    let mut ids: Vec<&str> = Vec::with_capacity(blocks.len());
    for block in &blocks {
        let id = block.get("id").and_then(Value::as_str).unwrap_or_default();
        let kind = block
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if id.is_empty() || ids.contains(&id) {
            return Err(AppError::InvalidInput(
                "every block needs a unique id".into(),
            ));
        }
        if !BLOCK_TYPES.contains(&kind) {
            return Err(AppError::InvalidInput(format!(
                "unknown block type: {kind}"
            )));
        }
        if kind == "image" {
            check_gallery(block)?;
        }
        ids.push(id);
    }
    Ok(blocks)
}

/// Checks the `images` of an image block, when it has some: a list of at
/// most [`MAX_GALLERY_IMAGES`] objects.
fn check_gallery(block: &Value) -> AppResult<()> {
    let Some(images) = block.get("images") else {
        return Ok(());
    };
    let Value::Array(images) = images else {
        return Err(AppError::InvalidInput(
            "an image block's images must be a list".into(),
        ));
    };
    if images.len() > MAX_GALLERY_IMAGES {
        return Err(AppError::InvalidInput(format!(
            "an image block has at most {MAX_GALLERY_IMAGES} images"
        )));
    }
    if !images.iter().all(Value::is_object) {
        return Err(AppError::InvalidInput(
            "every image of a block must be an object".into(),
        ));
    }
    Ok(())
}

/// Captions of an image block: those of its gallery, or the single caption
/// of a block saved before galleries.
fn captions(block: &Value) -> Vec<&str> {
    match block.get("images").and_then(Value::as_array) {
        Some(images) => images
            .iter()
            .filter_map(|image| image.get("caption").and_then(Value::as_str))
            .collect(),
        None => block
            .get("caption")
            .and_then(Value::as_str)
            .into_iter()
            .collect(),
    }
}

/// Text of a TipTap node: its text leaves, with a line break after each
/// block-level node (paragraph, heading, list item…).
fn node_text(node: &Value, out: &mut String) {
    if let Some(text) = node.get("text").and_then(Value::as_str) {
        out.push_str(text);
    }
    // A mention (M2 step 2.10) reads as its label.
    if node.get("type").and_then(Value::as_str) == Some("mention")
        && let Some(label) = node.pointer("/attrs/label").and_then(Value::as_str)
    {
        out.push_str(label);
    }
    if let Some(children) = node.get("content").and_then(Value::as_array) {
        for child in children {
            node_text(child, out);
        }
        if !out.ends_with('\n') {
            out.push('\n');
        }
    }
}

/// Adds to `out` the card ids of the mention nodes under `node`, once each.
fn node_mentions(node: &Value, out: &mut Vec<String>) {
    if node.get("type").and_then(Value::as_str) == Some("mention")
        && let Some(id) = node.pointer("/attrs/id").and_then(Value::as_str)
        && !id.is_empty()
        && !out.iter().any(|known| known == id)
    {
        out.push(id.to_owned());
    }
    if let Some(children) = node.get("content").and_then(Value::as_array) {
        for child in children {
            node_mentions(child, out);
        }
    }
}

/// Cards mentioned (`@`) in the text blocks, in order of first mention.
pub fn mentions(blocks: &[Value]) -> Vec<String> {
    let mut out = Vec::new();
    for block in blocks {
        if block.get("type").and_then(Value::as_str) == Some("text")
            && let Some(doc) = block.get("doc")
        {
            node_mentions(doc, &mut out);
        }
    }
    out
}

/// Plain text of the blocks, for search: text blocks and image captions.
pub fn plain_text(blocks: &[Value]) -> String {
    let mut out = String::new();
    for block in blocks {
        match block.get("type").and_then(Value::as_str) {
            Some("text") => {
                if let Some(doc) = block.get("doc") {
                    node_text(doc, &mut out);
                }
            }
            Some("image") => {
                for caption in captions(block) {
                    if !caption.trim().is_empty() {
                        out.push_str(caption.trim());
                        out.push('\n');
                    }
                }
            }
            _ => {}
        }
    }
    out.trim().to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn text_block(id: &str, text: &str) -> Value {
        serde_json::json!({
            "id": id,
            "type": "text",
            "doc": { "type": "doc", "content": [
                { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Titre" }] },
                { "type": "paragraph", "content": [
                    { "type": "text", "text": text },
                    { "type": "text", "marks": [{ "type": "bold" }], "text": " en gras" }
                ] }
            ] }
        })
    }

    #[test]
    fn outline_is_checked() {
        assert!(parse("[]").unwrap().is_empty());
        assert!(parse("{}").is_err());
        assert!(parse("not json").is_err());
        assert!(parse(r#"[{ "type": "text" }]"#).is_err());
        assert!(parse(r#"[{ "id": "a", "type": "video" }]"#).is_err());
        assert!(
            parse(r#"[{ "id": "a", "type": "text" }, { "id": "a", "type": "text" }]"#).is_err()
        );
        let too_big = format!("[{}]", " ".repeat(MAX_CONTENT_BYTES));
        assert!(parse(&too_big).is_err());
    }

    fn mention(id: &str, label: &str) -> Value {
        serde_json::json!({ "type": "mention", "attrs": { "id": id, "label": label } })
    }

    #[test]
    fn mentions_are_listed_once_in_order() {
        let blocks = vec![
            serde_json::json!({ "id": "a", "type": "text", "doc": { "type": "doc", "content": [
                { "type": "paragraph", "content": [
                    { "type": "text", "text": "Avec " }, mention("gandalf", "Gandalf"),
                    { "type": "text", "text": " et " }, mention("frodo", "Frodon"),
                ] },
                { "type": "bulletList", "content": [{ "type": "listItem", "content": [
                    { "type": "paragraph", "content": [mention("gandalf", "Gandalf")] }
                ] }] }
            ] } }),
            serde_json::json!({ "id": "b", "type": "image", "caption": "@sam" }),
        ];
        assert_eq!(mentions(&blocks), ["gandalf", "frodo"]);
        assert_eq!(plain_text(&blocks), "Avec Gandalf et Frodon\nGandalf\n@sam");
    }

    #[test]
    fn gallery_is_checked_and_its_captions_are_searched() {
        let image = |caption: &str| serde_json::json!({ "id": caption, "assetId": "x.png", "caption": caption });
        let gallery = serde_json::json!([{ "id": "g", "type": "image",
            "images": [image("Fondcombe"), image(" "), image("La vallée")] }]);
        let blocks = parse(&gallery.to_string()).unwrap();
        assert_eq!(plain_text(&blocks), "Fondcombe\nLa vallée");

        assert!(parse(r#"[{ "id": "g", "type": "image", "images": [] }]"#).is_ok());
        assert!(parse(r#"[{ "id": "g", "type": "image", "images": {} }]"#).is_err());
        assert!(parse(r#"[{ "id": "g", "type": "image", "images": ["x.png"] }]"#).is_err());
        let too_many: Vec<Value> = (0..=MAX_GALLERY_IMAGES)
            .map(|i| image(&i.to_string()))
            .collect();
        let too_many = serde_json::json!([{ "id": "g", "type": "image", "images": too_many }]);
        assert!(parse(&too_many.to_string()).is_err());
    }

    #[test]
    fn plain_text_reads_text_blocks_and_captions() {
        let blocks = vec![
            text_block("a", "Il était une fois"),
            serde_json::json!({ "id": "b", "type": "image", "assetId": "x.png", "caption": " La carte " }),
            serde_json::json!({ "id": "c", "type": "stats5e" }),
        ];
        assert_eq!(
            plain_text(&blocks),
            "Titre\nIl était une fois en gras\nLa carte"
        );
    }
}
