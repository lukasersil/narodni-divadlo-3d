"""Interior walls traced from J. Fialka's measured plans (Šubert's guide, 1883).

Each plan (cellars … 4th tier) is thresholded to its solid black walls (thin lines of stairs,
hatching and lettering removed by morphological opening), registered onto the RÚIAN footprint
(similarity transform: PCA start + Nelder–Mead on the overlap) and sampled on a 0.2 m grid in the
building frame. Wall cells are merged into rectangles and written to src/data/partitions.js.

Run:  python3 tools/prep_partitions.py      (numpy, scipy, scikit-image, Pillow)
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage, optimize
from skimage.draw import polygon as fill_polygon

ROOT = Path(__file__).resolve().parents[1]
PLANS = Path.home() / "Documents/narodni-divadlo-podklady/01_plany_rezy_pohledy"
OUT = ROOT / "src/data/partitions.js"
DEBUG = Path(__import__('os').environ.get('ND_DEBUG', str(ROOT / 'tools' / '_debug')))

site = (ROOT / "src/data/site.js").read_text()
FOOT = np.array(json.loads(site[site.index("{"): site.rindex(";")])["frame"]["footprint"], float)  # [u, v]

LEVELS = [
    ("pudorys_01_sklepy_1883_Fialka_Subert-pruvodce.jpg", -4.4, -0.45),
    ("pudorys_02_prizemi_1883_Fialka_Subert-pruvodce.jpg", 0.0, 2.96),   # just under the floors at +3.0
    ("pudorys_03_parter_parketa_loze_prizemi_1883_Fialka_Subert-pruvodce.jpg", 3.0, 6.0),   # storeys follow AUD.tiers
    ("pudorys_04_I_poradi_kralovska_loze_1883_Fialka_Subert-pruvodce.jpg", 6.0, 9.5),
    ("pudorys_05_II_poradi_1883_Fialka_Subert-pruvodce.jpg", 9.5, 12.9),
    ("pudorys_06_III_poradi_I_galerie_1883_Fialka_Subert-pruvodce.jpg", 12.9, 17.7),
    ("pudorys_07_IV_poradi_II_galerie_1883_Fialka_Subert-pruvodce.jpg", 17.7, 21.0),
]

# building-frame grid
STEP = 0.2
U = np.arange(-27, 26, STEP)
Vv = np.arange(-10, 98, STEP)
GU, GV = np.meshgrid(U, Vv)          # rows = v, cols = u
inside = np.zeros(GU.shape, bool)
rr, cc = fill_polygon((FOOT[:, 1] + 10) / STEP, (FOOT[:, 0] + 27) / STEP, GU.shape)
inside[rr, cc] = True
dist_in = ndimage.distance_transform_edt(inside) * STEP   # metres to the outline

# auditorium / stage exclusions (the model has its own geometry there), in the auditorium frame:
# Zítek's axis is turned 3° from the building frame (AXIS in src/config.js)
PORTAL, STAGE_BACK, HOUSE = 36.6, 52.1, 11.4
CV, WALL_OUT, PARAPET, K = 26.0, 13.05, 7.3, 1.14   # AUD.cv, outer face of the horseshoe wall, parapet (config.js)
FRONT = PORTAL - 3.0
AX_PIVOT, AX_SHIFT, AX_ANG = 28.0, 0.5, math.radians(3.0)


def to_b(u, v):
    c, s = math.cos(AX_ANG), math.sin(AX_ANG)
    z = v - AX_PIVOT
    return AX_SHIFT + u * c + z * s, AX_PIVOT - u * s + z * c


def to_aud(u, v):
    du, dv = u - AX_SHIFT, v - AX_PIVOT
    c, s = math.cos(AX_ANG), math.sin(AX_ANG)
    return c * du - s * dv, AX_PIVOT + s * du + c * dv


# open or low parts that the model builds itself (polygons from src/config.js)
_cfg = (ROOT / "src/config.js").read_text()


def fp(name):
    i = _cfg.index(f"  {name}: ccw(")
    return np.array(json.loads(_cfg[_cfg.index("[", i): _cfg.index("),", i)]), float)


def poly_mask(poly, grow=0.0):
    rr, cc = fill_polygon((poly[:, 1] + 10) / STEP, (poly[:, 0] + 27) / STEP, GU.shape)
    m = np.zeros(GU.shape, bool)
    m[rr, cc] = True
    return ndimage.binary_dilation(m, iterations=int(round(grow / STEP))) if grow > 0 else m


LOGGIA = poly_mask(fp("loggia"), 0.4)          # open arcade on every floor
TERRACE = poly_mask(fp("terrace"), 0.4)        # wing only 8.6 m high – nothing above its roof
_fa = math.atan2(1.76 + 1.76, 19.24 + 18.87)              # north façade angle (FACADE in config.js)
_fu, _fv = GU * math.cos(_fa) + GV * math.sin(_fa), -GU * math.sin(_fa) + GV * math.cos(_fa)
FOYER = (np.abs(_fu) < 11.8) & (_fv > 1.1) & (_fv < 8.1)   # foyer hall (own walls, pilasters, vault)

# band along the main block's north façade (the model's own wall stands there)
_a, _b = np.array([-18.87, -1.76]), np.array([19.24, 1.76])
_t = np.clip(((GU - _a[0]) * (_b[0] - _a[0]) + (GV - _a[1]) * (_b[1] - _a[1])) / np.sum((_b - _a) ** 2), 0, 1)
NORTH_BAND = np.hypot(GU - (_a[0] + _t * (_b[0] - _a[0])), GV - (_a[1] + _t * (_b[1] - _a[1]))) < 1.9


def in_horseshoe(u, v, r, k=1.0):
    t = np.where(v < CV, (CV - v) / (k * r), 0)
    return (np.abs(u) <= r * np.sqrt(np.clip(1 - t ** 2, 0, 1))) & (v <= PORTAL) & (v >= CV - k * r)


def load(name):
    g = np.asarray(Image.open(PLANS / name).convert("L"), np.float32)
    return g


def building_mask(g):
    """Silhouette of the building at quarter resolution (doors bridged, thin lines removed)."""
    small = np.asarray(Image.fromarray(g.astype(np.uint8)).resize((g.shape[1] // 4, g.shape[0] // 4)), np.float32)
    walls = ndimage.binary_opening(small < 120, structure=np.ones((3, 3)))
    closed = ndimage.binary_closing(walls, structure=np.ones((15, 15)))
    filled = ndimage.binary_fill_holes(closed)
    lab, n = ndimage.label(filled)
    sizes = ndimage.sum(filled, lab, range(1, n + 1))
    return lab == (1 + int(np.argmax(sizes)))


SCALE, ROT = 30.2, math.radians(5.6)   # common to all sheets (from the best-fitting plans)
RING = (dist_in > 0.25) & (dist_in < 1.1)  # exterior wall band inside the outline


def register(mask, walls):
    """Fixed scale/rotation; translation that lays the plan's outer walls onto the RÚIAN outline."""
    ys, xs = np.nonzero(mask)
    c_px = np.array([xs.mean(), ys.mean()]) * 4
    c_b = np.stack([GU[inside], GV[inside]], 1).mean(0)
    ru, rv = GU[RING][::3], GV[RING][::3]

    def to_px(params, u, v):
        s, th, du, dv = params
        dvv, duu = v - (c_b[1] + dv), u - (c_b[0] + du)
        return c_px[0] + s * (math.cos(th) * dvv + math.sin(th) * duu), c_px[1] + s * (math.sin(th) * dvv - math.cos(th) * duu)

    def score(params):
        x, y = to_px(params, ru, rv)
        ok = (x >= 0) & (y >= 0) & (x < walls.shape[1]) & (y < walls.shape[0])
        xi = np.clip(x.astype(int), 0, walls.shape[1] - 1)
        yi = np.clip(y.astype(int), 0, walls.shape[0] - 1)
        return np.mean(walls[yi, xi] & ok)

    best = (-1, None)
    for du in np.arange(-30, 30.01, 1.0):
        for dv in np.arange(-40, 40.01, 1.0):
            sc = score((SCALE, ROT, du, dv))
            if sc > best[0]:
                best = (sc, (SCALE, ROT, du, dv))
    s0, th0, du0, dv0 = best[1]
    for du in np.arange(du0 - 1.0, du0 + 1.01, 0.25):
        for dv in np.arange(dv0 - 1.0, dv0 + 1.01, 0.25):
            sc = score((SCALE, ROT, du, dv))
            if sc > best[0]:
                best = (sc, (SCALE, ROT, du, dv))
    s0, th0, du0, dv0 = best[1]
    for s1 in (SCALE * 0.985, SCALE, SCALE * 1.015):
        for th1 in (ROT - 0.01, ROT, ROT + 0.01):
            for du in np.arange(du0 - 0.6, du0 + 0.61, 0.1):
                for dv in np.arange(dv0 - 0.6, dv0 + 0.61, 0.1):
                    sc = score((s1, th1, du, dv))
                    if sc > best[0]:
                        best = (sc, (s1, th1, du, dv))
    return np.array(best[1]), best[0], to_px


def rects_from(mask):
    """Greedy merge of grid cells into rectangles [u0, u1, v0, v1]."""
    H, W = mask.shape
    used = np.zeros_like(mask)
    out = []
    for r in range(H):
        c = 0
        while c < W:
            if mask[r, c] and not used[r, c]:
                c1 = c
                while c1 + 1 < W and mask[r, c1 + 1] and not used[r, c1 + 1]:
                    c1 += 1
                r1 = r
                while r1 + 1 < H and mask[r1 + 1, c:c1 + 1].all() and not used[r1 + 1, c:c1 + 1].any():
                    r1 += 1
                used[r:r1 + 1, c:c1 + 1] = True
                out.append([round(U[c] - STEP / 2, 2), round(U[c1] + STEP / 2, 2), round(Vv[r] - STEP / 2, 2), round(Vv[r1] + STEP / 2, 2)])
                c = c1 + 1
            else:
                c += 1
    return out


def main():
    DEBUG.mkdir(exist_ok=True)
    levels = []
    for i, (name, y0, y1) in enumerate(LEVELS):
        g = load(name)
        dark = g < 105
        mask = building_mask(g)
        # solid walls only: open with ≈ 0.2 m so stair lines, hatching and lettering drop out
        walls = ndimage.binary_opening(dark, structure=np.ones((6, 6)))
        params, iou, to_px = register(mask, walls)
        x, y = to_px(params, GU, GV)
        xi = np.clip(x.astype(int), 0, g.shape[1] - 1)
        yi = np.clip(y.astype(int), 0, g.shape[0] - 1)
        w = walls[yi, xi] & inside & (dist_in > 1.25) & ~NORTH_BAND
        # leave out the parts the model builds itself
        AU, AV = to_aud(GU, GV)
        stage = (np.abs(AU) < HOUSE - 0.2) & (AV > PORTAL - 0.9) & (AV < STAGE_BACK + 0.6)
        rear_u = to_b(0, STAGE_BACK + 6.5)[0]
        rear = (np.abs(GU - rear_u) < 6.2) & (GV > STAGE_BACK + 0.3) & (GV < STAGE_BACK + 13.0)   # 1983 rear stage (11 × 12 m) and halls above
        if i >= 2:
            w &= ~in_horseshoe(AU, AV, WALL_OUT)        # auditorium inside the outer face of its wall
            w &= ~stage
        else:
            w &= ~((np.abs(AU) < 10.4) & (AV > PORTAL) & (AV < STAGE_BACK))   # stage pit
            if i == 1:
                w &= ~in_horseshoe(AU, AV, PARAPET - 0.4, K)        # keep the chamber ring, not its middle
        if i >= 1:
            w &= ~rear
            w &= ~LOGGIA
        if i >= 3:
            w &= ~TERRACE
        if 3 <= i <= 5:
            w &= ~FOYER
        if i == 6:
            # II. gallery amphitheatre behind the horseshoe (AUD.gallery in config.js); the model builds it
            gr = np.hypot(AU, CV - AV)
            ga = np.where(AV < CV, np.abs(np.arctan2(AU, CV - AV)), np.pi)
            w &= ~((ga < math.radians(56) + 0.06) & (gr < 10.4 + 10 * 0.7 + 0.9))   # AUD.gallery
        w = ndimage.binary_opening(w, structure=np.ones((2, 2)))
        if i == 1:
            # under the raked parterre (from +2.55) the walls stop lower
            low = w & in_horseshoe(AU, AV, WALL_OUT)
            w &= ~low
            levels.append({"y0": y0, "y1": 2.2, "rects": rects_from(low), "src": name.split("_1883")[0] + "_parterre"})
        rects = rects_from(w)
        levels.append({"y0": y0, "y1": y1, "rects": rects, "src": name.split("_1883")[0]})
        print(f"{name[:30]:30s} scale {params[0]:.2f}px/m  rot {math.degrees(params[1]):6.2f}°  wall-fit {iou:.3f}  cells {int(w.sum())}  rects {len(rects)}")
        # debug overlay
        dbg = np.stack([g, g, g], -1).astype(np.uint8)
        fx, fy = to_px(params, np.r_[FOOT[:, 0], FOOT[0, 0]], np.r_[FOOT[:, 1], FOOT[0, 1]])
        img = Image.fromarray(dbg)
        from PIL import ImageDraw
        d = ImageDraw.Draw(img)
        d.line(list(zip(fx, fy)), fill=(255, 0, 0), width=6)
        wx, wy = x[w], y[w]
        for a, b in zip(wx[::4], wy[::4]):
            d.point((a, b), fill=(0, 160, 255))
        img.resize((img.width // 3, img.height // 3)).save(DEBUG / f"overlay_{i + 1}.jpg", quality=80)
    OUT.write_text("// Generated by tools/prep_partitions.py from J. Fialka's 1883 plans – do not edit by hand.\n"
                   "export const PARTITIONS = " + json.dumps({"levels": levels}, separators=(",", ":")) + ";\n")
    print("wrote", OUT, round(OUT.stat().st_size / 1024), "KB")


if __name__ == "__main__":
    main()
