// Interiors (stage 4): horseshoe auditorium with five levels, proscenium boxes, gilded portal with the
// "NÁROD SOBĚ" frieze and tympanum, Hynais curtain with lambrequin and velvet drapes, Ženíšek's
// ceiling, the great chandelier, armchairs, foyer, painters' hall and staircases.
// References: podklady/04_interier_reference (photos), J. Fialka's plans 1883.
import * as THREE from 'three/webgpu';
import { AUD, H, V, STAGE, FACADE, FP, audToB, splitAtGallery, backAngle, hsPath, hsHalfWidth } from '../config.js';
import { capGeometry, sweepGeometry, mergeGeometries, ccw, beamMatrix, edges } from '../core/geom.js';
import { based, rect } from './util.js';
import { loadTex } from '../core/materials.js';
import { columnGeometry, figureGeometry } from './facade.js';

const IN_R = AUD.innerHalfWidth;                      // parapet line at the sides
const OUT_R = AUD.boxBack;                            // back wall of the boxes
const WALL_IN = AUD.outerHalfWidth - AUD.wallT / 2;   // inner face of the horseshoe wall
const CV = AUD.cv;                                    // end of the straight sides / centre of the curve
const K = AUD.k;
const FRONT = AUD.front;                              // proscenium boxes from here to the proscenium wall
const CC = AUD.ceilingCentre;                         // centre of the ceiling painting and of the chandelier
const CEIL_R = AUD.ceilingR;

// open U path from the right front, round the back, to the left front
export function uPath(r, front = FRONT, segs = 30, k = K) {
  return hsPath(r, k, front, segs);
}

function halfWidthAt(v, r, k = K) {
  return hsHalfWidth(v, r, k);
}

// points + inward normals along a path, every `step` metres (first one `offset` from the start)
function alongPath(path, step, offset = step / 2) {
  const out = [];
  let acc = offset;
  for (let i = 0; i < path.length - 1; i++) {
    const [x0, z0] = path[i], [x1, z1] = path[i + 1];
    const l = Math.hypot(x1 - x0, z1 - z0);
    if (l < 1e-9) continue;
    while (acc <= l) {
      const t = acc / l;
      const dx = (x1 - x0) / l, dz = (z1 - z0) / l;
      out.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, nx: dz, nz: -dx });
      acc += step;
    }
    acc -= l;
  }
  return out;
}

// points + inward normals along a U path
function alongU(r, step, front = FRONT, k = K, offset = step / 2) {
  return alongPath(uPath(r, front, 96, k), step, offset);
}

// angle of a point on a horseshoe line: 0 at the east end of the curve, π/2 on the axis, π at the west end
const curveAngle = (x, z, k) => Math.atan2((CV - z) / k, x);

// boxes line the straight sides and run `aBox` into the curve from each end
function inBoxSector(x, z, aBox, k) {
  if (aBox <= 0) return false;
  if (z >= CV) return true;
  const a = curveAngle(x, z, k);
  return a < aBox || a > Math.PI - aBox;
}

// consecutive runs of a path whose points satisfy keep(x, z)
function runsOf(path, keep) {
  const out = [];
  let cur = null;
  for (const p of path) {
    if (keep(p[0], p[1])) (cur ??= []).push(p);
    else if (cur) { if (cur.length > 1) out.push(cur); cur = null; }
  }
  if (cur && cur.length > 1) out.push(cur);
  return out;
}

const Y = new THREE.Vector3(0, 1, 0);
const facing = (x, y, z, nx, nz, s = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(Y, Math.atan2(nx, nz)), new THREE.Vector3(s, s, s));

// Mauve wall over the portal (photo towards the stage): painted festoons of leaves with red ribbons hanging
// from small rosettes, in a row just under the ceiling cornice, and a thin gilded line under the cornice.
function garlandTexture(w, h) {
  const PX = 64, c = document.createElement('canvas');
  c.width = Math.round(w * PX); c.height = Math.round(h * PX);
  const x = c.getContext('2d');
  x.fillStyle = '#c6a29f';
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#c9a74e';
  x.fillRect(0, 0.18 * PX, c.width, 0.05 * PX);
  const n = 9, sw = c.width / n, y0 = 0.55 * PX, sag = 0.7 * PX;
  for (let k = 0; k < n; k++) {
    const xa = k * sw + 0.12 * sw, xb = (k + 1) * sw - 0.12 * sw;
    // swag of leaves
    for (let t = 0; t <= 1.0001; t += 0.025) {
      const px = xa + (xb - xa) * t, py = y0 + Math.sin(Math.PI * t) * sag;
      const r = (0.07 + 0.08 * Math.sin(Math.PI * t)) * PX;
      x.fillStyle = t * 40 % 2 < 1 ? '#7f7a46' : '#9a8f55';
      x.beginPath(); x.ellipse(px, py, r * 1.3, r, (t - 0.5) * 1.2, 0, Math.PI * 2); x.fill();
      if (Math.round(t * 40) % 5 === 0) { x.fillStyle = '#b8453c'; x.beginPath(); x.arc(px, py + r * 0.3, r * 0.45, 0, Math.PI * 2); x.fill(); }
    }
    // rosette and ribbon ends at each hanging point
    for (const px of [xa, xb]) {
      x.fillStyle = '#7a2a2a';
      x.beginPath(); x.moveTo(px - 0.05 * PX, y0); x.lineTo(px - 0.14 * PX, y0 + 0.75 * PX); x.lineTo(px - 0.04 * PX, y0 + 0.68 * PX); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(px + 0.05 * PX, y0); x.lineTo(px + 0.14 * PX, y0 + 0.75 * PX); x.lineTo(px + 0.04 * PX, y0 + 0.68 * PX); x.closePath(); x.fill();
      x.fillStyle = '#c9a74e';
      x.beginPath(); x.arc(px, y0, 0.1 * PX, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#8c6a2c';
      x.beginPath(); x.arc(px, y0, 0.04 * PX, 0, Math.PI * 2); x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function buildInterior(ctx) {
  const { M, R } = ctx;
  // auditorium, portal and curtain live in the auditorium frame; foyer and stairs in the building frame
  let root = ctx.audRoot ?? ctx.root;
  const add = (o, opts) => { root.add(o); return R.add(o, opts); };
  const S = 4;
  ctx.ticks ??= [];

  // ------------------------------------------------------------------ interior finishes and textures
  const coreItems = R.items.filter((it) => it.material === M.brick);
  const finished = M.plaster.clone();
  finished.color = new THREE.Color('#e9dcc3');
  let plastered = null;
  R.hook((T) => {
    const on = T > 4.35;
    if (on === plastered) return;
    plastered = on;
    for (const it of coreItems) { it.material = on ? (it.obj.userData.finish ?? finished) : M.brick; R.applyVisibility(it); }
  });
  const parapetTex = loadTex('tex_parapet.jpg', { repeat: true });
  const parapetScrollTex = loadTex('tex_parapet_scroll.jpg', { repeat: true });
  const mat = {
    // gilded relief on the parapets (photos): the ornament texture tinted gold
    parapet: new THREE.MeshStandardNodeMaterial({ map: parapetTex, color: '#e2bd62', roughness: 0.38, metalness: 0.55, side: THREE.DoubleSide }),
    parapetScroll: new THREE.MeshStandardNodeMaterial({ map: parapetScrollTex, color: '#e2bd62', roughness: 0.38, metalness: 0.55, side: THREE.DoubleSide }),
    ceiling: new THREE.MeshStandardNodeMaterial({ map: loadTex('tex_ceiling.jpg'), roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide }),
    curtain: new THREE.MeshStandardNodeMaterial({ map: loadTex('tex_curtain.jpg'), roughness: 0.92, side: THREE.DoubleSide }),
    lambrequin: new THREE.MeshStandardNodeMaterial({ map: loadTex('tex_lambrequin.jpg'), roughness: 0.75, metalness: 0.15, side: THREE.DoubleSide }),
    frieze: new THREE.MeshStandardNodeMaterial({ map: loadTex('tex_frieze.jpg'), roughness: 0.4, metalness: 0.3 }),
    soffit: new THREE.MeshStandardNodeMaterial({ color: '#e8dcc2', roughness: 0.75, side: THREE.DoubleSide }),
    crystal: new THREE.MeshStandardNodeMaterial({ color: '#fffaf0', roughness: 0.05, metalness: 0.9, emissive: '#ffe2b0', emissiveIntensity: 0.35 }),
    wood: new THREE.MeshStandardNodeMaterial({ color: '#4a2a1a', roughness: 0.5 }),
    gild: M.stucco,
    porphyry: new THREE.MeshStandardNodeMaterial({ color: '#5e1c22', roughness: 0.55, side: THREE.DoubleSide }),
    mauve: new THREE.MeshStandardNodeMaterial({ color: '#c6a29f', roughness: 0.8, side: THREE.DoubleSide }),
    greenMarble: new THREE.MeshStandardNodeMaterial({ color: '#2d4a3d', roughness: 0.2, metalness: 0.05, side: THREE.DoubleSide }),
    whiteMarble: new THREE.MeshStandardNodeMaterial({ color: '#efe9de', roughness: 0.22 }),
    bronzeDark: new THREE.MeshStandardNodeMaterial({ color: '#3b2f25', roughness: 0.38, metalness: 0.75 }),
    pinkShade: new THREE.MeshStandardNodeMaterial({ color: '#f6c9bc', emissive: '#ff9c7e', emissiveIntensity: 1.4, roughness: 0.9, side: THREE.DoubleSide }),
    tin: new THREE.MeshStandardNodeMaterial({ color: '#c9cdd2', metalness: 0.85, roughness: 0.3 }),
    mirror: new THREE.MeshStandardNodeMaterial({ color: '#9aa1a8', metalness: 0.95, roughness: 0.07 }),
    lantern: new THREE.MeshStandardNodeMaterial({ color: '#141414', metalness: 0.35, roughness: 0.45 }),
    lens: new THREE.MeshStandardNodeMaterial({ color: '#2a3036', metalness: 0.2, roughness: 0.1 }),
    foyerCeiling: new THREE.MeshStandardNodeMaterial({ map: loadTex('tex_foyer_ceiling.jpg'), roughness: 0.7, side: THREE.DoubleSide }),
    lunette: new THREE.MeshStandardNodeMaterial({ map: loadTex('tex_foyer_lunette.jpg'), roughness: 0.75, side: THREE.DoubleSide }),
    curtainBase: new THREE.MeshStandardNodeMaterial({ color: '#4b3427', roughness: 0.9, side: THREE.DoubleSide }),
  };

  // ------------------------------------------------------------------ parterre floor (raked) and orchestra-pit rail
  const pitEdge = V.portal - 5.6; // the stalls end at the orchestra-pit wall
  const stallsY = (v) => 2.3 + Math.max(0, pitEdge - v) * 0.059; // 2.3 at the pit rail, ≈ 3.1 at the back (1914 section)
  {
    const r0 = AUD.parapets[0];
    const poly = ccw(uPath(r0, pitEdge, 48).slice(0, -1).concat([[-r0, pitEdge]]));
    const g = capGeometry(poly, 0, true, [], 3);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, stallsY(pos.getZ(i)));
    g.computeVertexNormals();
    add(based(g, M.parquet, { cast: false }), { stage: S, order: 0.02, dur: 0.1, mode: 'appear', xray: 'keep' });
    const rail = mergeGeometries([
      new THREE.BoxGeometry(14.4, 1.1, 0.18).translate(0, 2.85, V.portal - 5.7),
      new THREE.BoxGeometry(14.6, 0.12, 0.32).translate(0, 3.43, V.portal - 5.7),
    ].map((x) => x.toNonIndexed()));
    add(based(rail, mat.wood), { stage: S, order: 0.4, dur: 0.1, mode: 'rise', xray: 'keep' });
  }

  // ------------------------------------------------------------------ tiers (Fialka's tier plans, 1914 section)
  // Boxes ≈ 1.75 m wide along the straight sides and into the curve: partitions, a back wall with a door and a
  // corridor behind it. At the back an open balcony (I., II.) or gallery (III.); the stall boxes leave the back
  // open to the stalls. Ivory columns with gilded capitals and two-globe lamp brackets; ornamented parapets.
  const floors = [], soffits = [], bodies = [], fronts = [], cushions = [], rails = [], backWalls = [];
  const shafts = [], caps = [], lamps = [], parts = [], doors = [], treads = [], risers = [], bands = [];
  const sconces = []; // small pink-shaded wall lights inside the boxes, beside the door
  const frontsScroll = [], balus = []; // stall-box fronts (acanthus scroll), balusters of the II. gallery front
  const drapes = []; // red velvet box curtains tied back at each column (unit height, scaled per tier)
  const mirrors = []; // gilt-framed mirrors on the box back walls, beside the door
  const rowSeats = []; // chair matrices, added to the armchair instances below
  const standSeats = []; // II. gallery side seats by the portal, historic stages only (see the lighting stands)
  const quad = (list, a, b, c, d) => list.push(...a, ...b, ...c, ...a, ...c, ...d);
  const ell = (r, k, a, y) => [Math.cos(a) * r, y, CV - Math.sin(a) * r * k];
  const colAt = (x, z, nx, nz, y0, y1, lamp) => {
    shafts.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y0, z), new THREE.Quaternion(), new THREE.Vector3(1, Math.max(0.1, y1 - y0 - 0.3), 1)));
    caps.push(new THREE.Matrix4().makeTranslation(x, y1 - 0.3, z));
    if (lamp) lamps.push(facing(x + nx * 0.17, y1 - 0.62, z + nz * 0.17, nx, nz));
  };
  AUD.tiers.forEach((y, i) => {
    const inR = AUD.parapets[i], kP = AUD.parapetK[i], aBox = AUD.boxSector[i];
    const yTop = i < 4 ? AUD.tiers[i + 1] - 0.4 : AUD.ceiling;
    const ph = i === 0 ? 0.7 : 1.0; // parapet height (the stall boxes have a low front)
    // floor and soffit from the parapet to the horseshoe wall (boxes, corridor, balcony)
    const ring = ccw(uPath(WALL_IN, FRONT, 48, 1).concat(uPath(inR, FRONT, 48, kP).reverse()));
    floors.push(capGeometry(ring, y, true, [], 3));
    soffits.push(capGeometry(ring, y - 0.38, false, [], 3));
    // parapet: body, ornamented front, gilded rail below, velvet cushion on top
    const path = uPath(inR + 0.12, FRONT, 48, kP);
    if (i === 4) {
      // the II. gallery has an open gilded balustrade (photo of the tiers): plinth, balusters, rail
      bodies.push(sweepGeometry(path, [[-0.16, y - 0.4], [0.16, y - 0.4], [0.16, y + 0.14], [-0.16, y + 0.14], [-0.16, y - 0.4]], { closed: false, tile: 2 }));
      rails.push(sweepGeometry(path, [[-0.13, y + ph - 0.13], [0.15, y + ph - 0.13], [0.15, y + ph], [-0.13, y + ph], [-0.13, y + ph - 0.13]], { closed: false, tile: 2 }));
      for (const q of alongPath(path, 0.23)) balus.push(new THREE.Matrix4().makeTranslation(q.x, y + 0.14, q.z));
    } else {
      // gilded relief fronts: acanthus scroll on the stall boxes, genii and palmettes on a lattice above
      bodies.push(sweepGeometry(path, [[-0.16, y - 0.4], [0.16, y - 0.4], [0.16, y + ph], [-0.16, y + ph], [-0.16, y - 0.4]], { closed: false, tile: 2 }));
      (i === 0 ? frontsScroll : fronts).push(sweepGeometry(path, [[0.18, y - 0.36], [0.18, y + ph - 0.04]], { closed: false, tileU: 5.2, tileV: ph + 0.32 }));
    }
    cushions.push(sweepGeometry(path, [[-0.2, y + ph], [0.22, y + ph], [0.24, y + ph + 0.1], [0.16, y + ph + 0.17], [-0.18, y + ph + 0.15], [-0.2, y + ph]], { closed: false, tile: 2 }));
    rails.push(sweepGeometry(path, [[-0.18, y - 0.48], [0.22, y - 0.48], [0.22, y - 0.38], [-0.18, y - 0.38], [-0.18, y - 0.48]], { closed: false, tile: 2 }));

    // ---- boxes
    const inSec = (x, z) => inBoxSector(x, z, aBox, kP);
    const backAt = (x, z) => {         // point of the box back wall behind a parapet point
      if (z >= CV) return [Math.sign(x) * OUT_R, z];
      const a = curveAngle(x, z, kP);
      return [Math.cos(a) * OUT_R, CV - Math.sin(a) * OUT_R * kP];
    };
    const hh = yTop - y;
    const wall = (x0, z0, x1, z1) => parts.push(beamMatrix(new THREE.Vector3(x0, y + hh / 2, z0), new THREE.Vector3(x1, y + hh / 2, z1), 0.1, hh, new THREE.Matrix4()));
    const bounds = alongU(inR + 0.15, 1.75, FRONT, kP, 0).filter((q) => inSec(q.x, q.z));
    for (const q of bounds) {
      wall(q.x, q.z, ...backAt(q.x, q.z));
      colAt(q.x + q.nx * 0.03, q.z + q.nz * 0.03, q.nx, q.nz, y + ph, yTop, true);
      const dh = yTop - 0.3 - (y + ph + 0.17);
      for (const side of [-1, 1]) {
        drapes.push([side, facing(q.x - q.nx * 0.14, y + ph + 0.17, q.z - q.nz * 0.14, q.nx, q.nz).multiply(new THREE.Matrix4().makeScale(1, dh, 1))]);
      }
    }
    for (let b = 0; b + 1 < bounds.length; b++) {
      const q = bounds[b], q1 = bounds[b + 1];
      if (Math.hypot(q.x - q1.x, q.z - q1.z) > 2.4) continue; // across the open back
      const mx = (q.x + q1.x) / 2, mz = (q.z + q1.z) / 2, nx = (q.nx + q1.nx) / 2, nz = (q.nz + q1.nz) / 2;
      const [bx, bz] = backAt(mx, mz);
      doors.push(facing(bx + nx * 0.07, y, bz + nz * 0.07, nx, nz));
      sconces.push(facing(bx + nx * 0.07 - nz * 0.6, y + 1.7, bz + nz * 0.07 + nx * 0.6, nx, nz));
      mirrors.push(facing(bx + nx * 0.075 + nz * 0.66, y + 0.55, bz + nz * 0.075 - nx * 0.66, nx, nz));
    }
    if (aBox > 0) {
      // side walls where the boxes end and the balcony begins
      for (const a of [aBox, Math.PI - aBox]) {
        const [x0, , z0] = ell(inR + 0.15, kP, a, 0), [x1, , z1] = ell(OUT_R, kP, a, 0);
        wall(x0, z0, x1, z1);
      }
      for (const run of runsOf(uPath(OUT_R, FRONT, 96, kP), inSec)) {
        backWalls.push(sweepGeometry(run, [[-0.06, y], [0.06, y], [0.06, yTop], [-0.06, yTop], [-0.06, y]], { closed: false, tile: 3 }));
      }
      // two or three chairs at the front of every box
      for (const q of alongU(inR + 0.75, 0.62, FRONT - 0.3, kP)) {
        if (!inSec(q.x, q.z) || bounds.some((w) => Math.hypot(w.x - q.x, w.z - q.z) < 0.75)) continue;
        rowSeats.push([facing(q.x, y, q.z, q.nx, q.nz), 0.5 + i * 0.03]);
      }
    }

    // ---- red-brown panelling on the horseshoe wall behind balconies and the corridor (the gallery opening stays free)
    {
      const liner = uPath(WALL_IN - 0.04, FRONT, 96, 1);
      const runs = i === 4 ? runsOf(liner, (x, z) => backAngle(x, z) >= AUD.gallery.halfAngle) : [liner];
      for (const run of runs) backWalls.push(sweepGeometry(run, [[-0.03, y], [0.03, y], [0.03, yTop], [-0.03, yTop], [-0.03, y]], { closed: false, tile: 3 }));
    }

    // ---- columns at the back carrying the tier above (boxes have theirs on the partitions)
    if (i < 4) {
      for (const q of alongU(inR + 0.13, 3.4, FRONT, kP)) {
        if (!inSec(q.x, q.z)) colAt(q.x, q.z, q.nx, q.nz, y + ph, yTop, true);
      }
    }

    // ---- open balcony (I., II.) and gallery (III.): raked rows where there are no boxes
    if (i >= 1 && i <= 3) {
      const pitch = i === 3 ? 0.78 : 0.9, rise = i === 3 ? 0.42 : 0.3;
      const aMin = i === 3 ? 0.45 : aBox; // III.: one row along the sides, raked rows round the back
      const kAt = (r) => kP + (1 - kP) * Math.min(1, Math.max(0, (r - inR) / (WALL_IN - inR)));
      const SEG = 48;
      for (let j = 0; ; j++) {
        const r = inR + 0.55 + j * pitch;
        if (r > WALL_IN - 0.45) break;
        const hy = y + j * rise;
        if (j > 0) {
          // step: riser at the front edge, tread back to the next row (the last one to the wall)
          const rF = r - 0.4, rB = Math.min(r + pitch - 0.4, WALL_IN);
          for (let q = 0; q < SEG; q++) {
            const aa = aMin + ((Math.PI - 2 * aMin) * q) / SEG, ab = aMin + ((Math.PI - 2 * aMin) * (q + 1)) / SEG;
            quad(treads, ell(rF, kAt(rF), aa, hy), ell(rF, kAt(rF), ab, hy), ell(rB, kAt(rB), ab, hy), ell(rB, kAt(rB), aa, hy));
            quad(risers, ell(rF, kAt(rF), aa, hy - rise), ell(rF, kAt(rF), ab, hy - rise), ell(rF, kAt(rF), ab, hy), ell(rF, kAt(rF), aa, hy));
          }
        }
        const keep = (x, z) => (i === 3 && j === 0) || (z < CV && (() => { const a = curveAngle(x, z, kAt(r)); return a >= aMin && a <= Math.PI - aMin; })());
        for (const run of runsOf(uPath(r, FRONT - 0.4, 96, kAt(r)), keep)) {
          for (const q of alongPath(run, 0.56)) rowSeats.push([facing(q.x, hy, q.z, q.nx, q.nz), 0.52 + i * 0.03 + j * 0.004]);
        }
      }
    }

    // ---- IV. tier: colonnade on the gallery front, gilded beam and cornice band below the ceiling,
    // one row of seats along each side (the amphitheatre behind the back is built below)
    if (i === 4) {
      const front = uPath(inR + 0.1, FRONT, 96, kP);
      for (const q of alongPath(front, 3.0)) colAt(q.x, q.z, q.nx, q.nz, y + ph, 22.2, false);
      for (const q of alongPath(front, 3.0, 0)) lamps.push(facing(q.x - q.nx * 0.5, 21.4, q.z - q.nz * 0.5, q.nx, q.nz));
      bands.push(sweepGeometry(front, [[-0.25, 22.2], [0.3, 22.2], [0.42, 22.5], [0.3, 22.75], [0.45, 23.05], [0.5, 23.19], [-0.25, 23.19], [-0.25, 22.2]], { closed: false, tile: 2 })); // top 1 cm under the ceiling
      const r = inR + 0.6, kk = kP + (1 - kP) * 0.3;
      for (const run of runsOf(uPath(r, FRONT - 0.4, 96, kk), (x, z) => backAngle(x, z) > AUD.gallery.halfAngle + 0.05)) {
        for (const q of alongPath(run, 0.56)) {
          // the last bays next to the portal hold today's lighting stands: their seats go when the stands come
          (q.z > FRONT - 3.3 ? standSeats : rowSeats).push([facing(q.x, y, q.z, q.nx, q.nz), 0.62]);
        }
      }
    }
  });
  add(based(mergeGeometries(floors), M.boxWall, { cast: false }), { stage: S, order: 0.06, dur: 0.25, mode: 'rise', xray: 'keep' });
  add(based(mergeGeometries(soffits), mat.soffit, { cast: false }), { stage: S, order: 0.08, dur: 0.2, mode: 'rise', xray: 'keep' });
  add(based(mergeGeometries(backWalls), M.boxWall, { cast: false }), { stage: S, order: 0.1, dur: 0.25, mode: 'rise', xray: 'keep' });
  add(based(mergeGeometries(bodies), M.ivory), { stage: S, order: 0.2, dur: 0.22, mode: 'rise', xray: 'keep' });
  add(based(mergeGeometries(fronts), mat.parapet), { stage: S, order: 0.26, dur: 0.2, mode: 'rise', xray: 'keep' });
  add(based(mergeGeometries(frontsScroll), mat.parapetScroll), { stage: S, order: 0.26, dur: 0.2, mode: 'rise', xray: 'keep' });
  {
    // box curtains: hung from the box head beside each column, gathered by a gilded tie-back, falling to the cushion;
    // a left- and a right-hand shape (mirrored instance matrices would turn the lighting inside out)
    const pts = [[0.05, 1], [0.42, 1], [0.33, 0.84], [0.18, 0.66], [0.08, 0.55], [0.1, 0.4], [0.14, 0.15], [0.15, 0], [0.05, 0]];
    for (const side of [-1, 1]) {
      const sh = new THREE.Shape();
      sh.moveTo(side * pts[0][0], pts[0][1]);
      for (const [px, py] of pts.slice(1)) sh.lineTo(side * px, py);
      sh.closePath();
      const list = drapes.filter((d) => d[0] === side).map((d) => d[1]);
      const di = new THREE.InstancedMesh(new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false, curveSegments: 4 }), M.velvet, list.length);
      list.forEach((m, k) => di.setMatrixAt(k, m));
      add(di, { stage: S, mode: 'grow', dur: 0.08, orders: new Float32Array(list.length).fill(0.58), xray: 'keep' });
      const ti = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.035, 0.1).translate(side * 0.09, 0.55, 0.03), mat.gild, list.length);
      list.forEach((m, k) => ti.setMatrixAt(k, m));
      add(ti, { stage: S, mode: 'grow', dur: 0.08, orders: new Float32Array(list.length).fill(0.58), xray: 'keep' });
    }
  }
  {
    const prof = [[0.07, 0], [0.07, 0.05], [0.045, 0.08], [0.04, 0.15], [0.068, 0.32], [0.072, 0.42], [0.045, 0.57], [0.034, 0.63], [0.055, 0.67], [0.068, 0.74], [0.001, 0.74]];
    const bg = new THREE.LatheGeometry(prof.map(([r, h]) => new THREE.Vector2(r, h)), 10);
    const bi = new THREE.InstancedMesh(bg, mat.gild, balus.length);
    balus.forEach((m, k) => bi.setMatrixAt(k, m));
    add(bi, { stage: S, mode: 'rise', dur: 0.1, orders: new Float32Array(balus.length).fill(0.27), xray: 'keep' });
  }
  add(based(mergeGeometries(rails), mat.gild), { stage: S, order: 0.28, dur: 0.2, mode: 'rise', xray: 'keep' });
  add(based(mergeGeometries(cushions), M.velvet), { stage: S, order: 0.3, dur: 0.2, mode: 'rise', xray: 'keep' });
  add(based(mergeGeometries(bands), mat.gild), { stage: S, order: 0.4, dur: 0.1, mode: 'rise', xray: 'keep' });
  {
    const mk = (arr) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(arr.map((x, i) => (i % 3 === 1 ? null : x / 2)).filter((x) => x !== null), 2));
      g.computeVertexNormals();
      return g;
    };
    add(new THREE.Mesh(mk(treads), M.boxWall), { stage: S, order: 0.09, dur: 0.1, mode: 'appear', xray: 'keep' });
    add(new THREE.Mesh(mk(risers), M.boxWall), { stage: S, order: 0.09, dur: 0.1, mode: 'appear', xray: 'keep' });
    const inst = (geo, material, list, order, mode = 'grow') => {
      const im = new THREE.InstancedMesh(geo, material, list.length);
      list.forEach((m, k) => im.setMatrixAt(k, m));
      im.castShadow = true;
      add(im, { stage: S, mode, dur: 0.1, orders: new Float32Array(list.length).fill(order), xray: 'keep' });
      return im;
    };
    inst(new THREE.BoxGeometry(1, 1, 1), M.boxWall, parts, 0.18);
    inst(new THREE.BoxGeometry(0.85, 2.1, 0.06).translate(0, 1.05, 0), mat.wood, doors, 0.2);
    inst(new THREE.CylinderGeometry(0.085, 0.1, 1, 12).translate(0, 0.5, 0), M.ivory, shafts, 0.32, 'rise');
    inst(mergeGeometries([
      new THREE.CylinderGeometry(0.17, 0.1, 0.24, 12).translate(0, 0.12, 0),
      new THREE.BoxGeometry(0.38, 0.06, 0.38).translate(0, 0.27, 0),
    ].map((x) => x.toNonIndexed())), mat.gild, caps, 0.34);
    // lamp brackets with two frosted globes (lighting layer)
    const lg = mergeGeometries([
      new THREE.SphereGeometry(0.09, 10, 8).translate(-0.15, 0.08, 0.05),
      new THREE.SphereGeometry(0.09, 10, 8).translate(0.15, 0.08, 0.05),
    ].map((x) => x.toNonIndexed()));
    const lm = new THREE.InstancedMesh(lg, M.lamp, lamps.length);
    lamps.forEach((m, k) => lm.setMatrixAt(k, m));
    root.add(lm);
    R.add(lm, { stage: S, mode: 'grow', dur: 0.08, orders: new Float32Array(lamps.length).fill(0.55), xray: 'layerAlways', layer: 'lighting' });
    const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.04, 0.05).translate(0, 0.02, 0), mat.gild, lamps.length);
    lamps.forEach((m, k) => arms.setMatrixAt(k, m));
    add(arms, { stage: S, mode: 'grow', dur: 0.08, orders: new Float32Array(lamps.length).fill(0.55), xray: 'keep' });
    const lit = (geo, material, list, order) => {
      const im = new THREE.InstancedMesh(geo, material, list.length);
      list.forEach((m, k) => im.setMatrixAt(k, m));
      root.add(im);
      R.add(im, { stage: S, mode: 'grow', dur: 0.08, orders: new Float32Array(list.length).fill(order), xray: 'layerAlways', layer: 'lighting' });
    };
    // pink-shaded sconces in the boxes: gilded arm, small fabric shade
    inst(mergeGeometries([
      new THREE.BoxGeometry(0.05, 0.05, 0.16).translate(0, 0, 0.08),
      new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8).translate(0, -0.05, 0.16),
    ].map((x) => x.toNonIndexed())), mat.gild, sconces, 0.56);
    lit(new THREE.CylinderGeometry(0.06, 0.1, 0.13, 12, 1, true).translate(0, 0.06, 0.16), mat.pinkShade, sconces, 0.56);
    // tall mirrors in gilt frames beside the doors (photo of the box tiers): frame 0.48 × 1.3 m, glass behind it
    {
      const fr = new THREE.Shape();
      fr.moveTo(-0.24, 0); fr.lineTo(0.24, 0); fr.lineTo(0.24, 1.3); fr.lineTo(-0.24, 1.3); fr.closePath();
      const hole = new THREE.Path();
      hole.moveTo(-0.185, 0.055); hole.lineTo(-0.185, 1.245); hole.lineTo(0.185, 1.245); hole.lineTo(0.185, 0.055); hole.closePath();
      fr.holes.push(hole);
      const frameG = mergeGeometries([
        new THREE.ExtrudeGeometry(fr, { depth: 0.04, bevelEnabled: false }),
        new THREE.BoxGeometry(0.56, 0.07, 0.07).translate(0, 1.33, 0.03).toNonIndexed(), // cornice
        new THREE.SphereGeometry(0.05, 8, 6).translate(0, 1.4, 0.03).toNonIndexed(),    // crest
      ]);
      inst(frameG, mat.gild, mirrors, 0.57);
      inst(new THREE.PlaneGeometry(0.37, 1.19).translate(0, 0.65, 0.012), mat.mirror, mirrors, 0.57);
    }
    // round recessed lights in the soffits under the balconies (photos), between the back columns, over the
    // open balconies and the back of the stalls (the boxes have their sconces)
    const downs = [], rims = [];
    for (let j = 1; j < AUD.tiers.length; j++) {
      const ys = AUD.tiers[j] - 0.385;
      for (const q of alongU(AUD.parapets[j] + 0.85, 3.4, FRONT, AUD.parapetK[j], 1.7)) {
        if (inBoxSector(q.x, q.z, AUD.boxSector[j - 1], AUD.parapetK[j - 1])) continue;
        downs.push(new THREE.Matrix4().makeTranslation(q.x, ys - 0.004, q.z));
        rims.push(new THREE.Matrix4().makeTranslation(q.x, ys - 0.01, q.z));
      }
    }
    lit(new THREE.CircleGeometry(0.11, 18).rotateX(Math.PI / 2), M.lamp, downs, 0.57);
    inst(new THREE.TorusGeometry(0.15, 0.025, 6, 20).rotateX(Math.PI / 2), mat.gild, rims, 0.57);
  }

  // ------------------------------------------------------------------ proscenium boxes: four storeys each side between the horseshoe and
  // the proscenium wall, framed by ivory pilasters with gilded capitals. On the I. tier the presidential box
  // (west, with St Wenceslas' crown) and its twin (east) under red velvet canopies flanked by gilded caryatids.
  {
    const slabs = [], pFronts = [], pCush = [], pil = [], pilCaps = [], canopy = [], fringe = [], beams = [], cary = [];
    const D = V.portal - 0.7 - FRONT; // boxes end at the proscenium wall
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const y = AUD.tiers[i];
        const yTop = AUD.tiers[i + 1] - 0.4;
        const inR = AUD.parapets[i], ph = i === 0 ? 0.7 : 1.0;
        const u0 = s * inR, u1 = s * OUT_R;
        slabs.push(new THREE.BoxGeometry(Math.abs(u1 - u0), 0.38, D).translate((u0 + u1) / 2, y - 0.19, FRONT + D / 2));
        slabs.push(new THREE.BoxGeometry(0.12, yTop - y, D).translate(u1, (y + yTop) / 2, FRONT + D / 2));
        const path = s > 0 ? [[inR + 0.1, FRONT + D], [inR + 0.1, FRONT]] : [[-inR - 0.1, FRONT], [-inR - 0.1, FRONT + D]];
        pFronts.push(sweepGeometry(path, [[0.18, y - 0.36], [0.18, y + ph - 0.04]], { closed: false, tileU: 5.2, tileV: ph + 0.32 }));
        pCush.push(sweepGeometry(path, [[-0.2, y + ph], [0.22, y + ph], [0.24, y + ph + 0.1], [0.16, y + ph + 0.17], [-0.18, y + ph + 0.15], [-0.2, y + ph]], { closed: false, tile: 2 }));
        for (const vv of [FRONT + 0.14, FRONT + D - 0.14]) {
          pil.push(new THREE.Matrix4().compose(new THREE.Vector3(s * (inR + 0.02), y + ph, vv), new THREE.Quaternion(), new THREE.Vector3(1, yTop - y - ph - 0.3, 1)));
          pilCaps.push(new THREE.Matrix4().makeTranslation(s * (inR + 0.02), yTop - 0.3, vv));
        }
        if (i === 1) {
          const uC = s * (inR - 0.02), yC = yTop - 0.75;
          canopy.push(new THREE.BoxGeometry(0.1, 0.7, D - 0.2).translate(uC, yC + 0.35, FRONT + D / 2).toNonIndexed());
          fringe.push(new THREE.BoxGeometry(0.12, 0.08, D - 0.2).translate(uC, yC - 0.02, FRONT + D / 2).toNonIndexed());
          beams.push(new THREE.BoxGeometry(0.35, 0.3, D + 0.1).translate(s * (inR + 0.08), yTop - 0.15, FRONT + D / 2).toNonIndexed());
          for (const vv of [FRONT + 0.32, FRONT + D - 0.32]) {
            cary.push(new THREE.Matrix4().compose(new THREE.Vector3(s * (inR + 0.05), y + ph + 0.17, vv),
              new THREE.Quaternion().setFromAxisAngle(Y, s > 0 ? -Math.PI / 2 : Math.PI / 2), new THREE.Vector3(1.6, 1.6, 1.6)));
          }
          if (s < 0) {
            // St Wenceslas' crown over the presidential box
            beams.push(new THREE.CylinderGeometry(0.2, 0.17, 0.2, 10).translate(uC - 0.12, yTop - 0.05, FRONT + D / 2).toNonIndexed());
            beams.push(new THREE.SphereGeometry(0.08, 8, 6).translate(uC - 0.12, yTop + 0.12, FRONT + D / 2).toNonIndexed());
          }
        }
      }
    }
    // organ lofts on the IV. tier next to the proscenium (photo towards the stage): behind a low parapet a gilded
    // frame between two pilasters, filled with a rank of tin pipes, longest in the middle
    const pipes = [], feet = [], organFrame = [], organBack = [];
    for (const s of [-1, 1]) {
      const y = AUD.tiers[4], inR = AUD.parapets[4], ph = 1.0, top = 22.2;
      const u0 = s * inR, u1 = s * WALL_IN;
      slabs.push(new THREE.BoxGeometry(Math.abs(u1 - u0), 0.38, D).translate((u0 + u1) / 2, y - 0.19, FRONT + D / 2));
      const path = s > 0 ? [[inR + 0.1, FRONT + D], [inR + 0.1, FRONT]] : [[-inR - 0.1, FRONT], [-inR - 0.1, FRONT + D]];
      pFronts.push(sweepGeometry(path, [[0.18, y - 0.36], [0.18, y + ph - 0.04]], { closed: false, tileU: 5.2, tileV: ph + 0.32 }));
      pCush.push(sweepGeometry(path, [[-0.2, y + ph], [0.22, y + ph], [0.24, y + ph + 0.1], [0.16, y + ph + 0.17], [-0.18, y + ph + 0.15], [-0.2, y + ph]], { closed: false, tile: 2 }));
      for (const vv of [FRONT + 0.14, FRONT + D - 0.14]) {
        pil.push(new THREE.Matrix4().compose(new THREE.Vector3(s * (inR + 0.02), y + ph, vv), new THREE.Quaternion(), new THREE.Vector3(1, top - y - ph - 0.6, 1)));
        pilCaps.push(new THREE.Matrix4().makeTranslation(s * (inR + 0.02), top - 0.6, vv));
      }
      // entablature over the opening and the gallery's gilded band carried on over the loft
      organFrame.push(new THREE.BoxGeometry(0.4, 0.3, D).translate(s * (inR + 0.05), top - 0.15, FRONT + D / 2));
      organFrame.push(new THREE.BoxGeometry(0.75, 1.0, D).translate(s * (inR + 0.2), top + 0.5, FRONT + D / 2));
      organFrame.push(new THREE.BoxGeometry(0.16, 0.1, D - 0.5).translate(s * (inR + 0.3), y + ph + 0.22, FRONT + D / 2)); // pipe rack
      organBack.push(new THREE.BoxGeometry(0.06, top - 0.3 - y - ph, D - 0.3).translate(s * (inR + 0.7), (y + ph + top - 0.3) / 2, FRONT + D / 2));
      const n = 13;
      for (let k = 0; k < n; k++) {
        const t = (k - (n - 1) / 2) / ((n - 1) / 2), len = 1.5 + 1.25 * (1 - t * t);
        const vv = FRONT + 0.42 + ((D - 0.84) * k) / (n - 1);
        pipes.push(new THREE.Matrix4().compose(new THREE.Vector3(s * (inR + 0.4), y + ph + 0.36, vv), new THREE.Quaternion(), new THREE.Vector3(1, len, 1)));
        feet.push(new THREE.Matrix4().makeTranslation(s * (inR + 0.4), y + ph + 0.16, vv));
      }
    }
    add(new THREE.Mesh(mergeGeometries(organFrame.map((g) => g.toNonIndexed())), mat.gild), { stage: S, order: 0.4, dur: 0.06, mode: 'appear', xray: 'keep' });
    add(new THREE.Mesh(mergeGeometries(organBack.map((g) => g.toNonIndexed())), new THREE.MeshStandardNodeMaterial({ color: '#1b1511', roughness: 0.9 })),
      { stage: S, order: 0.4, dur: 0.06, mode: 'appear', xray: 'keep' });
    for (const [geo, list] of [[new THREE.CylinderGeometry(0.055, 0.055, 1, 12).translate(0, 0.5, 0), pipes], [new THREE.CylinderGeometry(0.055, 0.015, 0.2, 12).translate(0, 0.1, 0), feet]]) {
      const im = new THREE.InstancedMesh(geo, mat.tin, list.length);
      list.forEach((m, k) => im.setMatrixAt(k, m));
      add(im, { stage: S, mode: 'rise', dur: 0.08, orders: new Float32Array(list.length).fill(0.42), xray: 'keep' });
    }
    add(based(mergeGeometries(slabs.map((g) => g.toNonIndexed())), M.boxWall), { stage: S, order: 0.12, dur: 0.2, mode: 'rise', xray: 'keep' });
    add(based(mergeGeometries(pFronts), mat.parapetScroll), { stage: S, order: 0.27, dur: 0.2, mode: 'rise', xray: 'keep' });
    add(based(mergeGeometries(pCush), M.velvet), { stage: S, order: 0.3, dur: 0.2, mode: 'rise', xray: 'keep' });
    const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 1, 0.24).translate(0, 0.5, 0), M.ivory, pil.length);
    pil.forEach((m, k) => pm.setMatrixAt(k, m));
    add(pm, { stage: S, mode: 'rise', dur: 0.1, orders: new Float32Array(pil.length).fill(0.36), xray: 'keep' });
    const pc = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.3, 0.32).translate(0, 0.15, 0), mat.gild, pilCaps.length);
    pilCaps.forEach((m, k) => pc.setMatrixAt(k, m));
    add(pc, { stage: S, mode: 'grow', dur: 0.1, orders: new Float32Array(pilCaps.length).fill(0.37), xray: 'keep' });
    add(new THREE.Mesh(mergeGeometries(canopy), M.drape), { stage: S, order: 0.5, dur: 0.08, mode: 'appear', xray: 'keep' });
    add(new THREE.Mesh(mergeGeometries([...fringe, ...beams]), M.gold), { stage: S, order: 0.5, dur: 0.08, mode: 'appear', xray: 'keep' });
    const cm = new THREE.InstancedMesh(figureGeometry(2), mat.gild, cary.length);
    cary.forEach((m, k) => cm.setMatrixAt(k, m));
    cm.castShadow = true;
    add(cm, { stage: S, mode: 'grow', dur: 0.08, orders: new Float32Array(cary.length).fill(0.52), xray: 'keep' });
  }

  // ------------------------------------------------------------------ today's stage lighting in the house (photos towards the stage):
  // black lanterns on pipes in front of the upper parapets next to the portal, on stands in the II. gallery and a
  // nest in the top proscenium box; all aimed at the stage. Modern, so they come with the stage machinery (stage 6).
  {
    const LS = 6;
    const aim = new THREE.Vector3(0, STAGE.floor + 1.6, V.portal + 4.5);
    const bodies = [], yokes = [], lenses = [], pipes = [];
    const lantern = (x, y, z) => {
      const d = new THREE.Vector3().subVectors(aim, new THREE.Vector3(x, y, z));
      const yaw = Math.atan2(d.x, d.z), pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z));
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
      bodies.push(m); lenses.push(m);
      yokes.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(Y, yaw), new THREE.Vector3(1, 1, 1)));
    };
    const pipe = (a, b) => pipes.push(beamMatrix(a, b, 0.05, 0.05, new THREE.Matrix4()));
    for (const s of [-1, 1]) {
      // hanging rows on pipes in front of the parapet's straight run next to the portal: II. balcony, I. gallery
      for (const [i, n] of [[2, 3], [3, 6]]) {
        const y = AUD.tiers[i], top = y + 1.0 + 0.17, xb = s * (AUD.parapets[i] - 0.32);
        const z0 = FRONT - 0.35, z1 = FRONT - 0.35 - (n - 1) * 0.62;
        pipe(new THREE.Vector3(xb, top + 0.06, z0 + 0.2), new THREE.Vector3(xb, top + 0.06, z1 - 0.2));
        for (const zb of [z0 + 0.1, z1 - 0.1]) pipe(new THREE.Vector3(xb, top + 0.06, zb), new THREE.Vector3(s * (AUD.parapets[i] + 0.1), top + 0.06, zb)); // brackets over the cushion
        for (let k = 0; k < n; k++) lantern(xb, top - 0.28, z0 - k * 0.62);
      }
      // II. gallery: two stands with two lanterns each, just behind the balustrade
      for (const zz of [FRONT - 0.9, FRONT - 2.5]) {
        const xs = s * (AUD.parapets[4] + 0.55), y = AUD.tiers[4];
        pipe(new THREE.Vector3(xs, y, zz), new THREE.Vector3(xs, y + 2.35, zz));
        pipe(new THREE.Vector3(xs, y + 2.25, zz - 0.3), new THREE.Vector3(xs, y + 2.25, zz + 0.3));
        lantern(xs, y + 2.0, zz - 0.3); lantern(xs, y + 2.0, zz + 0.3);
        lantern(xs, y + 1.55, zz);
      }
      // nest in the III. proscenium box (I. gallery level): a boom with four lanterns
      {
        const y = AUD.tiers[3], xs = s * (AUD.parapets[3] + 0.7), zz = FRONT + 1.0;
        pipe(new THREE.Vector3(xs, y, zz), new THREE.Vector3(xs, AUD.tiers[4] - 0.45, zz));
        for (const [hy, dz] of [[1.4, -0.28], [1.4, 0.28], [2.05, -0.28], [2.05, 0.28]]) {
          pipe(new THREE.Vector3(xs, y + hy + 0.22, zz), new THREE.Vector3(xs, y + hy + 0.22, zz + dz));
          lantern(xs, y + hy, zz + dz);
        }
      }
    }
    // lantern: body along +z with a front ring and a rear cap, a yoke from the body's sides up to a clamp
    const bodyG = mergeGeometries([
      new THREE.CylinderGeometry(0.13, 0.15, 0.48, 14).rotateX(Math.PI / 2),
      new THREE.CylinderGeometry(0.155, 0.155, 0.05, 14).rotateX(Math.PI / 2).translate(0, 0, 0.25),
      new THREE.CylinderGeometry(0.09, 0.09, 0.08, 10).rotateX(Math.PI / 2).translate(0, 0, -0.28),
      new THREE.BoxGeometry(0.04, 0.03, 0.26).translate(0, 0.16, -0.02),
    ].map((g) => g.toNonIndexed()));
    const yokeG = mergeGeometries([
      new THREE.BoxGeometry(0.025, 0.3, 0.05).translate(-0.175, 0.13, 0),
      new THREE.BoxGeometry(0.025, 0.3, 0.05).translate(0.175, 0.13, 0),
      new THREE.BoxGeometry(0.375, 0.03, 0.05).translate(0, 0.28, 0),
      new THREE.CylinderGeometry(0.025, 0.025, 0.08, 8).translate(0, 0.33, 0),
    ].map((g) => g.toNonIndexed()));
    const lensG = new THREE.CircleGeometry(0.125, 16).translate(0, 0, 0.276);
    for (const [geo, material, list] of [[bodyG, mat.lantern, bodies], [yokeG, mat.lantern, yokes], [lensG, mat.lens, lenses], [new THREE.BoxGeometry(1, 1, 1), mat.lantern, pipes]]) {
      const im = new THREE.InstancedMesh(geo, material, list.length);
      list.forEach((m, k) => im.setMatrixAt(k, m));
      im.castShadow = true;
      add(im, { stage: LS, mode: 'grow', dur: 0.06, orders: new Float32Array(list.length).fill(0.62), xray: 'layerAlways', layer: 'lighting', modern: true });
    }
  }

  // ------------------------------------------------------------------ II. gallery: amphitheatre behind the horseshoe
  // (Fialka's plan of the IV. tier: rows on arcs round the auditorium centre; 1914 section: rising ≈ 3.6 m
  // from the columns to the back wall at v ≈ 8.5, under its own ceiling)
  const galSeats = [];
  {
    const G = AUD.gallery, y0 = AUD.tiers[4], TH = G.halfAngle, SEG = 40;
    const arcPt = (r, a, y) => new THREE.Vector3(Math.sin(a) * r, y, CV - Math.cos(a) * r);
    const treads = [], risers = [];
    const quad = (list, a, b, c, d) => list.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
    // stepped rows from the colonnade on the gallery front back to the rear wall. Towards the back the rows
    // are cut off by the attic walls (|u| ≤ U_MAX in the auditorium frame): a full 56° sector would reach
    // past them, the east side by almost 1.5 m.
    const U_MAX = 12.5;
    const aLim = (r) => Math.min(TH, Math.asin(Math.min(1, U_MAX / r)));
    const rIn = G.r0;
    const rows = [];
    for (let k = 0; k < G.rows; k++) rows.push([G.r0 + k * G.row, G.r0 + (k + 1) * G.row, y0 + 0.25 + k * G.rise]);
    const rBack = G.r0 + G.rows * G.row;
    const band = (list, ra, rb, y, up = true) => {
      const A = aLim(rb);
      for (let j = 0; j < SEG; j++) {
        const a0 = -A + (2 * A * j) / SEG, a1 = -A + (2 * A * (j + 1)) / SEG;
        if (up) quad(list, arcPt(ra, a0, y), arcPt(ra, a1, y), arcPt(rb, a1, y), arcPt(rb, a0, y));
        else quad(list, arcPt(ra, a0, y), arcPt(rb, a0, y), arcPt(rb, a1, y), arcPt(ra, a1, y));
      }
    };
    for (let k = 0; k < rows.length; k++) {
      const [ra, rb, y] = rows[k];
      const yPrev = k ? rows[k - 1][2] : y0;
      band(treads, ra, rb, y);
      if (y > yPrev) {
        const A = aLim(rb);
        for (let j = 0; j < SEG; j++) {
          const a0 = -A + (2 * A * j) / SEG, a1 = -A + (2 * A * (j + 1)) / SEG;
          quad(risers, arcPt(ra, a0, yPrev), arcPt(ra, a1, yPrev), arcPt(ra, a1, y), arcPt(ra, a0, y));
        }
      }
      // seats on the rows (benches with backs as on the 1900 seating plan)
      {
        const r = ra + 0.32, A = aLim(rb) - 0.06;
        const n = Math.floor((2 * A * r) / 0.56);
        for (let q = 0; q <= n; q++) {
          const a = -A + ((2 * A) * q) / n;
          const p = arcPt(r, a, y);
          galSeats.push(facing(p.x, y, p.z, -Math.sin(a), Math.cos(a)));
        }
      }
    }
    const mk = (arr) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(arr.map((x, i) => (i % 3 === 1 ? null : x / 2)).filter((x) => x !== null), 2));
      g.computeVertexNormals();
      return g;
    };
    add(new THREE.Mesh(mk(treads), M.parquet), { stage: S, order: 0.07, dur: 0.1, mode: 'appear', xray: 'keep' });
    add(new THREE.Mesh(mk(risers), M.boxWall), { stage: S, order: 0.07, dur: 0.1, mode: 'appear', xray: 'keep' });
    // back wall on the arc; side walls radial from the colonnade, then straight along the attic walls
    const rB = rBack + 0.25, AB = aLim(rB);
    const backPath = [];
    for (let j = 0; j <= SEG; j++) { const a = -AB + (2 * AB * j) / SEG; backPath.push([Math.sin(a) * rB, CV - Math.cos(a) * rB]); }
    const prof = (t) => [[-t, y0 - 0.4], [t, y0 - 0.4], [t, G.ceiling + 0.4], [-t, G.ceiling + 0.4], [-t, y0 - 0.4]];
    const walls = [sweepGeometry(backPath, prof(0.25), { closed: false, tile: 3 })];
    const rKnee = U_MAX / Math.sin(TH);
    for (const sgn of [-1, 1]) {
      const r0 = rIn - 0.6;
      const sidePath = [[sgn * Math.sin(TH) * r0, CV - Math.cos(TH) * r0], [sgn * U_MAX, CV - Math.cos(TH) * rKnee],
        [sgn * U_MAX, CV - Math.sqrt(rB * rB - U_MAX * U_MAX) - 0.2]];
      walls.push(sweepGeometry(sgn > 0 ? sidePath : sidePath.slice().reverse(), prof(0.2), { closed: false, tile: 3 }));
    }
    add(based(mergeGeometries(walls), M.plaster), { stage: S, order: 0.06, dur: 0.2, mode: 'rise', xray: 'keep' });
    const ceil = [];
    band(ceil, rIn - 0.6, rIn, G.ceiling, false);
    for (let k = 0; k < rows.length; k++) band(ceil, rows[k][0], rows[k][1], G.ceiling, false);
    band(ceil, rBack, rBack + 0.3, G.ceiling, false);
    add(new THREE.Mesh(mk(ceil), mat.soffit), { stage: S, order: 0.6, dur: 0.06, mode: 'appear', xray: 'keep' });
  }

  // ------------------------------------------------------------------ armchairs
  {
    const velvetG = mergeGeometries([
      new THREE.BoxGeometry(0.5, 0.11, 0.46).translate(0, 0.46, 0.02),
      new THREE.BoxGeometry(0.5, 0.58, 0.09).translate(0, 0.78, -0.21),
    ].map((g) => g.toNonIndexed()));
    const frameG = mergeGeometries([
      new THREE.BoxGeometry(0.05, 0.22, 0.44).translate(-0.27, 0.6, 0.0),
      new THREE.BoxGeometry(0.05, 0.22, 0.44).translate(0.27, 0.6, 0.0),
      new THREE.BoxGeometry(0.06, 0.42, 0.06).translate(-0.27, 0.21, 0.12),
      new THREE.BoxGeometry(0.06, 0.42, 0.06).translate(0.27, 0.21, 0.12),
      new THREE.BoxGeometry(0.54, 0.05, 0.1).translate(0, 1.08, -0.22),
    ].map((g) => g.toNonIndexed()));
    const mats = [], orders = [];
    // stalls: continuous rows without a centre aisle, ≈0.9 m apart, on the raked floor
    for (let r = 0; r < 16; r++) {
      const v = pitEdge - 0.75 - r * 0.9; // first row clear of the orchestra-pit rail
      const half = halfWidthAt(v, AUD.parapets[0]) - 0.6;
      if (half < 1.5) continue;
      const y = stallsY(v);
      const n = Math.floor((2 * half) / 0.56);
      for (let k = 0; k <= n; k++) {
        const x = -half + (k * 2 * half) / n;
        mats.push(new THREE.Matrix4().makeTranslation(x, y, v));
        orders.push(0.4 + r * 0.015);
      }
    }
    // boxes, balconies and galleries (collected with the tiers above)
    rowSeats.forEach(([m, o]) => { mats.push(m); orders.push(o); });
    galSeats.forEach((m) => { mats.push(m); orders.push(0.6); });
    const vm = new THREE.InstancedMesh(velvetG, M.velvet, mats.length);
    const fm = new THREE.InstancedMesh(frameG, mat.wood, mats.length);
    mats.forEach((m, i) => { vm.setMatrixAt(i, m); fm.setMatrixAt(i, m); });
    vm.castShadow = true;
    const ord = new Float32Array(orders);
    add(vm, { stage: S, mode: 'grow', dur: 0.05, orders: ord, xray: 'keep' });
    add(fm, { stage: S, mode: 'grow', dur: 0.05, orders: ord, xray: 'keep' });
    // seats removed for the present-day lighting stands in the II. gallery (they go just before the stands come)
    if (standSeats.length) {
      const so = new Float32Array(standSeats.map(([, o]) => o));
      for (const [g, material] of [[velvetG, M.velvet], [frameG, mat.wood]]) {
        const im = new THREE.InstancedMesh(g, material, standSeats.length);
        standSeats.forEach(([m], i) => im.setMatrixAt(i, m));
        im.castShadow = material === M.velvet;
        add(im, { stage: S, mode: 'grow', dur: 0.05, orders: so, remove: 6, xray: 'keep' });
      }
    }
  }

  // ------------------------------------------------------------------ Ženíšek's ceiling: a shallow dome (23.2 at the edge, ≈ 24.0 in the
  // middle) round the chandelier. Rectified from a photo taken straight up (tools/prep_textures.py): a gilded
  // openwork grille Ø ≈ 4.4 m in the centre, the coral ring with rosettes, the eight fields on sky-blue grounds
  // inside r 7.4; a porphyry band to r 9.4 with eight dark rosettes in gilded rims at r 8.2; a flat ceiling out to
  // the gallery colonnade, the higher gallery ceiling (≈ 24.6) behind it up to the horseshoe wall
  {
    const PAINT_R = 7.4, GRILLE_R = 2.2, ROSETTE_R = 8.2;
    const domeY = (r) => AUD.ceiling + 0.85 * Math.cos((Math.min(r, CEIL_R) / CEIL_R) * (Math.PI / 2));
    const lathe = (r0, r1, n) => {
      const prof = [];
      for (let k = 0; k <= n; k++) { const r = r0 + ((r1 - r0) * k) / n; prof.push(new THREE.Vector2(Math.max(0.001, r), domeY(r))); }
      return new THREE.LatheGeometry(prof, 96);
    };
    const painted = lathe(GRILLE_R, PAINT_R, 14);
    const pos = painted.attributes.position, uv = painted.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / (2 * PAINT_R), 0.5 - pos.getZ(i) / (2 * PAINT_R));
    painted.translate(0, 0, CC);
    add(new THREE.Mesh(painted, mat.ceiling), { stage: S, order: 0.6, dur: 0.08, mode: 'appear', xray: 'keep' });
    add(new THREE.Mesh(lathe(PAINT_R, CEIL_R, 4).translate(0, 0, CC), mat.porphyry), { stage: S, order: 0.6, dur: 0.08, mode: 'appear', xray: 'keep' });
    // gilded openwork grille over the opening for the chandelier (rings, spokes and scroll loops), dark void above
    const gy = domeY(GRILLE_R) - 0.03;
    const grille = [[GRILLE_R, 0.08], [1.55, 0.05], [0.85, 0.05], [0.28, 0.05]]
      .map(([r, t]) => new THREE.TorusGeometry(r, t, 6, Math.round(24 + r * 20)).rotateX(Math.PI / 2).translate(0, gy, CC).toNonIndexed());
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, b = a + Math.PI / 16;
      grille.push(new THREE.BoxGeometry(0.045, 0.045, GRILLE_R - 0.28).translate(0, 0, (GRILLE_R + 0.28) / 2).rotateY(a).translate(0, gy, CC).toNonIndexed());
      for (const [r, rl] of [[1.88, 0.24], [1.2, 0.2]]) {
        grille.push(new THREE.TorusGeometry(rl, 0.03, 5, 16).rotateX(Math.PI / 2).translate(Math.cos(b) * r, gy, CC + Math.sin(b) * r).toNonIndexed());
      }
    }
    // eight dark rosettes in gilded rims on cream roundels, on the porphyry band between the painted fields
    const rosD = [], rosC = [];
    for (let k = 0; k < 8; k++) {
      const a = ((k + 0.5) / 8) * Math.PI * 2, x = Math.cos(a) * ROSETTE_R, z = CC + Math.sin(a) * ROSETTE_R, y = domeY(ROSETTE_R);
      rosC.push(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 28).translate(x, y - 0.03, z).toNonIndexed());
      grille.push(new THREE.TorusGeometry(0.36, 0.05, 6, 28).rotateX(Math.PI / 2).translate(x, y - 0.07, z).toNonIndexed());
      grille.push(new THREE.TorusGeometry(0.53, 0.03, 6, 28).rotateX(Math.PI / 2).translate(x, y - 0.06, z).toNonIndexed());
      grille.push(new THREE.SphereGeometry(0.07, 8, 6).scale(1, 0.6, 1).translate(x, y - 0.1, z).toNonIndexed());
      rosD.push(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 24).translate(x, y - 0.06, z).toNonIndexed());
    }
    add(new THREE.Mesh(mergeGeometries(rosC), M.ivory), { stage: S, order: 0.61, dur: 0.05, mode: 'appear', xray: 'keep' });
    add(new THREE.Mesh(mergeGeometries(rosD), mat.bronzeDark), { stage: S, order: 0.61, dur: 0.05, mode: 'appear', xray: 'keep' });
    // gilded mouldings round the painting and round the band
    for (const [r, t] of [[PAINT_R, 0.08], [CEIL_R, 0.16], [CEIL_R + 0.35, 0.09]]) {
      grille.push(new THREE.TorusGeometry(r, t, 8, 128).rotateX(Math.PI / 2).translate(0, domeY(r) - 0.05, CC).toNonIndexed());
    }
    add(new THREE.Mesh(mergeGeometries(grille), mat.gild), { stage: S, order: 0.62, dur: 0.05, mode: 'appear', xray: 'keep' });
    add(new THREE.Mesh(new THREE.CircleGeometry(GRILLE_R + 0.05, 40).rotateX(Math.PI / 2).translate(0, AUD.ceiling + 1.1, CC), M.iron), { stage: S, order: 0.6, dur: 0.05, mode: 'appear', xray: 'keep' });
    // dark collar between the opening and the void, so nothing shows through at an angle
    const collarY0 = domeY(GRILLE_R) - 0.02, collarY1 = AUD.ceiling + 1.12;
    add(new THREE.Mesh(new THREE.CylinderGeometry(GRILLE_R + 0.04, GRILLE_R + 0.04, collarY1 - collarY0, 40, 1, true).translate(0, (collarY0 + collarY1) / 2, CC),
      new THREE.MeshStandardNodeMaterial({ color: '#141210', roughness: 0.9, side: THREE.DoubleSide })), { stage: S, order: 0.6, dur: 0.05, mode: 'appear', xray: 'keep' });
    // flat ceiling from the painted circle to the gallery colonnade
    const hole = [];
    for (let i = 0; i < 96; i++) { const a = (i / 96) * Math.PI * 2; hole.push([Math.cos(a) * CEIL_R, CC + Math.sin(a) * CEIL_R]); }
    const r4 = AUD.parapets[4] + 0.5, k4 = AUD.parapetK[4], wallFace = V.portal - 0.7;
    const inner = ccw(uPath(r4, wallFace, 64, k4));
    add(new THREE.Mesh(capGeometry(inner, AUD.ceiling, false, [ccw(hole).reverse()], 3), mat.soffit), { stage: S, order: 0.58, dur: 0.08, mode: 'appear', xray: 'keep' });
    // higher ceiling over the top tier between the colonnade and the horseshoe wall
    const upper = ccw(uPath(WALL_IN + 0.05, wallFace, 64, 1).concat(uPath(r4 - 0.1, wallFace, 64, k4).reverse()));
    add(new THREE.Mesh(capGeometry(upper, AUD.gallery.ceiling, false, [], 3), mat.soffit), { stage: S, order: 0.58, dur: 0.08, mode: 'appear', xray: 'keep' });
  }

  // ------------------------------------------------------------------ the great chandelier (≈ 5.5 m, Ø 3 m, 3 circuits)
  {
    const ch = new THREE.Group();
    // gilt bronze, 5.5 m tall, Ø 3 m: crown, tapering cage, main ring with two rows of lamps, bowl and finial;
    // it hangs through the grille from the girders, top at the ceiling, bottom level with the gallery front
    const top = AUD.ceiling + 0.05;
    const shaftProf = [[0.06, 0], [0.42, -0.2], [0.36, -0.8], [0.2, -1.4], [0.3, -2.2], [0.24, -2.9], [0.42, -3.3], [0.34, -3.9], [0.75, -4.6], [0.42, -5.0], [0.12, -5.35], [0.001, -5.6]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    const shaft = new THREE.LatheGeometry(shaftProf, 16);
    ch.add(new THREE.Mesh(shaft, mat.gild));
    const tiers = [[0.42, -0.85, 8], [0.55, -2.25, 12], [0.85, -3.25, 18], [1.48, -4.05, 34], [1.3, -4.3, 30], [0.75, -4.75, 16]];
    const ringG = [], bulbs = [], drops = [];
    for (const [r, y, n] of tiers) {
      ringG.push(new THREE.TorusGeometry(r, 0.05, 6, 40).rotateX(Math.PI / 2).translate(0, y, 0).toNonIndexed());
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + y;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        bulbs.push([x, y + 0.2, z]);
        drops.push([Math.cos(a + Math.PI / n) * r * 0.97, y - 0.22, Math.sin(a + Math.PI / n) * r * 0.97]);
      }
      // arms from the shaft to the ring
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        ringG.push(new THREE.CylinderGeometry(0.025, 0.025, r, 5).rotateZ(Math.PI / 2).rotateY(-a).translate(Math.cos(a) * r / 2, y + 0.05, Math.sin(a) * r / 2).toNonIndexed());
      }
    }
    ch.add(new THREE.Mesh(mergeGeometries(ringG), mat.gild));
    const bulbG = mergeGeometries([new THREE.CylinderGeometry(0.025, 0.025, 0.16, 6).translate(0, 0.08, 0), new THREE.SphereGeometry(0.065, 8, 6).translate(0, 0.2, 0)].map((g) => g.toNonIndexed()));
    const bm = new THREE.InstancedMesh(bulbG, M.lamp, bulbs.length);
    bulbs.forEach(([x, y, z], i) => bm.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, z)));
    ch.add(bm);
    const dropG = new THREE.OctahedronGeometry(0.06, 0).scale(1, 2.2, 1);
    const dm = new THREE.InstancedMesh(dropG, mat.crystal, drops.length);
    drops.forEach(([x, y, z], i) => dm.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, z)));
    ch.add(dm);
    ctx.chandelierTemplate = ch.clone();
    ch.position.set(0, top, CC);
    root.add(ch);
    R.add(ch, { stage: S, order: 0.7, mode: 'drop', dropHeight: 6, dur: 0.15, xray: 'layerAlways', layer: 'lighting' });
    ctx.chandelier = ch;
  }

  // ------------------------------------------------------------------ portal (1914 section, photos): clear opening ≈ 11.5 × 11.9 m with a flat
  // top and rounded upper corners, a ≈ 1 m ivory frame with gilded beads and a chain of medallions; the
  // "NÁROD SOBĚ" frieze with the arms of the Czech lands at ≈ 16.6–17.9 and Schnirch's pediment group above it,
  // on a mauve wall up to the ceiling
  const pw = 5.75;                  // half of the clear opening
  const top = H.stageFloor + 11.9;  // ≈ 14.9
  const fz = V.portal - 0.95;       // front face of the portal frame
  {
    const fwid = 1.0, outerW = pw + fwid, rc = 1.2;
    const outline = (path, w, t, r) => {
      path.moveTo(-w, H.stageFloor - 0.2); path.lineTo(w, H.stageFloor - 0.2); path.lineTo(w, t - r);
      path.quadraticCurveTo(w, t, w - r, t); path.lineTo(-w + r, t); path.quadraticCurveTo(-w, t, -w, t - r); path.closePath();
    };
    // points along the opening contour (up the right jamb, across the top, down the left jamb)
    const contour = (w, t, r, z) => {
      const pts = [new THREE.Vector3(w, H.stageFloor, z), new THREE.Vector3(w, t - r, z)];
      for (let k = 1; k <= 8; k++) { const a = (k / 8) * (Math.PI / 2); pts.push(new THREE.Vector3(w - r + Math.cos(a) * r, t - r + Math.sin(a) * r, z)); }
      for (let k = 0; k <= 8; k++) { const a = Math.PI / 2 + (k / 8) * (Math.PI / 2); pts.push(new THREE.Vector3(-w + r + Math.cos(a) * r, t - r + Math.sin(a) * r, z)); }
      pts.push(new THREE.Vector3(-w, H.stageFloor, z));
      return pts;
    };
    const frame = new THREE.Shape();
    outline(frame, outerW, top + fwid, rc + fwid);
    const hole = new THREE.Path();
    outline(hole, pw, top, rc);
    frame.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(frame, { depth: 0.5, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 12 });
    g.translate(0, 0, fz - 0.5);
    add(based(g, mat.gild), { stage: S, order: 0.44, dur: 0.12, mode: 'rise', xray: 'keep' });
    // beads on both edges of the gilded frame and a chain of round medallions between them
    const gold = [];
    for (const [w, t, r] of [[pw + 0.06, top + 0.06, rc + 0.06], [outerW - 0.06, top + fwid - 0.06, rc + fwid - 0.06]]) {
      gold.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(contour(w, t, r, fz - 0.57), false, 'catmullrom', 0), 160, 0.055, 6, false));
    }
    const mid = new THREE.CatmullRomCurve3(contour(pw + fwid / 2, top + fwid / 2, rc + fwid / 2, fz - 0.58), false, 'catmullrom', 0);
    const nMed = Math.floor(mid.getLength() / 0.85);
    for (let k = 0; k <= nMed; k++) {
      const q = mid.getPointAt(k / nMed);
      gold.push(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14).rotateX(Math.PI / 2).translate(q.x, q.y, q.z).toNonIndexed());
    }
    add(new THREE.Mesh(mergeGeometries(gold.map((x) => (x.index ? x.toNonIndexed() : x))), M.gold), { stage: S, order: 0.46, dur: 0.08, mode: 'appear', xray: 'keep' });
    // inner reveal of the opening (red)
    const rev = mergeGeometries([
      new THREE.BoxGeometry(0.4, top - rc - H.stageFloor, 1.3).translate(-pw - 0.2, (top - rc + H.stageFloor) / 2, fz + 0.65),
      new THREE.BoxGeometry(0.4, top - rc - H.stageFloor, 1.3).translate(pw + 0.2, (top - rc + H.stageFloor) / 2, fz + 0.65),
      new THREE.BoxGeometry(2 * pw, 0.4, 1.3).translate(0, top + 0.2, fz + 0.65),
    ].map((x) => x.toNonIndexed()));
    add(based(rev, M.boxWall), { stage: S, order: 0.44, dur: 0.12, mode: 'rise', xray: 'keep' });
    // mauve wall above the portal up to the ceiling, with a row of painted garlands under the ceiling cornice
    const wallW = 2 * WALL_IN, wallH = AUD.ceiling - (top + fwid);
    const mauve = new THREE.Mesh(new THREE.PlaneGeometry(wallW, wallH).rotateY(Math.PI).translate(0, (AUD.ceiling + top + fwid) / 2, V.portal - 0.72),
      new THREE.MeshStandardNodeMaterial({ map: garlandTexture(wallW, wallH), roughness: 0.8, side: THREE.DoubleSide }));
    add(mauve, { stage: S, order: 0.43, dur: 0.05, mode: 'appear', xray: 'keep' });
    // frieze with the inscription and coats of arms
    const fw = 14.0, fh = 1.3, fy = top + fwid + 0.75 + fh / 2;
    const frieze = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh).rotateY(Math.PI), mat.frieze);
    frieze.position.set(0, fy, fz - 0.62);
    add(frieze, { stage: S, order: 0.5, dur: 0.05, mode: 'appear', xray: 'keep' });
    const yF = fy + fh / 2 + 0.05;
    const cornice = mergeGeometries([
      new THREE.BoxGeometry(fw + 0.6, 0.18, 0.9).translate(0, fy - fh / 2 - 0.09, fz - 0.6),
      new THREE.BoxGeometry(fw + 1.0, 0.28, 1.05).translate(0, yF + 0.14, fz - 0.65),
      new THREE.BoxGeometry(fw + 1.3, 0.16, 1.15).translate(0, yF + 0.36, fz - 0.7),
    ].map((x) => x.toNonIndexed()));
    add(based(cornice, mat.gild), { stage: S, order: 0.5, dur: 0.08, mode: 'rise', xray: 'keep' });
    // pediment (raking cornices) with Schnirch's group: a winged genius between reclining figures
    const ped = new THREE.Shape();
    const half = 8.0, rise = Math.min(2.9, AUD.ceiling - 0.25 - (yF + 0.45));
    ped.moveTo(-half, 0); ped.lineTo(half, 0); ped.lineTo(0, rise); ped.closePath();
    const inner = new THREE.Path();
    inner.moveTo(-half + 0.9, 0.25); inner.lineTo(half - 0.9, 0.25); inner.lineTo(0, rise - 0.45); inner.closePath();
    ped.holes.push(inner);
    const pg = new THREE.ExtrudeGeometry(ped, { depth: 0.6, bevelEnabled: false });
    pg.translate(0, yF + 0.45, fz - 1.0);
    add(based(pg, mat.gild), { stage: S, order: 0.52, dur: 0.08, mode: 'rise', xray: 'keep' });
    const tymp = new THREE.Shape();
    tymp.moveTo(-half + 0.9, 0.25); tymp.lineTo(half - 0.9, 0.25); tymp.lineTo(0, rise - 0.45); tymp.closePath();
    const tg = new THREE.ShapeGeometry(tymp).rotateY(Math.PI).translate(0, yF + 0.45, fz - 0.45);
    add(new THREE.Mesh(tg, mat.mauve), { stage: S, order: 0.52, dur: 0.05, mode: 'appear', xray: 'keep' });
    const fig = figureGeometry();
    const relief = [];
    const poses = [[-5.2, -1.35, 1.1], [-3.6, -1.1, 1.4], [-2.0, -0.4, 1.8], [0, 0, 2.3], [2.0, 0.4, 1.8], [3.6, 1.1, 1.4], [5.2, 1.35, 1.1]];
    for (const [x, tilt, sc] of poses) {
      relief.push(new THREE.Matrix4().compose(new THREE.Vector3(x, yF + 0.7, fz - 0.62),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, tilt)), new THREE.Vector3(sc, sc, sc * 0.5)));
    }
    const rm = new THREE.InstancedMesh(fig, mat.gild, relief.length);
    relief.forEach((m, i) => rm.setMatrixAt(i, m));
    add(rm, { stage: S, mode: 'grow', dur: 0.06, orders: new Float32Array(relief.length).fill(0.56), xray: 'keep' });
  }

  // ------------------------------------------------------------------ curtains: Hynais (down for the finished house) under a straight
  // red lambrequin with gold embroidery and fringe (≈ 2 m deep); no tied-back side drapes (photos)
  {
    // photo int_opona_hynais_foto: under a ≈2.6 m lambrequin the painting (aspect ≈1.55) with its ornamental
    // borders and the band of coats of arms, below it a dark band ≈1.5 m down to the stage floor
    const lamH = 2.6;
    const cw = 2 * pw + 0.6;
    const ch = cw / 1.55;
    const lamBottom = top + 0.25 - lamH - H.stageFloor;          // relative to the stage floor
    const curtain = new THREE.Group();
    curtain.add(new THREE.Mesh(new THREE.PlaneGeometry(cw, ch).translate(0, lamBottom - ch / 2 + 0.1, 0).rotateY(Math.PI), mat.curtain));
    const lowH = lamBottom + 0.1 - ch;
    curtain.add(new THREE.Mesh(new THREE.PlaneGeometry(cw, lowH).translate(0, lowH / 2, 0).rotateY(Math.PI), mat.curtainBase));
    curtain.add(new THREE.Mesh(new THREE.PlaneGeometry(cw, 1.2).translate(0, lamBottom + 0.6, 0.01).rotateY(Math.PI), M.drape));
    curtain.position.set(0, H.stageFloor, V.portal + 0.3);
    root.add(curtain);
    R.add(curtain, { stage: S, order: 0.8, mode: 'none', dur: 0.1, xray: 'hide' });
    const lam = new THREE.Mesh(new THREE.PlaneGeometry(2 * pw + 0.4, lamH).rotateY(Math.PI), mat.lambrequin);
    lam.position.set(0, top + 0.25 - lamH / 2, fz + 0.25);
    add(lam, { stage: S, order: 0.78, dur: 0.05, mode: 'appear', xray: 'keep' });
    const tassels = [];
    for (let x = -pw; x <= pw; x += 0.13) tassels.push(new THREE.Matrix4().makeTranslation(x, top + 0.25 - lamH - 0.18, fz + 0.2));
    const tm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.05, 0.36, 5), mat.gild, tassels.length);
    tassels.forEach((m, i) => tm.setMatrixAt(i, m));
    add(tm, { stage: S, mode: 'grow', dur: 0.05, orders: new Float32Array(tassels.length).fill(0.79), xray: 'keep' });
    // the ceremonial curtain is down for the finished house and rises for the stage machinery,
    // X-ray and whenever the camera stands behind the curtain line
    let lift = 0;
    const camLocal = new THREE.Vector3();
    ctx.ticks.push((dt, T, state) => {
      camLocal.copy(ctx.camera.position);
      curtain.parent.worldToLocal(camLocal);
      const onStage = camLocal.z > V.portal + 0.3 && camLocal.y > 0 && Math.abs(camLocal.x) < STAGE.houseHalfWidth;
      const want = T < 4.85 ? 0 : (state?.lastStop === 6 || state?.xray || onStage) ? 1 : 0;
      lift += (want - lift) * Math.min(1, dt * 1.6);
      curtain.position.y = H.stageFloor + lift * (lamBottom + 0.6);
    });
    ctx.hynais = curtain;
  }

  // ------------------------------------------------------------------ painters' hall above the auditorium
  {
    // the painters' hall lies on the girders above the auditorium; next to it the 1881 water reservoir
    const hallY = AUD.girders[1] + 0.12;
    add(new THREE.Mesh(capGeometry(rect(-11.2, 11.2, V.auditoriumBack + 0.5, V.portal - 0.6), hallY, true, [], 4), M.plaster),
      { stage: S, order: 0.66, dur: 0.05, mode: 'appear', xray: 'ghostSoft' });
    const wallH = H.atticTop - 0.02 - hallY; // 2 cm under the copper attic deck, which lies at H.atticTop
    const hallWall = based(new THREE.BoxGeometry(22.4, wallH, 0.35).translate(0, wallH / 2, 0), M.plaster);
    hallWall.position.set(0, hallY, 22.6); // end wall of the hall towards the reservoir
    add(hallWall, { stage: S, order: 0.66, dur: 0.05, mode: 'rise', xray: 'ghostSoft' });
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 5.6, 20).rotateX(Math.PI / 2), M.iron);
    tank.position.set(2.5, hallY + 0.8, 28.6);
    tank.castShadow = true;
    root.add(tank);
    R.add(tank, { stage: S, order: 0.7, mode: 'grow', dur: 0.05, xray: 'layerAlways', layer: 'water' });
  }

  // the foyer runs parallel to the north façade (façade frame, see FACADE in config.js)
  const foyerRoot = new THREE.Group();
  foyerRoot.rotation.y = -FACADE.angle;
  foyerRoot.name = 'foyer-frame';
  ctx.root.add(foyerRoot);
  root = foyerRoot;
  // ------------------------------------------------------------------ foyer (1914 section, photos): floor ≈ 6.6 like the loggia, 21.5 × 6.4 m;
  // ochre imitation-marble walls on a dark-green base, white marble pilasters with gilded capitals in five bays,
  // a gilded bracketed cornice at 12.0; above it Aleš's "Vlast" lunettes (5 + 5 + 2 + 2) under a shallow cove
  // and the flat field (≈ 13.9) with Ženíšek's triptych; two chandeliers, dark bronze busts on gilded brackets,
  // floor inlaid with stars and crosses inside a border of diamonds
  {
    const v0 = V.foyer[0], v1 = V.foyer[1], vm = (v0 + v1) / 2;
    const FL = H.loggiaFloor, CORN = 12.0, LUN = 13.6, FIELD = 13.9;
    // the loggia (and the five doors) is centred slightly east of the façade-frame origin
    const lf = edges(FP.loggia).reduce((a, e) => (e.p[1] + e.q[1] < a.p[1] + a.q[1] ? e : a));
    const lmx = (lf.p[0] + lf.q[0]) / 2, lmz = (lf.p[1] + lf.q[1]) / 2;
    const uc = lmx * Math.cos(FACADE.angle) + lmz * Math.sin(FACADE.angle);
    const BAY = 4.15, L2 = 10.75;
    const u0 = uc - L2, u1 = uc + L2;
    const pilU = [0, 1, 2, 3, 4, 5].map((k) => uc + (k - 2.5) * BAY);
    const bayU = [0, 1, 2, 3, 4].map((k) => uc + (k - 2) * BAY);
    // floor: inlaid field inside a band of diamonds
    const field = rect(u0 + 0.8, u1 - 0.8, v0 + 0.8, v1 - 0.8);
    add(new THREE.Mesh(capGeometry(field, FL + 0.03, true, [], 2.4), M.inlay), { stage: S, order: 0.05, dur: 0.05, mode: 'appear', xray: 'keep' });
    add(new THREE.Mesh(capGeometry(rect(u0, u1, v0, v1), FL + 0.03, true, [field.slice().reverse()], 1.6), M.inlayBorder), { stage: S, order: 0.05, dur: 0.05, mode: 'appear', xray: 'keep' });
    // walls up to the lunettes, green marble base, gilded cornice
    const room = rect(u0, u1, v0, v1);
    add(based(sweepGeometry(room, [[0, FL], [0, LUN]], { tileU: 4, tileV: 4 }), M.foyerWall, { cast: false }), { stage: S, order: 0.1, dur: 0.2, mode: 'rise', xray: 'keep' });
    add(based(sweepGeometry(room, [[0, FL], [-0.12, FL], [-0.12, FL + 0.9], [-0.06, FL + 0.95], [0, FL + 0.95]], { tile: 2 }), mat.greenMarble), { stage: S, order: 0.12, dur: 0.2, mode: 'rise', xray: 'keep' });
    add(based(sweepGeometry(room, [[0, CORN - 0.45], [-0.12, CORN - 0.45], [-0.18, CORN - 0.25], [-0.3, CORN - 0.2], [-0.42, CORN], [-0.5, CORN + 0.08], [0, CORN + 0.08]], { tile: 2 }), mat.gild), { stage: S, order: 0.5, dur: 0.1, mode: 'rise', xray: 'keep' });
    // shallow cove from the lunettes to the flat field, painted cream
    const cove = [];
    for (let k = 0; k <= 8; k++) { const t = (k / 8) * (Math.PI / 2); cove.push([-1.6 * (1 - Math.cos(t)), LUN + (FIELD - LUN) * Math.sin(t)]); }
    add(new THREE.Mesh(sweepGeometry(room, cove, { tile: 3 }), mat.soffit), { stage: S, order: 0.6, dur: 0.05, mode: 'appear', xray: 'keep' });
    add(new THREE.Mesh(capGeometry(rect(u0 + 1.6, u1 - 1.6, v0 + 1.6, v1 - 1.6), FIELD, false, [], 3), mat.soffit), { stage: S, order: 0.6, dur: 0.05, mode: 'appear', xray: 'keep' });
    // Ženíšek's triptych in gilded frames on the flat field
    const tri = [], triFrames = [];
    for (const du of [-5.4, 0, 5.4]) {
      tri.push(new THREE.PlaneGeometry(4.5, 2.75).rotateX(Math.PI / 2).translate(uc + du, FIELD - 0.02, vm).toNonIndexed());
      for (const [w, h, x, z] of [[4.8, 0.16, 0, -1.45], [4.8, 0.16, 0, 1.45], [0.16, 3.06, -2.32, 0], [0.16, 3.06, 2.32, 0]]) {
        triFrames.push(new THREE.BoxGeometry(w, 0.08, h).translate(uc + du + x, FIELD - 0.05, vm + z).toNonIndexed());
      }
    }
    add(new THREE.Mesh(mergeGeometries(tri), mat.foyerCeiling), { stage: S, order: 0.62, dur: 0.05, mode: 'appear', xray: 'keep' });
    add(new THREE.Mesh(mergeGeometries(triFrames), mat.gild), { stage: S, order: 0.62, dur: 0.05, mode: 'appear', xray: 'keep' });
    // Aleš's lunettes: five on each long wall over the bays, two on each end wall
    const lun = [], lunFr = [];
    const lunette = (x, z, rotY, r) => {
      lun.push(new THREE.CircleGeometry(r, 24, 0, Math.PI).rotateY(rotY).translate(x, CORN + 0.12, z).toNonIndexed());
      lunFr.push(new THREE.TorusGeometry(r + 0.05, 0.06, 6, 24, Math.PI).rotateY(rotY).translate(x, CORN + 0.12, z).toNonIndexed());
    };
    for (const u of bayU) { lunette(u, v0 + 0.03, 0, 1.4); lunette(u, v1 - 0.03, Math.PI, 1.4); }
    for (const [u, rot] of [[u0 + 0.03, Math.PI / 2], [u1 - 0.03, -Math.PI / 2]]) for (const dv of [-1.45, 1.45]) lunette(u, vm + dv, rot, 1.25);
    add(new THREE.Mesh(mergeGeometries(lun), mat.lunette), { stage: S, order: 0.64, dur: 0.05, mode: 'appear', xray: 'keep' });
    add(new THREE.Mesh(mergeGeometries(lunFr), mat.gild), { stage: S, order: 0.64, dur: 0.05, mode: 'appear', xray: 'keep' });
    // pilasters: white marble shafts with gilded Corinthian capitals, on the green base
    const pil = [], caps = [];
    for (const u of pilU) for (const [v, f] of [[v0, 1], [v1, -1]]) {
      // 1 cm off the wall: a face lying on the wall would flicker against it
      pil.push(new THREE.Matrix4().makeTranslation(u, FL + 0.95, v + f * 0.1));
      caps.push(new THREE.Matrix4().makeTranslation(u, CORN - 0.95, v + f * 0.13));
    }
    const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, CORN - 0.95 - FL - 0.95, 0.18).translate(0, (CORN - 0.95 - FL - 0.95) / 2, 0), mat.whiteMarble, pil.length);
    pil.forEach((m, i) => pm.setMatrixAt(i, m));
    add(pm, { stage: S, mode: 'rise', dur: 0.08, orders: new Float32Array(pil.length).fill(0.2), xray: 'keep' });
    const capG = mergeGeometries([
      new THREE.BoxGeometry(0.78, 0.5, 0.24).translate(0, 0.25, 0),
      new THREE.BoxGeometry(0.92, 0.1, 0.3).translate(0, 0.55, 0),
    ].map((x) => x.toNonIndexed()));
    const cm = new THREE.InstancedMesh(capG, mat.gild, caps.length);
    caps.forEach((m, i) => cm.setMatrixAt(i, m));
    add(cm, { stage: S, mode: 'grow', dur: 0.08, orders: new Float32Array(caps.length).fill(0.22), xray: 'keep' });
    // doors: five glazed doors to the loggia (north), doors with red velvet curtains (south), one in each end wall
    const doorG = [], glassG = [], drapeG = [];
    for (const u of bayU) {
      doorG.push(new THREE.BoxGeometry(2.2, 4.3, 0.1).translate(u, FL + 2.15, v0 + 0.06).toNonIndexed()); // 1 cm off the wall
      glassG.push(new THREE.PlaneGeometry(1.8, 3.9).translate(u, FL + 2.1, v0 + 0.115).toNonIndexed()); // between the door (0.11) and the face of the marble base (0.12)
      doorG.push(new THREE.BoxGeometry(1.9, 3.4, 0.1).translate(u, FL + 1.7, v1 - 0.06).toNonIndexed());
      drapeG.push(new THREE.BoxGeometry(2.2, 3.7, 0.12).translate(u, FL + 1.85, v1 - 0.14).toNonIndexed());
    }
    for (const uu of [u0 + 0.06, u1 - 0.06]) doorG.push(new THREE.BoxGeometry(0.1, 3.6, 2.0).translate(uu, FL + 1.8, vm).toNonIndexed());
    add(new THREE.Mesh(mergeGeometries(doorG), mat.wood), { stage: S, order: 0.3, dur: 0.05, mode: 'appear', xray: 'keep' });
    add(new THREE.Mesh(mergeGeometries(glassG).rotateY(0), M.glass), { stage: S, order: 0.3, dur: 0.05, mode: 'appear', xray: 'keep' });
    add(new THREE.Mesh(mergeGeometries(drapeG), M.drape), { stage: S, order: 0.32, dur: 0.05, mode: 'appear', xray: 'keep' });
    // dark bronze busts of the founders on gilded scroll brackets fixed to the pilasters (≈ 2.4 m up)
    const bust = mergeGeometries([
      new THREE.CylinderGeometry(0.1, 0.16, 0.12, 12).translate(0, 0.06, 0),
      new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.46, 0.34, 0.26).translate(0, 0.11, 0),
      new THREE.CylinderGeometry(0.075, 0.09, 0.16, 10).translate(0, 0.34, 0.01),
      new THREE.SphereGeometry(0.115, 14, 10).scale(1, 1.22, 1.08).translate(0, 0.53, 0.02),
      new THREE.SphereGeometry(0.118, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1.02, 1.1, 1.08).translate(0, 0.56, -0.005),
      new THREE.BoxGeometry(0.035, 0.06, 0.05).translate(0, 0.52, 0.14),
    ].map((g) => g.toNonIndexed()));
    const bracket = mergeGeometries([
      new THREE.BoxGeometry(0.5, 0.08, 0.42).translate(0, -0.04, 0.12),
      new THREE.CylinderGeometry(0.08, 0.16, 0.45, 8).translate(0, -0.3, 0.06),
      new THREE.SphereGeometry(0.1, 8, 6).translate(0, -0.55, 0.05),
    ].map((g) => g.toNonIndexed()));
    const busts = [];
    for (const u of pilU) {
      busts.push(new THREE.Matrix4().makeTranslation(u, FL + 2.4, v0 + 0.28));
      busts.push(new THREE.Matrix4().makeRotationY(Math.PI).setPosition(u, FL + 2.4, v1 - 0.28));
    }
    const bm = new THREE.InstancedMesh(bust, mat.bronzeDark, busts.length);
    const km = new THREE.InstancedMesh(bracket, mat.gild, busts.length);
    busts.forEach((m, i) => { bm.setMatrixAt(i, m); km.setMatrixAt(i, m); });
    add(km, { stage: S, mode: 'grow', dur: 0.08, orders: new Float32Array(busts.length).fill(0.69), xray: 'keep' });
    add(bm, { stage: S, mode: 'grow', dur: 0.08, orders: new Float32Array(busts.length).fill(0.7), xray: 'keep' });
    // red velvet benches along the south wall
    const benches = [];
    for (const u of bayU.slice(0, 4)) benches.push(new THREE.BoxGeometry(2.2, 0.45, 0.55).translate(u + BAY / 2, FL + 0.225, v1 - 0.45).toNonIndexed());
    add(new THREE.Mesh(mergeGeometries(benches), M.velvet), { stage: S, order: 0.4, dur: 0.05, mode: 'appear', xray: 'keep' });
    // two chandeliers between the paintings (tulip shades in two tiers)
    for (const du of [-2.7, 2.7]) {
      const c = ctx.chandelierTemplate.clone();
      c.scale.setScalar(0.45);
      c.position.set(uc + du, FIELD - 0.3, vm);
      root.add(c);
      R.add(c, { stage: S, order: 0.72, mode: 'drop', dropHeight: 3, dur: 0.1, xray: 'keep' });
    }
  }

  root = ctx.root;
  // ------------------------------------------------------------------ staircases (layer: stairs), positions from Fialka's plans 1883
  {
    const steps = []; // [u, y, v, width, depth, rotY]
    // dog-leg stair in a rectangular stair hall: two runs along the longer side, landings at both ends
    const flights = []; // [from, to, width] of each run (for stringers and handrails)
    const B = (alongU, a, y, b) => (alongU ? new THREE.Vector3(b, y, a) : new THREE.Vector3(a, y, b));
    const dogleg = (u0, u1, v0, v1, yTop, y0 = 0, alongU = false) => {
      const [a0, a1, b0, b1] = alongU ? [v0, v1, u0, u1] : [u0, u1, v0, v1];
      const w = (a1 - a0) / 2 - 0.1;
      const run = b1 - b0 - 2.4;
      const n = 11;
      const put = (a, y, b, wa, db) => steps.push(alongU ? [b, y, a, db, wa, 0] : [a, y, b, wa, db, 0]);
      for (let f = 0, y = y0; y < yTop - 0.05; f++, y += 1.8) {
        const back = f % 2 === 1;
        const lane = back ? a1 - w / 2 : a0 + w / 2;
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n;
          put(lane, y + t * 1.8, back ? b1 - 1.2 - run * t : b0 + 1.2 + run * t, w, run / n + 0.04);
        }
        put((a0 + a1) / 2, y + 1.8, back ? b0 + 0.6 : b1 - 0.6, a1 - a0, 1.2); // landing
        const bs = back ? b1 - 1.2 : b0 + 1.2, be = back ? b0 + 1.2 : b1 - 1.2;
        flights.push({ from: B(alongU, lane, y, bs), to: B(alongU, lane, y + 1.8, be), w, side: B(alongU, back ? a1 - 0.08 : a0 + 0.08, 0, 0), alongU });
      }
    };
    const newels = [];
    // oval / spiral stair around a newel
    const spiral = (cu, cv, r, yTop, y0 = 0) => {
      newels.push([cu, cv, y0, yTop]);
      const n = Math.round((yTop - y0) / 0.18);
      for (let k = 0; k < n; k++) {
        const a = k * (Math.PI * 2 / 18);
        steps.push([cu + Math.cos(a) * r * 0.55, y0 + k * 0.18, cv + Math.sin(a) * r * 0.55 * 1.25, r * 0.9, 0.42, -a]);
      }
    };
    dogleg(13.6, 18.0, 2.2, 7.2, AUD.tiers[4]);        // NE pylon – to the III. and IV. tier
    dogleg(-17.6, -13.0, -0.6, 4.4, AUD.tiers[4]);     // NW pylon (behind the north wall, which runs at v ≈ −1.4 here)
    dogleg(12.8, 18.4, 8.8, 16.4, AUD.tiers[2]);       // main stair to the I. and II. tier (east)
    dogleg(-15.4, -10.6, 11.0, 16.4, AUD.tiers[2]);    // main stair (west)
    dogleg(-16.9, -12.9, 19.4, 26.2, AUD.tiers[1]);    // "ku královské lóži" – stair to the royal box
    dogleg(13.95, 17.55, 29.8, 34.6, AUD.tiers[4]);    // east side stair along the auditorium (clear of the horseshoe wall, outer face ≈ 13.7 here)
    dogleg(13.5, 17.5, 46.8, 50.1, AUD.tiers[4]);      // east stage stair beside the stage house
    dogleg(-14.6, -10.3, 48.9, 52.4, AUD.tiers[4]);    // west stair by the actors' entrance
    for (const s of [-1, 1]) spiral(...audToB(s * 10.3, V.portal + 1.4), 1.0, STAGE.floor + 15.4, STAGE.floor); // newel stairs in the stage corners
    dogleg(10.9, 17.8, 56.8, 60.5, 18.6, 0, true);     // Provisional Theatre stairs
    dogleg(-12.9, -6.8, 59.8, 63.3, 18.6, 0, true);
    spiral(13.5, 87.3, 2.2, 20.8);                      // oval stair of the Schulz house
    // stringers under the runs, handrails on the wall side, newels of the spiral stairs
    const strG = [], railG = [];
    const mm = new THREE.Matrix4();
    for (const fl of flights) {
      const lo = fl.from.clone().add(new THREE.Vector3(0, -0.12, 0)), hi = fl.to.clone().add(new THREE.Vector3(0, -0.12, 0));
      strG.push(mm.clone().copy(beamMatrix(lo, hi, fl.w, 0.22, mm)));
      const sideA = fl.alongU ? 'z' : 'x';
      const a = fl.from.clone(), b = fl.to.clone();
      a[sideA] = fl.side[sideA]; b[sideA] = fl.side[sideA];
      a.y += 0.95; b.y += 0.95;
      railG.push(mm.clone().copy(beamMatrix(a, b, 0.07, 0.07, mm)));
    }
    const strM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.plaster, strG.length);
    strG.forEach((m, i) => strM.setMatrixAt(i, m));
    add(strM, { stage: S, mode: 'grow', dur: 0.05, orders: new Float32Array(strG.length).fill(0.05), xray: 'layerAlways', layer: 'stairs' });
    const railM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat.gild, railG.length);
    railG.forEach((m, i) => railM.setMatrixAt(i, m));
    add(railM, { stage: S, mode: 'grow', dur: 0.05, orders: new Float32Array(railG.length).fill(0.3), xray: 'layerAlways', layer: 'stairs' });
    const newM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.22, 1, 12).translate(0, 0.5, 0), M.trim, newels.length);
    newels.forEach(([u, v, y0, y1], i) => newM.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(u, y0, v), new THREE.Quaternion(), new THREE.Vector3(1, y1 - y0, 1))));
    add(newM, { stage: S, mode: 'rise', dur: 0.05, orders: new Float32Array(newels.length).fill(0.05), xray: 'layerAlways', layer: 'stairs' });
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.17, 1), M.trim, steps.length);
    const q = new THREE.Quaternion();
    steps.forEach(([u, y, v, w, d, r], i) => im.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(u, y, v), q.setFromAxisAngle(Y, r), new THREE.Vector3(w, 1, d))));
    im.castShadow = true;
    add(im, { stage: S, mode: 'grow', dur: 0.05, orders: new Float32Array(steps.map((st) => 0.05 + Math.min(0.3, st[1] / 60))), xray: 'layerAlways', layer: 'stairs' });
  }
  ctx.auditorium = { CV, CC, FRONT, CEIL_R, portalTop: top, pw };
  return ctx;
}
