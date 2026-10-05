// Interior walls of every storey, traced from J. Fialka's measured plans of 1883
// (tools/prep_partitions.py). They rise with the masonry (stage 1) and are plastered with the
// interiors; in X-ray they stay faint behind the structure layer.
//
// The tracing gives each wall as a row of touching rectangles. Drawn as separate boxes, the faces where
// two boxes meet lie inside the wall; a section opens the wall and the dark inside of one box flickers
// against the lit face of the next. So the rectangles of a storey are merged into one solid with only
// its outer faces: a grid over the rectangle edges, every cell with the height of the wall on it.
import * as THREE from 'three/webgpu';
import { PARTITIONS } from '../data/partitions.js';

const TILE = 2;     // brick texture: 2 m per repeat, as on the masonry walls
const GAP_LOW = 0.01, GAP_TOP = 0.02; // clear of the floor slab below and of the storey above

// Solid of touching / disjoint rectangles [u0, u1, v0, v1] with heights hs, base at y = 0.
// Building frame: x = u, z = v. yUV shifts the texture so storeys line up.
function mergedWalls(rects, hs, yUV) {
  const us = [...new Set(rects.flatMap((r) => [r[0], r[1]]))].sort((a, b) => a - b);
  const vs = [...new Set(rects.flatMap((r) => [r[2], r[3]]))].sort((a, b) => a - b);
  const iu = new Map(us.map((u, i) => [u, i])), iv = new Map(vs.map((v, i) => [v, i]));
  const nu = us.length - 1, nv = vs.length - 1;
  const hgt = new Float32Array(nu * nv); // 0 = no wall
  rects.forEach(([u0, u1, v0, v1], k) => {
    for (let j = iv.get(v0); j < iv.get(v1); j++) hgt.fill(hs[k], j * nu + iu.get(u0), j * nu + iu.get(u1));
  });
  const H = (i, j) => (i >= 0 && i < nu && j >= 0 && j < nv ? hgt[j * nu + i] : 0);

  const pos = [], uv = [];
  const quad = (p, t) => { // p, t: four corners, counter-clockwise seen from the outside
    pos.push(...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]);
    uv.push(...t[0], ...t[1], ...t[2], ...t[0], ...t[2], ...t[3]);
  };
  const T = (a, b) => [a / TILE, b / TILE];
  // The mesh must be watertight: a corner of one face lying on the edge of another (a T-junction)
  // leaves pinholes that sparkle in motion. So along every grid line v = vs[j] the faces that touch it
  // share the same vertices: the places where the pair of cells on both sides of the line changes.
  const breaks = [];
  for (let j = 0; j <= nv; j++) {
    const b = [];
    for (let i = 1; i < nu; i++) if (H(i - 1, j - 1) !== H(i, j - 1) || H(i - 1, j) !== H(i, j)) b.push(i);
    breaks.push(b);
  }
  const inside = (list, a, b) => list.filter((i) => i > a && i < b);
  // vertical faces are cut at every wall height of the storey, so faces of different heights meet corner to corner
  const levels = [...new Set(hs.map(Math.fround))].sort((a, b) => a - b); // as stored in the float grid
  const spans = (a, b) => {
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const ys = [lo, ...levels.filter((y) => y > lo && y < hi), hi];
    return ys.slice(1).map((y, k) => [ys[k], y]);
  };
  // horizontal cap of row j over cells a…b at height y, split on both long edges, as a triangle strip
  const cap = (j, a, b, y, up) => {
    const v0 = vs[j], v1 = vs[j + 1];
    const P = [a, ...inside(breaks[j], a, b), b].map((i) => us[i]);
    const Q = [a, ...inside(breaks[j + 1], a, b), b].map((i) => us[i]);
    const tri = (p, q, r) => { // p, q, r: [u, v]; wound to face up or down
      const ny = (q[1] - p[1]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[1] - p[1]);
      if ((ny > 0) !== up) [q, r] = [r, q];
      pos.push(p[0], y, p[1], q[0], y, q[1], r[0], y, r[1]);
      uv.push(...T(p[0], p[1]), ...T(q[0], q[1]), ...T(r[0], r[1]));
    };
    let p = 0, q = 0;
    while (p < P.length - 1 || q < Q.length - 1) {
      if (q === Q.length - 1 || (p < P.length - 1 && P[p + 1] <= Q[q + 1])) { tri([P[p], v0], [P[p + 1], v0], [Q[q], v1]); p++; }
      else { tri([P[p], v0], [Q[q + 1], v1], [Q[q], v1]); q++; }
    }
  };
  for (let j = 0; j < nv; j++) {
    const v0 = vs[j], v1 = vs[j + 1];
    // caps: runs of cells along u (the top follows the wall height, the bottom spans every wall)
    for (let i = 0; i < nu;) {
      if (!H(i, j)) { i++; continue; }
      let k = i + 1;
      while (k < nu && H(k, j)) k++;
      cap(j, i, k, 0, false);
      for (let a = i; a < k;) {
        const h = H(a, j);
        let b = a + 1;
        while (b < k && H(b, j) === h) b++;
        cap(j, a, b, h, true);
        a = b;
      }
      i = k;
    }
    // faces across u: where the wall height steps between neighbouring cells
    for (let i = 0; i <= nu; i++) {
      const hl = H(i - 1, j), hr = H(i, j);
      if (hl === hr) continue;
      const u = us[i];
      for (const [lo, hi] of spans(hl, hr)) {
        const t = [T(v0, yUV + lo), T(v1, yUV + lo), T(v1, yUV + hi), T(v0, yUV + hi)];
        if (hr > hl) quad([[u, lo, v0], [u, lo, v1], [u, hi, v1], [u, hi, v0]], t); // faces −u
        else quad([[u, lo, v0], [u, hi, v0], [u, hi, v1], [u, lo, v1]], [t[0], t[3], t[2], t[1]]); // faces +u
      }
    }
  }
  // faces across v: runs of cells with the same pair of heights on both sides of the line
  for (let j = 0; j <= nv; j++) {
    const v = vs[j];
    for (let i = 0; i < nu;) {
      const hb = H(i, j - 1), hf = H(i, j);
      let k = i + 1;
      while (k < nu && H(k, j - 1) === hb && H(k, j) === hf) k++;
      if (hb !== hf) {
        const u0 = us[i], u1 = us[k];
        for (const [lo, hi] of spans(hb, hf)) {
          const t = [T(u0, yUV + lo), T(u0, yUV + hi), T(u1, yUV + hi), T(u1, yUV + lo)];
          if (hf > hb) quad([[u0, lo, v], [u0, hi, v], [u1, hi, v], [u1, lo, v]], t); // faces −v
          else quad([[u0, lo, v], [u1, lo, v], [u1, hi, v], [u0, hi, v]], [t[0], t[3], t[2], t[1]]); // faces +v
        }
      }
      i = k;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

export function buildPartitions(ctx) {
  const { root, M, R } = ctx;
  // storeys that start at the same height (the two ground-floor plans) touch: one solid for both
  const groups = new Map();
  PARTITIONS.levels.forEach((L, li) => {
    if (!L.rects.length) return;
    const key = L.y0.toFixed(2);
    if (!groups.has(key)) groups.set(key, { y0: L.y0, cellar: li === 0, rects: [], hs: [], names: [] });
    const g = groups.get(key);
    const h = L.y1 - L.y0 - GAP_LOW - GAP_TOP;
    for (const r of L.rects) { g.rects.push(r); g.hs.push(h); }
    g.names.push(L.src);
  });
  for (const g of groups.values()) {
    const base = g.y0 + GAP_LOW;
    const mesh = new THREE.Mesh(mergedWalls(g.rects, g.hs, base), M.brick);
    mesh.position.y = base; // the "rise" animation scales from the storey floor
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'partitions-' + g.names.join('+');
    root.add(mesh);
    // cellars belong to the foundations, the rest grows storey by storey with the walls;
    // faint in X-ray so the load-bearing structure stands out
    R.add(mesh, g.cellar
      ? { stage: 0, order: 0.5, mode: 'rise', dur: 0.2, xray: 'ghostSoft' }
      : { stage: 1, order: Math.min(0.92, Math.max(0, (g.y0 + 4.4) / 26)), mode: 'rise', dur: 0.15, xray: 'ghostSoft' });
  }
  return ctx;
}
