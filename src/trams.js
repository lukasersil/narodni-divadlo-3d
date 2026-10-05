// Trams: double track down the middle of Národní, across Most Legií and along the embankments
// (Smetanovo / Masarykovo nábřeží), as today. Škoda 15T sets (31.4 m, 4 sections, DPP red and cream)
// run both ways and stop at "Národní divadlo". Part of the present-day surroundings (stage 6), hidden in X-ray.
// World coordinates (like site.js); road centrelines come from OSM.
import * as THREE from 'three/webgpu';
import { vec3 } from 'three/tsl';
import { SITE_DATA as SITE, bToWorld } from './config.js';
import { makeTerrain } from './site.js';
import { beamMatrix, mergeGeometries } from './core/geom.js';
import { U } from './core/materials.js';

const TRACK_HALF = 1.55;   // track centres 3.1 m apart
const GAUGE_HALF = 0.72;   // 1435 mm gauge
const SECTION = 7.85;      // 4 × 7.85 m ≈ 31.4 m
const SPEED = 8.5;         // m/s
const DWELL = 14;          // s at the stop
const BRIDGE_Y = 0.2;      // deck of Most Legií

// chain OSM ways into one polyline: from a start point, always take a way that continues from the
// current end and does not lead back to a point already used (OSM has one-way pairs on Národní)
function chain(start, names) {
  const near = (p, q, d = 2) => Math.hypot(p[0] - q[0], p[1] - q[1]) < d;
  const pool = SITE.osm.roads.filter((w) => names.includes(w.name));
  const out = [{ p: start, bridge: false }];
  for (let guard = 0; guard < 40; guard++) {
    const end = out[out.length - 1].p;
    let pick = null;
    for (const w of pool) {
      const a = w.pts[0], b = w.pts[w.pts.length - 1];
      const pts = near(a, end) ? w.pts : near(b, end) ? [...w.pts].reverse() : null;
      if (!pts) continue;
      const far = pts[pts.length - 1];
      if (out.some((o) => near(o.p, far))) continue;
      pick = { w, pts };
      break;
    }
    if (!pick) break;
    pool.splice(pool.indexOf(pick.w), 1);
    pick.pts.slice(1).forEach((p) => out.push({ p, bridge: pick.w.bridge }));
  }
  return out;
}

// polyline with arc length, heights matching the draped road surface (linear between OSM vertices)
function makePath(nodes, terrain) {
  const pts = nodes.map(({ p, bridge }) => {
    const h = bridge ? BRIDGE_Y : (terrain.height(p[0], p[1]) ?? 0) + 0.06;
    return new THREE.Vector3(p[0], h, p[1]);
  });
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const len = acc[acc.length - 1];
  const _a = new THREE.Vector3();
  return {
    pts, len, acc,
    // point and unit tangent at arc length s (clamped)
    at(s, out, tan) {
      s = THREE.MathUtils.clamp(s, 0, len);
      let i = 1;
      while (i < acc.length - 1 && acc[i] < s) i++;
      const t = (s - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
      out.lerpVectors(pts[i - 1], pts[i], t);
      if (tan) tan.subVectors(pts[i], pts[i - 1]).setY(0).normalize();
      return out;
    },
    // arc length of the point nearest to (x, z)
    nearest(x, z) {
      let best = 0, bd = Infinity;
      for (let s = 0; s <= len; s += 1) {
        this.at(s, _a);
        const d = Math.hypot(_a.x - x, _a.z - z);
        if (d < bd) { bd = d; best = s; }
      }
      return best;
    },
  };
}

export function buildTrams(ctx) {
  const { scene, R } = ctx;
  const terrain = makeTerrain();
  const group = new THREE.Group();
  group.name = 'trams';
  scene.add(group);

  const routes = [
    // Národní → Most Legií (lines 9, 22, 23)
    makePath(chain([402.5, -159.8], ['Národní', 'most Legií']), terrain),
    // Smetanovo → Masarykovo nábřeží (lines 2, 17)
    makePath(chain([-17.4, -287.5], ['Smetanovo nábřeží', 'Masarykovo nábřeží']), terrain),
  ].filter((r) => r.len > 60);


  // ---------------------------------------------------------------- track: concrete bed + rails
  const beds = [], rails = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), t = new THREE.Vector3(), n = new THREE.Vector3();
  const off = (p, tan, d, out) => out.set(p.x - tan.z * d, p.y, p.z + tan.x * d);
  const pa = new THREE.Vector3(), pb = new THREE.Vector3();
  for (const r of routes) {
    for (let s = 0; s < r.len; s += 4) {
      const s1 = Math.min(r.len, s + 4);
      r.at(s, a, t); r.at(s1, b, n);
      n.add(t).normalize();
      for (const side of [-1, 1]) {
        const c = side * TRACK_HALF;
        beds.push(beamMatrix(off(a, n, c, pa).setY(a.y + 0.012), off(b, n, c, pb).setY(b.y + 0.012), 2.5, 0.02, new THREE.Matrix4()));
        for (const g of [-1, 1]) {
          rails.push(beamMatrix(off(a, n, c + g * GAUGE_HALF, pa).setY(a.y + 0.03), off(b, n, c + g * GAUGE_HALF, pb).setY(b.y + 0.03), 0.08, 0.03, new THREE.Matrix4()));
        }
      }
    }
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  const bedMat = new THREE.MeshStandardNodeMaterial({ color: '#8f8b84', roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -4 });
  const railMat = new THREE.MeshStandardNodeMaterial({ color: '#9aa0a6', roughness: 0.35, metalness: 0.85 });
  const bedMesh = new THREE.InstancedMesh(box, bedMat, beds.length);
  beds.forEach((m, i) => bedMesh.setMatrixAt(i, m));
  bedMesh.receiveShadow = true;
  const railMesh = new THREE.InstancedMesh(box, railMat, rails.length);
  rails.forEach((m, i) => railMesh.setMatrixAt(i, m));
  group.add(bedMesh, railMesh);

  // ---------------------------------------------------------------- 15T sets: per-section parts, instanced
  const red = new THREE.MeshStandardNodeMaterial({ color: '#b8172b', roughness: 0.45, metalness: 0.1 });
  const cream = new THREE.MeshStandardNodeMaterial({ color: '#ece6d8', roughness: 0.5 });
  const glass = new THREE.MeshStandardNodeMaterial({ color: '#1d2329', roughness: 0.08, metalness: 0.3 });
  glass.emissiveNode = vec3(1.0, 0.86, 0.62).mul(U.night).mul(0.9); // lit saloon at night
  const grey = new THREE.MeshStandardNodeMaterial({ color: '#4a4d52', roughness: 0.6, metalness: 0.4 });
  const L = SECTION - 0.35; // gap for the articulation bellows
  const P = {
    skirt: [new THREE.BoxGeometry(2.46, 0.95, L).translate(0, 0.78, 0), red],
    glass: [new THREE.BoxGeometry(2.48, 1.25, L - 0.5).translate(0, 1.88, 0), glass],
    top: [new THREE.BoxGeometry(2.46, 0.72, L).translate(0, 2.86, 0), cream],
    // window pillars: five per section split the glazing into separate windows
    pier: [mergeGeometries([-0.5, -0.25, 0, 0.25, 0.5].map((f) => new THREE.BoxGeometry(2.5, 1.25, 0.16).translate(0, 1.88, f * (L - 0.5)).toNonIndexed())), red],
    roof: [new THREE.BoxGeometry(1.6, 0.32, L * 0.55).translate(0, 3.38, 0), grey], // roof equipment
    bogie: [new THREE.BoxGeometry(2.2, 0.35, 2.4).translate(0, 0.22, 0), grey],
  };
  const SETS = routes.length * 2;            // one set per direction per route
  const parts = {};
  for (const [k, [g, m]] of Object.entries(P)) {
    parts[k] = new THREE.InstancedMesh(g, m, SETS * 4);
    parts[k].castShadow = k !== 'glass';
    parts[k].frustumCulled = false;
    group.add(parts[k]);
  }
  // driver's cab at both ends (local +z = outwards): red nose, raked windscreen, cream cap, LED destination sign
  const sign = new THREE.MeshStandardNodeMaterial({ color: '#2a1a0a', emissive: '#ff9a2a', emissiveIntensity: 1.6 });
  const CAB = [
    [new THREE.BoxGeometry(2.46, 1.05, 0.9).translate(0, 0.83, 0.45), red],
    [new THREE.BoxGeometry(2.36, 1.45, 0.1).rotateX(-0.28).translate(0, 2.02, 0.62), glass],
    [new THREE.BoxGeometry(2.46, 0.62, 0.5).translate(0, 2.9, 0.25), cream],
    [new THREE.BoxGeometry(1.5, 0.22, 0.04).translate(0, 2.92, 0.52), sign],
  ];
  const cabs = CAB.map(([g, mat]) => {
    const im = new THREE.InstancedMesh(g, mat, SETS * 2);
    im.frustumCulled = false;
    group.add(im);
    return im;
  });
  // pantograph on the second section
  const panG = new THREE.BoxGeometry(0.06, 0.9, 1.4).rotateX(0.6).translate(0, 3.9, 0);
  const pans = new THREE.InstancedMesh(panG, grey, SETS);
  pans.frustumCulled = false;
  group.add(pans);

  const theatre = bToWorld(0, 0, 10);
  const sets = [];
  routes.forEach((r, ri) => {
    const stop = r.nearest(theatre.x, theatre.z);
    for (const dir of [1, -1]) sets.push({ r, dir, s: (ri * 0.37 + (dir > 0 ? 0.15 : 0.62)) * r.len, stop, wait: 0, done: false });
  });

  // ---------------------------------------------------------------- interlocking where the two lines cross
  // (Národní / Most Legií × the embankment line at the bridgehead): a set may run into a crossing only when no
  // set of the other line is in it; otherwise it waits at the approach. The zone along each line covers the
  // other line's two tracks and the swept width of a car, widened for the crossing angle.
  const crossings = [];
  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const A = routes[i], B = routes[j];
      for (let ia = 1; ia < A.pts.length; ia++) {
        for (let ib = 1; ib < B.pts.length; ib++) {
          const p0 = A.pts[ia - 1], p1 = A.pts[ia], q0 = B.pts[ib - 1], q1 = B.pts[ib];
          const rx = p1.x - p0.x, rz = p1.z - p0.z, sx = q1.x - q0.x, sz = q1.z - q0.z;
          const den = rx * sz - rz * sx, la = Math.hypot(rx, rz), lb = Math.hypot(sx, sz);
          if (Math.abs(den) < 1e-9 * la * lb) continue;
          const ta = ((q0.x - p0.x) * sz - (q0.z - p0.z) * sx) / den;
          const tb = ((q0.x - p0.x) * rz - (q0.z - p0.z) * rx) / den;
          if (ta < 0 || ta > 1 || tb < 0 || tb > 1) continue;
          const sin = Math.abs(den) / (la * lb), cos = Math.sqrt(Math.max(0, 1 - sin * sin));
          const half = ((TRACK_HALF + 1.3) * (1 + cos)) / Math.max(0.3, sin) + 2.0;
          crossings.push({ lines: [A, B], s: [A.acc[ia - 1] + ta * la, B.acc[ib - 1] + tb * lb], half, holders: new Set() });
        }
      }
    }
  }
  const inZone = (set, c, s = set.s) => {
    const k = c.lines.indexOf(set.r);
    if (k < 0) return false;
    const lo = Math.min(s, s - set.dir * 4 * SECTION), hi = Math.max(s, s - set.dir * 4 * SECTION);
    return hi > c.s[k] - c.half && lo < c.s[k] + c.half;
  };
  const blockedBy = (set, c) => [...c.holders].some((o) => o !== set && o.r !== set.r);
  // start-up: no two sets of different lines inside the same crossing
  for (const c of crossings) {
    for (const set of sets) {
      if (!inZone(set, c)) continue;
      if (blockedBy(set, c)) set.s -= set.dir * (2 * c.half + 4 * SECTION);
      else c.holders.add(set);
    }
  }

  const q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), S1 = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3(), tan = new THREE.Vector3(), m = new THREE.Matrix4(), e = new THREE.Matrix4();
  const ZERO = new THREE.Vector3(0, 0, 0);
  function place(set, idx) {
    const { r, dir } = set;
    for (let k = 0; k < 4; k++) {
      const sk = set.s - dir * (k * SECTION + SECTION / 2);
      // sections beyond either end of the line are off the map: hidden, not piled up at the end point
      const offMap = sk < SECTION / 2 || sk > r.len - SECTION / 2;
      r.at(sk, pos, tan);
      if (dir < 0) tan.negate();
      off(pos, tan, TRACK_HALF, pos); // right-hand running (tan points along the direction of travel)
      q.setFromAxisAngle(Y, Math.atan2(tan.x, tan.z));
      m.compose(pos, q, offMap ? ZERO : S1);
      const i = idx * 4 + k;
      for (const key of ['skirt', 'glass', 'top', 'roof', 'bogie']) parts[key].setMatrixAt(i, m);
      parts.pier.setMatrixAt(i, m);
      if (k === 1) pans.setMatrixAt(idx, m);
      if (k === 0 || k === 3) {
        // the rear cab faces backwards
        e.makeRotationY(k === 0 ? 0 : Math.PI).setPosition(0, 0, (k === 0 ? 1 : -1) * (L / 2)).premultiply(m);
        for (const c of cabs) c.setMatrixAt(idx * 2 + (k === 0 ? 0 : 1), e);
      }
    }
  }
  function step(dt) {
    dt = Math.min(dt, 0.1); // a long frame (hidden tab) must not let a set jump through a crossing
    sets.forEach((set, idx) => {
      const { r } = set;
      if (set.wait > 0) set.wait -= dt;
      else {
        const before = set.s;
        const next = set.s + set.dir * SPEED * dt;
        // entering a crossing held by the other line: wait at the approach
        const held = crossings.some((c) => !inZone(set, c) && inZone(set, c, next) && blockedBy(set, c));
        if (held) { place(set, idx); return; }
        set.s = next;
        for (const c of crossings) {
          if (inZone(set, c)) c.holders.add(set);
          else c.holders.delete(set);
        }
        const front = set.s;
        // stop at "Národní divadlo" (front of the set at the platform end)
        if (!set.done && (before - set.stop) * (front - set.stop) <= 0) { set.wait = DWELL; set.done = true; }
        // leave the map and come back from the other end
        const tail = 4 * SECTION;
        if (set.dir > 0 && set.s - tail > r.len) { set.s = 0; set.done = false; }
        if (set.dir < 0 && set.s + tail < 0) { set.s = r.len; set.done = false; }
        for (const c of crossings) if (!inZone(set, c)) c.holders.delete(set);
      }
      place(set, idx);
    });
    for (const p of [...Object.values(parts), ...cabs, pans]) p.instanceMatrix.needsUpdate = true;
  }
  step(0);

  // present-day surroundings: appear with the completed building, never in X-ray
  R.add(group, { stage: 6, order: 0.6, mode: 'none', dur: 0.05, xray: 'hide', modern: true });
  ctx.ticks ??= [];
  ctx.ticks.push((dt) => { if (group.visible) step(dt); });
  return ctx;
}
