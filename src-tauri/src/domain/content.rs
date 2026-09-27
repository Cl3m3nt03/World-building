//! A card's content: an ordered list of blocks, stored as JSON. The front
//! owns the blocks' inner shape (a TipTap document for a text block…); the
//! Rust side checks the outline, bounds the size, and derives the plain text
//! used by search.
//!
//! ```json
//! [{ "id": "…", "type": "text", "doc": { "type": "doc", "content": [ … ] } },
//!  { "id": "…", "type": "image", "assetId": "…", "caption": "…" }]
//! ```

use serde_json::Value;

use crate::error::{AppError, AppResult};

/// Block types the app knows.
pub const BLOCK_TYPES: [&str; 4] = ["text", "image", "stats5e", "map"];
/// Largest content, in bytes of JSON.
pub const MAX_CONTENT_BYTES: usize = 4 * 1024 * 1024;
/// Most blocks in one card.
pub const MAX_BLOCKS: usize = 500;

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
        ids.push(id);
    }
    Ok(blocks)
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
                if let Some(caption) = block.get("caption").and_then(Value::as_str)
                    && !caption.trim().is_empty()
                {
                    out.push_str(caption.trim());
                    out.push('\n');
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
