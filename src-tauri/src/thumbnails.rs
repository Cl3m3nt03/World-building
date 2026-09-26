//! World thumbnails for the world list: a reduced copy of each world's main
//! image, cached in `<config dir>/thumbnails/<world id>.png`, so the list can
//! show it without opening the world. Served by the `bzthumb://` protocol.

use std::path::{Path, PathBuf};

use image::imageops::FilterType;
use uuid::Uuid;

use crate::error::{AppError, AppResult};

pub const SCHEME: &str = "bzthumb";
const DIR: &str = "thumbnails";
/// Longest side of a thumbnail, in pixels.
pub const MAX_SIDE: u32 = 640;

/// Path of the thumbnail of `world_id`. Refuses anything but a UUID, so the
/// id can never point outside the thumbnails folder.
pub fn path(config_dir: &Path, world_id: &str) -> AppResult<PathBuf> {
    let id = Uuid::parse_str(world_id)
        .map_err(|_| AppError::InvalidInput(format!("invalid world id: {world_id:?}")))?;
    Ok(config_dir
        .join(DIR)
        .join(format!("{}.png", id.hyphenated())))
}

/// Writes (from `source`, an image file) or removes (`None`) the thumbnail
/// of `world_id`. Returns whether a thumbnail now exists.
pub fn refresh(config_dir: &Path, world_id: &str, source: Option<&Path>) -> AppResult<bool> {
    let target = path(config_dir, world_id)?;
    let Some(source) = source else {
        match std::fs::remove_file(&target) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
        return Ok(false);
    };

    let image = image::open(source)
        .map_err(|error| AppError::InvalidInput(format!("unreadable image: {error}")))?;
    // Only shrink: `resize` would also enlarge a small image.
    let thumbnail = if image.width() > MAX_SIDE || image.height() > MAX_SIDE {
        image.resize(MAX_SIDE, MAX_SIDE, FilterType::Triangle)
    } else {
        image
    };

    if let Some(dir) = target.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let tmp = target.with_extension("png.tmp");
    thumbnail
        .save_with_format(&tmp, image::ImageFormat::Png)
        .map_err(|error| AppError::Io(format!("cannot write thumbnail: {error}")))?;
    std::fs::rename(&tmp, &target)?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    const ID: &str = "5f0c4ba6-1f55-4c0e-9d6c-3f1a2a8e6c11";

    fn write_image(path: &Path, width: u32, height: u32) {
        image::RgbImage::from_pixel(width, height, image::Rgb([200, 120, 40]))
            .save(path)
            .unwrap();
    }

    #[test]
    fn a_large_image_is_reduced_keeping_its_ratio() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("map.png");
        write_image(&source, 2000, 1000);

        assert!(refresh(dir.path(), ID, Some(&source)).unwrap());

        let thumbnail = image::open(path(dir.path(), ID).unwrap()).unwrap();
        assert_eq!((thumbnail.width(), thumbnail.height()), (640, 320));
    }

    #[test]
    fn a_small_image_is_not_enlarged() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("icon.png");
        write_image(&source, 100, 80);

        refresh(dir.path(), ID, Some(&source)).unwrap();

        let thumbnail = image::open(path(dir.path(), ID).unwrap()).unwrap();
        assert!(thumbnail.width() <= 100 && thumbnail.height() <= 80);
    }

    #[test]
    fn none_removes_the_thumbnail() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("a.png");
        write_image(&source, 10, 10);
        refresh(dir.path(), ID, Some(&source)).unwrap();

        assert!(!refresh(dir.path(), ID, None).unwrap());
        assert!(!path(dir.path(), ID).unwrap().exists());
        assert!(!refresh(dir.path(), ID, None).unwrap(), "idempotent");
    }

    #[test]
    fn only_uuids_are_accepted() {
        let dir = tempfile::tempdir().unwrap();
        for bad in ["../settings", "abc", "", "5f0c4ba6/../x"] {
            assert!(
                matches!(path(dir.path(), bad), Err(AppError::InvalidInput(_))),
                "{bad}"
            );
        }
    }

    #[test]
    fn an_unreadable_image_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("broken.png");
        std::fs::write(&source, b"not an image").unwrap();

        assert!(matches!(
            refresh(dir.path(), ID, Some(&source)),
            Err(AppError::InvalidInput(_))
        ));
        assert!(!path(dir.path(), ID).unwrap().exists());
    }
}
