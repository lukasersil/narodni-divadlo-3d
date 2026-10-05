// Timber scaffolding and derrick cranes: rise with the walls (stage 1), stay through the roof
// and façade work, and are struck during completion (stage 6).
import * as THREE from 'three/webgpu';
import { FP, H, bToWorld } from '../config.js';
import { edges, beamMatrix, pointInPolygon } from '../core/geom.js';
import { makeTerrain } from '../site.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// polygon offset with its own distance per edge (outOf(edge)); corners where the offset lines meet
function offsetVar(poly, outOf) {
  const lines = edges(poly).map((e) => { const d = outOf(e); return { p: [e.p[0] + e.n[0] * d, e.p[1] + e.n[1] * d], dir: e.dir }; });
  return lines.map((B, i) => {
    const A = lines[(i - 1 + lines.length) % lines.length];
    const den = A.dir[0] * B.dir[1] - A.dir[1] * B.dir[0];
    if (Math.abs(den) < 1e-6) return B.p;
    const t = ((B.p[0] - A.p[0]) * B.dir[1] - (B.p[1] - A.p[1]) * B.dir[0]) / den;
    return [A.p[0] + A.dir[0] * t, A.p[1] + A.dir[1] * t];
  });
}

export function buildScaffold(ctx) {
  const { root, M, R } = ctx;
  const poles = [], ledgers = [], boards = [];

  // `others`: neighbouring masses [{ poly, top }] – no scaffolding inside them below their top
  // (the loggia, the terrace wing, the connector to the stage house)
  // `out` is the distance of the inner pole line from the wall: a number, or a function of the edge
  function ring(poly, y0, y1, out, startOrder, span, others = []) {
    const outOf = typeof out === 'function' ? out : () => out;
    const inner = offsetVar(poly, outOf);
    const outer = offsetVar(poly, (e) => outOf(e) + 1.3);
    const lifts = Math.floor((y1 - y0) / 2.0);
    const topAt = (x, z) => others.reduce((t, o) => (pointInPolygon(x, z, o.poly) ? Math.max(t, o.top) : t), -Infinity);
    const free = (a, b) => (a.y + b.y) / 2 > topAt((a.x + b.x) / 2, (a.z + b.z) / 2);
    const push = (list, item) => { if (free(item[0], item[1])) list.push(item); };
    for (const [line, isOuter] of [[inner, false], [outer, true]]) {
      for (const e of edges(line)) {
        const n = Math.max(1, Math.round(e.len / 2.6));
        for (let k = 0; k <= n; k++) {
          const t = k / n;
          const x = e.p[0] + (e.q[0] - e.p[0]) * t, z = e.p[1] + (e.q[1] - e.p[1]) * t;
          const base = Math.max(y0, topAt(x, z)); // poles stand on a lower roof next door
          if (base < y1) poles.push([v3(x, base, z), v3(x, y1 + 1.2, z), 0.12, startOrder]);
        }
        for (let l = 1; l <= lifts; l++) {
          const y = y0 + l * 2.0;
          const o = startOrder + (l / lifts) * span;
          push(ledgers, [v3(e.p[0], y, e.p[1]), v3(e.q[0], y, e.q[1]), 0.09, o]);
          if (!isOuter) continue;
          // diagonal bracing on the outer face every other lift
          if (l % 2 === 0) push(ledgers, [v3(e.p[0], y - 2, e.p[1]), v3(e.q[0], y, e.q[1]), 0.06, o]);
        }
      }
    }
    // plank decks between the two pole lines
    for (let l = 1; l <= lifts; l++) {
      const y = y0 + l * 2.0;
      const ei = edges(inner), eo = edges(outer);
      ei.forEach((e, i) => {
        const f = eo[i];
        if (!f) return;
        const a = v3((e.p[0] + f.p[0]) / 2, y + 0.06, (e.p[1] + f.p[1]) / 2);
        const b = v3((e.q[0] + f.q[0]) / 2, y + 0.06, (e.q[1] + f.q[1]) / 2);
        push(boards, [a, b, 1.1, startOrder + (l / lifts) * span]);
      });
    }
  }
  // The inner poles stand clear of everything that projects from the walls once the façade is set (stage 3):
  // the main cornice (1.32 m), the west balcony (1.1 m), the loggia columns (1.23 m), and on the east the arcade
  // gallery with its balcony (2.55 m); round the attic its cornice and the balustrade at the foot of the dome.
  const ALL = Infinity;
  ring(FP.main, 0, H.cornice + 1, (e) => (e.n[0] > 0.8 ? 2.8 : 1.5), 0.02, 0.85, [{ poly: FP.loggia, top: ALL }, { poly: FP.terrace, top: 8.7 }, { poly: FP.south, top: ALL }]);
  ring(FP.loggia, 0, H.cornice + 1, 1.5, 0.05, 0.8, [{ poly: FP.main, top: ALL }]);
  ring(FP.domeBase, H.cornice, H.atticTop + 2, 1.1, 0.75, 0.2);

  const box = new THREE.BoxGeometry(1, 1, 1);
  const build = (list, mat, thin = true) => {
    const im = new THREE.InstancedMesh(box, mat, list.length);
    const m = new THREE.Matrix4();
    list.forEach(([a, b, w], i) => im.setMatrixAt(i, beamMatrix(a, b, w, thin ? w : 0.06, m)));
    im.castShadow = true;
    R.add(im, { stage: 1, mode: 'grow', dur: 0.08, orders: new Float32Array(list.map((x) => x[3])), remove: 6, xray: 'hide' });
    root.add(im);
  };
  // poles appear progressively as the lifts go up: order by height bucket
  build(poles.map(([a, b, w, o]) => [a, b, w, o]), M.wood);
  build(ledgers, M.wood);
  build(boards, M.woodDark, false);

  // Two timber stiff-leg derricks (local +x towards the building): a mast held by two raking back legs on
  // ground sills, a boom hinged at the mast foot and luffed by a topping lift from the mast head, the hoist rope
  // with a stone block. They stand clear of the walls and land their loads on the scaffold decks, so neither the
  // boom nor any rope reaches over the building at any stage.
  const stick = (a, b, r, mat) => {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, len, 8), mat);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return m;
  };
  const terrain = makeTerrain();
  const ground = (u, v) => { const w = bToWorld(u, 0, v); return (terrain.height(w.x, w.z) ?? 0) + 0.06; };
  const derrick = (x, z, yaw, reach, spread, leg, order) => {
    const g = new THREE.Group();
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const toB = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c]; // local (x, z) → building frame
    const y0 = ground(x, z);
    const MAST = 30, TIP = 27.5, LOAD = 15;
    const head = v3(0, y0 + MAST, 0), foot = v3(0.5, y0 + 1.2, 0), tip = v3(reach, TIP, 0);
    g.add(stick(v3(0, y0, 0), head, 0.28, M.woodDark));                   // mast
    g.add(stick(foot, tip, 0.2, M.woodDark));                              // boom
    g.add(stick(head, tip, 0.03, M.iron));                                 // topping lift
    g.add(stick(tip, v3(reach, LOAD + 0.45, 0), 0.025, M.iron));           // hoist rope
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.9), M.trim);
    block.position.set(reach, LOAD, 0);
    g.add(block);
    const winch = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.0), M.woodDark);
    winch.position.set(-1.6, ground(...toB(-1.6, 0)) + 0.45, 0);
    g.add(winch);
    for (const sgn of [-1, 1]) {
      const ax = -Math.cos(spread) * leg, az = sgn * Math.sin(spread) * leg;
      const anchor = v3(ax, ground(...toB(ax, az)) + 0.15, az);
      g.add(stick(anchor, v3(0, y0 + MAST - 0.6, 0), 0.2, M.woodDark));  // back leg
      g.add(stick(v3(0, y0 + 0.15, 0), anchor, 0.16, M.woodDark));         // sill
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    root.add(g);
    R.add(g, { stage: 1, order, mode: 'rise', dur: 0.15, remove: 4, removeOrder: 0.1, xray: 'hide' });
  };
  // west, on the embankment street (12 m wide, the river wall at u ≈ −34.5): legs kept on the street
  derrick(-27.5, 33, 0, 6.0, 1.1, 10, 0.05);
  // east, in Divadelní: open ground behind it
  derrick(33, 40, Math.PI - 0.12, 8.7, 0.87, 16, 0.1);
  return ctx;
}
