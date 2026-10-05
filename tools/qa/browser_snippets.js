// QA camera helpers. Paste into the browser console at http://localhost:5173 (python3 serve.py),
// after the model has loaded and the intro flight has finished (~5 s). Then e.g.:
//   await __qa.secView()               // long section on Zítek's axis → tools/qa/section_overlay.py
//   await __qa.ortho('west')           // near-orthographic elevation, surroundings hidden
//   await __qa.vp('v-foyer')           // a viewpoint with the UI hidden
//   __qa.reset()                       // normal camera, fog and surroundings again
window.__qa = await (async () => {
  const nd = window.__nd;
  const { bToWorld, audToB } = await import('/src/config.js');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const site = nd.scene.getObjectByName('site');
  const trams = nd.scene.getObjectByName('trams');
  const hideUI = () => document.querySelectorAll('.toolbar,.side,.stagecard,.timeline,.masthead,.badge,#hotspots,.hint,.info')
    .forEach((e) => { e.style.visibility = 'hidden'; });
  const hideSite = (on) => {
    if (site) site.visible = !on;
    if (trams) trams.visible = !on;
    nd.scene.background = on ? new nd.THREE.Color('#ffffff') : null;
  };
  const place = (pos, tgt, fov) => {
    nd.scene.fog.near = 1e6; nd.scene.fog.far = 2e6; nd.controls.maxDistance = 1e5;
    const D = pos.distanceTo(tgt);
    nd.camera.fov = fov; nd.camera.near = Math.max(0.5, D - 400); nd.camera.far = D + 600;
    nd.camera.updateProjectionMatrix();
    nd.camera.position.copy(pos); nd.controls.target.copy(tgt); nd.camera.lookAt(tgt); nd.controls.update();
  };
  // building-frame elevations [u, y, v]; 1280×760 renders
  const ORTHO = {
    west: { pos: [-1500, 40, 38], tgt: [0, 17, 38], fov: 2.3 },
    north: { pos: [0, 30, -1500], tgt: [0, 18, -5], fov: 2.0 },
    east: { pos: [1500, 40, 40], tgt: [0, 18, 40], fov: 3.6 },
    south: { pos: [6, 30, 1600], tgt: [6, 16, 80], fov: 1.8 },
    top: { pos: [0.5, 1500, 44.5], tgt: [0.5, 0, 44.5], fov: 4.3 },
  };
  return {
    hideSite,
    async secView(cutU = -0.3, yc = 14, vc = 44, D = 1500, fov = 3) {
      nd.actions.setCut(true); nd.actions.setCutValues(cutU, 60);
      const [bu, bv] = audToB(-D, vc), [tu, tv] = audToB(0, vc);
      place(bToWorld(bu, yc, bv), bToWorld(tu, yc, tv), fov);
      hideSite(true); hideUI(); await sleep(1200);
    },
    async ortho(name) {
      const o = ORTHO[name];
      nd.actions.setCut(false);
      place(bToWorld(...o.pos), bToWorld(...o.tgt), o.fov);
      hideSite(true); hideUI(); await sleep(1200);
    },
    async vp(id) { nd.actions.viewpoint(id); await sleep(4000); hideUI(); },
    reset() {
      nd.camera.fov = 38; nd.camera.near = 0.5; nd.camera.far = 5000; nd.camera.updateProjectionMatrix();
      nd.scene.fog.near = 380; nd.scene.fog.far = 1900; nd.controls.maxDistance = 900;
      hideSite(false);
      document.querySelectorAll('.toolbar,.side,.stagecard,.timeline,.masthead,.badge,#hotspots,.hint,.info')
        .forEach((e) => { e.style.visibility = ''; });
    },
  };
})();
