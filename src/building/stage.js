// Stage machinery (stage 5). Numbers from ND "Stage Equipment" (2021) and the 1:50 drawings:
// 8 primary lifts (2 × 7.25 m halves, +3.5 / −3.65 m), revolving stage Ø 14 m stored as a cassette,
// 6 orchestra-pit lifts, 30 motorised + 20 manual fly bars, galleries at +8.52 / +10.82 / +14.42 m,
// lighting bridge +8.03 m, iron curtain 12 × 12 m (1923) and the second iron curtain (1983).
import * as THREE from 'three/webgpu';
import { H, V, STAGE, FLY, REAR } from '../config.js';
import { beamMatrix, mergeGeometries } from '../core/geom.js';
import { rect } from './util.js';
import { capGeometry } from '../core/geom.js';
import { loadTex } from '../core/materials.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildStage(ctx) {
  const { M, R } = ctx;
  const root = ctx.audRoot ?? ctx.root;
  const S = 5;
  const F = STAGE.floor;
  const reg = (o, opts) => { root.add(o); return R.add(o, { stage: S, xray: 'layerAlways', layer: 'stage', ...opts }); };
  ctx.ticks ??= [];

  // ------------------------------------------------------------------ side stages and rear stage floors
  {
    const floors = [
      capGeometry(rect(-STAGE.houseHalfWidth + 0.5, -7.4, V.portal + 0.7, V.stageBack - 0.5), F, true, [], 4),
      capGeometry(rect(7.4, STAGE.houseHalfWidth - 0.5, V.portal + 0.7, V.stageBack - 0.5), F, true, [], 4),
    ];
    const m = new THREE.Mesh(mergeGeometries(floors), M.stageFloor);
    m.receiveShadow = true;
    root.add(m);
    R.add(m, { stage: S, order: 0.02, mode: 'appear', dur: 0.05, xray: 'keep' });
    // rear stage in the former Provisional Theatre (building frame)
    const rear = new THREE.Mesh(capGeometry(rect(REAR.u - REAR.half, REAR.u + REAR.half, V.stageBack - 0.2, REAR.v + REAR.depth / 2), F, true, [], 4), M.stageFloor);
    rear.receiveShadow = true;
    ctx.root.add(rear);
    R.add(rear, { stage: S, order: 0.02, mode: 'appear', dur: 0.05, xray: 'keep' });
  }

  // ------------------------------------------------------------------ lift tables with hydraulic rams
  const lifts = [];
  {
    const z0 = V.portal + 2.0, z1 = V.stageBack - 1.1;   // inside the pit tank, behind the lighting towers
    const pitch = (z1 - z0) / 8;                         // 8 tables (each of two 7.25 m halves)
    const tableG = mergeGeometries([
      new THREE.BoxGeometry(STAGE.width, 0.38, pitch - 0.06).translate(0, -0.19, 0),
      new THREE.BoxGeometry(STAGE.width - 0.4, 1.6, 0.18).translate(0, -1.2, 0),
    ].map((g) => g.toNonIndexed()));
    const ramG = new THREE.CylinderGeometry(0.22, 0.22, 1, 10).translate(0, -0.5, 0);
    for (let i = 0; i < 8; i++) {
      const v = z0 + (i + 0.5) * pitch;
      const g = new THREE.Group();
      const top = new THREE.Mesh(tableG, M.stageFloor);
      top.castShadow = top.receiveShadow = true;
      g.add(top);
      for (const u of [-4.5, 4.5]) {
        const ram = new THREE.Mesh(ramG, M.steel);
        ram.position.set(u, -0.4, 0);
        ram.scale.y = F - H.pitBottom - 0.4;
        g.add(ram);
      }
      g.position.set(0, F, v);
      reg(g, { order: 0.05 + i * 0.04, mode: 'slide', dropHeight: 7, dur: 0.18 });
      lifts.push(g);
    }
    // pit floor and hydraulic power unit under the rear stage
    const pit = new THREE.Mesh(capGeometry(rect(-7.6, 7.6, V.portal + 0.6, V.stageBack - 0.6), H.pitBottom, true, [], 3), M.concrete);
    root.add(pit);
    R.add(pit, { stage: 0, order: 0.6, mode: 'appear', xray: 'keep' });
    const hyd = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.6, 16).rotateZ(Math.PI / 2), M.steel);
      tank.position.set(REAR.u - 4 + k * 2.7, -3.4, REAR.v - 1);
      const motor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 1.2), M.iron);
      motor.position.set(REAR.u - 4 + k * 2.7, -3.8, REAR.v + 0.6);
      hyd.add(tank, motor);
    }
    // the hydraulics room lies under the rear stage, in the building frame
    ctx.root.add(hyd);
    R.add(hyd, { stage: S, xray: 'layerAlways', layer: 'stage', order: 0.02, mode: 'grow', dur: 0.1 });
  }

  // ------------------------------------------------------------------ orchestra pit (6 lifts, opera position −2.61 m)
  {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.3, 4.6), M.parquet);
      t.position.set(-5.75 + i * 2.3, F - 2.61, V.portal - 3.1);
      t.receiveShadow = true;
      g.add(t);
    }
    const walls = new THREE.Mesh(mergeGeometries([
      new THREE.BoxGeometry(14.2, 3.2, 0.25).translate(0, F - 1.2, V.portal - 5.5),
      new THREE.BoxGeometry(0.25, 3.2, 5.2).translate(-7.1, F - 1.2, V.portal - 3),
      new THREE.BoxGeometry(0.25, 3.2, 5.2).translate(7.1, F - 1.2, V.portal - 3),
    ].map((x) => x.toNonIndexed())), M.boxWall);
    g.add(walls);
    // music stands as a hint of the orchestra
    const stands = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.05, 0.35).translate(0, 1.1, 0), M.iron, 30);
    for (let k = 0; k < 30; k++) stands.setMatrixAt(k, new THREE.Matrix4().makeRotationX(-0.6).setPosition(-6 + (k % 10) * 1.3, F - 2.45, V.portal - 4.6 + Math.floor(k / 10) * 1.3));
    g.add(stands);
    reg(g, { order: 0.3, mode: 'slide', dropHeight: 4, dur: 0.15 });
  }

  // ------------------------------------------------------------------ revolving stage cassette in the rear stage
  {
    const g = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.4, 11.6), M.stageFloor); // cassette 11 × 12 m
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, 0.44, 48), M.parquet);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.08, 6, 64).rotateX(Math.PI / 2), M.stucco);
    ring.position.y = 0.23;
    g.add(plate, disc, ring);
    g.position.set(REAR.u, F + 0.2, REAR.v);
    ctx.root.add(g);
    R.add(g, { stage: S, xray: 'layerAlways', layer: 'stage', order: 0.45, mode: 'grow', dur: 0.12 });
    ctx.ticks.push((dt) => { disc.rotation.y += dt * 0.12; });
  }

  // ------------------------------------------------------------------ fly tower: grid, galleries, bars, flats
  const flyTop = F + STAGE.grid; // ≈ 28.5
  {
    const beams = [];
    // grid inside the fly tower (it stays under the dome: u ±9.6, v up to 48.9 m)
    const gu = FLY.half - 1.0, gv = FLY.back - 0.6;
    for (let k = 0; k <= 9; k++) {
      const v = V.portal + 1.0 + k * (gv - V.portal - 1.0) / 9;
      beams.push([v3(-gu, flyTop, v), v3(gu, flyTop, v), 0.22]);
    }
    for (const u of [-gu, -5.4, -1.8, 1.8, 5.4, gu]) beams.push([v3(u, flyTop + 0.3, V.portal + 1), v3(u, flyTop + 0.3, gv), 0.3]);
    // galleries on both side walls
    for (const y of STAGE.galleries) {
      for (const s of [-1, 1]) {
        const u = s * (STAGE.houseHalfWidth - 1.3);
        beams.push([v3(u, F + y, V.portal + 1), v3(u, F + y, V.stageBack - 0.8), 1.6]);
        beams.push([v3(u - s * 0.8, F + y + 1.0, V.portal + 1), v3(u - s * 0.8, F + y + 1.0, V.stageBack - 0.8), 0.06]);
      }
    }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.steel, beams.length);
    const mm = new THREE.Matrix4();
    beams.forEach(([a, b, w], i) => im.setMatrixAt(i, beamMatrix(a, b, w, w > 1 ? 0.12 : w, mm)));
    im.castShadow = true;
    reg(im, { mode: 'grow', dur: 0.1, orders: new Float32Array(beams.length).fill(0.5) });
  }
  const bars = [];
  {
    const pipeG = new THREE.CylinderGeometry(0.05, 0.05, STAGE.width, 6).rotateZ(Math.PI / 2);
    const cableG = new THREE.CylinderGeometry(0.012, 0.012, 1, 3).translate(0, 0.5, 0);
    const flatG = new THREE.PlaneGeometry(STAGE.width - 0.6, 1, 1, 1).translate(0, -0.5, 0);
    const flatMats = [
      new THREE.MeshStandardNodeMaterial({ map: loadTex('tex_backdrop_landscape.jpg'), roughness: 0.95, side: THREE.DoubleSide }),
      new THREE.MeshStandardNodeMaterial({ map: loadTex('tex_backdrop_temple.jpg'), roughness: 0.95, side: THREE.DoubleSide }),
      new THREE.MeshStandardNodeMaterial({ color: '#141210', roughness: 1, side: THREE.DoubleSide }),
    ];
    for (let i = 0; i < 30; i++) {
      const v = V.portal + 1.3 + i * (FLY.back - 0.8 - V.portal - 1.3) / 29; // inside the fly tower, clear of the iron curtain
      const g = new THREE.Group();
      const pipe = new THREE.Mesh(pipeG, M.steel);
      g.add(pipe);
      for (const u of [-6, -2, 2, 6]) {
        const c = new THREE.Mesh(cableG, M.iron);
        c.position.x = u;
        c.name = 'cable';
        g.add(c);
      }
      // scenery: borders (black), painted flats, lighting battens
      let hangH = 0;
      if (i % 5 === 0) {
        const b = new THREE.Mesh(flatG, flatMats[2]);
        b.scale.y = 2.2; hangH = 2.2;
        g.add(b);
      } else if (i % 7 === 3) {
        const f = new THREE.Mesh(flatG, flatMats[i % 2]);
        f.scale.y = 7; hangH = 7;
        g.add(f);
      } else if ([4, 12, 19, 26].includes(i)) { // four lighting battens
        const lamps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.22, 0.45, 8), M.iron, 12);
        for (let k = 0; k < 12; k++) lamps.setMatrixAt(k, new THREE.Matrix4().makeRotationX(0.6).setPosition(-6.6 + k * 1.2, -0.3, 0));
        g.add(lamps);
      }
      const home = 14 + ((i * 37) % 11);
      g.position.set(0, F + home, v);
      g.userData = { home, hangH };
      reg(g, { order: 0.55 + i * 0.012, mode: 'drop', dropHeight: 10, dur: 0.12 });
      bars.push(g);
    }
    const setCables = () => {
      for (const g of bars) {
        const len = flyTop - g.position.y;
        g.children.forEach((c) => { if (c.name === 'cable') c.scale.y = Math.max(0.1, len); });
      }
    };
    setCables();
    ctx.setCables = setCables; // called by the demo motion only while the bars move
    // while the bars drop into place (registry 'drop' moves them), keep the cables ending at the grid
    let dropping = false;
    R.hook((T) => {
      const now = T > S && T < S + 1;
      if (now || dropping) setCables();
      dropping = now;
    });
  }

  // ------------------------------------------------------------------ lighting bridge and towers (layer: lighting)
  {
    const g = new THREE.Group();
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.8, 1.4), M.steel);
    bridge.position.set(0, F + STAGE.bridge, V.portal + 1.2); // clear of the curtain line (portal + 0.3)
    g.add(bridge);
    for (const s of [-1, 1]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.9, STAGE.bridge, 1.2), M.steel);
      tower.position.set(s * STAGE.portalWidth / 2, F + STAGE.bridge / 2, V.portal + 1.2);
      g.add(tower);
    }
    // spotlights: dark housings with a small warm lens
    const lensMat = new THREE.MeshStandardNodeMaterial({ color: '#fff2d8', emissive: '#ffd9a0', emissiveIntensity: 0.9 });
    const housing = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.2, 0.5, 10), M.iron, 26);
    const lens = new THREE.InstancedMesh(new THREE.CircleGeometry(0.11, 12).rotateX(Math.PI / 2).translate(0, -0.26, 0), lensMat, 26);
    let k = 0;
    const put = (m) => { housing.setMatrixAt(k, m); lens.setMatrixAt(k, m); k++; };
    for (let i = 0; i < 14; i++) put(new THREE.Matrix4().makeRotationX(0.7).setPosition(-6 + i * 0.92, F + STAGE.bridge - 0.6, V.portal + 1.2));
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) put(new THREE.Matrix4().makeRotationZ(-s * 1.2).setPosition(s * (STAGE.portalWidth / 2 - 0.2), F + 1.2 + i * 1.2, V.portal + 1.2));
    g.add(housing, lens);
    root.add(g);
    R.add(g, { stage: S, order: 0.7, mode: 'grow', dur: 0.1, xray: 'layerAlways', layer: 'lighting' });
  }

  // ------------------------------------------------------------------ iron curtains (layer: fire)
  {
    const iron = new THREE.Mesh(new THREE.BoxGeometry(12.6, 12, 0.3), M.iron);
    iron.position.set(0, F + 12 + 6.2, V.portal + 0.95);
    root.add(iron);
    R.add(iron, { stage: S, order: 0.35, mode: 'drop', dropHeight: 6, dur: 0.12, xray: 'layerAlways', layer: 'fire' });
    const iron2 = new THREE.Mesh(new THREE.BoxGeometry(12.2, 10.6, 0.3), M.iron);
    iron2.position.set(0, H.cornice - 0.1 - 5.3, V.stageBack + 0.2); // stored up, top under the cornice
    root.add(iron2);
    R.add(iron2, { stage: S, order: 0.38, mode: 'drop', dropHeight: 6, dur: 0.12, xray: 'layerAlways', layer: 'fire' });
    ctx.ironCurtain = iron;
  }

  // ------------------------------------------------------------------ demo motion while the stage stop is shown
  let clock = 0;
  ctx.ticks.push((dt, T, state) => {
    const active = T > 5.95 && state?.lastStop === 6;
    clock += dt;
    const amp = active ? 1 : 0;
    lifts.forEach((g, i) => {
      const it = g.userData.item;
      if (!it || it.e < 0.999) return;
      const target = F + amp * Math.sin(clock * 0.6 + i * 0.7) * 1.4;
      g.position.y += (target - g.position.y) * Math.min(1, dt * 2);
    });
    let moved = false;
    bars.forEach((g, i) => {
      const it = g.userData.item;
      if (!it || it.e < 0.999) return;
      // bars travel up to 24 m above the stage (grid at 25.5 m)
      const target = F + Math.min(24, g.userData.home + amp * Math.sin(clock * 0.35 + i * 1.3) * 3.5);
      const dy = (target - g.position.y) * Math.min(1, dt * 1.5);
      if (Math.abs(dy) > 1e-4) { g.position.y += dy; moved = true; }
    });
    if (moved) ctx.setCables();
  });
  return ctx;
}
