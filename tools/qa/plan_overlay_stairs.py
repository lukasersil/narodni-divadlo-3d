import sys, math
sys.path.insert(0, 'tools')
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
import prep_partitions as P

AUD_BACK, PORTAL, STAGE_BACK, HW = P.AUD_BACK, P.PORTAL, P.STAGE_BACK, P.HOUSE
CV = AUD_BACK + 11.6 * 1.15
FRONT = PORTAL - 2.6
def A(pts):  # auditorium frame -> B
    u = np.array([p[0] for p in pts]); v = np.array([p[1] for p in pts])
    c, s = math.cos(P.AX_ANG), math.sin(P.AX_ANG); z = v - P.AX_PIVOT
    return P.AX_SHIFT + u * c + z * s, P.AX_PIVOT - u * s + z * c
def Bp(pts):
    return np.array([p[0] for p in pts]), np.array([p[1] for p in pts])
def upath(r, front=FRONT, segs=40):
    pts = [(r, front)]
    for i in range(segs + 1):
        a = i / segs * math.pi
        pts.append((math.cos(a) * r, CV - math.sin(a) * r * 1.15))
    pts.append((-r, front)); return pts
feat = [
    (A(upath(8.9)), (255, 0, 0)), (A(upath(11.15)), (255, 140, 0)), (A(upath(11.6)), (200, 0, 200)),
    (A([(-6.4, PORTAL), (6.4, PORTAL)]), (0, 150, 0)),
    (A([(-HW, PORTAL), (-HW, STAGE_BACK), (HW, STAGE_BACK), (HW, PORTAL)]), (0, 120, 255)),
    (A([(-0.0, 10), (0.0, 56)]), (255, 0, 255)),
    (Bp([(-11.5, -0.6), (11.5, -0.6), (11.5, 5.4), (-11.5, 5.4), (-11.5, -0.6)]), (0, 200, 200)),
]
stairs = [(13.6, 18.0, 2.2, 7.2), (-17.6, -13.0, -2.6, 2.4), (12.8, 18.4, 8.8, 16.4), (-15.4, -10.6, 11.0, 16.4),
          (13.2, 16.8, 29.8, 34.6), (-16.2, -11.6, 45.2, 49.2), (-13.8, -11.4, 55.8, 58.8), (15.4, 17.8, 55.8, 58.8)]
spirals = [(13.0, 47.4, 2.0), (6.4, 84.2, 2.0)]
out = sys.argv[1]
for li in (0, 1, 2, 3):
    name = P.LEVELS[li][0]
    g = P.load(name)
    mask = P.building_mask(g)
    walls = ndimage.binary_opening(g < 105, structure=np.ones((6, 6)))
    params, fit, to_px = P.register(mask, walls)
    img = Image.open(P.PLANS / name).convert('RGB'); d = ImageDraw.Draw(img)
    for (u, v), col in feat:
        x, y = to_px(params, u, v); d.line(list(zip(x, y)), fill=col, width=7)
    for (u0, u1, v0, v1) in stairs:
        x, y = to_px(params, np.array([u0, u1, u1, u0, u0]), np.array([v0, v0, v1, v1, v0])); d.line(list(zip(x, y)), fill=(0, 200, 0), width=6)
    for (cu, cv, r) in spirals:
        a = np.linspace(0, 2 * math.pi, 30); x, y = to_px(params, cu + np.cos(a) * r, cv + np.sin(a) * r * 1.25); d.line(list(zip(x, y)), fill=(0, 200, 0), width=6)
    img.resize((img.width // 2, img.height // 2)).save(f'{out}/ov2_{li + 1}.jpg', quality=82)
    print('saved', li + 1, round(fit, 3))
