//! Sidebar search (M3 step 3.7, docs/features/02-organisation.md): the live
//! documents whose name, alias or content holds every word typed, as
//! prefixes, accents and case ignored (FTS5 index, migration 0008).

use serde::Serialize;
use specta::Type;
use sqlx::SqlitePool;

use crate::db::search::{self as queries, HitRow};
use crate::domain::documents::DocumentKind;
use crate::error::AppResult;

#[cfg(test)]
mod tests;

/// Around a matched word in the highlighted texts the index gives back:
/// private use characters, never typed in a world.
const MARK_START: &str = "\u{E000}";
const MARK_END: &str = "\u{E001}";
/// Most name matches, then most content matches, returned.
const MAX_HITS: i64 = 30;
/// Most words of a query taken into account.
const MAX_WORDS: usize = 12;

/// A piece of text, matched by the query or not (to highlight it).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TextPart {
    pub text: String,
    pub matched: bool,
}

/// Where a document matched.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum SearchMatch {
    /// Its name.
    Name,
    /// One of its aliases (the first that matched).
    Alias { alias: Vec<TextPart> },
    /// Its content: an excerpt around the words.
    Content { excerpt: Vec<TextPart> },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub id: String,
    pub kind: DocumentKind,
    /// The name, with the matched words.
    pub title: Vec<TextPart>,
    pub type_id: Option<String>,
    pub image_asset_id: Option<String>,
    #[serde(rename = "match")]
    pub matched: SearchMatch,
}

/// The FTS5 expression for what was typed: every word, as a prefix
/// (`"elf"*`). `None` when nothing searchable was typed.
fn expression(query: &str) -> Option<String> {
    let words: Vec<String> = query
        .split_whitespace()
        .map(|word| word.replace('"', ""))
        .filter(|word| word.chars().any(char::is_alphanumeric))
        .take(MAX_WORDS)
        .map(|word| format!("\"{word}\"*"))
        .collect();
    (!words.is_empty()).then(|| words.join(" "))
}

/// Splits a highlighted text into matched and plain parts.
fn parts(marked: &str) -> Vec<TextPart> {
    let mut result = Vec::new();
    for (index, piece) in marked.split(MARK_START).enumerate() {
        // Before the first mark: plain. After each: matched up to its end.
        let (matched, rest) = if index == 0 {
            ("", piece)
        } else {
            piece.split_once(MARK_END).unwrap_or((piece, ""))
        };
        if !matched.is_empty() {
            result.push(TextPart {
                text: matched.to_owned(),
                matched: true,
            });
        }
        if !rest.is_empty() {
            result.push(TextPart {
                text: rest.to_owned(),
                matched: false,
            });
        }
    }
    result
}

/// The first alias holding a matched word, from the highlighted aliases
/// (the stored JSON array with marks inside its strings).
fn matched_alias(aliases_marked: &str) -> Option<Vec<TextPart>> {
    let aliases: Vec<String> = serde_json::from_str(aliases_marked).ok()?;
    aliases
        .iter()
        .find(|alias| alias.contains(MARK_START))
        .map(|alias| parts(alias))
}

fn hit(row: HitRow, matched: SearchMatch) -> AppResult<SearchHit> {
    Ok(SearchHit {
        id: row.id,
        kind: DocumentKind::parse(&row.kind)?,
        title: parts(&row.title_marked),
        type_id: row.type_id,
        image_asset_id: row.image_asset_id,
        matched,
    })
}

/// Live documents matching `query`: those matching by name or alias first,
/// then by content, each with an excerpt.
pub async fn search(pool: &SqlitePool, query: &str) -> AppResult<Vec<SearchHit>> {
    let Some(expression) = expression(query) else {
        return Ok(Vec::new());
    };
    let names = queries::matching(
        pool,
        &format!("{{title aliases}} : ({expression})"),
        MARK_START,
        MARK_END,
        MAX_HITS,
    )
    .await?;
    let contents = queries::matching(
        pool,
        &format!("content : ({expression})"),
        MARK_START,
        MARK_END,
        MAX_HITS,
    )
    .await?;

    let mut hits = Vec::with_capacity(names.len() + contents.len());
    for row in names {
        let matched = if row.title_marked.contains(MARK_START) {
            SearchMatch::Name
        } else {
            match matched_alias(&row.aliases_marked) {
                Some(alias) => SearchMatch::Alias { alias },
                None => SearchMatch::Name,
            }
        };
        hits.push(hit(row, matched)?);
    }
    for row in contents {
        if hits.iter().any(|found| found.id == row.id) {
            continue;
        }
        let excerpt = parts(&row.excerpt);
        hits.push(hit(row, SearchMatch::Content { excerpt })?);
    }
    Ok(hits)
}
