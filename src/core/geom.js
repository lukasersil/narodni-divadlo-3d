// Geometry helpers. Polygons are arrays of [x, z] in metres, counter-clockwise in (x, z)
// (positive signed area), so the outward normal of edge p→q is (dz, −dx).
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { mergeGeometries };

export function signedArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, z0] = poly[i];
    const [x1, z1] = poly[(i + 1) % poly.length];
    a += x0 * z1 - x1 * z0;
  }
  return a / 2;
}

export function ccw(poly) {
  return signedArea(poly) < 0 ? poly.slice().reverse() : poly.slice();
}

function edgeNormal(p, q) {
  const dx = q[0] - p[0];
  const dz = q[1] - p[1];
  const l = Math.hypot(dx, dz) || 1;
  return [dz / l, -dx / l];
}

// Miter offset; d > 0 grows the polygon. Miter length is clamped at sharp corners.
export function offsetPolygon(poly, d) {
  const n = poly.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p0 = poly[(i - 1 + n) % n];
    const p1 = poly[i];
    const p2 = poly[(i + 1) % n];
    const a = edgeNormal(p0, p1);
    const b = edgeNormal(p1, p2);
    const k = 1 + a[0] * b[0] + a[1] * b[1];
    let mx = (a[0] + b[0]) / Math.max(k, 0.25);
    let mz = (a[1] + b[1]) / Math.max(k, 0.25);
    out.push([p1[0] + mx * d, p1[1] + mz * d]);
  }
  return out;
}

// Sutherland–Hodgman clip by the half-plane dot([x,z], n) >= c.
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

// Part of the polygon with zMin <= z <= zMax.
export function clipBand(poly, zMin, zMax) {
  let p = clipHalf(poly, 0, 1, zMin);
  p = clipHalf(p, 0, -1, -zMax);
  return dedupe(p);
}

export function dedupe(poly, eps = 0.02) {
  const out = [];
  for (const p of poly) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > eps) out.push(p);
  }
  if (out.length > 1 && Math.hypot(out[0][0] - out.at(-1)[0], out[0][1] - out.at(-1)[1]) <= eps) out.pop();
  return out;
}

export function polyCentroid(poly) {
  let x = 0, z = 0;
  for (const p of poly) { x += p[0]; z += p[1]; }
  return [x / poly.length, z / poly.length];
}

export function pointInPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// Interpolated point along a polygon edge list.
export function edges(poly) {
  const list = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const dx = q[0] - p[0];
    const dz = q[1] - p[1];
    const len = Math.hypot(dx, dz);
    if (len < 1e-3) continue;
    list.push({ p, q, len, dir: [dx / len, dz / len], n: [dz / len, -dx / len], angle: Math.atan2(-dz, dx) });
  }
  return list;
}

// --------------------------------------------------------------------- builders

class GeoBuilder {
  constructor() {
    this.pos = [];
    this.uv = [];
  }
  tri(a, b, c, ua, ub, uc) {
    this.pos.push(...a, ...b, ...c);
    this.uv.push(...ua, ...ub, ...uc);
  }
  quad(a, b, c, d, ua, ub, uc, ud) {
    // a-b bottom, c-d top, front face is (a, c, b) wound → outward for CCW walls
    this.tri(a, c, b, ua, uc, ub);
    this.tri(a, d, c, ua, ud, uc);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeVertexNormals();
    return g;
  }
}

// Vertical outward-facing walls of a polygon between y0 and y1. UVs in metres / tile.
export function wallGeometry(poly, y0, y1, tile = 4) {
  const b = new GeoBuilder();
  let s = 0;
  for (const e of edges(poly)) {
    const a = [e.p[0], y0, e.p[1]];
    const bb = [e.q[0], y0, e.q[1]];
    const c = [e.q[0], y1, e.q[1]];
    const d = [e.p[0], y1, e.p[1]];
    const u0 = s / tile, u1 = (s + e.len) / tile;
    b.quad(a, bb, c, d, [u0, y0 / tile], [u1, y0 / tile], [u1, y1 / tile], [u0, y1 / tile]);
    s += e.len;
  }
  return b.build();
}

// Inward-facing walls (for the inside of a hollow shell).
export function innerWallGeometry(poly, y0, y1, tile = 4) {
  return wallGeometry(poly.slice().reverse(), y0, y1, tile);
}

// Flat cap at height y. up=true faces +y.
export function capGeometry(poly, y, up = true, holes = [], tile = 4) {
  const contour = poly.map(([x, z]) => new THREE.Vector2(x, z));
  const holeV = holes.map((h) => h.map(([x, z]) => new THREE.Vector2(x, z)));
  const tris = THREE.ShapeUtils.triangulateShape(contour, holeV);
  const all = [...contour, ...holeV.flat()];
  const b = new GeoBuilder();
  const P = (n) => [all[n].x, y, all[n].y];
  const U = (n) => [all[n].x / tile, all[n].y / tile];
  for (const t of tris) {
    let [i, j, k] = t;
    const a = all[i], bb = all[j], c = all[k];
    // y component of (b−a)×(c−a) in (x, y=height, z) space
    const ny = (bb.y - a.y) * (c.x - a.x) - (bb.x - a.x) * (c.y - a.y);
    if ((ny > 0) !== up) [j, k] = [k, j];
    b.tri(P(i), P(j), P(k), U(i), U(j), U(k));
  }
  const g = b.build();
  return g;
}

// Closed solid prism (walls + both caps).
export function prismGeometry(poly, y0, y1, tile = 4) {
  return mergeGeometries([
    wallGeometry(poly, y0, y1, tile),
    capGeometry(poly, y1, true, [], tile),
    capGeometry(poly, y0, false, [], tile),
  ]);
}

// Sweep a 2D profile [[offset, y], ...] along a polygon (closed) or polyline (closed=false).
// Offsets grow outward from the polygon. Profile should run bottom→top along the outer silhouette.
export function sweepGeometry(poly, profile, { closed = true, tile = 2, tileU = tile, tileV = tile } = {}) {
  const n = poly.length;
  const miters = [];
  for (let i = 0; i < n; i++) {
    const hasPrev = closed || i > 0;
    const hasNext = closed || i < n - 1;
    const a = hasPrev ? edgeNormal(poly[(i - 1 + n) % n], poly[i]) : null;
    const bN = hasNext ? edgeNormal(poly[i], poly[(i + 1) % n]) : null;
    if (a && bN) {
      const k = 1 + a[0] * bN[0] + a[1] * bN[1];
      miters.push([(a[0] + bN[0]) / Math.max(k, 0.3), (a[1] + bN[1]) / Math.max(k, 0.3)]);
    } else miters.push(a || bN);
  }
  // cumulative perimeter length for U
  const along = [0];
  for (let i = 1; i <= n; i++) {
    const p = poly[i - 1];
    const q = poly[i % n];
    along.push(along[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1]));
  }
  const profLen = [0];
  for (let j = 1; j < profile.length; j++) {
    profLen.push(profLen[j - 1] + Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]));
  }
  const P = (i, j) => {
    const k = i % n;
    const [o, y] = profile[j];
    return [poly[k][0] + miters[k][0] * o, y, poly[k][1] + miters[k][1] * o];
  };
  const b = new GeoBuilder();
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < profile.length - 1; j++) {
      const u0 = along[i] / tileU, u1 = along[i + 1] / tileU;
      const v0 = profLen[j] / tileV, v1 = profLen[j + 1] / tileV;
      b.quad(P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1), [u0, v0], [u1, v0], [u1, v1], [u0, v1]);
    }
  }
  if (!closed) {
    // end caps (flat, approximate)
    for (const [i, flip] of [[0, true], [n - 1, false]]) {
      const pts = profile.map((_, j) => P(i, j));
      const base = [poly[i][0], profile[0][1], poly[i][1]];
      for (let j = 0; j < pts.length - 1; j++) {
        if (flip) b.tri(base, pts[j], pts[j + 1], [0, 0], [0, 0], [0, 0]);
        else b.tri(base, pts[j + 1], pts[j], [0, 0], [0, 0], [0, 0]);
      }
    }
  }
  return b.build();
}

// Loft between two quads/polygons of equal vertex count along a profile f(s) -> [mix, y].
// Used for the trapezoidal dome. Returns geometry facing outward.
export function loftGeometry(base, top, steps, profileFn, tile = 3) {
  const n = base.length;
  const rings = [];
  for (let s = 0; s <= steps; s++) {
    const [m, y] = profileFn(s / steps);
    rings.push(base.map((p, i) => [p[0] + (top[i][0] - p[0]) * m, y, p[1] + (top[i][1] - p[1]) * m]));
  }
  const b = new GeoBuilder();
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n;
    let acc = 0;
    for (let s = 0; s < steps; s++) {
      const a = rings[s][i], bb = rings[s][i2], c = rings[s + 1][i2], d = rings[s + 1][i];
      const seg = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
      const w0 = Math.hypot(bb[0] - a[0], bb[2] - a[2]);
      const w1 = Math.hypot(c[0] - d[0], c[2] - d[2]);
      const v0 = acc / tile, v1 = (acc + seg) / tile;
      b.quad(a, bb, c, d, [0, v0], [w0 / tile, v0], [w1 / tile, v1], [0, v1]);
      acc += seg;
    }
  }
  return { geometry: b.build(), rings };
}

// Matrix for a unit box (1×1×1 centred) stretched between points a and b with cross-section w×h.
const _up = new THREE.Vector3(0, 1, 0);
const _alt = new THREE.Vector3(1, 0, 0);
export function beamMatrix(a, b, w, h = w, m = new THREE.Matrix4()) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  dir.normalize();
  const ref = Math.abs(dir.dot(_up)) > 0.95 ? _alt : _up;
  const x = new THREE.Vector3().crossVectors(ref, dir).normalize();
  const y = new THREE.Vector3().crossVectors(dir, x).normalize();
  // box local: X = width, Y = height, Z = length
  m.makeBasis(x.multiplyScalar(w), y.multiplyScalar(h), dir.multiplyScalar(len));
  m.setPosition((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return m;
}

// Matrix placing an object at (x, y, z) facing along the outward normal n (object +Z = outward).
export function facingMatrix(x, y, z, n, sx = 1, sy = 1, sz = 1, m = new THREE.Matrix4()) {
  const ang = Math.atan2(n[0], n[1]);
  m.makeRotationY(ang);
  m.scale(new THREE.Vector3(sx, sy, sz));
  m.setPosition(x, y, z);
  return m;
}

// Distribute bays along an edge: returns centres (distance along edge) for count bays.
export function bayCentres(len, spacing, margin = 1.5) {
  const usable = len - 2 * margin;
  if (usable < spacing * 0.6) return len > 2.4 ? [len / 2] : [];
  const count = Math.max(1, Math.round(usable / spacing));
  const step = usable / count;
  return Array.from({ length: count }, (_, i) => margin + step * (i + 0.5));
}

export function shift(geometry, x, y, z) {
  geometry.translate(x, y, z);
  return geometry;
}
