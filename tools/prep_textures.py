"""Builds interior textures in assets/ from the reference photos and procedural drawing.

Run:  python3 tools/prep_textures.py      (needs numpy + Pillow)

Sources (podklady/04_interier_reference, see ZDROJE.md there):
- int_opona_hynais_foto.jpg – Hynais curtain in the portal, photo Lehotsky, CC BY-SA 3.0 (painting 1883, PD)
- int_strop_hlediste_kruh.jpg – the auditorium ceiling photographed straight up, photo Dobroš, CC BY-SA 4.0
  (rectified to the plan by ceiling_photo(); Ženíšek's paintings 1881–83 are PD)
- int_foyer_strop_zenisek.jpg, int_foyer_hlavni_1.jpg – foyer ceiling and lunettes, photos Palickap, CC BY-SA 3.0
The parapet reliefs (parapet_tiers) and the frieze are drawn procedurally.
"""
import math
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance, ImageOps

# the research pack (plans, photos, map data) is not in the repository: it sits next to it, or where ND_PODKLADY points
PODKLADY = Path(os.environ.get("ND_PODKLADY", Path(__file__).resolve().parents[2] / "narodni-divadlo-podklady"))
REF = PODKLADY / "04_interier_reference"
OUT = Path(__file__).resolve().parents[1] / "assets"
FONT = "/System/Library/Fonts/Supplemental/Didot.ttc"
rng = np.random.default_rng(7)


def perspective_coeffs(dst, src):
    """Coefficients for Image.transform(PERSPECTIVE): maps output (dst) points to input (src)."""
    A, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); b.append(v)
    return np.linalg.solve(np.array(A, float), np.array(b, float)).tolist()


def save(img, name, q=82):
    img.convert("RGB").save(OUT / name, quality=q, optimize=True)
    print(name, img.size, round((OUT / name).stat().st_size / 1024), "KB")


GOLD = (214, 172, 92)
GOLD_D = (122, 88, 38)
GOLD_L = (246, 220, 150)


# ---------------------------------------------------------------------- curtain + lambrequin
def curtain():
    im = Image.open(REF / "int_opona_hynais_foto.jpg").convert("RGB")
    W, H = 1536, 1024
    src = [(941, 1165), (2998, 1150), (2919, 2470), (1009, 2470)]
    dst = [(0, 0), (W, 0), (W, H), (0, H)]
    out = im.transform((W, H), Image.PERSPECTIVE, perspective_coeffs(dst, src), Image.BICUBIC)
    out = ImageEnhance.Brightness(out).enhance(1.22)
    out = ImageEnhance.Contrast(out).enhance(1.1)
    out = ImageEnhance.Color(out).enhance(0.95)
    save(out, "tex_curtain.jpg")

    lam = im.crop((944, 690, 3006, 1150)).resize((1536, 344), Image.BICUBIC)
    lam = ImageEnhance.Contrast(lam).enhance(1.1)
    save(lam, "tex_lambrequin.jpg")


def arabesque(d, cx, cy, size, ang, col=GOLD):
    """Small symmetric gilded scroll ornament."""
    for s in (-1, 1):
        pts = []
        for i in range(24):
            t = i / 23
            r = size * (0.15 + 0.85 * t)
            a = ang + s * (0.4 + t * 2.6)
            pts.append((cx + math.cos(a) * r * 0.55, cy + math.sin(a) * r * 0.55))
        d.line(pts, fill=col, width=max(2, int(size / 18)))
    d.ellipse((cx - size * 0.1, cy - size * 0.1, cx + size * 0.1, cy + size * 0.1), fill=col)


def ceiling_photo():
    """The painted ceiling (r ≤ 7.4 m) rectified from Dobroš's photo taken straight up (int_strop_hlediste_kruh.jpg,
    CC BY-SA 4.0): the eight dark rosettes on the porphyry band (r 8.2 m, half-way between the fields) fix a
    homography from the plan (texture) to the photo. A photo looking up is mirrored against the plan; its bottom
    edge is the stage side. Measured on the rectified photo: openwork grille Ø ≈ 4.4 m, coral ring with rosettes
    to r ≈ 3.3 m, the eight fields from r ≈ 3.6 to 7.0 (the chandelier, Ø 3 m at 4.5 m below, checks the scale).
    The chandelier hides part of the centre: that patch is taken from the half turned by 180° (the ornament is
    eight-fold), and the grille opening is left dark for the 3D grille."""
    N, R_M, R_ROS = 2048, 7.4, 8.2
    im = Image.open(REF / "int_strop_hlediste_kruh.jpg").convert("RGB")
    photo = [(714.0, 164.6), (1427.6, 232.1), (1815.8, 771.9), (1756.0, 1407.7),
             (1292.4, 1867.2), (615.0, 1869.1), (163.6, 1366.9), (185.7, 673.2)]
    cx = sum(p[0] for p in photo) / 8
    cy = sum(p[1] for p in photo) / 8
    plan = []
    for x, y in photo:
        # plan angle of the rosette (x mirrored, y towards the stage), snapped to the ideal (k + ½)·45°
        a = math.atan2(y - cy, -(x - cx))
        k = round(a / (math.pi / 4) - 0.5)
        a = (k + 0.5) * math.pi / 4
        plan.append((R_ROS * math.cos(a), R_ROS * math.sin(a)))
    # homography plan (X east, Z towards the stage, metres) -> photo pixels
    A, bvec = [], []
    for (X, Z), (u, v) in zip(plan, photo):
        A.append([X, Z, 1, 0, 0, 0, -u * X, -u * Z]); bvec.append(u)
        A.append([0, 0, 0, X, Z, 1, -v * X, -v * Z]); bvec.append(v)
    h = np.linalg.lstsq(np.array(A, float), np.array(bvec, float), rcond=None)[0]
    Hm = np.array([[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1.0]])
    err = []
    for (X, Z), (u, v) in zip(plan, photo):
        q = Hm @ [X, Z, 1]
        err.append(math.hypot(q[0] / q[2] - u, q[1] / q[2] - v))
    print("ceiling homography: rosette fit error px", [round(e, 1) for e in err])
    # texture pixel (col, row) -> plan metres -> photo
    s = 2 * R_M / N
    Apx = np.array([[s, 0, -R_M], [0, s, -R_M], [0, 0, 1]])
    Hc = Hm @ Apx
    Hc = Hc / Hc[2, 2]
    coeffs = [Hc[0, 0], Hc[0, 1], Hc[0, 2], Hc[1, 0], Hc[1, 1], Hc[1, 2], Hc[2, 0], Hc[2, 1]]
    tex = im.transform((N, N), Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    # the chandelier (a disc in the photo) and its glare: refill from the mirrored half of the ceiling
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).ellipse((1090 - 245, 1187 - 245, 1090 + 245, 1187 + 245), fill=255)
    mask = mask.transform((N, N), Image.PERSPECTIVE, coeffs, Image.BILINEAR).filter(ImageFilter.GaussianBlur(10))
    tex = Image.composite(tex.rotate(180), tex, mask)
    # what is left of the glare (very bright pixels round the centre) the same way
    arr = np.asarray(tex).astype(int)
    yy, xx = np.mgrid[0:N, 0:N]
    rr = np.hypot(xx - N / 2, yy - N / 2) * (2 * R_M / N)
    glare = (arr.min(axis=2) > 236) & (rr < 4.2)
    gm = Image.fromarray((glare * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(4))
    tex = Image.composite(tex.rotate(180), tex, gm)
    # The fields' grounds are pale sky-blue; under the warm house lights the photo shows them warm grey. Inside
    # the eight cartouches (r 3.7–6.45 m, ≈ 1.9 m wide) shift the unsaturated pixels (sky) towards blue.
    c = N / 2
    px = N / (2 * R_M)  # pixels per metre
    fm = Image.new("L", (N, N), 0)
    fd = ImageDraw.Draw(fm)
    for k in range(8):
        a = -math.pi / 2 + k * math.pi / 4
        ux, uy = math.cos(a), math.sin(a)
        for r in np.linspace(3.7 + 0.95, 6.45 - 0.95, 40):
            x, y = c + ux * r * px, c + uy * r * px
            fd.ellipse((x - 0.95 * px, y - 0.95 * px, x + 0.95 * px, y + 0.95 * px), fill=255)
    fm = fm.filter(ImageFilter.GaussianBlur(6))
    arr = np.asarray(tex).astype(float) / 255
    mx, mn = arr.max(axis=2), arr.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    w = np.clip((0.32 - sat) / 0.16, 0, 1) * (np.asarray(fm) / 255)
    sky = arr * np.array([0.84, 1.0, 1.28]) * 1.22
    arr = arr * (1 - w[..., None]) + np.clip(sky, 0, 1) * w[..., None]
    tex = Image.fromarray((arr * 255).astype(np.uint8))
    tex = ImageEnhance.Brightness(tex).enhance(1.18)
    tex = ImageEnhance.Contrast(tex).enhance(1.05)
    d = ImageDraw.Draw(tex)
    d.ellipse((c - 2.2 * px, c - 2.2 * px, c + 2.2 * px, c + 2.2 * px), fill=(24, 20, 18))  # grille opening
    save(tex, "tex_ceiling.jpg", 82)


# ---------------------------------------------------------------------- frieze "NÁROD SOBĚ"
def shield(d, x, y, w, h, field, emblem):
    d.polygon([(x - w / 2, y - h / 2), (x + w / 2, y - h / 2), (x + w / 2, y + h * 0.1), (x, y + h / 2), (x - w / 2, y + h * 0.1)], fill=field, outline=GOLD_L)
    d.line([(x - w / 2 - 6, y - h / 2 - 6), (x + w / 2 + 6, y - h / 2 - 6)], fill=GOLD, width=8)
    ex, ey = x, y - h * 0.05
    if emblem == "lion":
        d.ellipse((ex - w * 0.16, ey - h * 0.28, ex + w * 0.12, ey - h * 0.02), fill=(240, 236, 228))
        d.polygon([(ex - w * 0.22, ey + h * 0.25), (ex - w * 0.06, ey - h * 0.08), (ex + w * 0.14, ey - h * 0.04), (ex + w * 0.2, ey + h * 0.24)], fill=(240, 236, 228))
        d.line([(ex + w * 0.18, ey + h * 0.1), (ex + w * 0.3, ey - h * 0.2), (ex + w * 0.24, ey - h * 0.3)], fill=(240, 236, 228), width=6)
        d.polygon([(ex - w * 0.16, ey - h * 0.28), (ex - w * 0.08, ey - h * 0.4), (ex, ey - h * 0.28), (ex + w * 0.08, ey - h * 0.4), (ex + w * 0.12, ey - h * 0.26)], fill=GOLD_L)
    else:
        col = (24, 22, 22) if emblem == "eagle" else (200, 40, 40)
        d.ellipse((ex - w * 0.08, ey - h * 0.3, ex + w * 0.08, ey - h * 0.12), fill=col)
        d.polygon([(ex - w * 0.38, ey - h * 0.2), (ex, ey - h * 0.08), (ex + w * 0.38, ey - h * 0.2), (ex + w * 0.2, ey + h * 0.22), (ex, ey + h * 0.3), (ex - w * 0.2, ey + h * 0.22)], fill=col)


def frieze():
    W, H = 2048, 240
    img = Image.new("RGB", (W, H), (111, 156, 146))
    d = ImageDraw.Draw(img)
    # gilded fillets top and bottom, delicate scrolls in the field
    for y0, y1 in ((0, 20), (H - 20, H)):
        d.rectangle((0, y0, W, y1), fill=GOLD)
        d.line([(0, (y0 + y1) // 2), (W, (y0 + y1) // 2)], fill=GOLD_L, width=3)
    for x in range(40, W, 90):
        arabesque(d, x, H / 2, 70, 0, (190, 170, 110))
    font = ImageFont.truetype(FONT, 136, index=0) if Path(FONT).exists() else ImageFont.load_default()
    for text, cx in (("NÁROD", 560), ("SOBĚ", 1490)):
        spaced = " ".join(text)
        bbox = d.textbbox((0, 0), spaced, font=font)
        x = cx - (bbox[2] - bbox[0]) / 2
        # backing panel so the letters read over the scrolls
        d.rectangle((x - 30, 34, x + bbox[2] - bbox[0] + 30, H - 34), fill=(111, 156, 146))
        d.text((x + 3, 48 + 3), spaced, font=font, fill=(80, 58, 22))
        d.text((x, 48), spaced, font=font, fill=(240, 206, 120))
    shield(d, 1024, H / 2, 150, 176, (180, 34, 40), "lion")
    for x in (92, W - 92):
        shield(d, x, H / 2, 112, 140, (232, 198, 92), "eagle")
    save(img, "tex_frieze.jpg")


# ---------------------------------------------------------------------- gilded relief parapets (photos of the tiers)
# One tile = 5.2 m along the front × ≈ 1.3 m high, four 1.3 m units. The material multiplies this map by gold,
# so the map carries relief as light (raised, lit) and dark (recessed, shadow) values.
RL = (246, 226, 168)   # raised, lit
RM = (205, 168, 96)    # ground
RD = (112, 78, 34)     # shadow / outline


def _beads(d, W, y0, y1):
    d.rectangle((0, y0, W, y1), fill=RD)
    cy = (y0 + y1) / 2
    for x in range(0, W, 18):
        d.ellipse((x + 2, cy - 6, x + 12, cy + 6), fill=RL)
        d.ellipse((x + 13, cy - 2, x + 17, cy + 2), fill=RM)


def _egg_dart(d, W, y0, y1):
    d.rectangle((0, y0, W, y1), fill=RD)
    for x in range(0, W, 32):
        d.ellipse((x + 4, y0 + 3, x + 24, y1 - 2), fill=RL, outline=RD, width=2)
        d.polygon([(x + 28, y0 + 4), (x + 31, y1 - 4), (x + 25, y1 - 4)], fill=RM)


def _palmette(d, cx, base, h, n=9):
    for k in range(n):
        a = math.pi * (0.12 + 0.76 * k / (n - 1))
        L = h * (0.75 + 0.25 * math.sin(math.pi * k / (n - 1)))
        tip = (cx - math.cos(a) * L, base - math.sin(a) * L)
        mid = ((cx + tip[0]) / 2, (base + tip[1]) / 2)
        wdt = h * 0.11
        nx, ny = -math.sin(a) * wdt, math.cos(a) * wdt
        d.polygon([(cx, base), (mid[0] + nx, mid[1] - ny), tip, (mid[0] - nx, mid[1] + ny)], fill=RL, outline=RD)
    for s in (-1, 1):  # volutes at the foot
        d.arc((cx + s * 10 - 16, base - 10, cx + s * 10 + 16, base + 22), 0, 360, fill=RD, width=4)
    d.ellipse((cx - 9, base - 9, cx + 9, base + 9), fill=RL, outline=RD, width=3)


def _angel(d, cx, top, h):
    """Standing winged genius holding a wreath (schematic high relief)."""
    head = top + h * 0.12
    for s in (-1, 1):  # wings
        pts = [(cx + s * 10, head + 22)]
        for t in np.linspace(0, 1, 9):
            pts.append((cx + s * (14 + 62 * math.sin(t * math.pi * 0.62)), head + 18 + t * h * 0.52 - 18 * math.sin(t * math.pi)))
        pts.append((cx + s * 12, head + h * 0.45))
        d.polygon(pts, fill=RL, outline=RD)
        for t in np.linspace(0.25, 0.85, 4):  # feather lines
            x = cx + s * (14 + 52 * math.sin(t * math.pi * 0.62))
            y = head + 18 + t * h * 0.52 - 18 * math.sin(t * math.pi)
            d.line([(cx + s * 16, head + 30 + t * 20), (x, y)], fill=RD, width=2)
    d.polygon([(cx - 13, head + 18), (cx + 13, head + 18), (cx + 24, top + h), (cx - 24, top + h)], fill=RL, outline=RD)  # robe
    for t in (-0.5, 0, 0.5):
        d.line([(cx + t * 10, head + 40), (cx + t * 30, top + h - 4)], fill=RD, width=2)  # folds
    d.ellipse((cx - 11, head - 11, cx + 11, head + 11), fill=RL, outline=RD, width=3)
    d.ellipse((cx - 17, head + 26, cx + 17, head + 58), outline=RD, width=7)   # wreath held at the breast
    d.ellipse((cx - 17, head + 26, cx + 17, head + 58), outline=RL, width=3)


def parapet_tiers():
    W, H = 1024, 256
    # I. and II. balcony, I. gallery: diamond lattice ground, winged genii between acanthus palmettes
    img = Image.new("RGB", (W, H), RM)
    d = ImageDraw.Draw(img)
    for x in range(-H, W + H, 24):
        d.line([(x, 30), (x + 196, 226)], fill=RD, width=2)
        d.line([(x, 226), (x + 196, 30)], fill=RD, width=2)
    for x in range(0, W, 24):
        for y in range(42, 226, 24):
            d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=RL)
    _beads(d, W, 0, 28)
    _egg_dart(d, W, 226, H)
    for k in range(4):
        cx = k * W / 4 + W / 8
        if k % 2 == 0:
            _angel(d, cx, 40, 178)
        else:
            _palmette(d, cx, 206, 150)
    arr = np.asarray(img).astype(np.int16) + rng.integers(-5, 6, (H, W))[..., None]
    save(Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)), "tex_parapet.jpg")

    # stall boxes and proscenium boxes: running acanthus scroll with oval medallions
    img = Image.new("RGB", (W, H), RM)
    d = ImageDraw.Draw(img)
    _beads(d, W, 0, 28)
    _egg_dart(d, W, 226, H)
    stem = [(x, 128 + 52 * math.sin(x / W * 8 * math.pi)) for x in range(0, W + 1, 4)]
    d.line(stem, fill=RD, width=12)
    d.line(stem, fill=RL, width=6)
    for k in range(8):
        x0 = k * W / 8 + W / 16
        y0 = 128 + 52 * math.sin(x0 / W * 8 * math.pi)
        s = 1 if k % 2 else -1
        cx, cy = x0 + 26, y0 - s * 34
        d.arc((cx - 30, cy - 30, cx + 30, cy + 30), 0, 360, fill=RD, width=8)
        d.arc((cx - 30, cy - 30, cx + 30, cy + 30), 20, 300, fill=RL, width=4)
        d.ellipse((cx - 10, cy - 10, cx + 10, cy + 10), fill=RL, outline=RD, width=3)
        for t in np.linspace(0.2, 0.8, 3):  # leaves along the stem
            lx = x0 - 40 + t * 80
            ly = 128 + 52 * math.sin(lx / W * 8 * math.pi)
            d.ellipse((lx - 16, ly - s * 22 - 8, lx + 16, ly - s * 22 + 8), fill=RL, outline=RD, width=2)
    for k in range(4):  # oval medallions with a rosette
        cx = k * W / 4 + W / 8
        d.ellipse((cx - 40, 60, cx + 40, 196), fill=RM, outline=RD, width=8)
        d.ellipse((cx - 32, 68, cx + 32, 188), outline=RL, width=4)
        for j in range(8):
            a = j / 8 * math.tau
            d.ellipse((cx + math.cos(a) * 16 - 9, 128 + math.sin(a) * 24 - 9, cx + math.cos(a) * 16 + 9, 128 + math.sin(a) * 24 + 9), fill=RL, outline=RD, width=2)
        d.ellipse((cx - 7, 121, cx + 7, 135), fill=RD)
    arr = np.asarray(img).astype(np.int16) + rng.integers(-5, 6, (H, W))[..., None]
    save(Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)), "tex_parapet_scroll.jpg")


# ---------------------------------------------------------------------- painted scenery for the fly tower
def backdrops():
    W, H = 1024, 512
    a = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(a)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(int(120 + 90 * t), int(150 + 60 * t), int(190 - 40 * t)))
    for k, col in enumerate([(92, 112, 96), (70, 94, 74), (52, 74, 56)]):
        pts = [(x, H * (0.45 + 0.1 * k) + math.sin(x / (90 + 30 * k) + k) * (30 + 10 * k)) for x in range(0, W + 8, 8)]
        d.polygon(pts + [(W, H), (0, H)], fill=col)
    for i in range(14):
        x = rng.integers(0, W)
        y = int(H * 0.72 + rng.integers(-20, 30))
        d.ellipse((x - 40, y - 120, x + 40, y), fill=(40, 62, 42))
        d.rectangle((x - 5, y - 10, x + 5, y + 40), fill=(60, 44, 30))
    save(a.filter(ImageFilter.GaussianBlur(1.2)), "tex_backdrop_landscape.jpg", 78)

    b = Image.new("RGB", (W, H), (196, 176, 140))
    d = ImageDraw.Draw(b)
    for y in range(H // 2):
        d.line([(0, y), (W, y)], fill=(int(150 + y / 6), int(170 + y / 8), int(196)))
    d.rectangle((0, int(H * 0.78), W, H), fill=(150, 126, 96))
    for i in range(8):
        x = 70 + i * 125
        d.rectangle((x, int(H * 0.22), x + 46, int(H * 0.78)), fill=(232, 218, 190), outline=(150, 130, 100), width=3)
        d.rectangle((x - 10, int(H * 0.2), x + 56, int(H * 0.24)), fill=(214, 198, 168))
    d.rectangle((40, int(H * 0.12), W - 40, int(H * 0.21)), fill=(222, 206, 176), outline=(150, 130, 100), width=3)
    d.polygon([(40, int(H * 0.12)), (W / 2, int(H * 0.0)), (W - 40, int(H * 0.12))], fill=(214, 198, 168))
    save(b.filter(ImageFilter.GaussianBlur(1.0)), "tex_backdrop_temple.jpg", 78)


# ---------------------------------------------------------------------- foyer: Ženíšek's ceiling paintings, Aleš's lunettes
def foyer():
    # central ceiling field (int_foyer_strop_zenisek.jpg, below the Greek-key border)
    im = Image.open(REF / "int_foyer_strop_zenisek.jpg").convert("RGB")
    paint = im.crop((0, 280, im.width, im.height)).resize((1024, 620), Image.LANCZOS)
    paint = ImageEnhance.Brightness(paint).enhance(1.15)
    save(paint, "tex_foyer_ceiling.jpg")
    # one of Aleš's "Vlast" lunettes on the cove (int_foyer_hlavni_1.jpg), as the upper half of a square
    # texture so that a half-disc (CircleGeometry 0…π) maps it directly
    im = Image.open(REF / "int_foyer_hlavni_1.jpg").convert("RGB")
    lun = im.crop((880, 873, 1450, 1233)).resize((1024, 512), Image.LANCZOS)
    lun = ImageEnhance.Brightness(lun).enhance(1.35)
    lun = ImageEnhance.Contrast(lun).enhance(1.15)
    sq = Image.new("RGB", (1024, 1024), (90, 70, 50))
    sq.paste(lun, (0, 0))
    save(sq, "tex_foyer_lunette.jpg")


if __name__ == "__main__":
    import sys
    # all textures, or only the ones named:  python3 tools/prep_textures.py ceiling_photo frieze
    jobs = {f.__name__: f for f in (foyer, curtain, ceiling_photo, frieze, parapet_tiers, backdrops)}
    for name in sys.argv[1:] or list(jobs):
        jobs[name]()
