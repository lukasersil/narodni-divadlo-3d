import * as THREE from 'three/webgpu';
import {
  wallGeometry, capGeometry, offsetPolygon, mergeGeometries, clipBand, dedupe, ccw, edges,
} from '../core/geom.js';

// Mesh whose geometry is re-based so y = 0 is its lowest point (needed for the "rise" animation).
export function based(geometry, material, { cast = true, receive = true, name } = {}) {
  geometry.computeBoundingBox();
  const minY = geometry.boundingBox.min.y;
  geometry.translate(0, -minY, 0);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = minY;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (name) mesh.name = name;
  return mesh;
}

// Thick wall ring: outer faces on `poly`, inner faces inset by `t`, ring cap on top.
export function ringWall(poly, y0, y1, t = 0.9, tile = 4) {
  const inner = offsetPolygon(poly, -t);
  return mergeGeometries([
    wallGeometry(poly, y0, y1, tile),
    wallGeometry(inner.slice().reverse(), y0, y1, tile),
    capGeometry(poly, y1, true, [inner], tile),
  ]);
}

// Clip by u (x) range
function clipHalf(poly, nx, nz, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const dp = p[0] * nx + p[1] * nz - c;
    const dq = q[0] * nx + q[1] * nz - c;
    if (dp >= 0) out.push(p);
    if ((dp >= 0) !== (dq >= 0)) {
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

export function clipBox(poly, uMin, uMax, vMin, vMax) {
  let p = clipBand(poly, vMin, vMax);
  p = clipHalf(p, 1, 0, uMin);
  p = clipHalf(p, -1, 0, -uMax);
  return dedupe(p);
}

export function rect(u0, u1, v0, v1) {
  return ccw([[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
}

// Horseshoe (U) outline: semicircle-ish back of radius r centred at (0, cv) plus straight legs to v = vFront.
export function horseshoe(halfWidth, cv, k, frontV, segs = 28) {
  const pts = [[halfWidth, frontV]];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI;
    pts.push([Math.cos(a) * halfWidth, cv - Math.sin(a) * halfWidth * k]);
  }
  pts.push([-halfWidth, frontV]);
  return pts;
}

// Hip roof with a flat top: loft from poly at y0 to poly inset by `inset` at y1.
export function hipRoofGeometry(poly, y0, y1, inset, tile = 3) {
  const top = offsetPolygon(poly, -inset);
  const n = poly.length;
  const pos = [];
  const uv = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], c = top[(i + 1) % n], d = top[i];
    const A = [a[0], y0, a[1]], B = [b[0], y0, b[1]], C = [c[0], y1, c[1]], D = [d[0], y1, d[1]];
    const w = Math.hypot(b[0] - a[0], b[1] - a[1]) / tile;
    const h = Math.hypot(inset, y1 - y0) / tile;
    pos.push(...A, ...C, ...B, ...A, ...D, ...C);
    uv.push(0, 0, w, h, w, 0, 0, 0, 0, h, w, h);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return mergeGeometries([g, capGeometry(top, y1, true, [], tile)]);
}

export function mergeInto(list) {
  return mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));
}

// Outward walls for the edges of a polygon that pass `keep(edge)` (internal joints are left out).
export function wallEdges(poly, y0, y1, keep, tile = 4) {
  const pos = [], uv = [];
  let s = 0;
  for (const e of edges(poly)) {
    const len = e.len;
    if (keep(e)) {
      const a = [e.p[0], y0, e.p[1]], b = [e.q[0], y0, e.q[1]], c = [e.q[0], y1, e.q[1]], d = [e.p[0], y1, e.p[1]];
      const u0 = s / tile, u1 = (s + len) / tile;
      pos.push(...a, ...c, ...b, ...a, ...d, ...c);
      uv.push(u0, y0 / tile, u1, y1 / tile, u1, y0 / tile, u0, y0 / tile, u0, y1 / tile, u1, y1 / tile);
    }
    s += len;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// edges that are joints between building parts (not exterior façades)
export const JOINT = {
  main: (e) => e.n[1] > 0.8 && e.p[1] > 40,          // south side of the main block → stage continues
  south: (e) => e.n[1] < -0.8 && e.p[1] < 55,        // north side of the south wing
  loggia: (e) => e.n[1] > 0.8,                         // back of the loggia block
  terrace: (e) => e.n[0] > 0.8,                        // east side of the terrace wing
};
