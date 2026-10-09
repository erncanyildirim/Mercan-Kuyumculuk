"""Rebuild the Mercan Kuyumculuk mark: exact rhombus frames + traced M/wordmark.

Outputs (in OUT dir):
  content.pbm       traced-content bitmap on canonical canvas
  content.svg       potrace SVG of the content
  mark.svg          final master SVG (rings as polygons + content path), yellow, transparent bg
  mark_vector.xml   Android/Compose VectorDrawable of the mark
  geometry.json     canonical geometry numbers
"""
import json, math, subprocess, sys, re
import numpy as np
from PIL import Image, ImageFilter

SCRATCH = sys.argv[1]
OUT = sys.argv[2]
YELLOW = "#F9DE14"

rot = np.load(f"{SCRATCH}/logo/rot.npy")  # 3660x3660 uint8 yellowness, de-rotated 2.5deg
H0, W0 = rot.shape
CX, CY = 1825.0, 1840.0
RATIO = 1.2955           # a/b of every rhombus
B_OUT = 1447.0           # outer ring, outer boundary half-height
V_THICK_OUT = 71.0       # vertical thickness of outer ring
GAP = 72.0
V_THICK_IN = 68.0
b_rings = [
    (B_OUT, B_OUT - V_THICK_OUT),
    (B_OUT - V_THICK_OUT - GAP, B_OUT - V_THICK_OUT - GAP - V_THICK_IN),
]
A_OUT = B_OUT * RATIO
CW = int(math.ceil(2 * A_OUT))   # canonical canvas width
CH = int(math.ceil(2 * B_OUT))   # canonical canvas height
ccx, ccy = CW / 2.0, CH / 2.0

# --- content: everything inside the inner ring's inner boundary ---
b_inner = b_rings[1][1] * 0.965
a_inner = b_inner * RATIO
yy, xx = np.mgrid[0:H0, 0:W0].astype(np.float32)
inside = (np.abs(xx - CX) / a_inner + np.abs(yy - CY) / b_inner) <= 1.0
content = np.where(inside, rot, 0).astype(np.uint8)
img = Image.fromarray(content).filter(ImageFilter.GaussianBlur(2.2))
# translate into canonical canvas
dx, dy = ccx - CX, ccy - CY
canvas = Image.new("L", (CW, CH), 0)
canvas.paste(img, (int(round(dx)), int(round(dy))))
bw = canvas.point(lambda v: 0 if v > 127 else 255).convert("1")
bw.save(f"{OUT}/content.pbm")
subprocess.run(["potrace", f"{OUT}/content.pbm", "-s", "-o", f"{OUT}/content.svg",
                "-t", "30", "-a", "1.0", "-O", "0.6"], check=True)

svg = open(f"{OUT}/content.svg").read()
paths = re.findall(r'<path d="([^"]+)"', svg, re.S)
path_d = " ".join(p.replace("\n", " ") for p in paths)
path_d = re.sub(r"\s+", " ", path_d).strip()

def rhombus_pts(b):
    a = b * RATIO
    return [(ccx, ccy - b), (ccx + a, ccy), (ccx, ccy + b), (ccx - a, ccy)]

def ring_path(b_outer, b_inner_):
    o = rhombus_pts(b_outer)
    i = rhombus_pts(b_inner_)[::-1]  # reverse winding -> hole under nonzero
    f = lambda pts: "M" + " L".join(f"{x:.2f},{y:.2f}" for x, y in pts) + " Z"
    return f(o) + " " + f(i)

ring_d = [ring_path(*r) for r in b_rings]

mark_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CW} {CH}" width="{CW}" height="{CH}">
  <g fill="{YELLOW}">
    <path d="{ring_d[0]}"/>
    <path d="{ring_d[1]}"/>
    <g transform="translate(0,{CH}) scale(0.1,-0.1)"><path d="{path_d}"/></g>
  </g>
</svg>
'''
open(f"{OUT}/mark.svg", "w").write(mark_svg)

def ring_vd(b_outer, b_inner_):
    o = rhombus_pts(b_outer)
    i = rhombus_pts(b_inner_)[::-1]
    f = lambda pts: "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + " Z"
    return f(o) + " " + f(i)

vd = f'''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="{CW / 20:.1f}dp"
    android:height="{CH / 20:.1f}dp"
    android:viewportWidth="{CW}"
    android:viewportHeight="{CH}">
    <path android:fillColor="{YELLOW}" android:pathData="{ring_vd(*b_rings[0])}"/>
    <path android:fillColor="{YELLOW}" android:pathData="{ring_vd(*b_rings[1])}"/>
    <group android:translateY="{CH}" android:scaleX="0.1" android:scaleY="-0.1">
        <path android:fillColor="{YELLOW}" android:pathData="{path_d}"/>
    </group>
</vector>
'''
open(f"{OUT}/mark_vector.xml", "w").write(vd)

json.dump({"CW": CW, "CH": CH, "ratio": RATIO, "rings": b_rings, "ccx": ccx, "ccy": ccy},
          open(f"{OUT}/geometry.json", "w"), indent=2)
print("canvas", CW, CH, "content path chars", len(path_d))
