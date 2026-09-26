//! Files imported into a world, stored in `assets/` under their content hash:
//! `<sha256>.<ext>`. Importing the same file twice stores it once.
//!
//! An asset id is exactly that file name. Ids are validated strictly before
//! any disk access, so an id can never point outside `assets/`.

use std::fs::File;
use std::io::{BufReader, Read, Write};
use std::path::{Path, PathBuf};

use serde::Serialize;
use sha2::{Digest, Sha256};
use specta::Type;
use uuid::Uuid;

use crate::error::{AppError, AppResult};

/// Longest accepted file extension.
const MAX_EXTENSION_LEN: usize = 10;

/// An imported file.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AssetInfo {
    /// `<sha256>.<ext>`: file name in `assets/`, used by `useAssetUrl`.
    pub id: String,
    /// Name of the imported file, for display.
    pub original_name: String,
    /// Size in bytes (u32 is not enough, and u64 has no safe JS type).
    pub size: f64,
    /// False when the same content was already in the world.
    pub created: bool,
}

/// Lower-case extension of `path`, if it is short and alphanumeric.
fn extension_of(path: &Path) -> Option<String> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    let valid = !extension.is_empty()
        && extension.len() <= MAX_EXTENSION_LEN
        && extension.bytes().all(|byte| byte.is_ascii_alphanumeric());
    valid.then_some(extension)
}

/// True if `id` has the exact shape of an asset id.
pub fn is_valid_id(id: &str) -> bool {
    let (hash, extension) = match id.split_once('.') {
        Some((hash, extension)) => (hash, Some(extension)),
        None => (id, None),
    };
    let hash_ok = hash.len() == 64
        && hash
            .bytes()
            .all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f'));
    let extension_ok = extension.is_none_or(|extension| {
        !extension.is_empty()
            && extension.len() <= MAX_EXTENSION_LEN
            && extension
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
    });
    hash_ok && extension_ok
}

/// Path of the asset `id` inside `assets_dir`. Refuses anything that is not a
/// well-formed id, or that would resolve outside `assets_dir`.
pub fn resolve(assets_dir: &Path, id: &str) -> AppResult<PathBuf> {
    if !is_valid_id(id) {
        return Err(AppError::InvalidInput(format!("invalid asset id: {id:?}")));
    }
    let path = assets_dir.join(id);
    // Defense in depth: the id format already excludes separators and "..".
    if path.parent() != Some(assets_dir) {
        return Err(AppError::InvalidInput(format!(
            "asset outside assets/: {id:?}"
        )));
    }
    Ok(path)
}

/// Copies `source` into `assets_dir` under its content hash.
pub fn import(assets_dir: &Path, source: &Path) -> AppResult<AssetInfo> {
    if !source.is_file() {
        return Err(AppError::InvalidInput(format!(
            "not a file: {}",
            source.display()
        )));
    }
    let original_name = source
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();
    std::fs::create_dir_all(assets_dir)?;

    // Hash while copying into a temporary file, then move it into place.
    let tmp = assets_dir.join(format!(".import-{}.tmp", Uuid::new_v4()));
    let (hash, size) = match copy_hashing(source, &tmp) {
        Ok(result) => result,
        Err(error) => {
            let _ = std::fs::remove_file(&tmp);
            return Err(error);
        }
    };

    let id = match extension_of(source) {
        Some(extension) => format!("{hash}.{extension}"),
        None => hash,
    };
    let target = resolve(assets_dir, &id)?;
    let created = if target.exists() {
        std::fs::remove_file(&tmp)?;
        false
    } else {
        std::fs::rename(&tmp, &target)?;
        true
    };

    tracing::info!(%id, created, size, "asset imported");
    Ok(AssetInfo {
        id,
        original_name,
        size: size as f64,
        created,
    })
}

fn copy_hashing(source: &Path, target: &Path) -> AppResult<(String, u64)> {
    let mut reader = BufReader::new(File::open(source)?);
    let mut writer = File::create_new(target)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; 64 * 1024];
    let mut size = 0_u64;
    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
        writer.write_all(&buffer[..read])?;
        size += read as u64;
    }
    writer.sync_all()?;
    let hash = hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    Ok((hash, size))
}

/// MIME type served for an asset, from its extension.
pub fn mime_type(id: &str) -> &'static str {
    match id.rsplit_once('.').map(|(_, extension)| extension) {
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("avif") => "image/avif",
        Some("bmp") => "image/bmp",
        Some("ico") => "image/x-icon",
        Some("svg") => "image/svg+xml",
        Some("mp3") => "audio/mpeg",
        Some("ogg" | "oga") => "audio/ogg",
        Some("wav") => "audio/wav",
        Some("flac") => "audio/flac",
        Some("m4a") => "audio/mp4",
        Some("mp4") => "video/mp4",
        Some("webm") => "video/webm",
        Some("pdf") => "application/pdf",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const HELLO_SHA256: &str = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

    fn setup() -> (tempfile::TempDir, PathBuf, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let assets = dir.path().join("assets");
        let source = dir.path().join("Portrait.PNG");
        std::fs::write(&source, "hello").unwrap();
        (dir, assets, source)
    }

    #[test]
    fn import_names_the_file_by_hash_and_extension() {
        let (_dir, assets, source) = setup();

        let asset = import(&assets, &source).unwrap();

        assert_eq!(asset.id, format!("{HELLO_SHA256}.png"));
        assert_eq!(asset.original_name, "Portrait.PNG");
        assert_eq!(asset.size, 5.0);
        assert!(asset.created);
        assert_eq!(std::fs::read(assets.join(&asset.id)).unwrap(), b"hello");
    }

    #[test]
    fn importing_the_same_content_twice_stores_it_once() {
        let (dir, assets, source) = setup();
        let copy = dir.path().join("copy.png");
        std::fs::copy(&source, &copy).unwrap();

        let first = import(&assets, &source).unwrap();
        let second = import(&assets, &copy).unwrap();

        assert_eq!(first.id, second.id);
        assert!(!second.created);
        let files: Vec<_> = std::fs::read_dir(&assets).unwrap().collect();
        assert_eq!(
            files.len(),
            1,
            "no duplicate and no leftover temporary file"
        );
    }

    #[test]
    fn import_drops_odd_extensions() {
        let (dir, assets, _) = setup();
        let weird = dir.path().join("notes.tar gz");
        std::fs::write(&weird, "hello").unwrap();
        let bare = dir.path().join("README");
        std::fs::write(&bare, "hello").unwrap();

        assert_eq!(import(&assets, &weird).unwrap().id, HELLO_SHA256);
        assert_eq!(import(&assets, &bare).unwrap().id, HELLO_SHA256);
    }

    #[test]
    fn import_refuses_a_folder_or_a_missing_file() {
        let (dir, assets, _) = setup();
        assert!(matches!(
            import(&assets, dir.path()),
            Err(AppError::InvalidInput(_))
        ));
        assert!(matches!(
            import(&assets, &dir.path().join("missing.png")),
            Err(AppError::InvalidInput(_))
        ));
    }

    #[test]
    fn resolve_accepts_only_well_formed_ids() {
        let assets = Path::new("C:\\World\\assets");
        let id = format!("{HELLO_SHA256}.png");
        assert_eq!(resolve(assets, &id).unwrap(), assets.join(&id));
        assert!(resolve(assets, HELLO_SHA256).is_ok());

        for bad in [
            "../world.db",
            "..\\world.db",
            "world.db",
            "C:\\Windows\\win.ini",
            "/etc/passwd",
            "",
            &format!("{HELLO_SHA256}.PNG"),
            &format!("{HELLO_SHA256}.png/../../world.db"),
            &format!("{HELLO_SHA256}."),
            &format!("{HELLO_SHA256}.verylongextension"),
            &HELLO_SHA256[..63],
            &HELLO_SHA256.to_uppercase(),
            ".import-1234.tmp",
        ] {
            assert!(
                matches!(resolve(assets, bad), Err(AppError::InvalidInput(_))),
                "{bad:?} must be refused"
            );
        }
    }

    #[test]
    fn mime_types_follow_the_extension() {
        assert_eq!(mime_type(&format!("{HELLO_SHA256}.png")), "image/png");
        assert_eq!(mime_type(&format!("{HELLO_SHA256}.jpeg")), "image/jpeg");
        assert_eq!(mime_type(HELLO_SHA256), "application/octet-stream");
    }
}
