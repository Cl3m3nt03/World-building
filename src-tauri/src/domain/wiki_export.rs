//! Export of the wiki as a static site (M8, ADR 0008). The front renders the
//! pages; this places the site's folder, checks every path written in it,
//! and copies the images from the world.

use std::path::{Component, Path, PathBuf};

use serde::Deserialize;
use specta::Type;

use crate::error::{AppError, AppResult};
use crate::world::assets;

/// Largest file of the site (a page, the search index, the fonts' CSS).
pub const MAX_FILE_BYTES: usize = 32 * 1024 * 1024;

/// Longest path of a file in the site.
const MAX_PATH_LEN: usize = 200;

/// Longest folder name taken from the wiki's title.
const MAX_NAME_CHARS: usize = 80;

/// A text file of the site: its path in the site's folder, and its content.
#[derive(Debug, Clone, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SiteFile {
    pub path: String,
    pub content: String,
}

fn invalid(message: impl Into<String>) -> AppError {
    AppError::InvalidInput(message.into())
}

/// A folder name from the wiki's title: the characters Windows refuses and
/// the trailing dots and spaces go, a reserved name or nothing gives "wiki".
pub fn folder_name(title: &str) -> String {
    let cleaned: String = title
        .chars()
        .map(|c| {
            if c.is_control() || r#"<>:"/\|?*"#.contains(c) {
                ' '
            } else {
                c
            }
        })
        .collect();
    let words = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    let short: String = words.chars().take(MAX_NAME_CHARS).collect();
    let name = short.trim_end_matches(['.', ' ']).to_string();
    let upper = name.to_uppercase();
    let reserved = ["CON", "PRN", "AUX", "NUL"].contains(&upper.as_str())
        || ((upper.starts_with("COM") || upper.starts_with("LPT"))
            && upper.len() == 4
            && upper.as_bytes()[3].is_ascii_digit());
    if name.is_empty() || reserved {
        "wiki".into()
    } else {
        format!("{name} - wiki")
    }
}

/// The site's folder: a folder named after the wiki in `parent`, an existing
/// folder chosen by the user.
pub fn site_dir(parent: &Path, title: &str) -> AppResult<PathBuf> {
    if !parent.is_absolute() || !parent.is_dir() {
        return Err(invalid(format!("not a folder: {}", parent.display())));
    }
    Ok(parent.join(folder_name(title)))
}

/// Where a file of the site goes: `relative` must stay in the site's folder
/// (letters, digits, `.`, `_`, `-` and `/` only; no part starting with a dot,
/// so no `..`).
pub fn file_path(dir: &Path, relative: &str) -> AppResult<PathBuf> {
    let allowed = |c: char| c.is_ascii_alphanumeric() || "._-/".contains(c);
    if relative.len() > MAX_PATH_LEN
        || !relative.chars().all(allowed)
        || relative.split('/').any(str::is_empty)
    {
        return Err(invalid(format!("invalid path in the site: {relative:?}")));
    }
    let path = Path::new(relative);
    for component in path.components() {
        match component {
            Component::Normal(part) if !part.to_string_lossy().starts_with('.') => {}
            _ => return Err(invalid(format!("invalid path in the site: {relative:?}"))),
        }
    }
    Ok(dir.join(path))
}

/// Writes text files of the site in `dir`.
pub fn write_files(dir: &Path, files: &[SiteFile]) -> AppResult<()> {
    // Every path is checked before anything is written.
    let targets = files
        .iter()
        .map(|file| {
            if file.content.len() > MAX_FILE_BYTES {
                return Err(invalid(format!("file too large: {}", file.path)));
            }
            file_path(dir, &file.path)
        })
        .collect::<AppResult<Vec<_>>>()?;
    for (file, target) in files.iter().zip(targets) {
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(target, &file.content)?;
    }
    Ok(())
}

/// Characters of an image's hash kept in its name in the site: short names
/// keep the paths under Windows' 260 characters, deep folders included.
const SHORT_HASH: usize = 16;

/// An image's file name in the site's `assets/`: the start of its hash, and
/// its extension (the front names it the same way, `assetFile`).
pub fn site_asset_name(id: &str) -> String {
    match id.split_once('.') {
        Some((hash, extension)) => format!("{}.{extension}", &hash[..SHORT_HASH.min(hash.len())]),
        None => id[..SHORT_HASH.min(id.len())].to_string(),
    }
}

/// Copies the world's images `ids` into `dir/assets/`. An image no longer in
/// the world is skipped. Returns how many were copied.
pub fn copy_assets(world_assets: &Path, dir: &Path, ids: &[String]) -> AppResult<u32> {
    let target = dir.join("assets");
    std::fs::create_dir_all(&target)?;
    let mut copied = 0;
    for id in ids {
        let source = assets::resolve(world_assets, id)?;
        if source.is_file() {
            std::fs::copy(&source, target.join(site_asset_name(id)))?;
            copied += 1;
        }
    }
    Ok(copied)
}

#[cfg(test)]
mod tests;
