"""Builds the app icons and the in-app emblem from the Atlasaga brand
sources in assets/brand (01_app_icon_1024.png, 02_small_icon_1024.png,
03_emblem_1024.png, drawn by Clement with an image generator).

The sources carry a light halo and a jagged edge around the tile and the
emblem. This script:
1. cleans them into assets/brand/app-icon.png, app-icon-small.png and
   emblem.png: the tile gets a clean anti-aliased rounded-rect mask, the
   emblem an eroded and smoothed alpha with a navy rim (no light fringe);
2. runs `pnpm tauri icon` on app-icon.png (src-tauri/icons, desktop files
   only: the android and ios folders are removed);
3. replaces src-tauri/icons/icon.ico: its 16 to 48 px frames come from the
   simplified icon (readable when small), 64 to 256 px from the full one;
4. writes the emblem the app shows (src/assets/brand/emblem.png, 192 px)
   and the exported wiki's favicon (src/assets/brand/favicon.png, the
   simplified tile at 32 px).

Needs Pillow. Usage: python scripts/brand-icons.py
"""
import os
import shutil
import subprocess

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
BRAND = os.path.join(ROOT, "assets", "brand")
ICONS = os.path.join(ROOT, "src-tauri", "icons")
APP_ASSETS = os.path.join(ROOT, "src", "assets", "brand")
SS = 4  # supersampling of the masks

# Frames of icon.ico, and which master draws them.
SMALL_FRAMES = [16, 20, 24, 32, 40, 48]
LARGE_FRAMES = [64, 96, 128, 256]


def rounded_mask(size, radius):
    mask = Image.new("L", (size * SS, size * SS), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size * SS - 1, size * SS - 1), radius=radius * SS, fill=255
    )
    return mask.resize((size, size), Image.LANCZOS)


def clean_tile(name, rect, radius, inset=6, size=1000, canvas=1024):
    """The tile inside `rect` (measured on the source, corner `radius`),
    inset past its halo, squared, centered and masked again."""
    src = Image.open(os.path.join(BRAND, name)).convert("RGB")
    x0, y0, x1, y1 = rect[0] + inset, rect[1] + inset, rect[2] - inset, rect[3] - inset
    scale = size / ((x1 - x0 + y1 - y0) / 2)
    tile = src.crop((x0, y0, x1, y1)).resize((size, size), Image.LANCZOS).convert("RGBA")
    tile.putalpha(rounded_mask(size, round((radius - inset) * scale)))
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(tile, ((canvas - size) // 2, (canvas - size) // 2))
    return out


def clean_emblem(name, navy=(18, 26, 40)):
    """The emblem without its light fringe: alpha eroded by 2 px, smoothed,
    and its rim painted with the outline's navy."""
    src = Image.open(os.path.join(BRAND, name)).convert("RGBA")
    hard = src.getchannel("A").point(lambda v: 255 if v >= 200 else 0)
    hard = hard.filter(ImageFilter.MinFilter(5))
    big = hard.resize((src.width * SS, src.height * SS), Image.BICUBIC)
    big = big.filter(ImageFilter.GaussianBlur(SS * 1.6)).point(lambda v: 255 if v >= 128 else 0)
    soft = big.resize(src.size, Image.LANCZOS)
    inner = hard.filter(ImageFilter.MinFilter(7))
    rim = ImageChops.subtract(soft.point(lambda v: 255 if v > 0 else 0), inner)
    rgb = src.convert("RGB")
    rgb.paste(Image.new("RGB", src.size, navy), mask=rim)
    out = rgb.convert("RGBA")
    out.putalpha(soft)
    return out


def scaled(image, size):
    """A small frame: Lanczos, then a light sharpening below 64 px."""
    frame = image.resize((size, size), Image.LANCZOS)
    if size < 64:
        frame = frame.filter(ImageFilter.UnsharpMask(radius=0.6, percent=60, threshold=0))
    return frame


def main():
    # Measured on the sources: the tile's bounds and corner radius.
    clean_tile("01_app_icon_1024.png", (2, 2, 1018, 1019), 270).save(
        os.path.join(BRAND, "app-icon.png"), optimize=True
    )
    clean_tile("02_small_icon_1024.png", (0, 10, 1016, 1010), 200).save(
        os.path.join(BRAND, "app-icon-small.png"), optimize=True
    )
    emblem = clean_emblem("03_emblem_1024.png")
    emblem.save(os.path.join(BRAND, "emblem.png"), optimize=True)

    subprocess.run("pnpm tauri icon assets/brand/app-icon.png", cwd=ROOT, shell=True, check=True)
    for platform in ("android", "ios"):
        shutil.rmtree(os.path.join(ICONS, platform), ignore_errors=True)

    full = Image.open(os.path.join(BRAND, "app-icon.png"))
    small = Image.open(os.path.join(BRAND, "app-icon-small.png"))
    frames = [scaled(small, s) for s in SMALL_FRAMES] + [scaled(full, s) for s in LARGE_FRAMES]
    sizes = [(s, s) for s in SMALL_FRAMES + LARGE_FRAMES]
    frames[-1].save(
        os.path.join(ICONS, "icon.ico"), format="ICO", sizes=sizes, append_images=frames[:-1]
    )
    # The 32 px PNG is a small size too: the simplified icon draws it.
    scaled(small, 32).save(os.path.join(ICONS, "32x32.png"), optimize=True)

    os.makedirs(APP_ASSETS, exist_ok=True)
    emblem.resize((192, 192), Image.LANCZOS).save(
        os.path.join(APP_ASSETS, "emblem.png"), optimize=True
    )
    # A browser tab shows 16 to 32 px: the simplified tile reads best there.
    scaled(small, 32).save(os.path.join(APP_ASSETS, "favicon.png"), optimize=True)


if __name__ == "__main__":
    main()
