// Procedural sculpture: draped figures (Apollo and the Muses, Záboj and Lumír, Wagner's groups,
// the Victories) and the horses of the trigae. Units: a standing figure is 1.0 tall, base at y = 0,
// facing +z. Horses are ≈ 2.4 long; the triga is built around the chariot.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from '../core/geom.js';

const UP = new THREE.Vector3(0, 1, 0);

function ni(g) {
  const out = g.index ? g.toNonIndexed() : g;
  if (!out.attributes.uv) out.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
  return out;
}

// tapered limb between two points with rounded ends
function limb(a, b, r0, r1 = r0, seg = 8) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(B, A);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
  g.translate(A.x, A.y, A.z);
  const s0 = new THREE.SphereGeometry(r0, seg, 6).translate(A.x, A.y, A.z);
  const s1 = new THREE.SphereGeometry(r1, seg, 6).translate(B.x, B.y, B.z);
  return [ni(g), ni(s0), ni(s1)];
}

function ellipsoid(c, r, seg = 12) {
  return ni(new THREE.SphereGeometry(1, seg, Math.max(6, seg / 2 | 0)).scale(r[0], r[1], r[2]).translate(c[0], c[1], c[2]));
}

// lathe with vertical folds (drapery)
function draped(profile, folds = 9, depth = 0.012, zScale = 0.78, seed = 0) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 28);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const k = 1 + (depth / r) * Math.sin(a * folds + y * 6 + seed) * (1 - y);
    p.setXYZ(i, x * k, y, z * k * zScale);
  }
  g.computeVertexNormals();
  return ni(g);
}

// ---------------------------------------------------------------------- attributes
const ATTR = {
  lyre: (h) => [
    ni(new THREE.TorusGeometry(0.06, 0.008, 5, 14, Math.PI).rotateZ(Math.PI).translate(h[0], h[1] + 0.06, h[2])),
    ...limb([h[0] - 0.06, h[1] + 0.06, h[2]], [h[0] - 0.05, h[1] + 0.16, h[2]], 0.008),
    ...limb([h[0] + 0.06, h[1] + 0.06, h[2]], [h[0] + 0.05, h[1] + 0.16, h[2]], 0.008),
    ...limb([h[0] - 0.055, h[1] + 0.15, h[2]], [h[0] + 0.055, h[1] + 0.15, h[2]], 0.007),
  ],
  mask: (h) => [ellipsoid([h[0], h[1] + 0.03, h[2] + 0.02], [0.04, 0.05, 0.018])],
  scroll: (h) => limb([h[0] - 0.02, h[1] - 0.02, h[2]], [h[0] + 0.03, h[1] + 0.12, h[2] + 0.02], 0.016),
  trumpet: (h) => [ni(new THREE.ConeGeometry(0.03, 0.26, 10).rotateZ(-1.1).translate(h[0] + 0.1, h[1] + 0.08, h[2]))],
  globe: (h) => [ellipsoid([h[0], h[1] + 0.045, h[2]], [0.045, 0.045, 0.045], 10)],
  tablet: (h) => [ni(new THREE.BoxGeometry(0.07, 0.1, 0.012).rotateZ(0.2).translate(h[0], h[1] + 0.04, h[2] + 0.02))],
  wreath: (h) => [ni(new THREE.TorusGeometry(0.05, 0.012, 5, 14).translate(h[0], h[1] + 0.04, h[2]))],
  torch: (h) => [...limb([h[0], h[1] - 0.12, h[2]], [h[0], h[1] + 0.12, h[2]], 0.012, 0.018), ni(new THREE.ConeGeometry(0.03, 0.07, 8).translate(h[0], h[1] + 0.16, h[2]))],
  sword: (h) => limb([h[0], h[1] - 0.25, h[2] + 0.02], [h[0], h[1] + 0.05, h[2] + 0.02], 0.008),
  harp: (h) => [ni(new THREE.TorusGeometry(0.09, 0.01, 5, 14, Math.PI * 0.9).rotateZ(Math.PI / 2).translate(h[0], h[1] + 0.05, h[2]))],
};

// ---------------------------------------------------------------------- standing draped figure
/**
 * @param pose.arms  [[shoulder→elbow→hand] right, left] as offsets in figure units
 * @param pose.attr  attribute in the raised hand
 * @param pose.lean  contrapposto sway (−1…1)
 */
export function statueGeometry(pose = {}) {
  const lean = pose.lean ?? 0.4;
  const seed = pose.seed ?? 0;
  const parts = [];
  // long robe (chiton) with folds, slightly swayed hips
  parts.push(draped([[0.0, 0.0], [0.15, 0.0], [0.165, 0.03], [0.145, 0.18], [0.125, 0.36], [0.108, 0.5], [0.1, 0.54], [0.0, 0.54]], 11, 0.014, 0.75, seed));
  // a hem bunched over the free leg
  parts.push(ellipsoid([0.05 * lean, 0.24, 0.07], [0.06, 0.18, 0.05]));
  // torso and chest
  parts.push(draped([[0.0, 0.5], [0.105, 0.5], [0.115, 0.58], [0.128, 0.66], [0.13, 0.72], [0.1, 0.755], [0.04, 0.77], [0.0, 0.77]], 7, 0.006, 0.68, seed + 2));
  // himation slung across the body
  parts.push(ni(new THREE.TorusGeometry(0.115, 0.03, 6, 18, Math.PI * 1.15).rotateX(Math.PI / 2).rotateZ(0.55 * (lean >= 0 ? 1 : -1)).scale(1, 1, 0.75).translate(0, 0.6, 0.01)));
  // neck, head, hair
  parts.push(...limb([0, 0.76, 0], [0, 0.81, 0.005], 0.028, 0.025));
  parts.push(ellipsoid([0.0, 0.865, 0.008], [0.048, 0.06, 0.052]));
  parts.push(ellipsoid([0.0, 0.89, -0.018], [0.05, 0.05, 0.048]));
  parts.push(ellipsoid([0.0, 0.875, -0.055], [0.028, 0.03, 0.026])); // knot of hair
  if (pose.crown) parts.push(ni(new THREE.TorusGeometry(0.046, 0.008, 5, 14).rotateX(Math.PI / 2).translate(0, 0.905, -0.01)));
  // arms
  const arms = pose.arms ?? [
    [[0.14, 0.73, 0], [0.19, 0.57, 0.04], [0.15, 0.44, 0.08]],
    [[-0.14, 0.73, 0], [-0.2, 0.58, 0.0], [-0.17, 0.44, 0.03]],
  ];
  for (const [s, e, h] of arms) {
    parts.push(...limb(s, e, 0.034, 0.028));
    parts.push(...limb(e, h, 0.027, 0.02));
  }
  if (pose.attr && ATTR[pose.attr]) parts.push(...ATTR[pose.attr](arms[0][2]));
  if (pose.attr2 && ATTR[pose.attr2]) parts.push(...ATTR[pose.attr2](arms[1][2]));
  const g = mergeGeometries(parts.map(ni));
  // contrapposto: sway the upper body over the hip
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setX(i, p.getX(i) + Math.sin(Math.min(1, y) * Math.PI * 0.5) * 0.025 * lean);
  }
  return g;
}

// Apollo and the nine Muses: poses and attributes (Kalliope scroll, Klio tablet, Euterpe trumpet,
// Thalia mask, Melpomene sword, Terpsichore harp, Erato lyre, Polyhymnia veiled, Urania globe)
export const MUSES = [
  { attr: 'lyre', crown: true, lean: 0.6, arms: [[[0.14, 0.73, 0], [0.2, 0.62, 0.06], [0.12, 0.6, 0.12]], [[-0.14, 0.73, 0], [-0.22, 0.86, 0.02], [-0.2, 1.0, 0.02]]] },
  { attr: 'scroll', lean: -0.4, arms: [[[0.14, 0.73, 0], [0.18, 0.6, 0.08], [0.1, 0.56, 0.14]], [[-0.14, 0.73, 0], [-0.18, 0.57, 0.02], [-0.15, 0.44, 0.05]]] },
  { attr: 'tablet', lean: 0.3, arms: [[[0.14, 0.73, 0], [0.17, 0.6, 0.08], [0.08, 0.58, 0.13]], [[-0.14, 0.73, 0], [-0.19, 0.58, 0.02], [-0.16, 0.45, 0.04]]] },
  { attr: 'trumpet', lean: -0.5, arms: [[[0.14, 0.73, 0], [0.24, 0.8, 0.06], [0.26, 0.93, 0.08]], [[-0.14, 0.73, 0], [-0.19, 0.58, 0.03], [-0.15, 0.46, 0.06]]] },
  { attr: 'mask', lean: 0.5, arms: [[[0.14, 0.73, 0], [0.22, 0.62, 0.06], [0.26, 0.5, 0.1]], [[-0.14, 0.73, 0], [-0.12, 0.6, 0.08], [-0.04, 0.6, 0.12]]] },
  { attr: 'sword', attr2: 'mask', lean: -0.3, arms: [[[0.14, 0.73, 0], [0.2, 0.58, 0.04], [0.2, 0.46, 0.06]], [[-0.14, 0.73, 0], [-0.21, 0.6, 0.05], [-0.22, 0.5, 0.1]]] },
  { attr: 'harp', lean: 0.6, arms: [[[0.14, 0.73, 0], [0.2, 0.62, 0.08], [0.16, 0.54, 0.14]], [[-0.14, 0.73, 0], [-0.1, 0.62, 0.1], [0.02, 0.6, 0.14]]] },
  { attr: 'lyre', lean: -0.6, arms: [[[0.14, 0.73, 0], [0.18, 0.6, 0.06], [0.1, 0.58, 0.12]], [[-0.14, 0.73, 0], [-0.24, 0.84, 0.0], [-0.22, 0.98, 0.0]]] },
  { lean: 0.2, seed: 2, arms: [[[0.14, 0.73, 0], [0.1, 0.62, 0.1], [0.0, 0.66, 0.13]], [[-0.14, 0.73, 0], [-0.08, 0.62, 0.1], [0.0, 0.64, 0.12]]] },
  { attr: 'globe', lean: -0.4, arms: [[[0.14, 0.73, 0], [0.2, 0.62, 0.08], [0.17, 0.54, 0.14]], [[-0.14, 0.73, 0], [-0.2, 0.58, 0.02], [-0.15, 0.45, 0.05]]] },
];

// Bard with a harp (Záboj, Lumír) – cloak, beard
export function bardGeometry(seed = 0) {
  const g = statueGeometry({ attr: 'harp', lean: seed ? -0.5 : 0.5, seed: 4 + seed, arms: [[[0.14, 0.73, 0], [0.2, 0.6, 0.08], [0.14, 0.54, 0.14]], [[-0.14, 0.73, 0], [-0.1, 0.62, 0.1], [0.0, 0.6, 0.14]]] });
  const beard = ellipsoid([0, 0.82, 0.04], [0.04, 0.05, 0.03]);
  const cloak = draped([[0.0, 0.3], [0.17, 0.3], [0.16, 0.5], [0.15, 0.72], [0.0, 0.76]], 8, 0.01, 0.7, 7);
  return mergeGeometries([g, beard, cloak].map(ni));
}

// ---------------------------------------------------------------------- horse (rearing, as on the trigae)
export function horseGeometry(variant = 0) {
  const parts = [];
  const tilt = 0.12 + variant * 0.04;
  // barrel, chest and hindquarters
  parts.push(ellipsoid([0, 1.25, 0], [0.62, 0.3, 0.27], 16));
  parts.push(ellipsoid([0.42, 1.35, 0], [0.32, 0.34, 0.27], 14));
  parts.push(ellipsoid([-0.45, 1.3, 0], [0.34, 0.33, 0.29], 14));
  // arched neck and head (bowed)
  parts.push(...limb([0.55, 1.5, 0], [0.86, 1.95, 0], 0.2, 0.13, 10));
  parts.push(ni(new THREE.SphereGeometry(1, 12, 8).scale(0.14, 0.24, 0.13).rotateZ(-0.7).translate(0.72, 1.82, 0)));
  parts.push(...limb([0.9, 2.02, 0], [1.2, 1.78, 0], 0.11, 0.065, 10));
  parts.push(ni(new THREE.ConeGeometry(0.03, 0.12, 6).translate(0.9, 2.12, 0.05)));
  parts.push(ni(new THREE.ConeGeometry(0.03, 0.12, 6).translate(0.9, 2.12, -0.05)));
  // mane
  parts.push(ni(new THREE.BoxGeometry(0.5, 0.06, 0.05).rotateZ(1.0).translate(0.66, 1.88, 0)));
  // forelegs raised and bent, hind legs planted
  const fl = (z, k) => [...limb([0.45, 1.12, z], [0.72, 0.92 + k * 0.08, z], 0.075, 0.055), ...limb([0.72, 0.92 + k * 0.08, z], [0.66, 0.58 + k * 0.1, z], 0.05, 0.04), ellipsoid([0.66, 0.55 + k * 0.1, z], [0.05, 0.04, 0.05])];
  parts.push(...fl(0.12, 0), ...fl(-0.12, 1));
  const hl = (z, dx) => [...limb([-0.5, 1.1, z], [-0.62 + dx, 0.62, z], 0.09, 0.06), ...limb([-0.62 + dx, 0.62, z], [-0.55 + dx, 0.06, z], 0.05, 0.04), ellipsoid([-0.55 + dx, 0.04, z], [0.06, 0.04, 0.06])];
  parts.push(...hl(0.13, 0), ...hl(-0.13, 0.12));
  // tail
  parts.push(...limb([-0.78, 1.4, 0], [-1.05, 1.1, 0], 0.06, 0.05), ...limb([-1.05, 1.1, 0], [-1.12, 0.72, 0.02], 0.05, 0.03));
  const g = mergeGeometries(parts.map(ni));
  g.rotateZ(tilt); // rearing
  return g;
}

// Triga: three horses abreast, chariot, winged Victory with a wreath
export function trigaGeometry() {
  const parts = [];
  [-0.78, 0, 0.78].forEach((z, i) => {
    const h = horseGeometry(i % 2).translate(0.45, 0.05 * i, z);
    parts.push(h);
  });
  // chariot: curved front shield and wheels
  const shield = new THREE.CylinderGeometry(0.8, 0.65, 1.0, 16, 1, true, -Math.PI / 2, Math.PI);
  shield.rotateY(Math.PI / 2).translate(-1.15, 0.95, 0);
  parts.push(ni(shield));
  const wheel = new THREE.TorusGeometry(0.55, 0.06, 6, 20);
  parts.push(ni(wheel.clone().translate(-1.35, 0.55, 0.8)), ni(wheel.clone().translate(-1.35, 0.55, -0.8)));
  for (const z of [0.8, -0.8]) for (let k = 0; k < 4; k++) parts.push(ni(new THREE.BoxGeometry(1.0, 0.04, 0.04).rotateZ((k * Math.PI) / 4).translate(-1.35, 0.55, z)));
  parts.push(...limb([-1.35, 0.55, 0.8], [-1.35, 0.55, -0.8], 0.04));
  parts.push(...limb([-1.0, 0.75, 0], [0.4, 1.15, 0], 0.035));
  // Victory standing in the chariot, arms raised with a wreath
  const vic = statueGeometry({
    attr: 'wreath', attr2: 'torch', lean: 0.3, seed: 9,
    arms: [[[0.14, 0.73, 0], [0.2, 0.86, 0.04], [0.18, 1.0, 0.06]], [[-0.14, 0.73, 0], [-0.24, 0.82, 0.02], [-0.3, 0.92, 0.02]]],
  });
  vic.scale(2.3, 2.3, 2.3).rotateY(Math.PI / 2).translate(-1.25, 0.6, 0);
  parts.push(vic);
  // spread wings: fanned feathers behind the shoulders
  for (const s of [-1, 1]) {
    for (let k = 0; k < 7; k++) {
      const len = 0.9 - k * 0.07;
      const f = new THREE.BoxGeometry(0.05, len, 0.16 - k * 0.012);
      f.translate(0, len / 2, 0);
      f.rotateX(s * (0.35 + k * 0.17));
      f.rotateZ(0.25 + k * 0.02);
      f.translate(-1.45, 2.25, s * 0.08);
      parts.push(ni(f));
    }
  }
  return mergeGeometries(parts.map(ni));
}
