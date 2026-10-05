"""Overlay a long-section render of the model on the 1914 section drawing (Architektonický obzor,
"Hlavní řez podélný – nynější stav") with a metric grid, and save zoomed crops.

Usage:  python3 tools/qa/section_overlay.py <render.png> <out_dir>

The render must come from `__qa.secView()` in tools/qa/browser_snippets.js: 1280 × 760 px, camera
1500 m west of Zítek's axis, fov 3°, centred on v = 44 m, y = 14 m (≈ 9.675 px per metre).
Grid: thin blue line every 1 m of height (thick every 5 m, 0 = street), green line every 5 m along v.
"""
import os
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageOps

# the research pack (plans, photos, map data) is not in the repository: it sits next to it, or where ND_PODKLADY points
PODKLADY = Path(os.environ.get("ND_PODKLADY", Path(__file__).resolve().parents[3] / "narodni-divadlo-podklady"))
DRAWING = PODKLADY / "01_plany_rezy_pohledy/rez_hlavni_podelny_nynejsi_stav_Zitek_Schulz_ArchObzor1914_tab11-12.jpg"
PX_M = 35.6                  # drawing pixels per metre at full resolution (scale bar)
X_PORTAL, Y_STREET = 2540, 2418  # drawing pixel of the proscenium wall (v = 36.6) and of street level
PORTAL_V = 36.6
RENDER_PX_M = 9.675          # render pixels per metre
RENDER_CENTRE = (640, 380, 44.0, 14.0)  # pixel x, pixel y, v, y

render, out = Path(sys.argv[1]), Path(sys.argv[2])
dr = Image.open(DRAWING).convert("L")
md = Image.open(render).convert("RGB")
k = PX_M / RENDER_PX_M
cx, cy, cv, ch = RENDER_CENTRE
X0 = X_PORTAL + (cv - PORTAL_V) * PX_M - cx * k
Y0 = Y_STREET - ch * PX_M - cy * k
mds = md.resize((int(md.width * k), int(md.height * k)))
region = dr.crop((int(X0), int(Y0), int(X0) + mds.width, int(Y0) + mds.height))
faded = Image.blend(mds, Image.new("RGB", mds.size, (255, 255, 255)), 0.35)
lines = ImageOps.colorize(region, black=(220, 0, 30), white=(255, 255, 255))
comp = ImageChops.multiply(faded, lines)

d = ImageDraw.Draw(comp)
Yc = lambda h: Y_STREET - h * PX_M - Y0
Xc = lambda v: X_PORTAL + (v - PORTAL_V) * PX_M - X0
for h in range(-10, 48):
    d.line([(0, Yc(h)), (comp.width, Yc(h))], fill=(0, 120, 255) if h % 5 else (0, 60, 200), width=1 if h % 5 else 3)
for v in range(-10, 100, 5):
    d.line([(Xc(v), 0), (Xc(v), comp.height)], fill=(0, 160, 60), width=2)

out.mkdir(parents=True, exist_ok=True)
comp.resize((comp.width // 2, comp.height // 2)).save(out / "sec_full.jpg", quality=86)


def crop(name, v0, v1, h0, h1, w=1500):
    c = comp.crop((int(Xc(v0)), int(Yc(h1)), int(Xc(v1)), int(Yc(h0))))
    c.resize((w, int(w * c.height / c.width))).save(out / name, quality=88)


crop("sec_auditorium.jpg", 6, 40, 0, 31)
crop("sec_dome.jpg", 0, 56, 24, 47)
crop("sec_north.jpg", -9, 16, -10, 33)
crop("sec_stage.jpg", 34, 60, -10, 34)
crop("sec_south.jpg", 55, 98, -10, 34)
print("saved to", out)
