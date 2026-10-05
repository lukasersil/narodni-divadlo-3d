"""Builds src/data/site.js from the collected open data (IPR Praha, OSM, RÚIAN).

Run:  python tools/prep_data.py   (needs numpy, pyproj, shapely, Pillow)

World frame of the app (metres): x = east, y = up, z = south (true north = -z),
origin = tmerc point lat 50.08094 / lon 14.41352 (centre of ND), y = 0 at street
level by the theatre (191.3 m Bpv). The historic building itself is modelled in a
building frame "B" (u east, v south along the long axis, azimuth 353.6°).
"""
import base64, json, math
from pathlib import Path

import numpy as np
from PIL import Image
from pyproj import Transformer
from shapely.geometry import Polygon, LineString, box, Point
from shapely.ops import unary_union

SRC = Path.home() / "Documents/narodni-divadlo-podklady/07_3d_modely_a_data"
OUT = Path(__file__).resolve().parents[1] / "src/data/site.js"

GROUND_BPV = 191.3
LAT0, LON0 = 50.08094, 14.41352
ND_DEF = (-743454.43, -1043666.57)  # EPSG:5514 x, y of the ND definition point

to_wgs = Transformer.from_crs("EPSG:5514", "EPSG:4326", always_xy=True)
tmerc = Transformer.from_crs(
    "EPSG:4326",
    f"+proj=tmerc +lat_0={LAT0} +lon_0={LON0} +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +units=m",
    always_xy=True,
)


def sjtsk_to_world(x5514, y5514, h_bpv):
    lon, lat = to_wgs.transform(x5514, y5514)
    e, n = tmerc.transform(lon, lat)
    return e, h_bpv - GROUND_BPV, -n


def wgs_to_world(lon, lat):
    e, n = tmerc.transform(lon, lat)
    return e, -n


def b64(arr):
    return base64.b64encode(np.ascontiguousarray(arr).tobytes()).decode()


# ---------------------------------------------------------------- IPR context
def load_context():
    path = SRC / "ipr_praha_a_3d_modely/odvozene_threejs/ND_IPR_BD3_okoli_bbox500m_local.obj"
    verts, groups, cur = [], {}, None
    for line in open(path):
        if line.startswith("v "):
            X, Y, Z = map(float, line.split()[1:4])
            verts.append((X + ND_DEF[0], -Z + ND_DEF[1], Y + 190.0))
        elif line.startswith("g "):
            cur = line.split()[1]
            groups.setdefault(cur, [])
        elif line.startswith("f "):
            idx = [int(t.split("/")[0]) - 1 for t in line.split()[1:]]
            for i in range(1, len(idx) - 1):
                groups[cur].append((idx[0], idx[i], idx[i + 1]))
    world = [sjtsk_to_world(*v) for v in verts]
    return world, groups


def ruian_polys():
    d = json.load(open(SRC / "ruian_cuzk/ruian_budovy_nd_wgs84.geojson"))
    out = {}
    for f in d["features"]:
        g = f["geometry"]
        ring = g["coordinates"][0] if g["type"] == "Polygon" else g["coordinates"][0][0]
        name = f["properties"].get("nazev") or f["properties"].get("name") or str(len(out))
        out[name] = Polygon([wgs_to_world(*p[:2]) for p in ring])
    return out


def build_context(ruian):
    world, groups = load_context()
    nd_poly = next(p for n, p in ruian.items() if "historick" in n.lower() or "223" in n)
    nova = next(p for n, p in ruian.items() if "Nova scena" in n or "Nová scéna" in n)
    buckets = {"wall": [], "roof": [], "glass": [], "glassroof": []}
    for g, tris in groups.items():
        if not tris:
            continue
        bid, kind = g.rsplit("_", 1)
        if kind == "base":
            continue
        vidx = {i for t in tris for i in t}
        cx = np.mean([world[i][0] for i in vidx])
        cz = np.mean([world[i][2] for i in vidx])
        pt = Point(cx, cz)
        if nd_poly.buffer(1.5).contains(pt):
            continue  # the historic building is modelled in detail
        is_glass = nova.buffer(1.0).contains(pt)
        key = ("glass" if kind == "wall" else "glassroof") if is_glass else ("wall" if kind == "wall" else "roof")
        buckets[key].extend(tris)
    out = {}
    for key, tris in buckets.items():
        used = sorted({i for t in tris for i in t})
        remap = {o: n for n, o in enumerate(used)}
        pos = np.array([world[i] for i in used], dtype=np.float32)
        idx = np.array([[remap[i] for i in t] for t in tris], dtype=np.uint32).ravel()
        out[key] = {"pos": b64(pos), "idx": b64(idx), "n": len(used)}
    return out


# ---------------------------------------------------------------- terrain
def build_terrain():
    base = SRC / "ipr_praha_a_3d_modely/ipr_rastry_bbox_500m"
    dsm = np.array(Image.open(base / "IPR_DMP_teren_budovy_1m_bbox500m.tif"), dtype=np.float32)
    rel = np.array(Image.open(base / "IPR_relativni_vysky_budov_1m_bbox500m.tif"), dtype=np.float32)
    rel = np.where(np.isfinite(rel) & (rel > 0) & (rel < 200), rel, 0)
    dtm = dsm - rel
    dtm = np.where(np.isfinite(dtm) & (dtm > 184.8), dtm, np.where(np.isfinite(dsm), dsm, 185.3))
    dtm = np.clip(dtm, 185.0, 230.0)
    step = 5
    rows = list(range(0, 500, step)) + [499]
    cols = list(range(0, 500, step)) + [499]
    hs = np.zeros((len(rows), len(cols)), dtype=np.float32)
    xs = np.zeros_like(hs)
    zs = np.zeros_like(hs)
    for i, r in enumerate(rows):
        for j, c in enumerate(cols):
            win = dtm[max(0, r - 2): r + 3, max(0, c - 2): c + 3]
            h = float(np.nanmin(win))  # min keeps street level under removed buildings
            x5514 = -743699.5 + c
            y5514 = -1043400.5 - r
            wx, wy, wz = sjtsk_to_world(x5514, y5514, h)
            xs[i, j], hs[i, j], zs[i, j] = wx, wy, wz
    return {
        "rows": len(rows),
        "cols": len(cols),
        "pos": b64(np.stack([xs, hs, zs], -1).astype(np.float32)),
    }


# ---------------------------------------------------------------- OSM
def build_osm():
    d = json.load(open(SRC / "osm/osm_ulice_reka_okoli_nd_wgs84.geojson"))
    clip = box(-420, -420, 420, 420)
    river, bridges, roads = [], [], []
    for f in d["features"]:
        p, g = f["properties"], f["geometry"]
        if g["type"] == "Polygon" and (p.get("natural") == "water" and p.get("water") == "river"):
            poly = Polygon([wgs_to_world(*q[:2]) for q in g["coordinates"][0]],
                           [[wgs_to_world(*q[:2]) for q in h] for h in g["coordinates"][1:]])
            river.append(poly.buffer(0).intersection(clip))
        elif g["type"] == "Polygon" and p.get("man_made") == "bridge":
            poly = Polygon([wgs_to_world(*q[:2]) for q in g["coordinates"][0]]).buffer(0)
            if poly.intersects(clip) and poly.area > 400:
                bridges.append(poly.intersection(clip).simplify(0.3))
        elif g["type"] == "LineString" and p.get("highway") in ("residential", "service", "pedestrian", "tertiary", "secondary", "primary"):
            line = LineString([wgs_to_world(*q[:2]) for q in g["coordinates"]]).intersection(clip)
            if line.is_empty or line.length < 5:
                continue
            width = 14 if p.get("name") in ("Národní", "Masarykovo nábřeží", "Smetanovo nábřeží") else 8
            for part in getattr(line, "geoms", [line]):
                roads.append({"w": width, "name": p.get("name", ""), "bridge": p.get("bridge") == "yes",
                              "pts": [[round(x, 2), round(z, 2)] for x, z in part.simplify(0.5).coords]})

    def poly_json(poly):
        polys = list(getattr(poly, "geoms", [poly]))
        out = []
        for q in polys:
            if q.geom_type != "Polygon" or q.area < 50:
                continue
            q = q.simplify(0.6)
            out.append({"outer": [[round(x, 2), round(z, 2)] for x, z in q.exterior.coords[:-1]],
                        "holes": [[[round(x, 2), round(z, 2)] for x, z in h.coords[:-1]] for h in q.interiors]})
        return out

    return {
        "river": poly_json(unary_union(river)),
        "bridges": [pj for b in bridges for pj in poly_json(b)],
        "roads": roads,
    }


# ---------------------------------------------------------------- building frame
AZ = math.radians(353.6)
E_VEC = (math.cos(AZ), -math.sin(AZ))
V_VEC = (math.sin(AZ + math.pi), math.cos(AZ + math.pi))  # pointing south along the axis
ORIGIN_LOCAL = (-2.5, 36.6)  # local tmerc (east, north)


def to_b(p):
    dx, dy = p[0] - ORIGIN_LOCAL[0], p[1] - ORIGIN_LOCAL[1]
    return (round(dx * E_VEC[0] + dy * E_VEC[1], 2), round(dx * V_VEC[0] + dy * V_VEC[1], 2))


def build_frame():
    d = json.load(open(SRC / "ruian_cuzk/ruian_budovy_nd_lokalni_metry.json"))
    g = d["features"][0]["geometry"]
    ring = g["coordinates"][0] if g["type"] == "Polygon" else g["coordinates"][0][0]
    poly = Polygon([to_b(p) for p in ring]).simplify(0.4)
    return {
        "azimuthDeg": 353.6,
        "originWorld": [ORIGIN_LOCAL[0], 0, -ORIGIN_LOCAL[1]],
        "rotationY": math.atan2(E_VEC[1], E_VEC[0]),
        "footprint": [[x, v] for x, v in poly.exterior.coords[:-1]],
    }


def main():
    ruian = ruian_polys()
    site = {
        "attribution": "IPR Praha (CC BY 4.0), © OpenStreetMap contributors (ODbL), ČÚZK RÚIAN (CC BY 4.0)",
        "context": build_context(ruian),
        "terrain": build_terrain(),
        "osm": build_osm(),
        "frame": build_frame(),
    }
    OUT.write_text("// Generated by tools/prep_data.py – do not edit by hand.\nexport const SITE = " + json.dumps(site, separators=(",", ":")) + ";\n")
    print("wrote", OUT, round(OUT.stat().st_size / 1024), "KB")
    print("frame", site["frame"]["rotationY"], len(site["frame"]["footprint"]), "pts")
    print("river polys", len(site["osm"]["river"]), "bridges", len(site["osm"]["bridges"]), "roads", len(site["osm"]["roads"]))
    print({k: v["n"] for k, v in site["context"].items()})


if __name__ == "__main__":
    main()
