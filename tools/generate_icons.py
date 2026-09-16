from PIL import Image
from pathlib import Path

ROOT = Path(r"E:\blender_workspace\gatetouch_pro")
LOGO_DARK = ROOT / "src" / "assets" / "logo" / "logo_dark.png"
LOGO_LIGHT = ROOT / "src" / "assets" / "logo" / "logo.png"
OUT = ROOT / "assets"
OUT.mkdir(exist_ok=True)

dark = Image.open(LOGO_DARK).convert("RGBA")
light = Image.open(LOGO_LIGHT).convert("RGBA")
print("dark size", dark.size)
print("light size", light.size)

px = dark.getpixel((dark.width // 20, dark.height // 20))
bg_rgb = px[:3]
bg_hex = "#{:02x}{:02x}{:02x}".format(*bg_rgb)
print("bg_hex", bg_hex)


def cover_square(im: Image.Image, size: int) -> Image.Image:
    w, h = im.size
    scale = max(size / w, size / h)
    nw, nh = int(round(w * scale)), int(round(h * scale))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - size) // 2
    top = (nh - size) // 2
    return resized.crop((left, top, left + size, top + size))


def flatten_rgb(im: Image.Image, size: int, fill) -> Image.Image:
    covered = cover_square(im, size)
    canvas = Image.new("RGB", (size, size), fill)
    canvas.paste(covered, (0, 0), covered)
    return canvas


# Main Expo icon (1024) — dark logo
flatten_rgb(dark, 1024, bg_rgb).save(OUT / "icon.png", "PNG", optimize=True)

# Android adaptive background
Image.new("RGB", (1024, 1024), bg_rgb).save(OUT / "android-icon-background.png", "PNG", optimize=True)

# Android adaptive foreground — full logo
cover_square(dark, 1024).save(OUT / "android-icon-foreground.png", "PNG", optimize=True)

# Monochrome themed icon (white silhouette)
gray = cover_square(dark, 1024).convert("L")
bg_l = gray.getpixel((20, 20))
mono = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
pixels = []
for v in gray.getdata():
    a = max(0, min(255, int((v - bg_l) * 1.4)))
    pixels.append((255, 255, 255, a))
mono.putdata(pixels)
mono.save(OUT / "android-icon-monochrome.png", "PNG", optimize=True)

# Favicons
for name, size in [("favicon.png", 48), ("favicon-32.png", 32), ("favicon-16.png", 16)]:
    flatten_rgb(dark, size, bg_rgb).save(OUT / name, "PNG", optimize=True)

# Splash + light variant + common PWA sizes
cover_square(dark, 512).save(OUT / "splash-icon.png", "PNG", optimize=True)
flatten_rgb(light, 1024, (255, 255, 255)).save(OUT / "icon-light.png", "PNG", optimize=True)
for size in (180, 192, 512):
    flatten_rgb(dark, size, bg_rgb).save(OUT / f"icon-{size}.png", "PNG", optimize=True)

print("DONE")
for p in sorted(OUT.glob("*.png")):
    print(f"  {p.name:40s} {p.stat().st_size:8d}")
print("BG_HEX", bg_hex)
