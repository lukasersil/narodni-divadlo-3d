// Façade detail: windows, pilasters, loggia arcade with columns, balustrades, statues, trigae, lamps.
import * as THREE from 'three/webgpu';
import { FP, H, V } from '../config.js';
import { edges, offsetPolygon, sweepGeometry, mergeGeometries, pointInPolygon, clipBand, bayCentres, polyCentroid, capGeometry } from '../core/geom.js';
import { based, JOINT } from './util.js';
import { U, loadTex } from '../core/materials.js';
import { vec3 } from 'three/tsl';
import { statueGeometry, MUSES, bardGeometry, trigaGeometry } from './sculpture.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

function place(x, y, z, n, sx = 1, sy = 1, sz = 1, yaw = 0) {
  _q.setFromAxisAngle(Y, Math.atan2(n[0], n[1]) + yaw);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.clone(), _s.set(sx, sy, sz));
}

// ------------------------------------------------------------------ part geometries (local: +z outward, y up, base at 0)
function frameRect(w, h, f = 0.2, d = 0.22) {
  const parts = [
    new THREE.BoxGeometry(w + 2 * f, f, d).translate(0, -f / 2, d / 2),
    new THREE.BoxGeometry(w + 2 * f, f, d).translate(0, h + f / 2, d / 2),
    new THREE.BoxGeometry(f, h, d).translate(-w / 2 - f / 2, h / 2, d / 2),
    new THREE.BoxGeometry(f, h, d).translate(w / 2 + f / 2, h / 2, d / 2),
    new THREE.BoxGeometry(w + 2 * f + 0.2, 0.14, d + 0.12).translate(0, -f - 0.07, (d + 0.12) / 2), // sill
  ];
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

function archShape(w, h) {
  // rectangle w × (h − w/2) topped by a semicircle
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, 0);
  s.lineTo(r, 0);
  s.lineTo(r, h - r);
  s.absarc(0, h - r, r, 0, Math.PI, false);
  s.lineTo(-r, 0);
  return s;
}

function glassArch(w, h) {
  return new THREE.ShapeGeometry(archShape(w, h), 12).translate(0, 0, 0.03).toNonIndexed();
}

function frameArch(w, h, f = 0.22, d = 0.24, sill = true) {
  const outer = archShape(w + 2 * f, h + f);
  outer.holes.push(archShape(w, h));
  const g = new THREE.ExtrudeGeometry(outer, { depth: d, bevelEnabled: false, curveSegments: 12 });
  const key = new THREE.BoxGeometry(0.34, 0.5, d + 0.06).translate(0, h + f - 0.15, (d + 0.06) / 2);
  const parts = [g, key.toNonIndexed()];
  if (sill) parts.push(new THREE.BoxGeometry(w + 2 * f + 0.25, 0.16, d + 0.14).translate(0, -0.08, (d + 0.14) / 2).toNonIndexed());
  return mergeGeometries(parts);
}

function pediment(w, kind) {
  if (kind === 'tri') {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, w * 0.26); s.lineTo(-w / 2, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.36, bevelEnabled: false });
    const ledge = new THREE.BoxGeometry(w + 0.1, 0.16, 0.42).translate(0, -0.08, 0.21);
    return mergeGeometries([g, ledge.toNonIndexed()]);
  }
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0);
  s.quadraticCurveTo(0, w * 0.34, -w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.36, bevelEnabled: false, curveSegments: 10 });
  const ledge = new THREE.BoxGeometry(w + 0.1, 0.16, 0.42).translate(0, -0.08, 0.21);
  return mergeGeometries([g, ledge.toNonIndexed()]);
}

// glazing bars (sashes, mullion, transom) in front of the glass: local +z outward, base at 0
const BAR = 0.065, BAR_D = 0.06, BAR_Z = 0.075;
const bar = (w, h, x, y) => new THREE.BoxGeometry(w, h, BAR_D).translate(x, y, BAR_Z).toNonIndexed();
function sashRing(w, h) {
  return [bar(w, BAR, 0, BAR / 2), bar(w, BAR, 0, h - BAR / 2), bar(BAR, h, -w / 2 + BAR / 2, h / 2), bar(BAR, h, w / 2 - BAR / 2, h / 2)];
}
function barsRect(w, h) {
  const tr = h * 0.72; // transom: casements below, fanlight above
  return mergeGeometries([...sashRing(w, h), bar(BAR, tr, 0, tr / 2), bar(w, BAR * 1.3, 0, tr),
    bar(w * 0.5 - BAR, BAR * 0.7, -w / 4, tr * 0.5), bar(w * 0.5 - BAR, BAR * 0.7, w / 4, tr * 0.5)]);
}
function barsArch(w, h) {
  const r = w / 2, spring = h - r;
  const parts = [bar(w, BAR, 0, BAR / 2), bar(BAR, spring, -r + BAR / 2, spring / 2), bar(BAR, spring, r - BAR / 2, spring / 2),
    bar(BAR, h, 0, h / 2), bar(w, BAR * 1.3, 0, spring), bar(w * 0.5 - BAR, BAR * 0.7, -w / 4, spring * 0.5), bar(w * 0.5 - BAR, BAR * 0.7, w / 4, spring * 0.5)];
  // fanlight: arched sash and radial bars
  const arc = new THREE.TorusGeometry(r - BAR / 2, BAR / 2, 4, 16, Math.PI).scale(1, 1, BAR_D / BAR).translate(0, spring, BAR_Z).toNonIndexed();
  parts.push(arc);
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4]) {
    parts.push(new THREE.BoxGeometry(BAR * 0.8, r, BAR_D).translate(0, r / 2, 0).rotateZ(a - Math.PI / 2).translate(0, spring, BAR_Z).toNonIndexed());
  }
  return mergeGeometries(parts);
}
function barsOval(w, h) {
  return mergeGeometries([bar(BAR, h * 0.96, 0, h / 2), bar(w * 0.96, BAR, 0, h / 2)]);
}

function ovalGlass(w, h) {
  return new THREE.CircleGeometry(0.5, 20).scale(w, h, 1).translate(0, h / 2, 0.03).toNonIndexed();
}
function ovalFrame(w, h) {
  return new THREE.TorusGeometry(0.5, 0.09, 6, 22).scale(w + 0.1, h + 0.1, 1.6).translate(0, h / 2, 0.08).toNonIndexed();
}

function pilaster(h) {
  return mergeGeometries([
    new THREE.BoxGeometry(0.95, 0.35, 0.36).translate(0, 0.175, 0.18),
    new THREE.BoxGeometry(0.72, h - 1.0, 0.24).translate(0, 0.35 + (h - 1.0) / 2, 0.12),
    new THREE.BoxGeometry(0.98, 0.65, 0.36).translate(0, h - 0.325, 0.18),
  ].map((g) => g.toNonIndexed()));
}

export function columnGeometry(h) {
  // Attic base, fluted shaft with entasis, Corinthian capital (bell, two rows of acanthus, volutes, abacus)
  const shaftH = h - 1.75;
  const shaft = new THREE.CylinderGeometry(0.36, 0.42, shaftH, 48, 6);
  const sp = shaft.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i);
    const a = Math.atan2(z, x);
    const ent = 1 + 0.03 * Math.sin(((y / shaftH) + 0.5) * Math.PI); // entasis
    const fl = 1 - 0.045 * Math.max(0, Math.cos(a * 24)) ** 2;      // 24 flutes
    sp.setX(i, x * ent * fl);
    sp.setZ(i, z * ent * fl);
  }
  shaft.computeVertexNormals();
  shaft.translate(0, 0.6 + shaftH / 2, 0);
  const plinth = new THREE.BoxGeometry(1.2, 0.2, 1.2).translate(0, 0.1, 0);
  const torus1 = new THREE.TorusGeometry(0.5, 0.1, 8, 32).rotateX(Math.PI / 2).translate(0, 0.3, 0);
  const scotia = new THREE.CylinderGeometry(0.44, 0.47, 0.14, 32).translate(0, 0.45, 0);
  const torus2 = new THREE.TorusGeometry(0.44, 0.07, 8, 32).rotateX(Math.PI / 2).translate(0, 0.55, 0);
  const capY = h - 1.15;
  const bell = new THREE.LatheGeometry([[0.38, 0], [0.4, 0.2], [0.46, 0.5], [0.55, 0.8], [0.6, 0.92]].map(([r, y]) => new THREE.Vector2(r, y)), 24).translate(0, capY, 0);
  const astragal = new THREE.TorusGeometry(0.39, 0.045, 6, 28).rotateX(Math.PI / 2).translate(0, capY, 0);
  const leaves = [];
  for (const [row, n, y, r, len, tilt] of [[0, 8, 0.05, 0.42, 0.42, 0.28], [1, 8, 0.32, 0.5, 0.4, 0.4]]) {
    for (let k = 0; k < n; k++) {
      const a = ((k + row * 0.5) / n) * Math.PI * 2;
      const leaf = new THREE.SphereGeometry(1, 8, 6).scale(0.11, len / 2, 0.05);
      leaf.translate(0, len / 2, 0);
      leaf.rotateX(tilt);
      leaf.rotateY(-a + Math.PI / 2);
      leaf.translate(Math.cos(a) * r, capY + y, Math.sin(a) * r);
      leaves.push(leaf);
    }
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const vol = new THREE.TorusGeometry(0.1, 0.035, 6, 12).rotateY(-a).translate(Math.cos(a) * 0.62, capY + 0.82, Math.sin(a) * 0.62);
    leaves.push(vol);
  }
  const abacus = new THREE.BoxGeometry(1.36, 0.22, 1.36).translate(0, h - 0.11, 0);
  const flower = new THREE.SphereGeometry(0.08, 8, 6).translate(0, h - 0.1, 0.7);
  return mergeGeometries([plinth, torus1, scotia, torus2, shaft, bell, astragal, ...leaves, abacus, flower].map((g) => (g.index ? g.toNonIndexed() : g)));
}

function baluster() {
  const pts = [[0.13, 0], [0.13, 0.08], [0.08, 0.12], [0.07, 0.2], [0.12, 0.38], [0.13, 0.48], [0.07, 0.62], [0.055, 0.7], [0.1, 0.74], [0.12, 0.82], [0.0, 0.83]];
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 8);
  return g.toNonIndexed();
}

// Statues come from sculpture.js; figureGeometry is kept for other modules.
export function figureGeometry(i = 1) {
  return statueGeometry(MUSES[i % MUSES.length]);
}

// coffered and painted vault of the loggia (Tulka's lunettes are hinted in the coffers)
function cofferMaterial(w, d, plain = false) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = plain ? '#d8c29a' : '#e4d3b2';
  x.fillRect(0, 0, c.width, c.height);
  const nx = Math.round(w / 1.4), ny = 4;
  const cw = c.width / nx, chh = c.height / ny;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const px = i * cw, py = j * chh;
      x.fillStyle = plain ? '#b49a70' : '#b8924e';
      x.fillRect(px + 4, py + 4, cw - 8, chh - 8);
      x.fillStyle = plain ? '#c9b086' : (i + j) % 3 === 0 ? '#5a6f8f' : '#8a3a2e';
      x.fillRect(px + 12, py + 12, cw - 24, chh - 24);
      x.fillStyle = plain ? '#e0caa0' : '#e8c878';
      x.beginPath(); x.arc(px + cw / 2, py + chh / 2, Math.min(cw, chh) * (plain ? 0.12 : 0.18), 0, Math.PI * 2); x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardNodeMaterial({ map: t, roughness: plain ? 0.85 : 0.6, metalness: plain ? 0 : 0.15, side: THREE.DoubleSide });
}

// ------------------------------------------------------------------ instancing kit
class Kit {
  constructor() {
    this.sets = new Map();
  }
  put(key, geometry, material, matrix, order, xray = 'ghost') {
    if (!this.sets.has(key)) this.sets.set(key, { geometry, material, mats: [], orders: [], xray });
    const s = this.sets.get(key);
    s.mats.push(matrix);
    s.orders.push(order);
  }
  build(add, stage, opts = {}) {
    for (const [key, s] of this.sets) {
      const im = new THREE.InstancedMesh(s.geometry, s.material, s.mats.length);
      s.mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = opts.cast ?? true;
      im.receiveShadow = true;
      im.name = key;
      add(im, { stage, mode: opts.mode ?? 'grow', dur: opts.dur ?? 0.08, orders: new Float32Array(s.orders), xray: s.xray, dropHeight: opts.dropHeight });
    }
  }
}

// ------------------------------------------------------------------ main
export function buildFacade(ctx) {
  const { root, M, R } = ctx;
  const add = (o, opts) => { root.add(o); return R.add(o, opts); };
  const kit = new Kit();

  const southTop = H.southCornice;
  const masses = [
    { id: 'main', poly: FP.main, top: H.cornice + 1.4 },
    { id: 'loggia', poly: FP.loggia, top: H.cornice + 1.4 },
    { id: 'terrace', poly: FP.terrace, top: 8.6 },
    { id: 'south', poly: FP.south, top: southTop + 1.2 },
  ];
  const blocked = (self, x, y, z) => masses.some((m) => m.id !== self && y < m.top && pointInPolygon(x, z, m.poly));

  // geometry library
  const G = {
    rectGlass: (w, h) => new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0.03).toNonIndexed(),
  };
  const lib = {};
  const geo = (key, make) => (lib[key] ??= make());

  function windowAt(type, e, s, yBase, order, self) {
    const x = e.p[0] + e.dir[0] * s, z = e.p[1] + e.dir[1] * s;
    if (blocked(self, x + e.n[0] * 0.7, yBase + 1.0, z + e.n[1] * 0.7)) return false;
    const n = e.n;
    const mtx = place(x, yBase, z, n);
    const t = type;
    if (t.kind === 'rect') {
      const dk = t.dark ? 'd' : '';
      kit.put(`glass-r${dk}-${t.w}-${t.h}`, geo(`gr${t.w}${t.h}`, () => G.rectGlass(t.w, t.h)), t.dark ? M.woodDark : M.glass, mtx, order, 'hide');
      kit.put(`frame-r-${t.w}-${t.h}`, geo(`fr${t.w}${t.h}`, () => frameRect(t.w, t.h)), M.trim, mtx, order);
      if (!t.dark) kit.put(`bars-r-${t.w}-${t.h}`, geo(`br${t.w}${t.h}`, () => barsRect(t.w, t.h)), M.frame, mtx, order, 'hide');
      if (t.ped) {
        const pm = place(x + n[0] * 0.02, yBase + t.h + 0.35, z + n[1] * 0.02, n);
        kit.put(`ped-${t.ped}-${t.w}`, geo(`p${t.ped}${t.w}`, () => pediment(t.w + 0.9, t.ped)), M.trim, pm, order + 0.02);
      }
    } else if (t.kind === 'arch' && t.open) {
      kit.put(`frame-ao-${t.w}-${t.h}`, geo(`fao${t.w}${t.h}`, () => frameArch(t.w, t.h, 0.26, 0.24, false)), M.trim, mtx, order);
    } else if (t.kind === 'arch') {
      kit.put(`glass-a-${t.w}-${t.h}`, geo(`ga${t.w}${t.h}`, () => glassArch(t.w, t.h)), t.dark ? M.woodDark : M.glass, mtx, order, 'hide');
      kit.put(`frame-a-${t.w}-${t.h}`, geo(`fa${t.w}${t.h}`, () => frameArch(t.w, t.h)), M.trim, mtx, order);
      if (!t.dark) kit.put(`bars-a-${t.w}-${t.h}`, geo(`ba${t.w}${t.h}`, () => barsArch(t.w, t.h)), M.frame, mtx, order, 'hide');
    } else if (t.kind === 'oval') {
      kit.put(`glass-o-${t.w}`, geo(`go${t.w}`, () => ovalGlass(t.w, t.h)), M.glass, mtx, order, 'hide');
      kit.put(`frame-o-${t.w}`, geo(`fo${t.w}`, () => ovalFrame(t.w, t.h)), M.trim, mtx, order);
      kit.put(`bars-o-${t.w}`, geo(`bo${t.w}`, () => barsOval(t.w, t.h)), M.frame, mtx, order, 'hide');
    } else if (t.kind === 'niche') {
      kit.put('niche', geo('niche', () => glassArch(1.7, 3.6)), M.woodDark, mtx, order, 'hide');
      kit.put('niche-frame', geo('nichef', () => frameArch(1.7, 3.6, 0.3, 0.3)), M.trim, mtx, order);
      const bard = x < 0 ? 0 : 1;
      kit.put('niche-statue-' + bard, geo('bard' + bard, () => bardGeometry(bard)), M.statue, place(x + n[0] * 0.25, yBase + 0.1, z + n[1] * 0.25, n, 3.0, 3.0, 3.0), order + 0.03);
    }
    return true;
  }

  // ---------------------------------------------------------------- windows per mass
  const T = {
    gRect: { kind: 'rect', w: 1.6, h: 2.6 },
    gArch: { kind: 'arch', w: 2.0, h: 4.4 },
    arcade: { kind: 'arch', w: 3.0, h: 5.4, dark: true },
    pArchTri: { kind: 'arch', w: 1.9, h: 3.9 },
    oval: { kind: 'oval', w: 1.35, h: 0.85 },
    attic: { kind: 'rect', w: 1.2, h: 1.7 },
    // south wing storey system (1914 elevation): three rows of small windows in the rusticated base, the main
    // floor, second-floor windows under triangular pediments, ovals in the frieze
    sBase: { kind: 'rect', w: 0.8, h: 0.5 },
    sLow: { kind: 'rect', w: 1.0, h: 1.0 },
    sMez: { kind: 'rect', w: 1.0, h: 1.2 },
    s1: { kind: 'rect', w: 1.5, h: 3.2 },
    s2: { kind: 'rect', w: 1.3, h: 1.4, ped: 'tri' },
    sOval: { kind: 'oval', w: 1.0, h: 0.68 },
    sAttic: { kind: 'rect', w: 1.3, h: 1.6 },
    // main block after Fialka's plans and the photos from Petřín / Divadelní
    wRect: { kind: 'rect', w: 1.4, h: 3.0 },             // west side sections, main floor
    wSmall: { kind: 'rect', w: 1.2, h: 0.8, ped: 'seg' }, // small window above, eared frame with a pediment
    wArch: { kind: 'arch', w: 3.2, h: 5.8 },             // west centre: five big arched windows
    eRect: { kind: 'rect', w: 1.7, h: 3.2 },             // east main floor
    eSmall: { kind: 'rect', w: 1.3, h: 0.9 },
    gf1: { kind: 'rect', w: 0.8, h: 0.5 },               // three small windows stacked in the rusticated base
    gf2: { kind: 'rect', w: 0.8, h: 1.2 },
    gf3: { kind: 'rect', w: 0.8, h: 1.3 },
    pDoor: { kind: 'rect', w: 1.6, h: 3.3, ped: 'tri' }, // pylon doorways on Národní
    pSq: { kind: 'rect', w: 1.2, h: 1.2 },
    actDoor: { kind: 'arch', w: 1.2, h: 4.2, dark: true },
    atticDoor: { kind: 'rect', w: 1.2, h: 2.5, dark: true }, // three doors from the attic onto the north roof terrace
    pylW: { kind: 'arch', w: 1.5, h: 3.0 },              // NW pylon, river front
    eGf: { kind: 'rect', w: 0.9, h: 2.1 },               // behind the east arcade: paired windows
    eLun: { kind: 'arch', w: 2.4, h: 1.2 },              // ... under a lunette
    eDoor: { kind: 'rect', w: 1.5, h: 3.0 },
    porch: { kind: 'arch', w: 2.4, h: 6.9 },             // porch (podjezd): three glazed arches, crown ≈ 7.5
    drive: { kind: 'arch', w: 3.0, h: 4.6, dark: true }, // drive-through arch in each end face
    ovalF: { kind: 'oval', w: 1.25, h: 0.85 },
    roof: { kind: 'rect', w: 1.1, h: 1.5 },
    door: { kind: 'arch', w: 2.0, h: 4.3 },
    niche: { kind: 'niche' },
  };
  const pilasters = [];
  const aedicules = [];
  const ord = (base, z) => base + Math.min(0.08, Math.max(0, (z + 8) / 105) * 0.08);

  // main block: explicit bays per façade (Fialka's plans 1883, photos from Petřín and from Divadelní)
  const westEdges = edges(FP.main).filter((e) => e.n[0] < -0.5);
  const eastEdges = edges(FP.main).filter((e) => e.n[0] > 0.8);
  const onEdges = (list, v) => {
    for (const e of list) {
      const a = Math.min(e.p[1], e.q[1]), b = Math.max(e.p[1], e.q[1]);
      if (v >= a - 1e-6 && v <= b + 1e-6) return [e, ((v - e.p[1]) / (e.q[1] - e.p[1])) * e.len];
    }
    return null;
  };
  const halfCols = [], hoods = [], myslbek = [];
  const hood = (e, s, y, w) => {
    const x = e.p[0] + e.dir[0] * s, z = e.p[1] + e.dir[1] * s;
    hoods.push([place(x, y, z, e.n, w / 1.8, 1, 1), ord(0.3, z)]);
  };
  const pil = (e, s) => {
    const x = e.p[0] + e.dir[0] * s, z = e.p[1] + e.dir[1] * s;
    if (!blocked('main', x + e.n[0] * 0.7, 10, z + e.n[1] * 0.7)) pilasters.push([place(x, H.ground + 0.3, z, e.n), ord(0.25, z)]);
  };
  const groundTriplet = (e, s, v) => {
    windowAt(T.gf1, e, s, 1.1, ord(0.11, v), 'main');
    windowAt(T.gf2, e, s, 3.8, ord(0.12, v), 'main');
    windowAt(T.gf3, e, s, 5.7, ord(0.13, v), 'main');
  };
  // west (river) front: pylon | 3 rectangular bays | 5 arched bays between giant half-columns | 3 rectangular bays
  {
    const SIDE = [7.3, 11.1, 14.7, 42.9, 46.5, 50.3], CENTRE = [19.2, 23.9, 28.6, 33.4, 38.2];
    for (const v of SIDE) {
      const hit = onEdges(westEdges, v);
      if (!hit) continue;
      const [e, s] = hit;
      if (v === 46.5) {
        // actors' entrance with a hood (Myslbek's reclining Opera and Drama above it)
        windowAt(T.actDoor, e, s, 0.15, ord(0.12, v), 'main');
        hood(e, s, 4.4, 1.9);
        for (const side of [-1, 1]) {
          // two figures on the hood (top ≈ 5.0), leaning in towards the middle from its ends
          const x = e.p[0] + e.dir[0] * (s + side * 1.0) + e.n[0] * 0.28, z = e.p[1] + e.dir[1] * (s + side * 1.0) + e.n[1] * 0.28;
          // place() turns local +x against the edge direction, so the figure at +dir leans towards local +x
          myslbek.push(place(x, 5.0, z, e.n, 1.25, 1.25, 1.25).multiply(new THREE.Matrix4().makeRotationZ(-side * 0.62)));
        }
      } else groundTriplet(e, s, v);
      windowAt(T.wRect, e, s, 9.6, ord(0.26, v), 'main');
      hood(e, s, 13.2, 2.0);
      windowAt(T.wSmall, e, s, 14.4, ord(0.3, v), 'main');
      windowAt(T.ovalF, e, s, 17.9, ord(0.36, v), 'main');
    }
    for (const v of CENTRE) {
      const hit = onEdges(westEdges, v);
      if (!hit) continue;
      const [e, s] = hit;
      groundTriplet(e, s, v);
      windowAt(T.wArch, e, s, 9.5, ord(0.26, v), 'main');
      windowAt(T.ovalF, e, s, 17.9, ord(0.36, v), 'main');
    }
    for (const v of [16.8, 21.5, 26.2, 31.0, 35.8, 40.6]) {
      const hit = onEdges(westEdges, v);
      if (!hit) continue;
      const [e, s] = hit;
      halfCols.push([place(e.p[0] + e.dir[0] * s, 9.0, e.p[1] + e.dir[1] * s, e.n), ord(0.25, v)]);
    }
    for (const v of [5.4, 9.2, 12.9, 44.7, 48.4, 51.9]) { const hit = onEdges(westEdges, v); if (hit) pil(...hit); }
    // NW pylon: arched window with a small one above
    const hp = onEdges(westEdges, 1.6);
    if (hp) {
      windowAt(T.pylW, hp[0], hp[1], 9.7, ord(0.26, 1.6), 'main');
      windowAt(T.pSq, hp[0], hp[1], 13.9, ord(0.3, 1.6), 'main');
      windowAt(T.ovalF, hp[0], hp[1], 17.9, ord(0.36, 1.6), 'main');
      groundTriplet(hp[0], hp[1], 1.6);
    }
  }
  // east (Divadelní) front: pylon bay, then eleven bays of 4.0 m over the arcade gallery
  {
    const hp = onEdges(eastEdges, 4.8);
    if (hp) {
      windowAt(T.gRect, hp[0], hp[1], 2.2, ord(0.12, 4.8), 'main');
      windowAt(T.pArchTri, hp[0], hp[1], 9.15, ord(0.26, 4.8), 'main');
      windowAt(T.ovalF, hp[0], hp[1], 17.6, ord(0.36, 4.8), 'main');
    }
    for (let k = 0; k < 11; k++) {
      const v = 10 + k * 4.0;
      const hit = onEdges(eastEdges, v);
      if (!hit) continue;
      const [e, s] = hit;
      windowAt(T.eRect, e, s, 9.0, ord(0.26, v), 'main');
      hood(e, s, 12.5, 2.3);
      windowAt(T.eSmall, e, s, 13.4, ord(0.3, v), 'main');
      windowAt(T.ovalF, e, s, 17.6, ord(0.36, v), 'main');
    }
    for (let k = 0; k <= 11; k++) { const hit = onEdges(eastEdges, 8 + k * 4.0); if (hit) pil(...hit); }
  }
  // north pylon faces on Národní: doorway with a pediment, niche with Záboj / Lumír, small window, frieze oval
  {
    const e = edges(FP.main).find((q) => q.n[1] < -0.8);
    for (const p of [FP.pylonW, FP.pylonE]) {
      const [cx, cz] = polyCentroid(p);
      const s = (cx - e.p[0]) * e.dir[0] + (cz - e.p[1]) * e.dir[1];
      const z = e.p[1] + e.dir[1] * s;
      windowAt(T.pDoor, e, s, 0.4, ord(0.12, z), 'main');
      windowAt(T.niche, e, s, 9.0, ord(0.27, z), 'main');
      windowAt(T.pSq, e, s, 13.9, ord(0.3, z), 'main');
      windowAt(T.ovalF, e, s, 17.9, ord(0.36, z), 'main');
    }
  }
  {
    // straight hoods on consoles over the main-floor windows
    const hg = mergeGeometries([
      new THREE.BoxGeometry(1.8, 0.14, 0.34).translate(0, 0.43, 0.17),
      new THREE.BoxGeometry(1.95, 0.08, 0.4).translate(0, 0.54, 0.2),
      new THREE.BoxGeometry(0.16, 0.42, 0.3).translate(-0.82, 0.18, 0.15),
      new THREE.BoxGeometry(0.16, 0.42, 0.3).translate(0.82, 0.18, 0.15),
    ].map((g) => g.toNonIndexed()));
    const hm = new THREE.InstancedMesh(hg, M.trim, hoods.length);
    hoods.forEach(([m], i) => hm.setMatrixAt(i, m));
    add(hm, { stage: 3, mode: 'grow', dur: 0.06, orders: new Float32Array(hoods.map((q) => q[1])), xray: 'ghost' });
    if (myslbek.length) {
      const fm = new THREE.InstancedMesh(statueGeometry(MUSES[4]), M.statue, myslbek.length);
      myslbek.forEach((m, i) => fm.setMatrixAt(i, m));
      fm.castShadow = true;
      add(fm, { stage: 3, mode: 'grow', dur: 0.05, orders: new Float32Array(myslbek.length).fill(0.6), xray: 'ghost' });
    }
    // giant engaged Corinthian half-columns (Ø ≈ 0.9) of the west centre, 9.0 → 16.6
    const cg = mergeGeometries([
      new THREE.BoxGeometry(1.05, 0.3, 0.6).translate(0, 0.15, 0.05),
      new THREE.CylinderGeometry(0.42, 0.46, 6.65, 18, 1, false, -Math.PI / 2, Math.PI).translate(0, 0.3 + 3.325, 0),
      new THREE.CylinderGeometry(0.62, 0.43, 0.6, 18, 1, false, -Math.PI / 2, Math.PI).translate(0, 7.25, 0),
      new THREE.BoxGeometry(1.35, 0.14, 0.75).translate(0, 7.62, 0.1),
    ].map((g) => g.toNonIndexed()));
    const cm = new THREE.InstancedMesh(cg, M.trim, halfCols.length);
    halfCols.forEach(([m], i) => cm.setMatrixAt(i, m));
    cm.castShadow = true;
    add(cm, { stage: 3, mode: 'rise', dur: 0.08, orders: new Float32Array(halfCols.map((q) => q[1])), xray: 'ghost' });
  }
  // west balcony along the main floor (≈ 9.0) from the porch terrace to the connector,
  // east balcony on top of the arcade gallery (≈ 7.6)
  {
    const balcony = (path, y, out, order, slab = out + 0.25) => {
      const geos = [];
      geos.push(sweepGeometry(path, [[0, y - 0.3], [slab, y - 0.3], [slab, y], [0, y]], { closed: false, tile: 2 }));
      const line = path.map(([px, pz], i) => {
        const [qx, qz] = path[Math.min(path.length - 1, i + 1)], [rx, rz] = path[Math.max(0, i - 1)];
        const dx = qx - rx, dz = qz - rz, l = Math.hypot(dx, dz) || 1;
        return [px + (dz / l) * out, pz - (dx / l) * out];
      });
      geos.push(sweepGeometry(line, [[-0.18, y], [0.18, y], [0.18, y + 0.12], [-0.18, y + 0.12], [-0.18, y]], { closed: false, tile: 3 }));
      geos.push(sweepGeometry(line, [[-0.2, y + 0.95], [0.22, y + 0.95], [0.24, y + 1.06], [-0.22, y + 1.08], [-0.2, y + 0.95]], { closed: false, tile: 3 }));
      add(based(mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g))), M.trim), { stage: 3, order, dur: 0.06, mode: 'appear', xray: 'ghost' });
      const bm = [];
      for (let i = 0; i < line.length - 1; i++) {
        const [ax, az] = line[i], [bx, bz] = line[i + 1];
        const L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / 0.34);
        const nx = (bz - az) / L, nz = -(bx - ax) / L;
        for (let k = 1; k < n; k++) bm.push(place(ax + ((bx - ax) * k) / n, y + 0.12, az + ((bz - az) * k) / n, [nx, nz], 0.95, 0.95, 0.95));
      }
      const im = new THREE.InstancedMesh(baluster(), M.trim, bm.length);
      bm.forEach((m, i) => im.setMatrixAt(i, m));
      add(im, { stage: 3, mode: 'grow', dur: 0.05, orders: new Float32Array(bm.length).fill(order), xray: 'ghost' });
    };
    // the path follows the edge direction, so the sweep's left normal is the façade's outward normal
    const run = (list, v0, v1) => {
      const a = onEdges(list, v0), b = onEdges(list, v1);
      if (!a || !b || a[0] !== b[0]) return null;
      const e = a[0], s0 = Math.min(a[1], b[1]), s1 = Math.max(a[1], b[1]);
      return [s0, s1].map((q) => [e.p[0] + e.dir[0] * q, e.p[1] + e.dir[1] * q]);
    };
    const wp = run(westEdges, 18.0, 51.8);
    if (wp) balcony(wp, 9.0, 0.85, 0.3);
    const ep = run(eastEdges, 8.2, 51.9);
    if (ep) balcony(ep, 7.6, 2.08, 0.22, 2.55);
  }
  // east arcade gallery on Divadelní (Fialka plan 02, photo ext_detail_arkadova_galerie): eleven semicircular
  // arches on slender grey granite Ionic columns, 2.3 m in front of the wall, a balustrade between the column
  // pedestals; its roof is the main-floor balcony above. Behind it paired windows under lunettes and a door.
  {
    const DEP = 2.3, WT = 0.45, SPRING = 4.3, R = 1.75, TOP = 7.3, FLOOR = 1.0, PED = 1.95;
    const hA = onEdges(eastEdges, 7.8), hB = onEdges(eastEdges, 52.2);
    if (hA && hB && hA[0] === hB[0]) {
      const e = hA[0];
      const sv = (v) => onEdges([e], v)[1];
      const sA = Math.min(hA[1], hB[1]), sB = Math.max(hA[1], hB[1]), sMid = (sA + sB) / 2, L = sB - sA;
      const P = (sx, out) => [e.p[0] + e.dir[0] * sx + e.n[0] * out, e.p[1] + e.dir[1] * sx + e.n[1] * out];
      const lx = (sx) => -(sx - sMid); // place() turns local +x against the edge direction
      const arches = [];
      for (let k = 0; k < 11; k++) arches.push(lx(sv(10 + 4 * k)));
      arches.sort((p, q) => p - q);
      // front wall above the springing: one contour with the arches cut out of its lower edge
      const sh = new THREE.Shape();
      sh.moveTo(-L / 2, SPRING);
      for (const xc of arches) {
        sh.lineTo(xc - R, SPRING);
        sh.absarc(xc, SPRING, R, Math.PI, 0, true);
      }
      sh.lineTo(L / 2, SPRING);
      sh.lineTo(L / 2, TOP);
      sh.lineTo(-L / 2, TOP);
      sh.closePath();
      const front = new THREE.ExtrudeGeometry(sh, { depth: WT, bevelEnabled: false, curveSegments: 16 });
      const parts = [front.index ? front.toNonIndexed() : front];
      for (const xc of arches) {
        parts.push(new THREE.BoxGeometry(0.42, 0.62, WT + 0.1).translate(xc, SPRING + R + 0.02, WT / 2).toNonIndexed()); // keystones (mascarons)
        parts.push(new THREE.TorusGeometry(R + 0.1, 0.09, 6, 28, Math.PI).translate(xc, SPRING, WT).toNonIndexed()); // archivolt
      }
      // carved spandrels (photo of the gallery): a lyre between two palm branches over every pier
      {
        const relief = [];
        const lyre = new THREE.TorusGeometry(0.2, 0.035, 5, 14, Math.PI * 1.15).rotateZ(Math.PI * 1.07).translate(0, 0.22, 0);
        relief.push(lyre.toNonIndexed());
        relief.push(new THREE.BoxGeometry(0.34, 0.045, 0.05).translate(0, 0.42, 0).toNonIndexed()); // yoke
        for (const x of [-0.07, 0, 0.07]) relief.push(new THREE.BoxGeometry(0.014, 0.3, 0.02).translate(x, 0.26, 0).toNonIndexed()); // strings
        relief.push(new THREE.SphereGeometry(0.07, 8, 6).scale(1, 0.7, 0.5).translate(0, 0.02, 0).toNonIndexed());
        for (const sgn of [-1, 1]) {
          for (let i = 0; i < 7; i++) {
            const t = i / 6, ang = sgn * (0.35 + t * 0.95);
            const leaf = new THREE.SphereGeometry(0.5, 6, 4).scale(0.07, 0.24 - t * 0.09, 0.03)
              .rotateZ(-ang).translate(sgn * (0.16 + t * 0.42), 0.06 + Math.sin(t * 1.4) * 0.34, 0);
            relief.push(leaf.toNonIndexed());
          }
        }
        const rg = mergeGeometries(relief);
        for (let k = 1; k <= 10; k++) {
          const xk = lx(sv(8 + 4 * k));
          parts.push(rg.clone().translate(xk, 5.2, WT + 0.03));
        }
      }
      parts.push(new THREE.BoxGeometry(L, 0.16, 0.14).translate(0, 6.62, WT + 0.05).toNonIndexed()); // frieze moulding
      parts.push(new THREE.BoxGeometry(L, 0.12, 0.1).translate(0, 7.18, WT + 0.04).toNonIndexed());
      // impost blocks and end piers
      for (let k = 0; k <= 11; k++) {
        const xk = lx(sv(Math.min(52.0, 8 + 4 * k)));
        const end = k === 0 || k === 11;
        const xe = k === 0 ? lx(sA) - 0.25 : k === 11 ? lx(sB) + 0.25 : xk;
        if (end) parts.push(new THREE.BoxGeometry(0.5, SPRING - PED, WT).translate(xe, (SPRING + PED) / 2, WT / 2).toNonIndexed());
        else parts.push(new THREE.BoxGeometry(0.56, 0.2, WT + 0.06).translate(xk, SPRING - 0.1, WT / 2).toNonIndexed());
      }
      // balustrade: base course, coping, pedestals under the columns
      parts.push(new THREE.BoxGeometry(L, 0.1, WT).translate(0, FLOOR + 0.05, WT / 2).toNonIndexed());
      parts.push(new THREE.BoxGeometry(L, 0.12, WT + 0.08).translate(0, PED - 0.06, WT / 2).toNonIndexed());
      for (let k = 1; k <= 10; k++) parts.push(new THREE.BoxGeometry(0.55, PED - FLOOR, 0.55).translate(lx(sv(8 + 4 * k)), (PED + FLOOR) / 2, WT / 2).toNonIndexed());
      const [fx, fz] = P(sMid, DEP - WT);
      const fm = based(mergeGeometries(parts), M.trim);
      fm.geometry.applyMatrix4(place(fx, 0, fz, e.n));
      fm.geometry.computeBoundingBox();
      add(fm, { stage: 3, order: 0.2, dur: 0.07, mode: 'rise', xray: 'ghost' });
      // podium (gallery floor) on a granite plinth along the street
      const [px, pz] = P(sMid, 0);
      const pod = mergeGeometries([
        new THREE.BoxGeometry(L, FLOOR, DEP - 0.25).translate(0, FLOOR / 2, (DEP - 0.25) / 2),
      ].map((g) => g.toNonIndexed()));
      pod.applyMatrix4(place(px, 0, pz, e.n));
      add(based(pod, M.trim), { stage: 3, order: 0.19, dur: 0.05, mode: 'rise', xray: 'ghost' });
      const gp = new THREE.BoxGeometry(L, FLOOR - 0.05, 0.3).translate(0, (FLOOR - 0.05) / 2, DEP - 0.1).toNonIndexed();
      gp.applyMatrix4(place(px, 0, pz, e.n));
      add(based(gp, M.granite), { stage: 3, order: 0.19, dur: 0.05, mode: 'rise', xray: 'ghost' });
      // balusters between the pedestals
      const bm = [];
      for (let k = 0; k <= 10; k++) {
        const a0 = sv(8 + 4 * k) + 0.4, a1 = sv(Math.min(52.0, 12 + 4 * k)) - 0.4;
        const n = Math.max(2, Math.round((a1 - a0) / 0.3));
        for (let i = 0; i <= n; i++) {
          const [bx, bz] = P(a0 + ((a1 - a0) * i) / n, DEP - WT / 2);
          bm.push(place(bx, FLOOR + 0.1, bz, e.n, 0.86, 0.86, 0.86));
        }
      }
      const bi = new THREE.InstancedMesh(baluster(), M.trim, bm.length);
      bm.forEach((m, i) => bi.setMatrixAt(i, m));
      add(bi, { stage: 3, mode: 'grow', dur: 0.05, orders: new Float32Array(bm.length).fill(0.205), xray: 'ghost' });
      // slender Ionic columns of grey granite
      const colG = mergeGeometries([
        new THREE.CylinderGeometry(0.27, 0.29, 0.1, 16).translate(0, 0.05, 0),
        new THREE.TorusGeometry(0.22, 0.05, 6, 18).rotateX(Math.PI / 2).translate(0, 0.14, 0),
        new THREE.CylinderGeometry(0.17, 0.2, 1.75, 18).translate(0, 0.19 + 0.875, 0),
        new THREE.TorusGeometry(0.18, 0.035, 6, 18).rotateX(Math.PI / 2).translate(0, 1.95, 0),
        new THREE.CylinderGeometry(0.25, 0.18, 0.12, 18).translate(0, 2.02, 0),
        new THREE.CylinderGeometry(0.075, 0.075, 0.44, 10).rotateX(Math.PI / 2).translate(-0.23, 2.03, 0),
        new THREE.CylinderGeometry(0.075, 0.075, 0.44, 10).rotateX(Math.PI / 2).translate(0.23, 2.03, 0),
        new THREE.BoxGeometry(0.52, 0.06, 0.52).translate(0, 2.12, 0),
      ].map((g) => g.toNonIndexed()));
      const cols = [];
      for (let k = 1; k <= 10; k++) {
        const [cx, cz] = P(sv(8 + 4 * k), DEP - WT / 2);
        cols.push(place(cx, PED, cz, e.n));
      }
      const ci = new THREE.InstancedMesh(colG, M.granite, cols.length);
      cols.forEach((m, i) => ci.setMatrixAt(i, m));
      ci.castShadow = true;
      add(ci, { stage: 3, mode: 'rise', dur: 0.06, orders: new Float32Array(cols.length).fill(0.2), xray: 'ghost' });
      // pendant globe lamps in the arches
      const lamps = [], rods = [];
      for (let k = 0; k < 11; k++) {
        const [lx2, lz2] = P(sv(10 + 4 * k), DEP - WT - 0.7);
        rods.push(new THREE.Matrix4().makeTranslation(lx2, 3.9, lz2));
        lamps.push(new THREE.Matrix4().makeTranslation(lx2, 3.78, lz2));
      }
      const rg = new THREE.CylinderGeometry(0.015, 0.015, TOP - 3.9, 5).translate(0, (TOP - 3.9) / 2, 0);
      const ri = new THREE.InstancedMesh(rg, M.iron, rods.length);
      rods.forEach((m, i) => ri.setMatrixAt(i, m));
      add(ri, { stage: 3, mode: 'appear', dur: 0.04, orders: new Float32Array(rods.length).fill(0.21), xray: 'hide' });
      const li = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 14, 10), M.lamp, lamps.length);
      lamps.forEach((m, i) => li.setMatrixAt(i, m));
      add(li, { stage: 3, mode: 'appear', dur: 0.04, orders: new Float32Array(lamps.length).fill(0.21), xray: 'hide' });
      // ground floor behind the arcade: paired windows under a lunette, a door in the middle bay
      for (let k = 0; k < 11; k++) {
        const v = 10 + 4 * k, sx = sv(v);
        if (k === 5) windowAt(T.eDoor, e, sx, FLOOR + 0.02, ord(0.12, v), 'main');
        else for (const o of [-0.85, 0.85]) windowAt(T.eGf, e, sx + o, FLOOR + 0.55, ord(0.12, v), 'main');
        windowAt(T.eLun, e, sx, SPRING + 0.25, ord(0.13, v), 'main');
      }
    }
  }
  // loggia block side faces
  for (const e of edges(FP.loggia)) {
    if (Math.abs(e.n[0]) < 0.8) continue;
    windowAt(T.gRect, e, e.len / 2, 2.2, 0.14, 'loggia');
    windowAt(T.oval, e, e.len / 2, 16.75, 0.36, 'loggia');
  }
  // north-west terrace wing: tall arched windows
  for (const e of edges(FP.terrace)) {
    if (e.n[0] > 0.5) continue; // the side against the main block
    if (e.n[0] < -0.8) {
      // river front: three glazed arches on the axes of the side-section bays above
      for (const v of [7.3, 11.1, 14.7]) {
        const hit = onEdges([e], v);
        if (hit) windowAt(T.porch, e, hit[1], 0.6, 0.13, 'terrace');
      }
    } else windowAt(T.drive, e, e.len / 2, 0.05, 0.13, 'terrace');
  }
  // attic storey: nine windows on each long side (photos), eared frames with a cornice hood
  for (const e of edges(offsetPolygon(FP.domeBase, 0.25))) {
    const bays = bayCentres(e.len, 4.9, 2.4);
    if (e.n[1] < -0.8) for (const s of bays.slice(1, -1)) windowAt(T.atticDoor, e, s, H.cornice + 0.15, ord(0.5, 0), 'main');
    for (const s of bays) {
      const x = e.p[0] + e.dir[0] * s, z = e.p[1] + e.dir[1] * s;
      const m = place(x, 25.1, z, e.n);
      kit.put('attic-glass', geo('atg', () => G.rectGlass(1.45, 1.15)), M.glass, m, ord(0.52, z), 'hide');
      kit.put('attic-frame', geo('atf', () => frameRect(1.45, 1.15, 0.17, 0.2)), M.trim, m, ord(0.52, z));
      kit.put('attic-bars', geo('atb', () => barsRect(1.45, 1.15)), M.frame, m, ord(0.52, z), 'hide');
      kit.put('attic-hood', geo('ath', () => mergeGeometries([
        new THREE.BoxGeometry(2.2, 0.14, 0.32).translate(0, 1.55, 0.16),
        new THREE.BoxGeometry(1.95, 0.18, 0.22).translate(0, 1.41, 0.11),
        new THREE.BoxGeometry(0.34, 0.3, 0.22).translate(-1.0, 1.05, 0.11), // ears
        new THREE.BoxGeometry(0.34, 0.3, 0.22).translate(1.0, 1.05, 0.11),
      ].map((g) => g.toNonIndexed()))), M.trim, m, ord(0.53, z));
    }
  }
  // south wing (Provisional Theatre + Schulz house), storeys after the 1914 elevation; a giant Corinthian
  // order of pilasters between the bays from the main floor to the frieze
  const southPil = [];
  for (const e of edges(FP.south)) {
    if (e.n[0] < -0.5 && Math.max(e.p[1], e.q[1]) < 56) {
      // connector bay on the river front: a large arched window over an arched portal (photos from the river)
      const hit = onEdges([e], 54.0);
      if (hit) {
        windowAt({ kind: 'arch', w: 2.7, h: 5.4 }, e, hit[1], 9.5, ord(0.66, 54), 'south');
        windowAt({ kind: 'arch', w: 2.2, h: 6.6, dark: true }, e, hit[1], 0.4, ord(0.62, 54), 'south');
        windowAt(T.sOval, e, hit[1], 18.55, ord(0.74, 54), 'south');
      }
      continue;
    }
    const bays = bayCentres(e.len, 3.4, 1.4);
    for (const s of bays) {
      const z = e.p[1] + e.dir[1] * s;
      windowAt(T.sBase, e, s, 1.1, ord(0.62, z), 'south');
      windowAt(T.sLow, e, s, 4.0, ord(0.63, z), 'south');
      windowAt(T.sMez, e, s, 6.8, ord(0.64, z), 'south');
      windowAt(T.s1, e, s, 10.2, ord(0.66, z), 'south');
      windowAt(T.s2, e, s, 14.2, ord(0.69, z), 'south');
      windowAt(T.sOval, e, s, 18.55, ord(0.74, z), 'south');
    }
    if (bays.length > 1) {
      const step = bays[1] - bays[0];
      for (const s of bays.map((b) => b - step / 2).concat([bays.at(-1) + step / 2])) {
        const x = e.p[0] + e.dir[0] * s, z = e.p[1] + e.dir[1] * s;
        if (blocked('south', x + e.n[0] * 0.7, 12, z + e.n[1] * 0.7)) continue;
        southPil.push([place(x, 10.4, z, e.n), ord(0.66, z)]);
      }
    }
  }
  // attic storey of the former Provisional Theatre, flush with the façades
  {
    const prov = offsetPolygon(clipBand(FP.south, V.connectorEnd, V.provEnd), -0.05);
    for (const e of edges(prov)) {
      if (Math.abs(e.n[0]) < 0.5) continue; // windows on the river and street fronts
      for (const s of bayCentres(e.len, 3.6, 1.2)) windowAt(T.sAttic, e, s, 23.0, 0.68, 'provAttic');
    }
  }
  {
    // half-columns framing the piano-nobile windows
    const ag = mergeGeometries([
      new THREE.CylinderGeometry(0.15, 0.17, 4.1, 12, 1, false, -Math.PI / 2, Math.PI).translate(0, 2.25, 0),
      new THREE.BoxGeometry(0.42, 0.22, 0.2).translate(0, 0.11, 0.05),
      new THREE.CylinderGeometry(0.24, 0.16, 0.32, 12, 1, false, -Math.PI / 2, Math.PI).translate(0, 4.46, 0),
      new THREE.BoxGeometry(0.5, 0.12, 0.3).translate(0, 4.68, 0.08),
    ].map((g) => g.toNonIndexed()));
    const am = new THREE.InstancedMesh(ag, M.trim, aedicules.length);
    aedicules.forEach(([m], i) => am.setMatrixAt(i, m));
    am.castShadow = true;
    add(am, { stage: 3, mode: 'rise', dur: 0.08, orders: new Float32Array(aedicules.map((a) => a[1])), xray: 'ghost' });
    // modillions and dentils under the main and south cornices
    const mods = [], dents = [], mo = [], dO = [];
    const runs = [
      { poly: FP.main, keep: (e) => !JOINT.main(e), y: 20.42, sc: 1, ord: 0.43 },
      { poly: FP.loggia, keep: (e) => !JOINT.loggia(e), y: 20.42, sc: 1, ord: 0.43 },
      { poly: FP.south, keep: (e) => !JOINT.south(e), y: 19.82, sc: 0.8, ord: 0.73 },
    ];
    for (const r of runs) {
      for (const e of edges(r.poly)) {
        if (!r.keep(e)) continue;
        for (let s2 = 0.4; s2 < e.len - 0.2; s2 += 0.86 * r.sc) {
          const x = e.p[0] + e.dir[0] * s2, z = e.p[1] + e.dir[1] * s2;
          if (blocked(r.poly === FP.main ? 'main' : r.poly === FP.loggia ? 'loggia' : 'south', x + e.n[0] * 0.6, r.y, z + e.n[1] * 0.6)) continue;
          mods.push(place(x + e.n[0] * 0.62 * r.sc, r.y, z + e.n[1] * 0.62 * r.sc, e.n, r.sc, r.sc, r.sc));
          mo.push(r.ord);
        }
        for (let s2 = 0.2; s2 < e.len - 0.1; s2 += 0.26 * r.sc) {
          const x = e.p[0] + e.dir[0] * s2, z = e.p[1] + e.dir[1] * s2;
          if (blocked(r.poly === FP.main ? 'main' : r.poly === FP.loggia ? 'loggia' : 'south', x + e.n[0] * 0.6, r.y, z + e.n[1] * 0.6)) continue;
          dents.push(place(x + e.n[0] * 0.3 * r.sc, r.y - 0.28 * r.sc, z + e.n[1] * 0.3 * r.sc, e.n, r.sc, r.sc, r.sc));
          dO.push(r.ord);
        }
      }
    }
    const modG = mergeGeometries([
      new THREE.BoxGeometry(0.22, 0.2, 0.9).translate(0, 0.08, 0),
      new THREE.CylinderGeometry(0.11, 0.11, 0.22, 10).rotateZ(Math.PI / 2).translate(0, -0.03, -0.3),
    ].map((g) => g.toNonIndexed()));
    const mm = new THREE.InstancedMesh(modG, M.trim, mods.length);
    mods.forEach((m, i) => mm.setMatrixAt(i, m));
    add(mm, { stage: 3, mode: 'grow', dur: 0.05, orders: new Float32Array(mo), xray: 'ghost' });
    const dm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.16, 0.2), M.trim, dents.length);
    dents.forEach((m, i) => dm.setMatrixAt(i, m));
    add(dm, { stage: 3, mode: 'grow', dur: 0.05, orders: new Float32Array(dO), xray: 'ghost' });
  }
  {
    const sp = new THREE.InstancedMesh(pilaster(6.8), M.trim, southPil.length);
    southPil.forEach(([m], i) => sp.setMatrixAt(i, m));
    sp.castShadow = true;
    add(sp, { stage: 3, mode: 'rise', dur: 0.08, orders: new Float32Array(southPil.map((q) => q[1])), xray: 'ghost' });
  }
  {
    const pg = pilaster(H.piano - H.ground - 0.5);
    const im = new THREE.InstancedMesh(pg, M.trim, pilasters.length);
    pilasters.forEach(([m], i) => im.setMatrixAt(i, m));
    im.castShadow = true;
    add(im, { stage: 3, mode: 'rise', dur: 0.08, orders: new Float32Array(pilasters.map((p) => p[1])), xray: 'ghost' });
  }

  // ---------------------------------------------------------------- loggia: arcade, columns, doors (Fialka plan 04, 1914 section):
  // five bays of 4.15 m between corner piers, floor ≈ 6.6, balustrades between the column pedestals (top ≈ 7.7),
  // Corinthian columns to ≈ 15.0 (paired at the corners), vaulted bays with a lantern each, five rectangular
  // doors into the foyer under painted lunettes; below, five open arches into the porch
  const front = edges(FP.loggia).reduce((a, e) => (e.p[1] + e.q[1] < a.p[1] + a.q[1] ? e : a));
  {
    const L = front.len;
    const bay = 4.15, c0 = L / 2 - 2.5 * bay; // column axes at c0 + k·bay
    const FL = H.loggiaFloor;
    const open = 3.25, spring = 12.2;
    const at = (sA, out = 0) => [front.p[0] + front.dir[0] * sA + front.n[0] * out, front.p[1] + front.dir[1] * sA + front.n[1] * out];
    // arcade wall: plane with five arched openings, extruded inwards
    const s = new THREE.Shape();
    s.moveTo(-L / 2, 0); s.lineTo(L / 2, 0); s.lineTo(L / 2, H.piano - FL); s.lineTo(-L / 2, H.piano - FL); s.closePath();
    for (let k = 0; k < 5; k++) {
      const cx = c0 + bay * (k + 0.5) - L / 2;
      const h = new THREE.Path();
      h.moveTo(cx - open / 2, 0);
      h.lineTo(cx + open / 2, 0);
      h.lineTo(cx + open / 2, spring - FL);
      h.absarc(cx, spring - FL, open / 2, 0, Math.PI, false);
      h.lineTo(cx - open / 2, 0);
      s.holes.push(h);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 1.0, bevelEnabled: false, curveSegments: 14 });
    const uvA = g.attributes.uv;
    for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) / 4, uvA.getY(i) / 4);
    // orient: local x along the edge, local +z outward
    const mid = [(front.p[0] + front.q[0]) / 2, (front.p[1] + front.q[1]) / 2];
    const mtx = place(mid[0] - front.n[0] * 1.0, FL, mid[1] - front.n[1] * 1.0, front.n);
    g.applyMatrix4(mtx);
    add(based(g, M.stone), { stage: 3, order: 0.24, dur: 0.14, mode: 'rise', xray: 'ghost' });

    // ground floor: five open arches (span 2.8, crown 5.0; openings cut in shell.js) into a porch ≈ 4 m deep
    // under a coffered segmental vault, with glazed doors into the vestibule at the back, up three steps
    for (let k = 0; k < 5; k++) windowAt({ kind: 'arch', w: 2.8, h: 5.0, open: true }, front, c0 + bay * (k + 0.5), 0, 0.14, 'loggia');
    {
      const inset = edges(offsetPolygon(FP.loggia, -1.2));
      const fIn = inset.find((e) => e.n[1] < -0.8), bIn = inset.find((e) => e.n[1] > 0.8);
      const mF = [(fIn.p[0] + fIn.q[0]) / 2, (fIn.p[1] + fIn.q[1]) / 2];
      const D = Math.abs((mF[0] - bIn.p[0]) * bIn.n[0] + (mF[1] - bIn.p[1]) * bIn.n[1]);
      const cx = mF[0] - fIn.n[0] * D / 2, cz = mF[1] - fIn.n[1] * D / 2;
      const crown = FL - 0.12, half = D / 2, rise = 1.25;
      const R = (half * half + rise * rise) / (2 * rise), ang = Math.asin(Math.min(1, half / R));
      const vg = new THREE.CylinderGeometry(R, R, fIn.len, 28, 1, true, 1.5 * Math.PI - ang, 2 * ang).rotateZ(-Math.PI / 2);
      const uvV = vg.attributes.uv;
      for (let i = 0; i < uvV.count; i++) uvV.setXY(i, uvV.getY(i), uvV.getX(i)); // coffers: along the porch × across the vault
      vg.applyMatrix4(place(cx, crown - R, cz, fIn.n));
      add(new THREE.Mesh(vg, cofferMaterial(fIn.len, 2 * ang * R, true)), { stage: 3, order: 0.15, dur: 0.05, mode: 'appear', xray: 'hide' });
      // doors on the porch's back wall, facing the arches
      const bw = { p: bIn.q, q: bIn.p, dir: [-bIn.dir[0], -bIn.dir[1]], n: [-bIn.n[0], -bIn.n[1]], len: bIn.len };
      const steps = [], lamps = [];
      for (let k = 0; k < 5; k++) {
        const [ax, az] = at(c0 + bay * (k + 0.5));
        const sB = (ax - bw.p[0]) * bw.dir[0] + (az - bw.p[1]) * bw.dir[1];
        windowAt({ kind: 'rect', w: 1.7, h: 3.0 }, bw, sB, 0.47, 0.15, 'loggia');
        const px = bw.p[0] + bw.dir[0] * sB, pz = bw.p[1] + bw.dir[1] * sB;
        for (let j = 0; j < 3; j++) steps.push(place(px + bw.n[0] * (0.25 + 0.3 * (2 - j)), 0, pz + bw.n[1] * (0.25 + 0.3 * (2 - j)), bw.n, 1, 0.155 * (j + 1), 1));
        const [lx2, lz2] = at(c0 + bay * (k + 0.5), -2.6);
        lamps.push(new THREE.Matrix4().makeTranslation(lx2, 3.7, lz2));
      }
      const sm = new THREE.InstancedMesh(new THREE.BoxGeometry(2.9, 1, 0.32).translate(0, 0.5, 0), M.trim, steps.length);
      steps.forEach((m, i) => sm.setMatrixAt(i, m));
      add(sm, { stage: 3, mode: 'grow', dur: 0.04, orders: new Float32Array(steps.length).fill(0.15), xray: 'ghost' });
      const lr = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.015, crown - 3.85, 5).translate(0, (crown - 3.85) / 2 + 0.15, 0), M.iron, lamps.length);
      const lg2 = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 14, 10), M.lamp, lamps.length);
      lamps.forEach((m, i) => { lr.setMatrixAt(i, m); lg2.setMatrixAt(i, m); });
      add(lr, { stage: 3, mode: 'appear', dur: 0.04, orders: new Float32Array(lamps.length).fill(0.16), xray: 'hide' });
      add(lg2, { stage: 3, mode: 'appear', dur: 0.04, orders: new Float32Array(lamps.length).fill(0.16), xray: 'hide' });
    }
    // free-standing Corinthian columns, paired on the corner piers
    const colG = columnGeometry(15.0 - FL - 0.05);
    const cols = [];
    for (let k = 0; k <= 5; k++) {
      const offs = k === 0 || k === 5 ? [-0.5, 0.5] : [0];
      for (const o of offs) {
        const [x, z] = at(Math.min(L - 0.6, Math.max(0.6, c0 + bay * k + o)), 0.55);
        cols.push(place(x, FL + 0.05, z, front.n));
      }
    }
    const cm = new THREE.InstancedMesh(colG, M.trim, cols.length);
    cols.forEach((m, i) => cm.setMatrixAt(i, m));
    cm.castShadow = true;
    add(cm, { stage: 3, mode: 'rise', dur: 0.1, orders: new Float32Array(cols.map((_, i) => 0.18 + i * 0.008)), xray: 'ghost' });
    // doors into the foyer (rectangular) under painted lunettes
    const back = edges(FP.main).find((e) => e.n[1] < -0.8);
    const lunMat = new THREE.MeshStandardNodeMaterial({ map: loadTex('tex_foyer_lunette.jpg'), roughness: 0.8 });
    for (let k = 0; k < 5; k++) {
      const [cx] = at(c0 + bay * (k + 0.5));
      const sB = (cx - back.p[0]) / back.dir[0];
      const bx = back.p[0] + back.dir[0] * sB, bz = back.p[1] + back.dir[1] * sB;
      const m = place(bx, FL + 0.05, bz, back.n);
      kit.put('loggia-door', geo('ldg', () => G.rectGlass(1.9, 4.0)), M.glass, m, 0.3, 'hide');
      kit.put('loggia-door-f', geo('ldf', () => frameRect(1.9, 4.0, 0.22, 0.24)), M.trim, m, 0.3);
      kit.put('loggia-door-b', geo('ldb', () => barsRect(1.9, 4.0)), M.frame, m, 0.3, 'hide');
      kit.put('loggia-lunette', geo('llu', () => new THREE.CircleGeometry(1.25, 24, 0, Math.PI).translate(0, 4.55, 0.06).toNonIndexed()), lunMat, m, 0.32, 'hide');
      kit.put('loggia-lunette-f', geo('llf', () => new THREE.TorusGeometry(1.3, 0.09, 6, 24, Math.PI).translate(0, 4.55, 0.08).toNonIndexed()), M.trim, m, 0.32);
    }
    // stone paving of the loggia floor
    add(based(capGeometry(offsetPolygon(FP.loggia, -0.4), FL + 0.02, true, [], 1.2), M.paving, { cast: false }), { stage: 3, order: 0.2, dur: 0.05, mode: 'appear', xray: 'ghost' });
    // painted ceiling of the vaulted bays and a hanging lantern in each bay
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(L - 1.2, 5.6).rotateX(Math.PI / 2), cofferMaterial(L - 1.2, 5.6));
    ceil.position.set(mid[0] - front.n[0] * 3.6, 14.6, mid[1] - front.n[1] * 3.6);
    ceil.rotation.y = Math.atan2(front.n[0], front.n[1]);
    add(ceil, { stage: 3, order: 0.3, dur: 0.05, mode: 'appear', xray: 'hide' });
    {
      const lantern = mergeGeometries([
        new THREE.CylinderGeometry(0.02, 0.02, 2.4, 4).translate(0, 2.2, 0),
        new THREE.CylinderGeometry(0.32, 0.22, 0.12, 8).translate(0, 0.95, 0),
        new THREE.CylinderGeometry(0.22, 0.3, 0.12, 8).translate(0, 0.06, 0),
        new THREE.ConeGeometry(0.12, 0.3, 8).translate(0, 1.12, 0),
      ].map((x) => x.toNonIndexed()));
      const glassG = new THREE.CylinderGeometry(0.26, 0.24, 0.8, 8).translate(0, 0.5, 0);
      const lm = [], gm = [];
      for (let k = 0; k < 5; k++) {
        const [x, z] = at(c0 + bay * (k + 0.5), -2.4);
        lm.push(new THREE.Matrix4().makeTranslation(x, 11.3, z));
      }
      const li = new THREE.InstancedMesh(lantern, M.gold, lm.length);
      const gi = new THREE.InstancedMesh(glassG, M.glass, lm.length);
      lm.forEach((m, i) => { li.setMatrixAt(i, m); gi.setMatrixAt(i, m); gm.push(m); });
      add(li, { stage: 3, mode: 'grow', dur: 0.05, orders: new Float32Array(lm.length).fill(0.32), xray: 'hide' });
      add(gi, { stage: 3, mode: 'grow', dur: 0.05, orders: new Float32Array(lm.length).fill(0.32), xray: 'hide' });
    }
    // relief panels in the frieze above the arcade (acanthus with animals)
    for (let k = 0; k < 5; k++) {
      const [x, z] = at(c0 + bay * (k + 0.5));
      kit.put('relief', geo('relief', () => new THREE.BoxGeometry(3.4, 1.6, 0.16).translate(0, 0.8, 0.08).toNonIndexed()), M.trim, place(x, 16.3, z, front.n), 0.34);
    }
    // side arcades of the loggia (one arch each)
    for (const e of edges(FP.loggia)) {
      if (Math.abs(e.n[0]) < 0.8) continue;
      const sh = new THREE.Shape();
      sh.moveTo(-e.len / 2, 0); sh.lineTo(e.len / 2, 0); sh.lineTo(e.len / 2, H.piano - FL); sh.lineTo(-e.len / 2, H.piano - FL); sh.closePath();
      const hole = new THREE.Path();
      hole.moveTo(-open / 2, 0); hole.lineTo(open / 2, 0); hole.lineTo(open / 2, spring - FL);
      hole.absarc(0, spring - FL, open / 2, 0, Math.PI, false); hole.lineTo(-open / 2, 0);
      sh.holes.push(hole);
      const sg = new THREE.ExtrudeGeometry(sh, { depth: 0.9, bevelEnabled: false, curveSegments: 14 });
      const uvS = sg.attributes.uv;
      for (let i = 0; i < uvS.count; i++) uvS.setXY(i, uvS.getX(i) / 4, uvS.getY(i) / 4);
      const mx = (e.p[0] + e.q[0]) / 2 - e.n[0] * 0.9, mz = (e.p[1] + e.q[1]) / 2 - e.n[1] * 0.9;
      sg.applyMatrix4(place(mx, FL, mz, e.n));
      add(based(sg, M.stone), { stage: 3, order: 0.25, dur: 0.14, mode: 'rise', xray: 'ghost' });
    }
    // balustrade between the column pedestals along the loggia floor (top ≈ 7.7)
    {
      const balG = baluster();
      const bm = [];
      for (let k = 0; k < 5; k++) {
        for (let j = 1; j < 8; j++) {
          const [x, z] = at(c0 + bay * k + 0.6 + (j / 8) * (bay - 1.2), 0.55);
          bm.push(place(x, FL + 0.18, z, front.n, 1.05, 1.05, 1.05));
        }
      }
      const im = new THREE.InstancedMesh(balG, M.trim, bm.length);
      bm.forEach((m, i) => im.setMatrixAt(i, m));
      add(im, { stage: 3, mode: 'grow', dur: 0.05, orders: new Float32Array(bm.length).fill(0.3), xray: 'ghost' });
      const lineA = at(c0 + 0.4, 0.55), lineB = at(c0 + 5 * bay - 0.4, 0.55);
      const rail = sweepGeometry([lineA, lineB], [[-0.22, FL + 1.04], [0.22, FL + 1.04], [0.24, FL + 1.16], [-0.24, FL + 1.16], [-0.22, FL + 1.04]], { closed: false, tile: 2 });
      add(based(rail, M.trim), { stage: 3, order: 0.31, dur: 0.05, mode: 'appear', xray: 'ghost' });
    }
    ctx.loggia = { front, bay, c0 };
  }

  // ---------------------------------------------------------------- balustrades (interrupted wherever another mass stands; plinth
  // and coping follow the runs of balusters)
  {
    const bal = baluster();
    const provPoly = clipBand(FP.south, V.connectorEnd, V.provEnd);
    const runs = [
      { poly: FP.main, y: H.cornice + 0.02, self: 'main', order: 0.5, scale: 1.25 },
      { poly: FP.loggia, y: H.cornice + 0.02, self: 'loggia', order: 0.48, scale: 1.25 },
      { poly: FP.terrace, y: 8.62, self: 'terrace', order: 0.2, scale: 1.1 },
      // connector and Schulz house: on the main cornice; the Provisional Theatre has its flush attic there
      { poly: FP.south, y: southTop + 0.02, self: 'south', order: 0.76, scale: 1.15, skip: (ix, iz) => pointInPolygon(ix, iz, provPoly) },
      { poly: provPoly, y: H.provAttic + 0.02, self: 'provAttic', order: 0.8, scale: 1.0 },
      // on the attic cornice (top 30.62), in front of the foot of the dome (photo from the terrace)
      { poly: FP.domeBase, y: H.domeBase + 0.02, self: 'attic', order: 0.6, scale: 0.85, out: 0.5 },
    ];
    const mats = [], orders = [], peds = [], pedOrders = [];
    const pylonHit = (x, z) => pointInPolygon(x, z, FP.pylonW) || pointInPolygon(x, z, FP.pylonE);
    for (const r of runs) {
      const line = offsetPolygon(r.poly, r.out ?? 0.55);
      const segs = [];
      let cur = null, skipped = false, count = 0;
      const push = (x, z) => {
        if (!cur) cur = [];
        const last = cur[cur.length - 1];
        if (!last || Math.hypot(last[0] - x, last[1] - z) > 1e-3) cur.push([x, z]);
      };
      for (const e of edges(line)) {
        const n = Math.max(1, Math.floor(e.len / 0.36));
        for (let k = 0; k <= n; k++) {
          const s = (k / n) * e.len;
          const x = e.p[0] + e.dir[0] * s, z = e.p[1] + e.dir[1] * s;
          const ix = x - e.n[0] * 1.2, iz = z - e.n[1] * 1.2;
          const off = blocked(r.self, x + e.n[0] * 0.3, r.y + 0.2, z + e.n[1] * 0.3) || pylonHit(ix, iz)
            || (r.self === 'main' && pointInPolygon(x + e.n[0] * 0.8, z + e.n[1] * 0.8, FP.loggia)) || (r.skip && r.skip(ix, iz));
          if (off) {
            skipped = true;
            if (cur && cur.length > 1) segs.push(cur);
            cur = null;
            continue;
          }
          push(x, z);
          if (k === n) continue; // the corner point comes again as the next edge's first point
          if (count++ % 10 === 0) {
            peds.push(place(x, r.y, z, e.n, r.scale, r.scale, r.scale));
            pedOrders.push(r.order + (z + 8) / 2000);
          } else {
            mats.push(place(x, r.y + 0.12, z, e.n, r.scale, r.scale, r.scale));
            orders.push(r.order + (z + 8) / 1500);
          }
        }
      }
      if (cur && cur.length > 1) segs.push(cur);
      // a run that wraps round the start joins its last piece to the first
      if (skipped && segs.length > 1) {
        const a = segs[0], z = segs[segs.length - 1];
        if (Math.hypot(a[0][0] - z[z.length - 1][0], a[0][1] - z[z.length - 1][1]) < 0.4) segs[0] = z.concat(a.slice(1)), segs.pop();
      }
      const prof = (y0, y1) => [[-0.3, y0], [0.3, y0], [0.3, y1], [-0.3, y1], [-0.3, y0]];
      const cop = [[-0.32, r.y + 1.0 * r.scale], [0.34, r.y + 1.0 * r.scale], [0.36, r.y + 1.12 * r.scale], [-0.34, r.y + 1.14 * r.scale], [-0.32, r.y + 1.0 * r.scale]];
      const geos = skipped
        ? segs.flatMap((q) => [sweepGeometry(q, prof(r.y, r.y + 0.12 * r.scale), { closed: false, tile: 3 }), sweepGeometry(q, cop, { closed: false, tile: 3 })])
        : [sweepGeometry(line, prof(r.y, r.y + 0.12 * r.scale), { tile: 3 }), sweepGeometry(line, cop, { tile: 3 })];
      if (geos.length) add(based(mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g))), M.trim), { stage: 3, order: r.order + 0.06, dur: 0.06, mode: 'appear', xray: 'ghost' });
    }
    const bm = new THREE.InstancedMesh(bal, M.trim, mats.length);
    mats.forEach((m, i) => bm.setMatrixAt(i, m));
    bm.castShadow = true;
    add(bm, { stage: 3, mode: 'grow', dur: 0.05, orders: new Float32Array(orders), xray: 'ghost' });
    const pedG = new THREE.BoxGeometry(0.55, 1.12, 0.55).translate(0, 0.56, 0).toNonIndexed();
    const pm = new THREE.InstancedMesh(pedG, M.trim, peds.length);
    peds.forEach((m, i) => pm.setMatrixAt(i, m));
    pm.castShadow = true;
    add(pm, { stage: 3, mode: 'grow', dur: 0.05, orders: new Float32Array(pedOrders), xray: 'ghost' });
    // obelisks: on the corners of the Provisional Theatre's attic balustrade and on the Schulz house's south corners
    const obG = mergeGeometries([
      new THREE.BoxGeometry(0.75, 0.8, 0.75).translate(0, 0.4, 0),
      new THREE.BoxGeometry(0.62, 0.12, 0.62).translate(0, 0.86, 0),
      new THREE.CylinderGeometry(0.1, 0.27, 2.4, 4, 1).rotateY(Math.PI / 4).translate(0, 2.12, 0),
      new THREE.SphereGeometry(0.14, 8, 6).translate(0, 3.42, 0),
    ].map((g) => g.toNonIndexed()));
    const obs = [];
    for (const q of offsetPolygon(provPoly, 0.55)) obs.push(new THREE.Matrix4().makeTranslation(q[0], H.provAttic + 1.15, q[1]));
    const sEdge = edges(offsetPolygon(FP.south, 0.55)).reduce((a, e) => (e.p[1] + e.q[1] > a.p[1] + a.q[1] ? e : a));
    for (const q of [sEdge.p, sEdge.q]) obs.push(new THREE.Matrix4().makeTranslation(q[0], southTop + 1.33, q[1]));
    const om = new THREE.InstancedMesh(obG, M.trim, obs.length);
    obs.forEach((m, i) => om.setMatrixAt(i, m));
    om.castShadow = true;
    add(om, { stage: 3, mode: 'grow', dur: 0.05, orders: new Float32Array(obs.length).fill(0.82), xray: 'ghost' });
  }

  // ---------------------------------------------------------------- statues
  {
    const stat = [];
    const { front, bay } = ctx.loggia;
    // Apollo and the nine Muses stand on the coping of the cornice balustrade (y + 1.14 × scale)
    const copingTop = 21.42 + 1.14 * 1.25;
    // 6 on the front (Apollo in the middle), 2 on each side return
    const frontOrder = [1, 2, 0, 3, 4, 5];
    for (let k = 0; k <= 5; k++) {
      const s = Math.min(front.len - 0.6, Math.max(0.6, ctx.loggia.c0 + bay * k)); // over the column axes
      const x = front.p[0] + front.dir[0] * s + front.n[0] * 0.5, z = front.p[1] + front.dir[1] * s + front.n[1] * 0.5;
      stat.push([place(x, copingTop, z, front.n, 2.7, 2.7, 2.7, (k - 2.5) * 0.08), 0.86 + k * 0.012, frontOrder[k]]);
    }
    let side = 6;
    for (const e of edges(FP.loggia)) {
      if (Math.abs(e.n[0]) < 0.8) continue;
      for (const t of [0.3, 0.75]) {
        const x = e.p[0] + (e.q[0] - e.p[0]) * t + e.n[0] * 0.5, z = e.p[1] + (e.q[1] - e.p[1]) * t + e.n[1] * 0.5;
        stat.push([place(x, copingTop, z, e.n, 2.5, 2.5, 2.5), 0.93, side++ % 10]);
      }
    }
    // Wagner's groups (Opera and Drama) on the river front risalits
    let gi = 1;
    for (const [v, group] of [[11, true], [47, true], [5, false], [16.5, false], [41, false]]) {
      for (const o of group ? [-0.9, 0, 0.9] : [0]) {
        const hit = onEdges(westEdges, v + o);
        if (!hit) continue;
        const [e, s] = hit;
        const x = e.p[0] + e.dir[0] * s + e.n[0] * 0.4, z = e.p[1] + e.dir[1] * s + e.n[1] * 0.4;
        const sc = group && o === 0 ? 3.2 : 2.7;
        stat.push([place(x, H.balustrade + 0.1, z, e.n, sc, sc, 2.7, o * 0.3), 0.9, (gi++ * 3) % 10]);
      }
    }
    for (let v = 0; v < 10; v++) {
      const list = stat.filter((st) => st[2] === v);
      if (!list.length) continue;
      const sm = new THREE.InstancedMesh(geo('muse' + v, () => statueGeometry(MUSES[v])), M.statue, list.length);
      list.forEach(([m], i) => sm.setMatrixAt(i, m));
      sm.castShadow = true;
      add(sm, { stage: 3, mode: 'drop', dropHeight: 10, dur: 0.06, orders: new Float32Array(list.map((st) => st[1])), xray: 'ghost' });
    }

    // trigae on the pylons
    const tg = trigaGeometry();
    const tm = new THREE.InstancedMesh(tg, M.bronze, 2);
    [FP.pylonW, FP.pylonE].forEach((p, i) => {
      const [cx, cz] = polyCentroid(p);
      const yaw = i === 0 ? Math.PI / 2 + 0.35 : Math.PI / 2 - 0.35; // galloping north-ish, slightly outward
      _q.setFromAxisAngle(Y, yaw);
      tm.setMatrixAt(i, new THREE.Matrix4().compose(_p.set(cx + 0.4, 25.55, cz - 0.3), _q.clone(), _s.set(1.4, 1.4, 1.4)));
    });
    tm.castShadow = true;
    add(tm, { stage: 3, mode: 'drop', dropHeight: 14, dur: 0.05, orders: new Float32Array([0.96, 0.98]), xray: 'ghost' });
    const pedG = new THREE.BoxGeometry(5.6, 0.75, 3.8).translate(0, 0.375, 0);
    const ped = new THREE.InstancedMesh(pedG, M.trim, 2);
    [FP.pylonW, FP.pylonE].forEach((p, i) => {
      const [cx, cz] = polyCentroid(p);
      ped.setMatrixAt(i, new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(cx, 24.8, cz));
    });
    add(ped, { stage: 3, mode: 'grow', dur: 0.05, orders: new Float32Array([0.94, 0.95]), xray: 'ghost' });
    // pylon attics: relief panels on the outer faces
    const panels = [], urns = [], reliefs = [];
    for (const p of [FP.pylonW, FP.pylonE]) {
      for (const e of edges(p)) {
        const outer = e.n[1] < -0.8 || (p === FP.pylonW ? e.n[0] < -0.8 : e.n[0] > 0.8);
        if (!outer || e.len < 3) continue;
        const mx = (e.p[0] + e.q[0]) / 2, mz = (e.p[1] + e.q[1]) / 2;
        panels.push(place(mx + e.n[0] * 0.02, 22.2, mz + e.n[1] * 0.02, e.n));
        for (const d of [-1.0, 1.0]) reliefs.push(new THREE.Matrix4().compose(
          new THREE.Vector3(mx + e.dir[0] * d + e.n[0] * 0.15, 22.55, mz + e.dir[1] * d + e.n[1] * 0.15),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(e.n[0], e.n[1]), d * 1.25)), new THREE.Vector3(1.6, 1.6, 0.8)));
      }
    }
    // no urns on the pylons (photos); gilded vases ≈ 1.3 m on the four corners of the attic balustrade
    for (const q of offsetPolygon(FP.domeBase, 0.5)) urns.push(new THREE.Matrix4().makeTranslation(q[0], H.domeBase + 0.02 + 1.14 * 0.85, q[1]));
    const pg = mergeGeometries([
      new THREE.BoxGeometry(3.8, 2.0, 0.1).translate(0, 1.0, 0.05),
      new THREE.BoxGeometry(4.1, 0.16, 0.22).translate(0, 0.0, 0.1),
      new THREE.BoxGeometry(4.1, 0.16, 0.22).translate(0, 2.0, 0.1),
    ].map((g) => g.toNonIndexed()));
    const pm = new THREE.InstancedMesh(pg, M.trim, panels.length);
    panels.forEach((m, i) => pm.setMatrixAt(i, m));
    add(pm, { stage: 3, mode: 'grow', dur: 0.05, orders: new Float32Array(panels.length).fill(0.92), xray: 'ghost' });
    const rf = new THREE.InstancedMesh(geo('muse8', () => statueGeometry(MUSES[8])), M.statue, reliefs.length);
    reliefs.forEach((m, i) => rf.setMatrixAt(i, m));
    add(rf, { stage: 3, mode: 'grow', dur: 0.05, orders: new Float32Array(reliefs.length).fill(0.93), xray: 'ghost' });
    const urnG = new THREE.LatheGeometry([[0.001, 0], [0.28, 0], [0.28, 0.12], [0.14, 0.2], [0.38, 0.55], [0.4, 0.8], [0.22, 1.0], [0.25, 1.1], [0.08, 1.22], [0.001, 1.35]].map(([r, y]) => new THREE.Vector2(r, y)), 14);
    const um = new THREE.InstancedMesh(urnG, M.gold, urns.length);
    urns.forEach((m, i) => um.setMatrixAt(i, m));
    um.castShadow = true;
    add(um, { stage: 3, mode: 'grow', dur: 0.05, orders: new Float32Array(urns.length).fill(0.94), xray: 'ghost' });
  }

  kit.build(add, 3, { mode: 'grow', dur: 0.06 });

  // ---------------------------------------------------------------- bronze candelabra around the theatre
  {
    const post = mergeGeometries([
      new THREE.CylinderGeometry(0.55, 0.7, 0.9, 8).translate(0, 0.45, 0),
      new THREE.CylinderGeometry(0.2, 0.32, 4.2, 10).translate(0, 3.0, 0),
      new THREE.SphereGeometry(0.32, 10, 8).translate(0, 5.15, 0),
      new THREE.TorusGeometry(0.75, 0.05, 6, 16).rotateX(Math.PI / 2).translate(0, 5.25, 0),
    ].map((g) => g.toNonIndexed()));
    const globes = mergeGeometries([0, 1, 2, 3, 4].map((k) => {
      const a = (k / 4) * Math.PI * 2;
      return (k === 4 ? new THREE.SphereGeometry(0.3, 12, 10).translate(0, 6.15, 0) : new THREE.SphereGeometry(0.26, 12, 10).translate(Math.cos(a) * 0.75, 5.55, Math.sin(a) * 0.75)).toNonIndexed();
    }));
    const spots = [];
    const { front } = ctx.loggia;
    for (const t of [-0.08, 1.08]) {
      spots.push([front.p[0] + (front.q[0] - front.p[0]) * t + front.n[0] * 2.4, front.p[1] + (front.q[1] - front.p[1]) * t + front.n[1] * 2.4]);
    }
    for (const t of [0.22, 0.5, 0.78]) spots.push([front.p[0] + (front.q[0] - front.p[0]) * t + front.n[0] * 6.5, front.p[1] + (front.q[1] - front.p[1]) * t + front.n[1] * 6.5]);
    const main = FP.main;
    // Divadelní: on the kerb, clear of the arcade gallery (its front ≈ 2.3 m out from the wall)
    spots.push([main[0][0] - 3.4, main[0][1] + 6], [23.4, 6], [23.2, 30], [-21.8, 36]);
    const lampMat = new THREE.MeshStandardNodeMaterial({ color: '#2f3530', roughness: 0.5, metalness: 0.6 });
    const globeMat = new THREE.MeshStandardNodeMaterial({ color: '#f4ede0', roughness: 0.3 });
    globeMat.emissiveNode = vec3(1.0, 0.82, 0.55).mul(U.night.mul(3.2).add(0.05));
    const pm = new THREE.InstancedMesh(post, lampMat, spots.length);
    const gm = new THREE.InstancedMesh(globes, globeMat, spots.length);
    spots.forEach(([x, z], i) => {
      const m = new THREE.Matrix4().makeTranslation(x, 0, z);
      pm.setMatrixAt(i, m);
      gm.setMatrixAt(i, m);
    });
    pm.castShadow = true;
    const o = new Float32Array(spots.length).map((_, i) => 0.3 + i * 0.03);
    add(pm, { stage: 6, mode: 'rise', dur: 0.1, orders: o, xray: 'hide' });
    add(gm, { stage: 6, mode: 'grow', dur: 0.1, orders: o, xray: 'hide' });
  }
  return ctx;
}
