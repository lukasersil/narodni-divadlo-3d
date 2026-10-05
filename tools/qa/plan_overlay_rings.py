"""Draw candidate auditorium rings (auditorium frame) on a Fialka plan.

Usage: OUT=<dir> python3 tools/qa/plan_overlay_rings.py <level 1–7> "<r1>,<r2>,…" [cv] [k] [crop x0,y0,x1,y1]
Rings: straight sides from the portal (v = PORTAL) back to cv, then a half-ellipse (k = depth/width).
"""
import math
import os
import sys

sys.path.insert(0, 'tools')
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

import prep_partitions as P

level = int(sys.argv[1])
radii = [float(x) for x in sys.argv[2].split(',')]
cv = float(sys.argv[3]) if len(sys.argv) > 3 else 27.2
k = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
crop = sys.argv[5] if len(sys.argv) > 5 else None
PORTAL = P.PORTAL
c, s = math.cos(P.AX_ANG), math.sin(P.AX_ANG)


def a2b(u, v):
    z = v - P.AX_PIVOT
    return P.AX_SHIFT + u * c + z * s, P.AX_PIVOT - u * s + z * c


def ring(r, n=80):
    pts = [(r, PORTAL)]
    for i in range(n + 1):
        a = i / n * math.pi
        pts.append((math.cos(a) * r, cv - math.sin(a) * r * k))
    pts.append((-r, PORTAL))
    return pts


name = P.LEVELS[level - 1][0]
g = P.load(name)
mask = P.building_mask(g)
walls = ndimage.binary_opening(g < 105, structure=np.ones((6, 6)))
params, fit, to_px = P.register(mask, walls)
img = Image.open(P.PLANS / name).convert('RGB')
d = ImageDraw.Draw(img)
cols = [(255, 0, 0), (0, 150, 255), (0, 170, 0), (255, 0, 255), (255, 140, 0), (0, 0, 0)]
for i, r in enumerate(radii):
    pts = ring(r)
    bu, bv = zip(*[a2b(u, v) for u, v in pts])
    x, y = to_px(params, np.array(bu), np.array(bv))
    d.line(list(zip(x, y)), fill=cols[i % len(cols)], width=3)
for v in (PORTAL, cv):
    bu, bv = zip(*[a2b(u, v) for u in (-14, 14)])
    x, y = to_px(params, np.array(bu), np.array(bv))
    d.line(list(zip(x, y)), fill=(120, 120, 120), width=2)
bu, bv = zip(*[a2b(0, v) for v in (6, 56)])
x, y = to_px(params, np.array(bu), np.array(bv))
d.line(list(zip(x, y)), fill=(255, 0, 255), width=2)
if crop:
    img = img.crop(tuple(int(t) for t in crop.split(',')))
img.save(os.path.join(os.environ.get('OUT', '.'), f'rings_{level}.jpg'), quality=90)
print('ok', img.size, 'fit', round(fit, 3))
