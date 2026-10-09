"""Render raster icons of the rebuilt mark.

usage: render_icons.py <mark_dir> <project_root> <preview_dir>
"""
import json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageOps

MARK, ROOT, PREV = sys.argv[1], sys.argv[2], sys.argv[3]
g = json.load(open(f"{MARK}/geometry.json"))
CW, CH, RATIO = g["CW"], g["CH"], g["ratio"]
rings = g["rings"]
YELLOW = (0xF9, 0xDE, 0x14)
BLACK = (0x0A, 0x0A, 0x0A)


def render_mark(w):
    """Alpha mask (L) of the mark at width w px."""
    h = max(1, round(w * CH / CW))
    ss = 4
    W, H = w * ss, h * ss
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    # canonical coords
    X = (xs + 0.5) / W * CW - CW / 2
    Y = (ys + 0.5) / H * CH - CH / 2
    cov = np.zeros((H, W), bool)
    for bo, bi in rings:
        d = np.abs(X) / RATIO + np.abs(Y)  # rhombus "radius" in b-units
        cov |= (d <= bo) & (d > bi)
    rings_img = Image.fromarray((cov * 255).astype(np.uint8)).resize((w, h), Image.BOX)
    with tempfile.TemporaryDirectory() as td:
        out = os.path.join(td, "c.pgm")
        subprocess.run(["potrace", f"{MARK}/content.pbm", "-b", "pgm", "-W", str(w), "-H", str(h),
                        "-t", "30", "-a", "1.0", "-O", "0.6", "-o", out], check=True)
        c = ImageOps.invert(Image.open(out).convert("L"))
        if c.size != (w, h):
            c = c.resize((w, h), Image.LANCZOS)
    return Image.fromarray(np.maximum(np.asarray(rings_img), np.asarray(c)))


def compose(size, mark_frac, bg=BLACK, fg=YELLOW, alpha_bg=False, y_shift=0.0):
    mw = round(size * mark_frac)
    m = render_mark(mw)
    if alpha_bg:
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        layer = Image.new("RGBA", m.size, fg + (255,))
        canvas.paste(layer, ((size - m.width) // 2, (size - m.height) // 2 + round(y_shift * size)), m)
        return canvas
    canvas = Image.new("RGB", (size, size), bg)
    layer = Image.new("RGB", m.size, fg)
    canvas.paste(layer, ((size - m.width) // 2, (size - m.height) // 2 + round(y_shift * size)), m)
    return canvas


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)
    print("wrote", os.path.relpath(path, ROOT), img.size, img.mode)


# iOS App Store icon (no alpha)
save(compose(1024, 0.86), f"{ROOT}/iosApp/iosApp/Assets.xcassets/AppIcon.appiconset/app-icon-1024.png")
# Store assets
save(compose(512, 0.86), f"{ROOT}/store-assets/google-play/icon-512.png")
save(compose(1024, 0.86), f"{ROOT}/store-assets/app-store/icon-1024.png")
# Web icons
web = f"{ROOT}/webApp/src/webMain/resources"
save(compose(180, 0.84), f"{web}/apple-touch-icon.png")
save(compose(192, 0.86), f"{web}/icons/icon-192.png")
save(compose(512, 0.86), f"{web}/icons/icon-512.png")
save(compose(512, 0.70), f"{web}/icons/icon-maskable-512.png")
save(compose(48, 0.92), f"{web}/favicon-48.png")
fav = compose(64, 0.92)
fav.save(f"{web}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print("wrote favicon.ico")
# Large transparent mark for marketing / splash
save(compose(1600, 0.96, alpha_bg=True), f"{ROOT}/store-assets/brand/mark-transparent-1600.png")
# previews
os.makedirs(PREV, exist_ok=True)
compose(1024, 0.86).save(f"{PREV}/ios_icon.png")
small = Image.new("RGB", (48 * 4 + 50, 60), (240, 240, 240))
for i, s in enumerate([16, 32, 48, 64]):
    im = compose(s, 0.92)
    small.paste(im, (10 + i * 58, 2))
small.save(f"{PREV}/small_icons.png")
