"""Print dark-line crossings of a Fialka plan along lines in the auditorium frame.

Usage: python3 tools/qa/plan_profile.py <level 1–7> [thin]
Across the axis at several v (u from −15 to 15) and along the axis (v from 6 to 38).
"thin" keeps thin lines (raw threshold), otherwise only solid walls (opened mask).
"""
import math
import sys

sys.path.insert(0, 'tools')
import numpy as np
from scipy import ndimage

import prep_partitions as P

level = int(sys.argv[1])
thin = len(sys.argv) > 2 and sys.argv[2] == 'thin'
c, s = math.cos(P.AX_ANG), math.sin(P.AX_ANG)


def a2b(u, v):
    z = v - P.AX_PIVOT
    return P.AX_SHIFT + u * c + z * s, P.AX_PIVOT - u * s + z * c


name = P.LEVELS[level - 1][0]
g = P.load(name)
mask = P.building_mask(g)
walls = ndimage.binary_opening(g < 105, structure=np.ones((6, 6)))
params, fit, to_px = P.register(mask, walls)
dark = (g < 140) if thin else walls


def runs(us, vs, coord):
    bu, bv = a2b(us, vs)
    x, y = to_px(params, bu, bv)
    xi = np.clip(x.astype(int), 0, g.shape[1] - 1)
    yi = np.clip(y.astype(int), 0, g.shape[0] - 1)
    hit = dark[yi, xi]
    out, i = [], 0
    while i < len(hit):
        if hit[i]:
            j = i
            while j < len(hit) and hit[j]:
                j += 1
            a, b = coord[i], coord[j - 1]
            out.append(f'{a:.2f}' if b - a < 0.12 else f'{a:.2f}…{b:.2f}')
            i = j
        else:
            i += 1
    return out


print('level', level, name[:40], 'thin' if thin else 'walls')
us = np.arange(-15, 15, 0.02)
for v in (20, 22, 24, 26, 28, 30, 32, 34):
    print(f' v={v:2d}:', ' '.join(runs(us, np.full_like(us, v), us)))
vs = np.arange(6, 38, 0.02)
for u in (0.0, 3.0, -3.0):
    print(f' u={u:+.0f}:', ' '.join(runs(np.full_like(vs, u), vs, vs)))
