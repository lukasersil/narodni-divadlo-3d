// Masonry core, stone shell, cornices, attic storey, dome (iron frame + slate + gold) and roofs.
// Stage indices: 0 foundations · 1 walls · 2 roof & dome · 3 façade · 4 interiors · 5 stage · 6 completion
import * as THREE from 'three/webgpu';
import { FP, H, V, AUD, STAGE, FLY, REAR, audToB, bToAud, facadeToB, splitAtGallery } from '../config.js';
import {
  wallGeometry, capGeometry, offsetPolygon, sweepGeometry, clipBand, beamMatrix,
  mergeGeometries, ccw, edges,
} from '../core/geom.js';
import { based, ringWall, clipBox, rect, horseshoe, hipRoofGeometry, wallEdges, JOINT } from './util.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// wall profile along an open polyline (thick wall)
function openWall(points, y0, y1, t) {
  const h = t / 2;
  return sweepGeometry(points, [[-h, y0], [h, y0], [h, y1], [-h, y1], [-h, y0]], { closed: false, tile: 4 });
}

// Loggia porch arches (Fialka plan 02): five bays of 4.15 m centred on the front, arches 2.8 wide, crown 5.0
const LOGGIA_ARCHES = (len) => [0, 1, 2, 3, 4].map((k) => len / 2 - 2.5 * 4.15 + 4.15 * (k + 0.5));
// The loggia block's front wall from z0 to z0 + depth behind the front line, with the arched openings cut
// from its foot (local x along the façade, z inwards; UVs in 4 m tiles like the other walls)
function loggiaArchedFront(z0, depth, yTop) {
  const f = edges(FP.loggia).find((e) => e.n[1] < -0.8);
  const r = 1.4, spring = 5.0 - r;
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  for (const xc of LOGGIA_ARCHES(f.len)) {
    sh.lineTo(xc - r, 0);
    sh.lineTo(xc - r, spring);
    sh.absarc(xc, spring, r, Math.PI, 0, true);
    sh.lineTo(xc + r, 0);
  }
  sh.lineTo(f.len, 0);
  sh.lineTo(f.len, yTop);
  sh.lineTo(0, yTop);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 16 });
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / 4);
  g.translate(0, 0, z0);
  const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(f.dir[0], 0, f.dir[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-f.n[0], 0, -f.n[1]));
  g.applyMatrix4(basis.setPosition(f.p[0], 0, f.p[1]));
  return g;
}

// open wall paths along a polygon, leaving out edges for which skip(edge) is true
function openRing(poly, skip) {
  const es = edges(poly);
  const paths = [];
  let cur = null;
  const start = es.findIndex((e) => skip(e));
  const order = start < 0 ? es : es.slice(start + 1).concat(es.slice(0, start + 1));
  for (const e of order) {
    if (skip(e)) { if (cur) paths.push(cur); cur = null; continue; }
    if (!cur) cur = [e.p];
    cur.push(e.q);
  }
  if (cur) paths.push(cur);
  return paths.filter((p) => p.length > 1);
}

export const PROFILES = {
  plinth: [[0, -0.4], [0.42, -0.4], [0.42, 0.85], [0.3, 0.95], [0.22, 1.12], [0, 1.12]],
  string: [[0, 7.7], [0.22, 7.7], [0.32, 7.9], [0.34, 8.12], [0.2, 8.3], [0, 8.3]],
  sill: [[0, 8.9], [0.14, 8.9], [0.18, 9.06], [0, 9.1]],
  mezz: [[0, 15.42], [0.2, 15.42], [0.3, 15.62], [0.22, 15.82], [0, 15.84]],
  frieze: [[0, 18.95], [0.12, 18.95], [0.14, 19.1], [0, 19.12]],
  cornice: [[0, 20.05], [0.22, 20.05], [0.3, 20.28], [0.52, 20.34], [0.58, 20.52], [1.12, 20.6], [1.24, 20.76], [1.32, 21.08], [1.24, 21.24], [0.95, 21.38], [0, 21.42]],
  southCornice: [[0, 20.15], [0.2, 20.15], [0.28, 20.35], [0.85, 20.55], [0.98, 20.85], [0.85, 21.22], [0, 21.4]],
  provAttic: [[0, 26.3], [0.15, 26.3], [0.25, 26.5], [0.55, 26.6], [0.6, 26.8], [0, 26.82]],
  attic: [[0, 29.45], [0.22, 29.45], [0.52, 29.85], [0.62, 30.2], [0.48, 30.5], [0, 30.62]],
  coping: [[-0.32, 22.55], [0.36, 22.55], [0.38, 22.72], [-0.34, 22.74]],
};

export function buildShell(ctx) {
  const { root, M, R } = ctx;
  const add = (mesh, opts) => {
    root.add(mesh);
    return R.add(mesh, opts);
  };
  // auditorium / stage walls follow Zítek's axis (see AXIS in config.js)
  const addA = (mesh, opts) => {
    (ctx.audRoot ?? root).add(mesh);
    return R.add(mesh, opts);
  };

  const mainBands = [[0, H.ground], [H.ground, H.piano], [H.piano, H.cornice]];
  const southParts = {
    connector: clipBand(FP.south, V.mainEnd, V.connectorEnd),
    prov: clipBand(FP.south, V.connectorEnd, V.provEnd),
    schulz: clipBand(FP.south, V.provEnd, V.south + 1),
  };

  // ====================================================================== 0 · FOUNDATIONS
  {
    const pitPoly = offsetPolygon(FP.all, 3.2);
    // plot surface before works start
    add(based(capGeometry(offsetPolygon(FP.all, 8), 0.0, true, [], 6), M.ground, { cast: false }),
      { stage: null, until: 0.12, mode: 'none', xray: 'hide' });
    // ground between the excavation and the terrain cut-out, until the pavement ring is laid
    add(based(capGeometry(offsetPolygon(FP.all, 8), 0.0, true, [offsetPolygon(FP.all, 3.2).slice().reverse()], 6), M.ground, { cast: false }),
      { stage: null, until: 1.06, mode: 'none', xray: 'hide' });
    // excavation: earth walls + floor
    const pit = mergeGeometries([
      wallGeometry(pitPoly.slice().reverse(), H.foundation - 0.3, 0.02, 3),
      capGeometry(pitPoly, H.foundation - 0.3, true, [], 3),
    ]);
    const pitMesh = new THREE.Mesh(pit, M.earth);
    pitMesh.receiveShadow = true;
    add(pitMesh, { stage: 0, order: 0.0, dur: 0.12, mode: 'appear', until: 1.06, xray: 'hide' });
    // concrete slab
    add(based(mergeGeometries([wallGeometry(FP.all, H.foundation, H.foundation + 0.9, 3), capGeometry(FP.all, H.foundation + 0.9, true, [], 3)]), M.concrete),
      { stage: 0, order: 0.12, mode: 'rise', xray: 'keep' });
    // foundation walls (rubble stone): outer ring + main inner lines
    const fw = [
      ringWall(offsetPolygon(FP.all, -0.1), H.foundation + 0.9, -0.05, 1.5, 3),
      openWall([facadeToB(-17, V.foyer[1] + 0.35), facadeToB(18, V.foyer[1] + 0.35)], H.foundation + 0.9, -0.05, 1.0), // under the foyer's south wall
    ];
    add(based(mergeGeometries(fw), M.rubble), { stage: 0, order: 0.28, dur: 0.45, mode: 'rise', xray: 'struct' });
    const fwA = [
      openWall(horseshoe(AUD.outerHalfWidth, AUD.cv, 1, V.portal), H.foundation + 0.9, -0.05, AUD.wallT + 0.3),
      ringWall(rect(-STAGE.houseHalfWidth, STAGE.houseHalfWidth, V.portal - 0.8, V.stageBack), H.foundation + 0.9, -0.05, 1.4, 3),
    ];
    addA(based(mergeGeometries(fwA), M.rubble), { stage: 0, order: 0.3, dur: 0.43, mode: 'rise', xray: 'struct' });
    // concrete tank under the stage pit (1869)
    addA(based(ringWall(rect(-8.2, 8.2, V.portal + 0.2, V.stageBack - 0.3), H.foundation + 0.9, H.stageFloor - 0.4, 0.8, 3), M.concrete),
      { stage: 0, order: 0.55, mode: 'rise', xray: 'struct' });
    // ground-floor slab (opening over the stage pit)
    const slabHole = [ccw(rect(-7.6, 7.6, V.portal + 0.6, V.stageBack - 0.6).map(([u, v]) => audToB(u, v))).reverse()];
    const slab = mergeGeometries([
      capGeometry(FP.main, 0.0, true, slabHole, 4),
      capGeometry(FP.loggia, 0.0, true, [], 4),
      capGeometry(FP.terrace, 0.0, true, [], 4),
    ]);
    add(based(slab, M.concrete, { cast: false }), { stage: 1, order: 0.0, dur: 0.05, mode: 'appear', xray: 'ghostSoft' });
    // foundation stones (gold-lit) along the north basement wall
    const stoneG = new THREE.BoxGeometry(0.9, 0.7, 0.6);
    const stones = new THREE.InstancedMesh(stoneG, M.statue, 12);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 12; i++) {
      m.makeRotationY((Math.random() - 0.5) * 0.3).setPosition(-8.25 + i * 1.5, -2.6, 3.0 + (i % 2) * 0.2);
      stones.setMatrixAt(i, m);
    }
    stones.castShadow = true;
    const orders = new Float32Array(12).map((_, i) => 0.62 + i * 0.02);
    add(stones, { stage: 0, mode: 'drop', dropHeight: 6, orders, xray: 'keep' });
    // backfill + pavement ring around the building
    const ring = capGeometry(offsetPolygon(FP.all, 8), 0.01, true, [FP.all.slice().reverse()], 4); // covers the terrain cut-out (+6 m, cell-wise)
    add(based(ring, M.paving, { cast: false }), { stage: 1, order: 0.0, dur: 0.06, mode: 'appear', xray: 'keep' });
  }

  // ====================================================================== 1 · MASONRY CORE
  const coreOpts = (order) => ({ stage: 1, order, dur: 0.28, mode: 'rise', xray: 'struct' });
  {
    // main block walls: open on the south side where the stage continues into the connector wing
    const mainCoreAxis = offsetPolygon(FP.main, -0.85);
    const mainPaths = openRing(mainCoreAxis, JOINT.main);
    mainBands.forEach(([y0, y1], i) => add(based(mergeGeometries(mainPaths.map((pth) => openWall(pth, y0, y1, 1.1))), M.brick), coreOpts(0.0 + i * 0.2)));
    // loggia: ground floor round the porch (five open arches in the front wall), brick piers, top band
    const lg = offsetPolygon(FP.loggia, -0.3);
    // the open loggia is finished in sandstone, not plaster (see the finishes hook in interior.js)
    const lgGround = mergeGeometries([
      ...openRing(offsetPolygon(FP.loggia, -0.75), (e) => e.n[1] < -0.8).map((pth) => openWall(pth, 0, H.loggiaFloor - 0.02, 0.9)),
      loggiaArchedFront(0.3, 0.9, H.loggiaFloor - 0.02),
    ]);
    add(based(lgGround, M.brick), coreOpts(0.02)).userData.finish = M.stone; // just under the loggia floor
    add(based(ringWall(lg, H.piano, H.cornice, 0.9, 2), M.brick), coreOpts(0.42)).userData.finish = M.stone;
    const front = edges(FP.loggia).reduce((a, e) => (e.p[1] + e.q[1] < a.p[1] + a.q[1] ? e : a));
    const piers = [];
    const LB = 4.15, c0 = front.len / 2 - 2.5 * LB; // five loggia bays of 4.15 m (Fialka plan 04), corner piers at the ends
    for (let k = 0; k <= 5; k++) {
      const sA = Math.min(front.len - 1.1, Math.max(1.1, c0 + k * LB));
      const x = front.p[0] + front.dir[0] * sA - front.n[0] * 0.9;
      const z = front.p[1] + front.dir[1] * sA - front.n[1] * 0.9;
      const g = new THREE.BoxGeometry(k === 0 || k === 5 ? 2.2 : 1.4, H.piano - H.loggiaFloor, 1.2);
      g.rotateY(front.angle);
      g.translate(x, (H.loggiaFloor + H.piano) / 2, z);
      piers.push(g.toNonIndexed());
    }
    add(based(mergeGeometries(piers), M.brick), coreOpts(0.22)).userData.finish = M.stone;
    // north-west terrace wing (9 m)
    add(based(ringWall(offsetPolygon(FP.terrace, -0.3), 0, 8.6, 0.9, 2), M.brick), coreOpts(0.05));
    // auditorium horseshoe wall and stage house (fly tower to 33.5 m)
    {
      // horseshoe wall up to the girder bearings; at the back it opens onto the II. gallery
      // (below its floor and above the hall ceiling it is closed)
      // Above the main cornice the wall is thinned to its inner half: turned 3° with Zítek's axis, its full
      // outer face would stand ≈ 0.6 m proud of the attic wall on the east side near the portal.
      const [sideA, back, sideB] = splitAtGallery(horseshoe(AUD.outerHalfWidth, AUD.cv, 1, V.portal, 56));
      const top = AUD.girders[0];
      const T = AUD.wallT;
      const [upA, upBack, upB] = splitAtGallery(horseshoe(AUD.outerHalfWidth - T / 4, AUD.cv, 1, V.portal, 56));
      const parts = [openWall(sideA, 0, H.cornice, T), openWall(sideB, 0, H.cornice, T),
        openWall(upA, H.cornice, top, T / 2), openWall(upB, H.cornice, top, T / 2)];
      if (back.length > 1) parts.push(openWall(back, 0, AUD.tiers[4] - 0.4, T), openWall(upBack, AUD.ceiling, top, T / 2));
      addA(based(mergeGeometries(parts), M.brick), coreOpts(0.3));
    }
    const hw = STAGE.houseHalfWidth;
    addA(based(mergeGeometries([
      openWall([[-hw, V.portal], [-hw, V.stageBack], [-6.2, V.stageBack]], 0, H.cornice, 1.0),
      openWall([[6.2, V.stageBack], [hw, V.stageBack], [hw, V.portal]], 0, H.cornice, 1.0),
      openWall([[-6.2, V.stageBack], [6.2, V.stageBack]], 13.2, H.cornice, 1.0),
    ]), M.brick), coreOpts(0.5));
    // fly tower above the cornice stays inside the dome (±10.6 m, back wall at v = 49.5)
    const ft = FLY.half;
    addA(based(openWall([[-ft, V.portal], [-ft, FLY.back], [ft, FLY.back], [ft, V.portal]], H.cornice, FLY.top, 0.9), M.brick), coreOpts(0.62));
    // proscenium wall with the portal opening
    {
      const s = new THREE.Shape();
      s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, H.cornice); s.lineTo(ft, H.cornice); s.lineTo(ft, FLY.top); s.lineTo(-ft, FLY.top); s.lineTo(-ft, H.cornice); s.lineTo(-hw, H.cornice); s.closePath();
      const hole = new THREE.Path();
      const pw = STAGE.portalWidth / 2 + 0.6;
      hole.moveTo(-pw, H.stageFloor - 0.2); hole.lineTo(pw, H.stageFloor - 0.2); hole.lineTo(pw, 15.1); // masonry opening ≈ 12.9 × 12.1 behind the portal frame
      hole.lineTo(-pw, 15.1); hole.closePath();
      s.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(s, { depth: 1.4, bevelEnabled: false });
      g.translate(0, 0, V.portal - 0.7);
      const uvs = g.attributes.uv;
      for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) / 2, uvs.getY(i) / 2);
      addA(based(g, M.brick), coreOpts(0.52));
    }
    // pylon tops above the cornice
    for (const p of [FP.pylonW, FP.pylonE]) add(based(ringWall(offsetPolygon(p, -0.25), H.cornice, 24.78, 1.0, 2), M.brick), coreOpts(0.66)); // under the stone cap at 24.8
    // slate apron sloping from the attic wall down to the roof deck behind the main balustrade (photos)
    {
      const inner = offsetPolygon(FP.domeBase, 0.25), outer = offsetPolygon(FP.domeBase, 2.1);
      const pos = [];
      const ei = edges(inner), eo = edges(outer);
      ei.forEach((e, i) => {
        if (Math.abs(e.n[0]) < 0.8) return; // east and west sides, where the main block's deck lies
        const f = eo[i];
        const a0 = [e.p[0], 22.95, e.p[1]], a1 = [e.q[0], 22.95, e.q[1]];
        const b0 = [f.p[0], H.cornice + 0.06, f.p[1]], b1 = [f.q[0], H.cornice + 0.06, f.q[1]];
        pos.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(pos.map((v) => v / 5).filter((_, i) => i % 3 !== 1), 2)); // slate texture: 5 m tile
      g.computeVertexNormals();
      const apron = new THREE.Mesh(g, M.slate);
      apron.receiveShadow = true;
      add(apron, { stage: 2, order: 0.45, dur: 0.06, mode: 'appear', xray: 'ghost' });
    }
    // set-back attic storey under the dome
    add(based(ringWall(offsetPolygon(FP.domeBase, 0.1), H.cornice, H.atticTop - 0.02, 0.8, 2), M.brick), coreOpts(0.72)); // under the attic deck
    // connector wing (part of Zítek's stage house)
    add(based(mergeGeometries(openRing(offsetPolygon(southParts.connector, -0.75), (e) => Math.abs(e.n[1]) > 0.8)
      .map((path) => openWall(path, 0, H.southCornice, 0.9))), M.brick), coreOpts(0.6));

    // floors (iron beams + brick vaults → shown as slabs)
    const slabs = [];
    const northEnd = V.auditoriumBack - 1.8; // floors of the front block stop short of the auditorium ring
    // the front block's floors are cut on Zítek's axis too, so they meet the side strips without gaps
    const north = ccw(clipBox(ccw(FP.main.map(([u, v]) => bToAud(u, v))), -60, 60, -10, northEnd));
    // side strips along the auditorium and the stage house are cut in the auditorium frame
    const mainA = ccw(FP.main.map(([u, v]) => bToAud(u, v)));
    const slabsA = [];
    for (const y of [H.loggiaFloor, H.upperFloor]) {
      slabsA.push(capGeometry(north, y, true, [], 4), capGeometry(north, y - 0.45, false, [], 4));
      const wo = AUD.outerHalfWidth + AUD.wallT / 2 + 0.05; // outer face of the horseshoe wall
      for (const [u0, u1] of [[-30, -wo], [wo, 30]]) {
        const strip = clipBox(mainA, u0, u1, northEnd, V.portal);
        if (strip.length > 2) slabsA.push(capGeometry(ccw(strip), y, true, [], 4), capGeometry(ccw(strip), y - 0.45, false, [], 4));
      }
      for (const [u0, u1] of [[-30, -hw - 0.5], [hw + 0.5, 30]]) {
        const strip = clipBox(mainA, u0, u1, V.portal, V.stageBack);
        if (strip.length > 2) slabsA.push(capGeometry(ccw(strip), y + 0.6, true, [], 4));
      }
    }
    slabs.push(capGeometry(offsetPolygon(FP.loggia, -0.3), H.loggiaFloor, true, [], 4));
    add(based(mergeGeometries(slabs), M.plaster, { cast: false }), { stage: 1, order: 0.25, dur: 0.3, mode: 'appear', xray: 'ghostSoft' });
    addA(based(mergeGeometries(slabsA), M.plaster, { cast: false }), { stage: 1, order: 0.25, dur: 0.3, mode: 'appear', xray: 'ghostSoft' });

    // iron lattice girders over the auditorium (1875; steel 1882)
    const beams = [];
    const span = AUD.outerHalfWidth - 0.2; // bearing in the (thinned) upper horseshoe wall
    const [y0, y1] = AUD.girders; // 1914 section: 24.8–27.4 m, above the painted ceiling
    for (let k = 0; k < 8; k++) {
      const v = V.auditoriumBack + 1.6 + k * 2.6;
      beams.push([v3(-span, y0, v), v3(span, y0, v), 0.28]);
      beams.push([v3(-span, y1, v), v3(span, y1, v), 0.28]);
      const n = 12;
      for (let j = 0; j <= n; j++) {
        const x = -span + (2 * span * j) / n;
        beams.push([v3(x, y0, v), v3(x, y1, v), 0.12]);
        if (j < n) beams.push([v3(x, j % 2 ? y0 : y1, v), v3(-span + (2 * span * (j + 1)) / n, j % 2 ? y1 : y0, v), 0.1]);
      }
    }
    const box = new THREE.BoxGeometry(1, 1, 1);
    const girders = new THREE.InstancedMesh(box, M.ironNew, beams.length);
    const mm = new THREE.Matrix4();
    beams.forEach(([a, b, w], i) => girders.setMatrixAt(i, beamMatrix(a, b, w, w, mm)));
    girders.castShadow = true;
    const gOrders = new Float32Array(beams.length).map((_, i) => 0.84 + (Math.floor(i / (beams.length / 8)) / 8) * 0.15);
    addA(girders, { stage: 1, mode: 'drop', dropHeight: 6, orders: gOrders, xray: 'layerAlways', layer: 'structure' });
  }

  // pre-existing southern buildings: Provisional Theatre (1862) + neighbouring house
  {
    for (const key of ['prov', 'schulz']) {
      const p = offsetPolygon(southParts[key], -0.05);
      const wallGeo = key === 'prov'
        ? mergeGeometries(openRing(offsetPolygon(p, -0.42), (e) => e.n[1] < -0.8).map((path) => openWall(path, 0, H.southCornice, 0.8)))
        : ringWall(p, 0, H.southCornice, 0.8, 3);
      const walls = new THREE.Mesh(wallGeo, M.plaster);
      walls.castShadow = walls.receiveShadow = true;
      add(walls, { stage: null, xray: 'struct' });
      const oldRoof = based(hipRoofGeometry(p, H.southCornice, H.southCornice + 4.6, 5.0, 3), M.ctxRoof);
      add(oldRoof, { stage: null, remove: 2, removeOrder: 0.5, mode: 'none', xray: 'hide' });
      const floors = [];
      for (const y of [6.5, 10.8, 14.8, 18.6]) {
        // the 1983 rear stage (up to 14.4 m) and the halls above it (to 19.6 m) cut through the old floors
        const hole = key === 'prov' && y !== 14.8 ? [rect(REAR.u - REAR.half - 0.2, REAR.u + REAR.half + 0.2, V.connectorEnd - 1, REAR.v + REAR.depth / 2 + 0.2).slice().reverse()] : [];
        floors.push(capGeometry(offsetPolygon(p, -0.8), y, true, hole, 4));
      }
      const fm = new THREE.Mesh(mergeGeometries(floors), M.plaster);
      fm.receiveShadow = true;
      add(fm, { stage: null, xray: 'ghostSoft' });
    }
  }

  // ====================================================================== 2 · ROOF & DOME
  const domeBase = FP.domeBase;
  const domeTop = FP.domeTop;
  const profile = (s) => [1 - Math.cos((s * Math.PI) / 2), H.domeBase + (H.domeTop - H.domeBase) * Math.sin((s * Math.PI) / 2)];
  const domeRing = (s) => {
    const [mx, y] = profile(s);
    return domeBase.map((p, i) => [p[0] + (domeTop[i][0] - p[0]) * mx, y, p[1] + (domeTop[i][1] - p[1]) * mx]);
  };
  const domePoint = (side, t, s) => {
    const ring = domeRing(s);
    const a = ring[side], b = ring[(side + 1) % 4];
    return v3(a[0] + (b[0] - a[0]) * t, a[1], a[2] + (b[2] - a[2]) * t);
  };
  // frame members sit 0.45 m inside the slate surface
  const domeC = domeBase.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]);
  const framePoint = (side, t, s) => {
    const p = domePoint(side, t, s);
    const dx = domeC[0] - p.x, dz = domeC[1] - p.z;
    const l = Math.hypot(dx, dz) || 1;
    return v3(p.x + (dx / l) * 0.45, p.y - 0.35, p.z + (dz / l) * 0.45);
  };
  ctx.dome = { domeRing, domePoint, framePoint, profile };
  {
    // roof decks
    // the roof terrace round the attic is stone-paved (photo from the terrace; slate aprons east and west)
    const deckMain = capGeometry(offsetPolygon(FP.main, -0.5), H.cornice + 0.05, true, [offsetPolygon(domeBase, 0.3).slice().reverse()], 4);
    add(based(deckMain, M.paving, { cast: false }), { stage: 2, order: 0.0, dur: 0.1, mode: 'appear', xray: 'ghost' });
    // the loggia and the terrace survived the fire of 1881 (fx/fire.js leaves `survives` alone)
    add(based(capGeometry(offsetPolygon(FP.loggia, -0.3), H.cornice + 0.05, true, [], 4), M.paving, { cast: false }),
      { stage: 2, order: 0.0, dur: 0.1, mode: 'appear', xray: 'ghost' }).userData.survives = true;
    add(based(capGeometry(offsetPolygon(FP.terrace, -0.3), 8.65, true, [], 4), M.paving, { cast: false }),
      { stage: 2, order: 0.0, dur: 0.1, mode: 'appear', xray: 'ghost' }).userData.survives = true;
    add(based(capGeometry(offsetPolygon(domeBase, 0.1), H.atticTop, true, [], 4), M.copper, { cast: false }),
      { stage: 2, order: 0.02, dur: 0.1, mode: 'appear', xray: 'hide' });
    // skirt between the attic deck and the foot of the slate, so the iron frame does not show through
    add(based(wallGeometry(offsetPolygon(domeBase, -0.02), H.atticTop, H.domeBase + 0.05, 2), M.copper, { cast: false }),
      { stage: 2, order: 0.02, dur: 0.1, mode: 'appear', xray: 'hide' });

    // iron frame of the dome: ribs, purlins, transverse arched trusses
    const beams = [];
    const S = 8;
    for (let side = 0; side < 4; side++) {
      const a = domeBase[side], b = domeBase[(side + 1) % 4];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(3, Math.round(len / 2.6));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        for (let s = 0; s < S; s++) beams.push([framePoint(side, t, s / S), framePoint(side, t, (s + 1) / S), k === 0 ? 0.32 : 0.18, s / S]);
      }
      for (const s of [0, 0.3, 0.6, 1]) {
        for (let k = 0; k < n; k++) beams.push([framePoint(side, k / n, s), framePoint(side, (k + 1) / n, s), 0.16, s]);
      }
    }
    // transverse lattice trusses (as in the 1914 section)
    for (let k = 0; k < 11; k++) {
      const t = (k + 0.5) / 11;
      const west = (s) => framePoint(3, 1 - t, s);
      const east = (s) => framePoint(1, t, s);
      const chord = [];
      for (let s = 0; s <= 1.0001; s += 0.25) chord.push(west(s));
      for (let s = 1; s >= -0.0001; s -= 0.25) chord.push(east(s));
      for (let j = 0; j < chord.length - 1; j++) beams.push([chord[j], chord[j + 1], 0.2, 0.5]);
      const yb = 31.2;
      const pw = west(0), pe = east(0);
      beams.push([v3(pw.x, yb, pw.z), v3(pe.x, yb, pe.z), 0.22, 0.2]);
      for (let j = 1; j < chord.length - 1; j++) {
        const c = chord[j];
        beams.push([c, v3(c.x, yb, c.z), 0.08, 0.4]);
      }
    }
    const box = new THREE.BoxGeometry(1, 1, 1);
    const frame = new THREE.InstancedMesh(box, M.ironNew, beams.length);
    const mm = new THREE.Matrix4();
    beams.forEach(([p, q, w], i) => frame.setMatrixAt(i, beamMatrix(p, q, w, w, mm)));
    frame.castShadow = true;
    const orders = new Float32Array(beams.map((b) => 0.04 + b[3] * 0.4));
    add(frame, { stage: 2, mode: 'grow', orders, dur: 0.12, xray: 'layerAlways', layer: 'structure' });

    // slate cladding in rows (appears bottom → top)
    const rows = 12;
    const rings = Array.from({ length: rows + 1 }, (_, r) => domeRing(r / rows));
    // slant distance up the middle of each side, so the slate pattern runs on across the rows
    const mid = (ring, i) => { const a = ring[i], b = ring[(i + 1) % 4]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; };
    const climb = [[0, 0, 0, 0]];
    for (let r = 1; r <= rows; r++) climb.push(climb[r - 1].map((c, i) => c + Math.hypot(...mid(rings[r], i).map((q, k) => q - mid(rings[r - 1], i)[k]))));
    for (let r = 0; r < rows; r++) {
      const g = stripGeometry(rings[r], rings[r + 1], climb[r], climb[r + 1]);
      const mesh = new THREE.Mesh(g, M.slate);
      mesh.castShadow = mesh.receiveShadow = true;
      add(mesh, { stage: 2, order: 0.5 + r * 0.02, dur: 0.03, mode: 'appear', xray: 'ghost' });
    }
    // gilded band above the slate (≈1.5 m), carrying the flat copper roof with the ridge skylight
    const topY = H.crownBand;
    {
      const band = mergeGeometries([
        wallGeometry(domeTop, H.domeTop - 0.05, H.crownBand - 0.25, 3),
        wallGeometry(offsetPolygon(domeTop, 0.12), H.crownBand - 0.25, H.crownBand, 3), // projecting top moulding
        capGeometry(offsetPolygon(domeTop, 0.12), H.crownBand - 0.25, false, [domeTop.slice().reverse()], 3),
      ].map((g) => (g.index ? g.toNonIndexed() : g)));
      const bm = new THREE.Mesh(band, M.gold);
      bm.castShadow = true;
      add(bm, { stage: 2, order: 0.77, dur: 0.06, mode: 'appear', xray: 'ghost' });
    }
    add(new THREE.Mesh(capGeometry(offsetPolygon(domeTop, 0.12), topY, true, [], 4), M.copper), { stage: 2, order: 0.76, dur: 0.06, mode: 'appear', xray: 'ghost' });
    {
      const c = domeTop.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]);
      const sky = new THREE.CylinderGeometry(1, 1, 24, 3, 1);
      sky.rotateX(Math.PI / 2);
      sky.rotateZ(Math.PI);
      sky.scale(2.0, 1.1, 1);
      sky.translate(c[0], topY + 0.25, c[1]);
      const m = new THREE.Mesh(sky, M.glass);
      m.castShadow = true;
      add(m, { stage: 2, order: 0.78, dur: 0.06, mode: 'appear', xray: 'ghost' });
    }
    // gilded hip ribs
    for (let i = 0; i < 4; i++) {
      const pts = [];
      for (let s = 0; s <= 16; s++) {
        const r = domeRing(s / 16)[i];
        pts.push(v3(r[0], r[1] + 0.12, r[2]));
      }
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.2, 6, false);
      const m = new THREE.Mesh(g, M.gold);
      m.castShadow = true;
      add(m, { stage: 2, order: 0.8, dur: 0.06, mode: 'appear', xray: 'ghost' });
    }
    // gilded seams along the base and top edge of the dome
    for (const s of [0.02, 0.99]) {
      const r = domeRing(s);
      const pts = r.map((p) => v3(p[0], p[1] + 0.1, p[2]));
      pts.push(pts[0].clone());
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 64, 0.14, 5, false);
      add(new THREE.Mesh(g, M.gold), { stage: 2, order: 0.8, dur: 0.06, mode: 'appear', xray: 'ghost' });
    }
    // dormers (œil-de-bœuf with gilded frames)
    {
      const spots = [];
      const counts = [2, 4, 2, 4]; // N, E, S, W sides (domeBase order NW→NE→SE→SW); 4 on each long side (photos)
      for (let side = 0; side < 4; side++) {
        const n = counts[side];
        for (let k = 0; k < n; k++) {
          const t = (k + 1) / (n + 1);
          const p = domePoint(side, t, 0.3);
          const q = domePoint(side, t, 0.0);
          const nrm = new THREE.Vector2(q.x - p.x, q.z - p.z).normalize();
          spots.push({ p, n: nrm, order: 0.84 + 0.01 * k });
        }
      }
      const bodyG = new THREE.BoxGeometry(1.6, 1.9, 2.2);
      bodyG.translate(0, 0.6, -0.6);
      const capG = new THREE.CylinderGeometry(0.95, 0.95, 2.4, 12, 1, false, 0, Math.PI);
      capG.rotateX(Math.PI / 2);
      capG.rotateZ(Math.PI / 2);
      capG.translate(0, 1.55, -0.6);
      // photo from the terrace: dark bronze fronts, an upright oval window in a gilded frame, gilded scrolls
      // at the sides, a gilded sill and a palmette finial on the curved head
      const ringG = mergeGeometries([
        new THREE.TorusGeometry(0.42, 0.08, 6, 22).scale(1, 1.35, 1).translate(0, 0.75, 0.52),
        new THREE.TorusGeometry(0.17, 0.035, 5, 12, Math.PI * 1.3).rotateZ(-0.2).translate(-0.66, 0.98, 0.5),
        new THREE.TorusGeometry(0.17, 0.035, 5, 12, Math.PI * 1.3).rotateZ(Math.PI - 1.1).translate(0.66, 0.98, 0.5),
        new THREE.TorusGeometry(0.13, 0.035, 5, 12, Math.PI * 1.3).rotateZ(Math.PI + 0.2).translate(-0.62, 0.45, 0.5),
        new THREE.TorusGeometry(0.13, 0.035, 5, 12, Math.PI * 1.3).rotateZ(-1.1 + Math.PI * 2).translate(0.62, 0.45, 0.5),
        new THREE.BoxGeometry(1.2, 0.07, 0.12).translate(0, 0.1, 0.52),
        new THREE.SphereGeometry(0.11, 10, 8).translate(0, 2.62, -0.05),
        new THREE.ConeGeometry(0.09, 0.32, 8).translate(0, 2.85, -0.05),
      ].map((g) => (g.index ? g.toNonIndexed() : g)));
      const winG = new THREE.CircleGeometry(0.42, 18).scale(1, 1.35, 1);
      winG.translate(0, 0.75, 0.5);
      const make = (geo, mat) => new THREE.InstancedMesh(geo, mat, spots.length);
      const parts = [make(bodyG, M.iron), make(capG, M.copper), make(ringG, M.gold), make(winG, M.glass)];
      const mm = new THREE.Matrix4();
      spots.forEach((s, i) => {
        mm.makeRotationY(Math.atan2(s.n.x, s.n.y)).setPosition(s.p.x, s.p.y - 0.4, s.p.z);
        parts.forEach((pm) => pm.setMatrixAt(i, mm));
      });
      const ord = new Float32Array(spots.map((s) => s.order));
      parts.forEach((pm) => { pm.castShadow = true; add(pm, { stage: 2, mode: 'grow', orders: ord, dur: 0.08, xray: 'ghost' }); });
    }
    // the golden crown: railing of gilded rods, posts with finials, corner spires
    {
      const rods = [], posts = [];
      const rails = [];
      for (const e of edges(domeTop)) {
        const n = Math.round(e.len / 0.32);
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n;
          rods.push([e.p[0] + (e.q[0] - e.p[0]) * t, e.p[1] + (e.q[1] - e.p[1]) * t, k]);
        }
        const np = Math.round(e.len / 2.6);
        for (let k = 0; k <= np; k++) {
          const t = k / np;
          posts.push([e.p[0] + (e.q[0] - e.p[0]) * t, e.p[1] + (e.q[1] - e.p[1]) * t]);
        }
      }
      const CB = H.crownBand; // the cresting stands on the gilded band
      const rodG = new THREE.CylinderGeometry(0.035, 0.035, 1.3, 4);
      rodG.translate(0, CB + 0.75, 0);
      const leafG = new THREE.OctahedronGeometry(0.2, 0);
      leafG.scale(0.6, 1.4, 0.25);
      leafG.translate(0, CB + 1.7, 0);
      const postG = mergeGeometries([
        new THREE.CylinderGeometry(0.11, 0.14, 1.6, 6).translate(0, CB + 0.8, 0),
        new THREE.SphereGeometry(0.18, 8, 6).translate(0, CB + 1.75, 0),
        new THREE.ConeGeometry(0.07, 0.5, 6).translate(0, CB + 2.1, 0),
      ].map((g) => g.toNonIndexed()));
      // round medallions between the rods (as on the real cresting)
      const medG = new THREE.TorusGeometry(0.2, 0.035, 5, 14).translate(0, CB + 0.78, 0);
      const meds = rods.filter((r) => r[2] % 2 === 1);
      const medM = new THREE.InstancedMesh(medG, M.gold, meds.length);
      const rodM = new THREE.InstancedMesh(rodG, M.gold, rods.length);
      const leafM = new THREE.InstancedMesh(leafG, M.gold, rods.length);
      const postM = new THREE.InstancedMesh(postG, M.gold, posts.length);
      const mm = new THREE.Matrix4();
      rods.forEach(([x, z, k], i) => {
        mm.makeTranslation(x, 0, z);
        rodM.setMatrixAt(i, mm);
        mm.makeScale(1, k % 2 ? 0.7 : 1, 1).setPosition(x, k % 2 ? 0.55 : 0, z);
        leafM.setMatrixAt(i, mm);
      });
      posts.forEach(([x, z], i) => postM.setMatrixAt(i, mm.makeTranslation(x, 0, z)));
      // medallions face outwards: rotate each to its railing edge
      {
        const es = edges(domeTop);
        let mi = 0;
        for (const e of es) {
          const n = Math.round(e.len / 0.32);
          for (let k = 1; k < n; k += 2) {
            const t = (k + 0.5) / n;
            mm.makeRotationY(Math.atan2(e.n[0], e.n[1])).setPosition(e.p[0] + (e.q[0] - e.p[0]) * t, 0, e.p[1] + (e.q[1] - e.p[1]) * t);
            if (mi < meds.length) medM.setMatrixAt(mi++, mm);
          }
        }
      }
      for (const y of [CB + 0.12, CB + 1.4]) {
        const ring = domeTop.map((p) => v3(p[0], y, p[1]));
        ring.push(ring[0].clone());
        rails.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring, false, 'catmullrom', 0), 48, 0.06, 4, false));
      }
      const railM = new THREE.Mesh(mergeGeometries(rails), M.gold);
      const ordR = new Float32Array(rods.length).map((_, i) => 0.88 + (i / rods.length) * 0.08);
      add(rodM, { stage: 2, mode: 'grow', orders: ordR, dur: 0.05, xray: 'ghost' });
      add(leafM, { stage: 2, mode: 'grow', orders: ordR, dur: 0.05, xray: 'ghost' });
      add(postM, { stage: 2, mode: 'grow', orders: new Float32Array(posts.length).fill(0.9), dur: 0.06, xray: 'ghost' });
      add(medM, { stage: 2, mode: 'grow', orders: new Float32Array(meds.length).fill(0.91), dur: 0.05, xray: 'ghost' });
      add(railM, { stage: 2, order: 0.9, dur: 0.06, mode: 'appear', xray: 'ghost' });
      // corner spires
      // pedestal to ≈ 43.1, gilt ball Ø 0.75 at 43.6, shaft, small ball, spike to 46.8
      const spire = mergeGeometries([
        new THREE.CylinderGeometry(0.3, 0.42, 2.2, 8).translate(0, 1.1, 0),
        new THREE.CylinderGeometry(0.42, 0.42, 0.12, 8).translate(0, 2.26, 0),
        new THREE.CylinderGeometry(0.16, 0.24, 0.5, 8).translate(0, 2.57, 0),
        new THREE.SphereGeometry(0.38, 14, 10).translate(0, 43.6 - CB, 0),
        new THREE.CylinderGeometry(0.07, 0.15, 1.3, 8).translate(0, 43.6 - CB + 1.0, 0),
        new THREE.SphereGeometry(0.15, 10, 8).translate(0, 43.6 - CB + 1.75, 0),
        new THREE.ConeGeometry(0.06, H.spire - 43.6 - 1.85, 8).translate(0, (43.6 - CB + 1.85 + H.spire - CB) / 2, 0),
      ].map((g) => g.toNonIndexed()));
      spire.translate(0, CB, 0);
      const sp = new THREE.InstancedMesh(spire, M.gold, 4);
      domeTop.forEach((p, i) => sp.setMatrixAt(i, mm.makeTranslation(p[0], 0, p[1])));
      sp.castShadow = true;
      add(sp, { stage: 2, mode: 'grow', orders: new Float32Array([0.95, 0.96, 0.97, 0.98]), dur: 0.05, xray: 'ghost' });
    }

    // south wing (1914 elevation, photos from Petřín): the connector is covered by a flat copper deck behind the
    // balustrades; the former Provisional Theatre has an attic storey flush with the façades (cornice 26.8) with
    // its own balustrade and a copper hip roof (eaves ≈ 28, ridge ≈ 31) with a row of skylights; the Schulz house
    // a low copper hip roof (ridge ≈ 25.3) behind the balustrade on its main cornice; no dormers, no chimneys
    const conn = offsetPolygon(southParts.connector, -0.2);
    add(based(capGeometry(conn, H.southCornice + 0.2, true, [], 4), M.copper, { cast: false }), { stage: 2, order: 0.6, dur: 0.1, mode: 'appear', xray: 'ghost' });
    {
      const prov = offsetPolygon(southParts.prov, -0.05);
      add(based(ringWall(offsetPolygon(prov, -0.45), H.southCornice, H.provAttic, 0.8, 2), M.brick), { stage: 2, order: 0.62, mode: 'rise', xray: 'ghost' });
      const roofBase = offsetPolygon(prov, -0.7);
      add(based(capGeometry(offsetPolygon(prov, -0.2), H.provAttic + 0.02, true, [roofBase.slice().reverse()], 4), M.copper, { cast: false }), { stage: 2, order: 0.66, dur: 0.1, mode: 'appear', xray: 'ghost' });
      add(based(hipRoofGeometry(roofBase, 28.0, H.southRoofProv, 4.0), M.copper), { stage: 2, order: 0.7, mode: 'rise', xray: 'ghost' });
      // short knee wall from the attic cornice to the eaves
      add(based(ringWall(roofBase, H.provAttic, 28.0, 0.3, 2), M.copper), { stage: 2, order: 0.68, mode: 'rise', xray: 'ghost' });
      // skylights along the ridge
      const top = offsetPolygon(roofBase, -4.0);
      const cx = top.reduce((a, q) => a + q[0], 0) / top.length, cz = top.reduce((a, q) => a + q[1], 0) / top.length;
      const sky = [];
      for (let k = -2; k <= 2; k++) sky.push(new THREE.BoxGeometry(2.2, 0.5, 1.6).translate(cx + k * 2.6, H.southRoofProv + 0.26, cz).toNonIndexed()); // 1 cm over the ridge
      add(new THREE.Mesh(mergeGeometries(sky), M.glass), { stage: 2, order: 0.72, dur: 0.05, mode: 'appear', xray: 'ghost' });
    }
    {
      const schulz = offsetPolygon(southParts.schulz, -0.05);
      const roofBase = offsetPolygon(schulz, -1.1);
      add(based(capGeometry(offsetPolygon(schulz, -0.3), H.southCornice + 0.05, true, [roofBase.slice().reverse()], 4), M.copper, { cast: false }), { stage: 2, order: 0.6, dur: 0.1, mode: 'appear', xray: 'ghost' });
      add(based(hipRoofGeometry(roofBase, H.southCornice + 0.6, H.southRoofSchulz, 4.5), M.copper), { stage: 2, order: 0.7, mode: 'rise', xray: 'ghost' });
      add(based(ringWall(roofBase, H.southCornice, H.southCornice + 0.6, 0.3, 2), M.copper), { stage: 2, order: 0.68, mode: 'rise', xray: 'ghost' });
    }
  }

  // ====================================================================== 3 · STONE SHELL
  {
    const shellOpts = (order, dur = 0.16) => ({ stage: 3, order, dur, mode: 'rise', xray: 'ghost' });
    const masses = [
      { poly: FP.main, bands: mainBands, o: 0.0 },
      { poly: FP.loggia, bands: [[0, H.ground]], o: 0.05 },
      { poly: FP.terrace, bands: [[0, 8.6]], o: 0.04 },
    ];
    for (const { poly, bands, o } of masses) {
      const keep = poly === FP.main ? (e) => !JOINT.main(e) : poly === FP.loggia ? (e) => !JOINT.loggia(e) && e.n[1] > -0.8 : (e) => !JOINT.terrace(e);
      bands.forEach(([y0, y1], i) => {
        const mat = i === 0 ? M.rustic : M.stone;
        add(based(wallEdges(poly, y0, y1, keep, 4), mat), shellOpts(o + i * 0.14));
      });
    }
    add(based(loggiaArchedFront(0, 0.3, H.ground), M.rustic), shellOpts(0.05)); // loggia front with the porch arches
    // loggia: upper band over the arcade (front face is built in façade.js with the arcade)
    add(based(wallEdges(FP.loggia, H.piano, H.cornice, (e) => !JOINT.loggia(e), 4), M.stone), shellOpts(0.32));
    // pylon tops
    for (const p of [FP.pylonW, FP.pylonE]) {
      add(based(mergeGeometries([wallGeometry(p, H.cornice, 24.8, 4), capGeometry(p, 24.8, true, [], 4)]), M.stone), shellOpts(0.45));
    }
    // attic storey facing
    add(based(wallGeometry(offsetPolygon(domeBase, 0.25), H.cornice, H.atticTop, 4), M.stone), shellOpts(0.5));
    // south wing stone facing (Schulz unified the façades)
    const south = offsetPolygon(FP.south, 0);
    [[0, 9.3, M.rustic], [9.3, H.southCornice, M.stone]].forEach(([y0, y1, mat], i) => {
      add(based(wallEdges(south, y0, y1, (e) => !JOINT.south(e), 4), mat), shellOpts(0.58 + i * 0.08));
    });

    // cornices and string courses
    const sweep = (poly, prof, order, mat = M.trim) => add(based(sweepGeometry(poly, prof, { tile: 3 }), mat), { stage: 3, order, dur: 0.1, mode: 'appear', xray: 'ghost' });
    for (const poly of [FP.main, FP.terrace]) sweep(poly, PROFILES.plinth, 0.02);
    {
      // loggia: the plinth runs round the piers between the porch arches
      const plinthOpen = (pth) => add(based(sweepGeometry(pth, PROFILES.plinth, { tile: 3, closed: false }), M.trim), { stage: 3, order: 0.02, dur: 0.1, mode: 'appear', xray: 'ghost' });
      openRing(FP.loggia, (e) => e.n[1] < -0.8).forEach(plinthOpen);
      const f = edges(FP.loggia).find((e) => e.n[1] < -0.8);
      const cuts = LOGGIA_ARCHES(f.len).map((xc) => [xc - 1.4 - 0.05, xc + 1.4 + 0.05]);
      let s0 = 0;
      for (const [a0, a1] of cuts.concat([[f.len, f.len]])) {
        if (a0 - s0 > 0.1) plinthOpen([[f.p[0] + f.dir[0] * s0, f.p[1] + f.dir[1] * s0], [f.p[0] + f.dir[0] * a0, f.p[1] + f.dir[1] * a0]]);
        s0 = a1;
      }
    }
    sweep(FP.south, PROFILES.plinth, 0.6);
    // the string course of the main block stops where the loggia stands in front of it (its floor is at 6.6)
    const mainOpen = (() => {
      const P = FP.main, n = P.length, es = edges(P);
      const iN = es.findIndex((e) => e.n[1] < -0.8);
      const e = es[iN];
      const lx = FP.loggia.map((q) => q[0]);
      const xa = Math.min(...lx), xb = Math.max(...lx);
      const at = (x) => [x, e.p[1] + ((e.q[1] - e.p[1]) * (x - e.p[0])) / (e.q[0] - e.p[0])];
      const [aEnd, bEnd] = e.q[0] > e.p[0] ? [at(xb), at(xa)] : [at(xa), at(xb)];
      const path = [aEnd];
      for (let k = 1; k <= n; k++) path.push(P[(iN + k) % n]);
      path.push(bEnd);
      return path;
    })();
    add(based(sweepGeometry(mainOpen, PROFILES.string, { tile: 3, closed: false }), M.trim), { stage: 3, order: 0.14, dur: 0.1, mode: 'appear', xray: 'ghost' });
    sweep(FP.loggia, PROFILES.string, 0.14);
    for (const poly of [FP.main, FP.loggia]) {
      sweep(poly, PROFILES.mezz, 0.3);
      sweep(poly, PROFILES.frieze, 0.38);
      sweep(poly, PROFILES.cornice, 0.42);
    }
    // smooth facing of the loggia's back wall where the main block's rustication would show above its floor
    {
      const e = edges(FP.main).find((q) => q.n[1] < -0.8);
      const lx = FP.loggia.map((q) => q[0]);
      const xa = Math.min(...lx) + 0.4, xb = Math.max(...lx) - 0.4;
      const at = (x) => [x, e.p[1] + ((e.q[1] - e.p[1]) * (x - e.p[0])) / (e.q[0] - e.p[0])];
      const [A, B] = [at(xa), at(xb)];
      // just in front of the wall but behind the door glass (0.03), so the doors stay visible
      add(based(openWall([[A[0] + e.n[0] * 0.015, A[1] + e.n[1] * 0.015], [B[0] + e.n[0] * 0.015, B[1] + e.n[1] * 0.015]], H.loggiaFloor, H.ground + 0.45, 0.02), M.stone), shellOpts(0.2));
    }
    sweep(FP.terrace, [[0, 8.3], [0.3, 8.3], [0.36, 8.6], [0, 8.62]], 0.1);
    for (const p of [FP.pylonW, FP.pylonE]) sweep(p, [[0, 24.4], [0.25, 24.4], [0.35, 24.7], [0, 24.82]], 0.48);
    sweep(offsetPolygon(domeBase, 0.25), PROFILES.attic, 0.52);
    sweep(FP.south, PROFILES.string.map(([o, y]) => [o, y + 1.6]), 0.62);
    // Provisional Theatre: stone facing of the flush attic storey and its cornice
    {
      const prov = offsetPolygon(southParts.prov, -0.05);
      add(based(wallGeometry(prov, H.southCornice, H.provAttic, 4), M.stone), shellOpts(0.64));
      sweep(prov, PROFILES.provAttic, 0.66);
    }
    sweep(FP.south, PROFILES.southCornice, 0.72);
  }

  return ctx;
}

// Strip of the dome between two rings (outward-facing quads, UV in metres). u is measured from the middle of
// each side and v up the slope (v0s/v1s: slant distance of each side's lower/upper ring), so the slate pattern
// keeps its true size and runs on unbroken from row to row.
function stripGeometry(r0, r1, v0s, v1s) {
  const pos = [], uv = [];
  const tile = 5; // slate texture: one tile = 5 m
  const n = r0.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = r0[i], b = r0[j], c = r1[j], d = r1[i];
    const w0 = Math.hypot(b[0] - a[0], b[2] - a[2]) / 2 / tile, w1 = Math.hypot(c[0] - d[0], c[2] - d[2]) / 2 / tile;
    const v0 = v0s[i] / tile, v1 = v1s[i] / tile;
    // a, c, b / a, d, c  → outward
    pos.push(...a, ...c, ...b, ...a, ...d, ...c);
    uv.push(-w0, v0, w1, v1, w0, v0, -w0, v0, -w1, v1, w1, v1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
