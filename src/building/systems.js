// Building services for the X-ray layers. Sources: TOPIN series (Mužík 2023–25), Šubert 1883,
// ND Stage Technology, ENESA/EPC 2007–2010, ND energy-centre news (2026). Positions are schematic
// where the documents give only the room, marked "⚠️" in podklady/05_…/technologie_a_infrastruktura.md.
import * as THREE from 'three/webgpu';
import { FRAME, H, V, STAGE, AUD, FP, FLY, REAR, audToB, hsPath, hsHalfWidth } from '../config.js';
import { layerMaterial } from '../core/materials.js';
import { LAYERS } from '../data/content.js';
import { mergeGeometries, edges, offsetPolygon } from '../core/geom.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// world → building frame
function wb(x, y, z) {
  const c = Math.cos(FRAME.rotationY), s = Math.sin(FRAME.rotationY);
  const dx = x - FRAME.origin.x, dz = z - FRAME.origin.z;
  return v3(dx * c - dz * s, y, dx * s + dz * c);
}

function polyPath(points) {
  const path = new THREE.CurvePath();
  for (let i = 0; i < points.length - 1; i++) path.add(new THREE.LineCurve3(points[i], points[i + 1]));
  return path;
}

function tube(points, r) {
  const path = polyPath(points);
  const len = path.getLength();
  return { geo: new THREE.TubeGeometry(path, Math.max(8, Math.round(len / 0.6)), r, 8, false), len };
}

export function buildSystems(ctx) {
  const { root, M, R } = ctx;
  const color = Object.fromEntries(LAYERS.map((l) => [l.id, l.color]));
  const mats = {};
  const solid = (id) => (mats[id] ??= layerMaterial(color[id]));
  const glass = (id) => {
    if (mats['g' + id]) return mats['g' + id];
    const m = layerMaterial(color[id], { opacity: 0.22 });
    m.depthWrite = false;
    m.side = THREE.DoubleSide;
    return (mats['g' + id] = m);
  };
  const add = (obj, layer, order = 0.1) => {
    root.add(obj);
    R.add(obj, { stage: 6, order, mode: 'appear', dur: 0.05, xray: 'layer', layer });
    return obj;
  };
  const duct = (layer, points, r = 0.35, repeat) => {
    const { geo, len } = tube(points, r);
    return add(new THREE.Mesh(geo, layerMaterial(color[layer], { flow: true, repeat: repeat ?? Math.max(2, len / 3) })), layer);
  };
  const box = (layer, x, y, z, w, h, d, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat ?? solid(layer));
    m.position.set(x, y, z);
    return add(m, layer);
  };
  const CV = AUD.cv, CC = AUD.ceilingCentre; // horseshoe centre, chandelier
  const aud = (obj) => { (ctx.audRoot ?? root).add(obj); return obj; }; // follows Zítek's axis
  const ab = (u, y, v) => { const [x, z] = audToB(u, v); return v3(x, y, z); }; // auditorium-frame point in the building frame
  const RS = REAR.v, RU = REAR.u; // centre of the rear stage (11 × 12 m, former Provisional Theatre, on the stage axis)
  const F_BRIDGE = STAGE.floor + STAGE.bridge; // lighting bridge

  // ------------------------------------------------------------------ HVAC
  {
    const g = glass('hvac');
    // 1883 (Kelling): air drawn through tunnels from the Vltava into the cellars …
    duct('hvac', [v3(-40, -4.2, 21), v3(-20, -4.2, 21), v3(-12, -4.2, 21), v3(-12, -3.4, 6), v3(-6, -3.4, 3)], 0.75, 10);
    // … moved by a steam-driven fan under the vestibule ("parní stroj", "ventilátor" in the 1883 cellar plan)
    box('hvac', -4.5, -3.2, 2.2, 3.2, 2.0, 2.4);
    const fan = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.16, 8, 20), solid('hvac'));
    fan.position.set(-1.6, -2.9, 2.2);
    fan.rotation.y = Math.PI / 2;
    add(fan, 'hvac');
    box('hvac', 3.5, -2.6, 3.0, 7, 2.6, 4.2, g);                  // warming chamber under the vestibule
    duct('hvac', [v3(3.5, -3.0, 5.0), v3(0, -3.0, 10), v3(0, -2.6, 17)], 0.7, 6);
    // two chambers under the auditorium: "topení a ventilace" (cellar) and the mixing room (ground floor)
    const hs = (y0, y1) => {
      // under the stalls, following the horseshoe of the parapets
      const r = AUD.innerHalfWidth - 0.4;
      const pts = hsPath(r, AUD.k, V.portal - 2.4, 24).map(([x, z]) => new THREE.Vector2(x, -z));
      const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: y1 - y0, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, y0, 0);
      return geo;
    };
    aud(add(new THREE.Mesh(hs(-4.2, -0.4), g), 'hvac'));
    aud(add(new THREE.Mesh(hs(0.3, 2.3), g), 'hvac'));
    duct('hvac', [v3(0, -2.6, 17), v3(0, -1.0, 20), v3(0, 0.9, 22)], 0.55, 4);
    // outlets under the seats of the stalls (floor rakes from 2.3 at the pit to ≈3.1 at the back)
    const outs = [];
    for (let r = 0; r < 8; r++) {
      const v = V.portal - 6.4 - r * 1.75;
      const half = hsHalfWidth(v, AUD.innerHalfWidth) - 0.8;
      for (let x = -half; x <= half + 1e-6; x += 1.2) outs.push(new THREE.Matrix4().makeTranslation(x, 2.3 + (V.portal - 5.6 - v) * 0.059 - 0.3, v));
    }
    const outlets = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 6), solid('hvac'), outs.length);
    outs.forEach((m, i) => outlets.setMatrixAt(i, m));
    aud(add(outlets, 'hvac'));
    // exhaust through the chandelier rose to the lantern on the dome
    aud(duct('hvac', [v3(0, AUD.ceiling + 1.2, CC), v3(0, 31, CC), v3(0, H.domeTop + 0.4, 28)], 0.9, 6));
    // 1983: air-handling plant under the roof of the former Provisional Theatre, above the ballet and
    // multi-purpose halls over the rear stage (TOPIN cutaway); more units under the other roofs
    box('hvac', RU, 22.2, RS, 12, 4.0, 11.6, g);
    for (let i = 0; i < 3; i++) box('hvac', RU - 3.8 + i * 3.8, 21.4, RS, 3.0, 2.0, 7.5);
    box('hvac', 2, 25.6, 66, 8, 2.0, 6);
    box('hvac', 6, 23.6, 86, 7, 1.8, 5);
    box('hvac', 0, -7.4, 62, 10, 2.2, 5);                          // 2nd basement units
    // supply along the east corridors under the cornice into the void above Ženíšek's ceiling
    duct('hvac', [v3(RU, 21.2, RS - 3), v3(RU, 21.2, 53.6), v3(14.4, 21.2, 53.6), v3(14.4, 20.7, 53.6), v3(14.4, 20.7, 30), v3(11.4, 20.7, 30), v3(11.4, AUD.ceiling + 1.4, 30), v3(4, AUD.ceiling + 1.4, 30)], 0.7);
    duct('hvac', [v3(RU - 4, 21.2, RS - 3), v3(-12.6, 21.2, RS - 3), v3(-12.6, 6.4, RS - 3), v3(-12.6, 6.4, 40)], 0.55);
    duct('hvac', [v3(0, -6.2, 62), v3(15, -6.2, 50), v3(15, -6.2, 30), v3(15, 2, 26)], 0.6);
  }

  // ------------------------------------------------------------------ electrical
  {
    // main switchboard (ground floor) and cable room (basement) of the former Schulz house
    const cab = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 2.2, 0.6), solid('electric'), 10);
    for (let i = 0; i < 10; i++) cab.setMatrixAt(i, new THREE.Matrix4().makeTranslation(3 + i * 0.85, 1.1, 89));
    add(cab, 'electric');
    box('electric', 6, -2.2, 86, 12, 3.2, 10, glass('electric'));
    // trays: switchboard → east corridor → stage riser → grid / lighting bridge / chandelier
    duct('electric', [v3(7, -1.2, 86), v3(15, -1.2, 80), v3(15, -1.2, 46), v3(14.2, 2, 46), v3(14.2, 20.6, 46), ab(10, 20.6, 45.6), ab(10, 28, 45.6), ab(5, 28.6, 42)], 0.18);
    duct('electric', [v3(14.2, F_BRIDGE, 46), v3(14.2, F_BRIDGE, 40), ab(STAGE.portalWidth / 2 + 0.6, F_BRIDGE, V.portal + 1)], 0.14);
    duct('electric', [v3(14.2, 20.6, 40), v3(13.6, 20.6, 30), v3(13.6, AUD.girders[0], 30), ab(0, AUD.girders[0], CC), ab(0, AUD.ceiling + 1.2, CC)], 0.14);
    duct('electric', [v3(15, -1.2, 60), v3(-14, -1.2, 60), v3(-14, -1.2, 10), v3(-14, 8, 6)], 0.14);
    // 1883: "strojírna pro elektrické osvětlení" on the ground floor of the former Provisional Theatre
    // (Fialka's plan) – seven dynamos and three steam engines; the scenery store is there today
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const dyn = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 16).rotateX(Math.PI / 2), solid('electric'));
      dyn.position.set(-5.4 + i * 1.8, 0.85, 62);
      g.add(dyn);
    }
    for (let i = 0; i < 3; i++) {
      const eng = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 3), solid('electric'));
      eng.position.set(-4 + i * 4, 1.0, 67);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.12, 6, 20), solid('electric'));
      wheel.position.set(-4 + i * 4 + 1.1, 1.3, 67);
      wheel.rotation.y = Math.PI / 2;
      g.add(eng, wheel);
    }
    add(g, 'electric');
  }

  // ------------------------------------------------------------------ water
  {
    // historic iron tanks above the proscenium (1881)
    aud(box('water', -4, 30.6, V.portal + 0.8, 3.4, 1.6, 2.2));
    aud(box('water', 4, 30.6, V.portal + 0.8, 3.4, 1.6, 2.2));
    aud(duct('water', [v3(-4, 29.8, V.portal + 0.8), v3(-4, 27.8, V.portal + 1.4), v3(4, 27.8, V.portal + 1.4), v3(4, 29.8, V.portal + 0.8)], 0.1));
    // fire-water tank and pumps in the basement
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.6, 20), solid('water'));
    tank.position.set(-10, -6.8, 58);
    add(tank, 'water');
    box('water', -7, -7.6, 58, 1.4, 1, 1);
    duct('water', [v3(-7, -7.2, 58), v3(-12.6, -7.2, 50), v3(-12.6, 20.4, 50), ab(-9.6, 20.4, 47.5), ab(-9.6, 27.2, 47.5), ab(-7, 27.3, 46)], 0.14);
    // river water to the heat pumps in the energy centre (since 2007)
    const pts = [wb(-44, -5.6, 2), wb(-20, -5.6, 2), wb(-20, -7.5, 8), wb(30, -7.5, 18), wb(70, -9, 10), wb(88, -15.5, 4)];
    duct('water', pts, 0.45, 20);
    duct('water', pts.map((p) => p.clone().add(v3(0, 1.1, 0))), 0.45, 20);
  }

  // ------------------------------------------------------------------ fire safety
  {
    // drencher grid above the stage
    const dz = (FLY.back - 0.8 - V.portal - 1.6) / 5;
    for (let k = 0; k < 6; k++) aud(duct('fire', [v3(-7, 27.3, V.portal + 1.6 + k * dz), v3(7, 27.3, V.portal + 1.6 + k * dz)], 0.08, 4));
    aud(duct('fire', [v3(-7, 27.3, V.portal + 1.6), v3(-7, 27.3, V.portal + 1.6 + 5 * dz)], 0.1));
    // smoke vents on the fly tower roof, hydrants along the corridors
    for (const u of [-4, 0, 4]) aud(box('fire', u, FLY.top + 0.2, 44, 1.6, 0.4, 1.6)); // smoke flaps on the fly-tower top
    const hyd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.8, 0.25), solid('fire'), 16);
    let k = 0;
    for (const y of [1.2, 8.8, 12.4, 16]) for (const [u, v] of [[-12.6, 20], [12.6, 20], [-12.6, 33], [12.6, 33]]) hyd.setMatrixAt(k++, new THREE.Matrix4().makeTranslation(u, y, v));
    aud(add(hyd, 'fire'));
    // escape routes: chevrons along the side corridors to the stairs
    const chev = new THREE.InstancedMesh(new THREE.ConeGeometry(0.3, 0.6, 3).rotateX(Math.PI / 2), solid('fire'), 40);
    k = 0;
    for (const s of [-1, 1]) for (let i = 0; i < 10; i++) for (const y of [AUD.tiers[1] + 0.2, AUD.tiers[3] + 0.2]) {
      chev.setMatrixAt(k++, new THREE.Matrix4().makeRotationY(Math.PI).setPosition(s * 12.2, y, 34 - i * 2.6));
    }
    aud(add(chev, 'fire'));
  }

  // ------------------------------------------------------------------ lighting
  {
    // auditorium lamps: the two-globe brackets on the box columns (interior.js) are part of this layer
    // new façade floodlighting (2026, 235 fittings): fixtures at the foot of the façades
    const fl = [];
    for (const poly of [FP.main, FP.loggia, FP.south]) {
      for (const e of edges(offsetPolygon(poly, 1.2))) {
        for (let s = 1.5; s < e.len; s += 4.2) fl.push([e.p[0] + e.dir[0] * s, e.p[1] + e.dir[1] * s, e.n]);
      }
    }
    const fx = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.2, 0.35, 8), M.lamp, fl.length);
    fl.forEach(([x, z, n], i) => fx.setMatrixAt(i, new THREE.Matrix4().makeRotationAxis(v3(n[1], 0, -n[0]), -0.6).setPosition(x, 0.25, z)));
    add(fx, 'lighting');
  }

  // ------------------------------------------------------------------ stairs and lifts
  {
    box('stairs', RU, 6.7, RS + 7.6, 9.6, 26.6, 2.6, glass('stairs')); // scenery lift behind the rear stage (sets 1.9 × 2.4 × 8 m)
    box('stairs', RU, 3.2, RS + 7.6, 9.2, 0.3, 2.3);                    // its platform at stage level
    box('stairs', 14.6, 10.5, 51.4, 1.8, 21, 1.8, glass('stairs'));    // passenger lift to the fly galleries
    // service tunnel to the 1983 underground (New Stage, operations building)
    duct('stairs', [v3(18.6, -5.8, 45), wb(32, -6.5, 22), wb(60, -7, 18), wb(84, -9, 8)], 1.4, 12);
  }

  // ------------------------------------------------------------------ backstage spaces (TOPIN cutaway of the 1983 layout)
  {
    const g = glass('backstage');
    box('backstage', RU, 8.7, RS, 11.2, 11.4, 12, g);         // rear stage 11 × 12 m with the revolving-stage cassette
    box('backstage', RU, 17.3, RS - 3, 12, 4.8, 5.8, g);      // ballet hall
    box('backstage', RU, 17.3, RS + 3, 12, 4.8, 5.8, g);      // multi-purpose hall
    box('backstage', RU, 1.4, RS, 11, 2.6, 12, g);            // scenery store / turntable switchgear
    box('backstage', RU, -2.8, RS, 11, 3.4, 12, g);           // hydraulics room and scenery containers
    for (let f = 0; f < 4; f++) box('backstage', 3, 5.4 + f * 3.9, 85, 16, 3.2, 14, g); // dressing rooms
    box('backstage', 12.5, 9.3, 82, 4.5, 3.2, 5.5, solid('backstage'));                 // historic director's office
    const tables = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.8, 0.6), solid('backstage'), 20);
    let k = 0;
    for (let f = 0; f < 4; f++) for (let i = 0; i < 5; i++) tables.setMatrixAt(k++, new THREE.Matrix4().makeTranslation(-3 + i * 2.6, 4.2 + f * 3.9, 90.5));
    add(tables, 'backstage');
  }

  // ------------------------------------------------------------------ energy centre, PV, control room
  {
    // under the operations building, 5th basement (≈ −16 m)
    const cen = wb(93, -16, 0);
    const g = new THREE.Group();
    g.position.copy(cen);
    for (let i = 0; i < 2; i++) {
      const chp = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.4, 2.2), solid('energy'));
      chp.position.set(-4, 1.2, -3 + i * 3.4);
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 26, 8), solid('energy'));
      stack.position.set(-6.2, 13.5, -3 + i * 3.4);
      g.add(chp, stack);
    }
    const store = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 5, 24), solid('energy'));
    store.position.set(4, 2.5, 0);
    g.add(store);
    for (let i = 0; i < 3; i++) {
      const hp = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 1.6), solid('water'));
      hp.position.set(-1 + i * 3, 0.9, 5);
      g.add(hp);
    }
    root.add(g);
    R.add(g, { stage: 6, order: 0.1, mode: 'appear', xray: 'layer', layer: 'energy' });
    // pipes from the energy centre into the historic building
    duct('energy', [cen.clone().add(v3(0, 4, 0)), wb(60, -6, 14), wb(30, -6, 20), v3(19, -5, 40), v3(10, -5, 40), v3(10, -1, 30)], 0.3, 14);
    duct('energy', [cen.clone().add(v3(0, 5, 0)), wb(60, -5, 15), wb(30, -5, 21), v3(19, -4, 41), v3(-10, -4, 41), v3(-10, -1, 20)], 0.3, 14);
    // PV on the New Stage and operations-building roofs
    const panels = [];
    for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) panels.push(wb(52 + i * 5.6, 27.6, -34 + j * 4));
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) panels.push(wb(86 + i * 4.6, 24.6, -8 + j * 4.2));
    const pv = new THREE.InstancedMesh(new THREE.BoxGeometry(4.6, 0.12, 3.2), solid('energy'), panels.length);
    panels.forEach((p, i) => pv.setMatrixAt(i, new THREE.Matrix4().makeRotationX(-0.35).setPosition(p.x, p.y, p.z)));
    add(pv, 'energy');
    // central control room in the historic building
    box('energy', -9.6, 1.6, 60, 6, 3, 4, glass('energy'));
    const screens = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.7, 0.08), M.lamp, 6);
    for (let i = 0; i < 6; i++) screens.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-11.8 + i * 0.95, 1.9, 58.3));
    add(screens, 'energy');
  }

  // ------------------------------------------------------------------ 1883 boiler house in the Schulz house (Fialka's ground-floor plan)
  {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 4.2, 16).rotateX(Math.PI / 2), solid('energy'));
      boiler.position.set(-3 + i * 2.3, 1.1, 81);
      g.add(boiler);
    }
    const flue = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 26, 10), solid('energy'));
    flue.position.set(1.5, 13, 84.5);
    g.add(flue);
    add(g, 'energy');
  }

  // ------------------------------------------------------------------ structure extras: foundation slab outline
  {
    const outline = [];
    for (const e of edges(offsetPolygon(FP.all, -0.2))) outline.push(v3(e.p[0], H.foundation + 0.95, e.p[1]));
    outline.push(outline[0].clone());
    const { geo } = tube(outline, 0.12);
    add(new THREE.Mesh(geo, solid('structure')), 'structure');
  }
  return ctx;
}
