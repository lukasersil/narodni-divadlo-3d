import * as THREE from 'three/webgpu';
import './core/shaderdedupe.js';
import { pass, mrt, output, emissive, vec3, mix, smoothstep, positionLocal, normalize } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { FRAME, bToWorld, FP, AXIS, audToB, facadeToB } from './config.js';
import { pointInPolygon } from './core/geom.js';
import { Registry } from './core/registry.js';
import { createMaterials, U, layerMaterial, addSectionInsides } from './core/materials.js';
import { buildSite } from './site.js';
import { buildShell } from './building/shell.js';
import { buildFacade } from './building/facade.js';
import { buildScaffold } from './building/scaffold.js';
import { buildPartitions } from './building/partitions.js';
import { buildInterior } from './building/interior.js';
import { buildStage } from './building/stage.js';
import { buildSystems } from './building/systems.js';
import { Fire } from './fx/fire.js';
import { buildTrams } from './trams.js';
import { initUI } from './ui.js';
import { STAGES, LAYERS, UI_TEXT } from './data/content.js';

const container = document.getElementById('stage3d');
const loadErr = document.getElementById('load-err');
const loadBar = document.getElementById('load-bar');
// one animation frame: the browser paints the loading veil and handles input between long steps of the start-up
// (a hidden tab gets no frames, so it only waits for the event loop)
const nextFrame = () => new Promise((resolve) => (document.hidden ? setTimeout(resolve, 0) : requestAnimationFrame(() => resolve())));

// auditorium-frame point [u, y, v] → building frame
const A = ([u, y, v]) => { const [bu, bv] = audToB(u, v); return [bu, y, bv]; };
// façade-frame point (foyer) → building frame
const F = ([u, y, v]) => { const [bu, bv] = facadeToB(u, v); return [bu, y, bv]; };

// Camera views per timeline stop, in the building frame [u, y, v]
const VIEWS = {
  hero: { pos: [-96, 30, -52], tgt: [2, 16, 30] },
  site: { pos: [-74, 64, -40], tgt: [0, 0, 44] },
  foundations: { pos: [-74, 58, -34], tgt: [0, -6, 38] },
  walls: { pos: [-78, 38, -36], tgt: [0, 10, 34] },
  roof: { pos: [-64, 66, 8], tgt: [0, 30, 28] },
  facade: { pos: [-18, 44, -52], tgt: [0, 13, -1] }, // above the roofs across Národní – the street is too narrow for a full view
  interiors: { pos: [-56, 20, 26], tgt: [3, 11, 28] },
  stage: { pos: [-50, 16, 50], tgt: A([0, 12, 44.5]) },
  xray: { pos: [-84, 44, 6], tgt: [2, 10, 40] },
};

// Viewpoints for the "Views" panel (finished building, no section)
export const VIEWPOINTS = [
  { id: 'v-street', pos: [6, 1.8, -26], tgt: [0, 14, -3], cz: 'Národní třída', en: 'Národní Street' },
  { id: 'v-river', pos: [-112, 9, 18], tgt: [0, 16, 34], cz: 'Od řeky', en: 'From the river' },
  { id: 'v-dome', pos: [-26, 46, 2], tgt: [0, 37, 26], cz: 'Kopule', en: 'Dome' },
  { id: 'v-loggia', pos: [-10.2, 8.4, -4.6], tgt: [9, 10.0, -3.4], cz: 'Lodžie', en: 'Loggia' },
  { id: 'v-foyer', pos: F([-9.4, 8.4, 4.6]), tgt: F([9, 10.2, 4.6]), cz: 'Foyer', en: 'Foyer' },
  { id: 'v-aud', pos: A([0, 7.9, 17.0]), tgt: A([0, 9.2, 36.6]), cz: 'Hlediště', en: 'Auditorium' }, // from the I. balcony on the axis
  { id: 'v-ceiling', pos: A([0.4, 4.2, 23.0]), tgt: A([0, 23.4, 25.6]), cz: 'Strop a lustr', en: 'Ceiling and chandelier' },
  { id: 'v-stage', pos: A([0, 8.5, 50.8]), tgt: A([0, 9, 22]), cz: 'Z jeviště', en: 'From the stage' },
];

async function main() {
  // ------------------------------------------------------------------ renderer
  // reversed float depth: even precision at every distance, so surfaces a few millimetres apart
  // (a mirror on a box wall, a frame on the façade) no longer flicker against each other
  const renderer = new THREE.WebGPURenderer({ antialias: false, powerPreference: 'high-performance', reversedDepthBuffer: true });
  await renderer.init();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);
  const backend = renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.5, 5000);

  // environment for metal reflections (gilding)
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  await nextFrame();

  // sky dome
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3500, 32, 16), new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false }));
  const dirY = normalize(positionLocal).y;
  const dayCol = mix(vec3(0.83, 0.86, 0.88), vec3(0.36, 0.55, 0.78), smoothstep(-0.02, 0.45, dirY));
  const nightCol = mix(vec3(0.09, 0.11, 0.17), vec3(0.015, 0.022, 0.045), smoothstep(-0.02, 0.5, dirY));
  const xrayCol = mix(vec3(0.05, 0.09, 0.15), vec3(0.01, 0.02, 0.05), smoothstep(-0.02, 0.5, dirY));
  sky.material.colorNode = mix(mix(dayCol, nightCol, U.night), xrayCol, U.xray);
  sky.renderOrder = -1;
  scene.add(sky);
  scene.fog = new THREE.Fog(0xcfd6dc, 380, 1900);

  // lights
  const hemi = new THREE.HemisphereLight(0xdfe8f2, 0x6b6052, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0dc, 3.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -110; sun.shadow.camera.right = 110;
  sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -110;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.06;
  const centre = bToWorld(0, 0, 40);
  const sunDir = new THREE.Vector3(-0.836, 0.5, -0.224).normalize();
  sun.position.copy(centre).addScaledVector(sunDir, 260);
  sun.target.position.copy(centre);
  scene.add(sun, sun.target);
  const moonCol = new THREE.Color(0x8fa6d8);
  const sunCol = new THREE.Color(0xfff0dc);

  // ------------------------------------------------------------------ model
  const M = createMaterials({ reversedDepth: renderer.reversedDepthBuffer });
  await nextFrame();
  const R = new Registry();
  R.setGhostMaterial('shell', M.ghost);
  R.setGhostMaterial('soft', M.ghostSoft);
  R.setGhostMaterial('structure', M.ghostStruct);
  for (const l of LAYERS) R.setGhostMaterial('layer:' + l.id, layerMaterial(l.color));

  buildSite(scene, M, R);
  await nextFrame();

  const root = new THREE.ClippingGroup();
  root.name = 'narodni-divadlo';
  root.position.copy(FRAME.origin);
  root.rotation.y = FRAME.rotationY;
  root.clipShadows = true;
  const planeLong = new THREE.Plane();
  const planePlan = new THREE.Plane();
  root.clippingPlanes = [planeLong, planePlan];
  scene.add(root);

  // auditorium/stage frame: turned about Zítek's axis inside the building frame
  const audPivot = new THREE.Group();
  audPivot.position.set(AXIS.shiftU, 0, AXIS.pivotV);
  const audRot = new THREE.Group();
  audRot.rotation.y = AXIS.angle;
  const audRoot = new THREE.Group();
  audRoot.position.set(0, 0, -AXIS.pivotV);
  audRoot.name = 'auditorium-frame';
  root.add(audPivot);
  audPivot.add(audRot);
  audRot.add(audRoot);
  const ctx = { root, audRoot, M, R, scene, camera };
  // buildTrams: present-day trams on Národní, Most Legií and the embankments
  for (const build of [buildShell, buildPartitions, buildFacade, buildScaffold, buildInterior, buildStage, buildSystems, buildTrams]) {
    build(ctx);
    await nextFrame(); // a slow CPU spends seconds here: keep the page responsive between the parts
  }
  const fire = new Fire(ctx);
  addSectionInsides(root, M); // dark inside of the walls in a section

  // section planes (world space)
  // the long section follows Zítek's axis: cut.u is measured across the auditorium frame
  const axisP = (u) => { const [bu, bv] = audToB(u, AXIS.pivotV); return bToWorld(bu, 0, bv); };
  const eWorld = axisP(1).sub(axisP(0)).normalize();
  const cut = { on: false, u: -1.9, y: 46 };
  function applyCut() {
    const u = cut.on ? cut.u : -1000;
    const y = cut.on ? cut.y : 1000;
    // keep points with u >= cutU (removes the river-side half)
    planeLong.normal.copy(eWorld);
    planeLong.constant = -eWorld.dot(axisP(u));
    planePlan.normal.set(0, -1, 0);
    planePlan.constant = y;
  }
  applyCut();

  // ------------------------------------------------------------------ post-processing
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera, { samples: 4 });
  scenePass.setMRT(mrt({ output, emissive }));
  const colorTex = scenePass.getTextureNode('output');
  const emissiveTex = scenePass.getTextureNode('emissive');
  const glow = bloom(emissiveTex, 0.8, 0.4, 0.28);
  pipeline.outputNode = colorTex.add(glow);

  // ------------------------------------------------------------------ controls & camera flights
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.maxPolarAngle = Math.PI * 0.97;
  controls.minDistance = 0.6;
  controls.maxDistance = 900;
  controls.screenSpacePanning = true;

  const flight = { active: false, t: 0, dur: 2.4, p0: new THREE.Vector3(), p1: new THREE.Vector3(), t0: new THREE.Vector3(), t1: new THREE.Vector3() };
  function flyTo(view, dur = 2.4) {
    const v = VIEWS[view] ?? view;
    flight.p0.copy(camera.position);
    flight.t0.copy(controls.target);
    bToWorld(...v.pos, flight.p1);
    bToWorld(...v.tgt, flight.t1);
    flight.t = 0;
    flight.dur = dur;
    flight.active = true;
  }
  let uiReady = false; // the UI is created further down
  controls.addEventListener('start', () => { flight.active = false; if (uiReady) clearView(); });
  const _bp = new THREE.Vector3();
  bToWorld(...VIEWS.hero.pos, camera.position);
  bToWorld(...VIEWS.hero.tgt, controls.target);
  camera.position.add(new THREE.Vector3(-40, 25, -40));
  flyTo('hero', 3.5);

  // ------------------------------------------------------------------ app state
  const state = { T: 7, target: 7, playing: false, view: null, xray: false, xr: 0, night: 0, nightTarget: 0, lang: 'cz', layers: new Set(LAYERS.map((l) => l.id)), lastStop: -1, autoCut: false };
  Object.defineProperty(state, 'cutOn', { get: () => cut.on }); // hotspots inside the building need the section
  R.setMode({ xray: false, layers: state.layers });
  R.update(state.T, true);

  const stopOf = (T) => (T <= 0.001 ? 0 : Math.min(7, Math.ceil(T - 0.001)));

  // a chosen viewpoint stays highlighted only until the camera is moved some other way
  const clearView = () => { state.view = null; ui.clearViews(); };
  // leaving the fire episode by any timeline action puts the building back
  const endFire = () => {
    if (!state.fire) return;
    state.fire = false;
    fire.stop();
    ui.fireOff();
  };

  const actions = {
      goStop(i) {
        endFire();
        state.playing = false;
        state.view = null;
        state.target = STAGES[i].t;
        enterStop(i, true);
      },
      scrub(T) {
        endFire();
        clearView();
        state.playing = false;
        state.target = T;
        state.T = T;
      },
      play() {
        if (state.playing) { state.playing = false; return; }
        endFire();
        clearView();
        if (state.T >= 6.99) state.T = 0;
        state.target = state.T; // play on from where the clock is now, also in the middle of a transition
        state.playing = true;
        enterStop(stopOf(state.T), true);
      },
      setXray(on) {
        state.xray = on;
        if (on) clearView();
        R.setMode({ xray: on, layers: state.layers });
        if (on && !flight.active) flyTo('xray');
      },
      setLayers(set) {
        state.layers = set;
        R.setMode({ xray: state.xray, layers: set });
      },
      setCut(on) {
        cut.on = on;
        state.autoCut = false;
        applyCut();
      },
      setCutValues(u, y) {
        cut.u = u;
        cut.y = y;
        applyCut();
      },
      setNight(on) { state.nightTarget = on ? 1 : 0; },
      fire(on) {
        state.fire = on;
        if (on) {
          state.playing = false;
          clearView();
          // the theatre burned complete, two months after its first opening: no scaffolding, all interiors
          state.target = 7; state.T = 7;
          if (cut.on) { cut.on = false; state.autoCut = false; applyCut(); ui.syncCut(cut); }
          fire.start();
          flyTo({ pos: [-110, 26, 4], tgt: [0, 24, 30] }, 2.2);
        } else fire.stop();
      },
      rebuild() { state.fire = false; fire.rebuild(); },
      viewpoint(id) {
        const vp = VIEWPOINTS.find((v) => v.id === id);
        if (!vp) return;
        endFire();
        state.playing = false;
        state.target = 7;
        if (state.T < 6.5) state.T = 6.5;
        state.view = id === 'v-stage' ? 'stage' : id;
        if (state.xray) ui.setXray(false);
        if (cut.on) { cut.on = false; state.autoCut = false; applyCut(); ui.syncCut(cut); }
        flyTo(vp, 2.6);
      },
      flyTo,
  };
  const ui = initUI({ state, STAGES, LAYERS, VIEWPOINTS, backend, camera, renderer, actions });
  uiReady = true;
  const debug = { noPost: false };

  function enterStop(i, fly) {
    state.lastStop = i;
    ui.showStage(i);
    const st = STAGES[i];
    if (fly && st.view) flyTo(st.view);
    stopCut(st);
  }
  // interiors and stage machinery need the section cut
  function stopCut(st) {
    if (st.cut && !cut.on) {
      cut.on = true;
      state.autoCut = true;
      applyCut();
      ui.syncCut(cut);
    } else if (!st.cut && state.autoCut) {
      cut.on = false;
      state.autoCut = false;
      applyCut();
      ui.syncCut(cut);
    }
  }
  enterStop(7, false);

  // ------------------------------------------------------------------ loop
  const timer = new THREE.Timer();
  const fogDay = new THREE.Color(0xcfd6dc), fogNight = new THREE.Color(0x141b29), fogX = new THREE.Color(0x0b1422);
  // keep at least ~58° horizontal field of view on narrow / portrait screens
  function fitCamera() {
    if (!container.clientWidth || !container.clientHeight) return; // hidden pane / thumbnail: keep the last size
    const aspect = container.clientWidth / container.clientHeight;
    camera.aspect = aspect;
    const minH = THREE.MathUtils.degToRad(58);
    const vForH = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(minH / 2) / aspect));
    camera.fov = Math.min(75, Math.max(38, vForH));
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  fitCamera();
  window.addEventListener('resize', fitCamera);
  if (window.ResizeObserver) new ResizeObserver(fitCamera).observe(container);

  // ------------------------------------------------------------------ shader warm-up
  // three.js builds the shaders of an object when it is first drawn. Drawing everything in the first frame built
  // ~1 000 of them at once (every InstancedMesh gets its own) and froze the page: ~2 s on a fast Mac, ~9 s on a
  // slower laptop, ~24 s without WebGPU. Behind the loading veil the objects are switched on in batches instead,
  // each frame building about 50 ms of shaders, so the page keeps responding and the bar shows the progress.
  async function warmUp() {
    if (!container.clientWidth || !container.clientHeight) return; // hidden pane / thumbnail: nothing to draw into
    if (backend !== 'WebGPU') document.getElementById('load-slow').hidden = false;
    const items = [];
    scene.traverse((o) => { if ((o.isMesh || o.isLine || o.isPoints) && o.visible) items.push(o); });
    const off = new Set(items); // switched off here, on again at the end
    const culled = items.map((o) => o.frustumCulled);
    for (const o of items) { o.visible = false; o.frustumCulled = false; } // objects off screen get their shaders too
    // each frame draws one batch alone (with the meshes it hangs under), so a frame costs only that batch's shaders
    const shown = [];
    let i = 0, batch = 8;
    while (i < items.length) {
      const end = document.hidden ? items.length : Math.min(items.length, i + batch); // a hidden tab has no one to freeze
      for (; i < end; i++) {
        for (let o = items[i]; o; o = o.parent) if (off.has(o) && !o.visible) { o.visible = true; shown.push(o); }
      }
      const t0 = performance.now();
      pipeline.render();
      batch = THREE.MathUtils.clamp(Math.round(batch * Math.min(2, 50 / Math.max(performance.now() - t0, 2))), 1, 128); // grow gently: shaders differ in cost
      for (const o of shown) o.visible = false;
      shown.length = 0;
      const p = i / items.length;
      loadBar.style.setProperty('--p', p.toFixed(3));
      loadBar.setAttribute('aria-valuenow', Math.round(p * 100));
      await nextFrame();
    }
    items.forEach((o, k) => { o.visible = true; o.frustumCulled = culled[k]; });
  }
  await warmUp();
  // tools (promo renderer, QA scripts) wait for this: the model is built and its shaders are ready
  window.__nd = { state, actions, camera, controls, VIEWS, scene, THREE, R, renderer, sun, debug, ctx };

  document.getElementById('loading').style.opacity = '0';
  setTimeout(() => document.getElementById('loading').remove(), 900);

  renderer.setAnimationLoop((time) => {
    timer.update(time);
    const dt = Math.min(timer.getDelta(), 0.05);

    // build clock
    if (state.playing) {
      state.target = Math.min(7, state.target + dt * 0.16);
      if (state.target >= 7) state.playing = false;
    }
    const d = state.target - state.T;
    if (Math.abs(d) > 1e-4) {
      const speed = state.playing ? 10 : Math.max(0.45, Math.abs(d) * 1.4);
      state.T += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
    } else state.T = state.target;
    R.update(state.T);
    const stop = stopOf(state.T);
    if (stop !== state.lastStop && state.playing) enterStop(stop, true);
    else if (stop !== state.lastStop) {
      state.lastStop = stop;
      ui.showStage(stop);
      // passing through intermediate stops on the way to another one must not toggle the section
      if (stop === stopOf(state.target)) stopCut(STAGES[stop]);
    }

    // day / night
    state.night += (state.nightTarget - state.night) * Math.min(1, dt * 2.2);
    state.xr += ((state.xray ? 1 : 0) - state.xr) * Math.min(1, dt * 3);
    U.night.value = state.night;
    U.xray.value = state.xr;
    const dark = Math.max(state.night, state.xr * 0.85);
    sun.intensity = THREE.MathUtils.lerp(3.1, 0.35, dark);
    sun.color.lerpColors(sunCol, moonCol, dark);
    hemi.intensity = THREE.MathUtils.lerp(0.9, 0.2, dark);
    scene.environmentIntensity = THREE.MathUtils.lerp(0.55, 0.12, dark);
    scene.fog.color.lerpColors(fogDay, state.xr > state.night ? fogX : fogNight, dark);

    // camera flight
    if (flight.active) {
      flight.t = Math.min(1, flight.t + dt / flight.dur);
      const k = flight.t < 0.5 ? 4 * flight.t ** 3 : 1 - Math.pow(-2 * flight.t + 2, 3) / 2;
      camera.position.lerpVectors(flight.p0, flight.p1, k);
      controls.target.lerpVectors(flight.t0, flight.t1, k);
      if (flight.t >= 1) flight.active = false;
    }
    controls.update();
    // keep the camera above the street unless it is inside the building (or looking at the X-ray/section)
    {
      const c = Math.cos(FRAME.rotationY), sn = Math.sin(FRAME.rotationY);
      const dx = camera.position.x - FRAME.origin.x, dz = camera.position.z - FRAME.origin.z;
      _bp.set(dx * c - dz * sn, camera.position.y, dx * sn + dz * c);
      const inside = pointInPolygon(_bp.x, _bp.z, FP.all);
      const minY = inside || state.xray || cut.on ? -8.5 : 0.9;
      if (camera.position.y < minY) camera.position.y = minY;
    }
    for (const f of ctx.ticks ?? []) f(dt, state.T, state);
    fire.update(dt);
    ui.update(state.T, dt);
    if (!container.clientWidth || !container.clientHeight) return; // nothing to draw into
    if (debug.noPost) renderer.render(scene, camera); else pipeline.render();
  });
}

main().catch((err) => {
  console.error(err);
  loadErr.hidden = false;
  // the UI may not be up yet: pick the language from the browser
  const L = UI_TEXT[(navigator.language || '').toLowerCase().startsWith('cs') ? 'cz' : 'en'];
  loadErr.textContent = `${L.loadError}: ${err?.message ?? err}. ${L.loadHelp}`;
});
