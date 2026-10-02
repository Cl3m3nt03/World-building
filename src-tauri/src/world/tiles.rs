//! Tiles of very large map backgrounds (M4 step 4.3): beyond
//! [`TILE_THRESHOLD`] px on a side, the image is cut once into a pyramid of
//! 256 px JPEG tiles, in `tiles/<map id>/<z>/<x>/<y>.jpg` under the world
//! folder, so that the map stays fluid. Level `z = 0` is the image at full
//! size, `z = -1` half of it, and so on, as Leaflet numbers zooms in
//! `CRS.Simple` (one image pixel per unit at zoom 0).

use std::path::{Path, PathBuf};

use image::imageops::FilterType;
use image::{GenericImageView, RgbImage};

use crate::error::{AppError, AppResult};

/// Folder of the tiles, in the world folder.
pub const TILES_DIR: &str = "tiles";
/// Side of a tile, in px.
pub const TILE_SIZE: u32 = 256;
/// Images larger than this on a side are tiled.
pub const TILE_THRESHOLD: u32 = 8_000;
/// JPEG quality of the tiles.
const QUALITY: u8 = 85;

/// Whether an image of this size is tiled.
pub fn needs_tiles(width: u32, height: u32) -> bool {
    width.max(height) > TILE_THRESHOLD
}

/// How many levels under the full size: until the whole image fits in a tile.
pub fn levels_below(width: u32, height: u32) -> u32 {
    let mut side = width.max(height);
    let mut levels = 0;
    while side > TILE_SIZE {
        side = side.div_ceil(2);
        levels += 1;
    }
    levels
}

/// Folder of a map's tiles. `map_id` is checked to be a UUID.
pub fn dir(world_root: &Path, map_id: &str) -> AppResult<PathBuf> {
    if uuid::Uuid::parse_str(map_id).is_err() {
        return Err(AppError::InvalidInput(format!("not a map id: {map_id}")));
    }
    Ok(world_root.join(TILES_DIR).join(map_id))
}

/// Path of one tile (`<z>/<x>/<y>.jpg`), checked strictly before any disk
/// access: numbers only, so it cannot leave the map's tiles folder.
pub fn resolve(world_root: &Path, map_id: &str, tile: &str) -> AppResult<PathBuf> {
    let refused = || AppError::InvalidInput(format!("not a tile: {tile}"));
    let parts: Vec<&str> = tile.split('/').collect();
    let [z, x, y] = parts.as_slice() else {
        return Err(refused());
    };
    let y = y.strip_suffix(".jpg").ok_or_else(refused)?;
    let z: i32 = z.parse().map_err(|_| refused())?;
    let x: u32 = x.parse().map_err(|_| refused())?;
    let y: u32 = y.parse().map_err(|_| refused())?;
    if z > 0 {
        return Err(refused());
    }
    Ok(dir(world_root, map_id)?
        .join(z.to_string())
        .join(x.to_string())
        .join(format!("{y}.jpg")))
}

/// Cuts the image at `source` into tiles under `dest` (replaced). Slow for
/// big images: run it off the async runtime.
pub fn generate(source: &Path, dest: &Path) -> AppResult<u32> {
    let decoded = image::open(source)
        .map_err(|error| AppError::InvalidInput(format!("unreadable image: {error}")))?;
    let (width, height) = decoded.dimensions();
    let mut level: RgbImage = decoded.to_rgb8();
    drop(decoded);
    let levels = levels_below(width, height);
    if dest.exists() {
        std::fs::remove_dir_all(dest)?;
    }
    for depth in 0..=levels {
        if depth > 0 {
            let (w, h) = level.dimensions();
            level = image::imageops::resize(
                &level,
                w.div_ceil(2).max(1),
                h.div_ceil(2).max(1),
                FilterType::Triangle,
            );
        }
        let name = if depth == 0 {
            "0".to_owned()
        } else {
            format!("-{depth}")
        };
        write_level(&level, &dest.join(name))?;
    }
    Ok(levels)
}

fn write_level(level: &RgbImage, dir: &Path) -> AppResult<()> {
    let (width, height) = level.dimensions();
    for x in 0..width.div_ceil(TILE_SIZE) {
        let column = dir.join(x.to_string());
        std::fs::create_dir_all(&column)?;
        for y in 0..height.div_ceil(TILE_SIZE) {
            let left = x * TILE_SIZE;
            let top = y * TILE_SIZE;
            let tile = image::imageops::crop_imm(
                level,
                left,
                top,
                TILE_SIZE.min(width - left),
                TILE_SIZE.min(height - top),
            )
            .to_image();
            let file = std::fs::File::create(column.join(format!("{y}.jpg")))?;
            let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
                std::io::BufWriter::new(file),
                QUALITY,
            );
            encoder
                .encode_image(&tile)
                .map_err(|error| AppError::Internal(format!("tile encoding: {error}")))?;
        }
    }
    Ok(())
}

/// Removes the tiles of maps that no longer exist (`known` map ids).
pub fn sweep(world_root: &Path, known: &[String]) -> AppResult<usize> {
    let root = world_root.join(TILES_DIR);
    if !root.is_dir() {
        return Ok(0);
    }
    let mut removed = 0;
    for entry in std::fs::read_dir(&root)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if !known.contains(&name) && entry.path().is_dir() {
            std::fs::remove_dir_all(entry.path())?;
            removed += 1;
        }
    }
    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn levels_go_down_until_one_tile() {
        assert_eq!(levels_below(256, 100), 0);
        assert_eq!(levels_below(257, 100), 1);
        assert_eq!(levels_below(16_000, 16_000), 6);
        assert!(needs_tiles(8_001, 10));
        assert!(!needs_tiles(8_000, 8_000));
    }

    #[test]
    fn an_image_is_cut_into_a_pyramid_of_tiles() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("big.png");
        RgbImage::from_pixel(600, 300, image::Rgb([10, 120, 200]))
            .save(&source)
            .unwrap();
        let dest = dir.path().join("tiles").join("m");

        let levels = generate(&source, &dest).unwrap();

        assert_eq!(levels, 2);
        // Full size: 3 × 2 tiles; then 300 × 150: 2 × 1; then 150 × 75: 1.
        assert!(dest.join("0/2/1.jpg").is_file());
        assert!(dest.join("-1/1/0.jpg").is_file());
        assert!(!dest.join("-1/1/1.jpg").exists());
        assert!(dest.join("-2/0/0.jpg").is_file());
        let edge = image::open(dest.join("0/2/1.jpg")).unwrap();
        assert_eq!(edge.dimensions(), (88, 44));
    }

    #[test]
    fn tile_paths_are_checked() {
        let root = Path::new("/w");
        let id = "5f0c4ba6-1f55-4c0e-9d6c-3f1a2a8e6c11";
        assert_eq!(
            resolve(root, id, "-2/3/4.jpg").unwrap(),
            root.join("tiles")
                .join(id)
                .join("-2")
                .join("3")
                .join("4.jpg")
        );
        for bad in [
            "../x/1.jpg",
            "0/1/2.png",
            "1/0/0.jpg",
            "0/-1/0.jpg",
            "0/0",
            "0/0/0.jpg/x",
        ] {
            assert!(resolve(root, id, bad).is_err(), "{bad}");
        }
        assert!(resolve(root, "../settings", "0/0/0.jpg").is_err());
    }

    #[test]
    fn tiles_of_vanished_maps_are_swept() {
        let dir = tempfile::tempdir().unwrap();
        for id in ["kept", "gone"] {
            std::fs::create_dir_all(dir.path().join(TILES_DIR).join(id).join("0")).unwrap();
        }
        assert_eq!(sweep(dir.path(), &["kept".into()]).unwrap(), 1);
        assert!(dir.path().join(TILES_DIR).join("kept").is_dir());
        assert!(!dir.path().join(TILES_DIR).join("gone").exists());
    }
}
