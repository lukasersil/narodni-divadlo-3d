import * as THREE from 'three/webgpu';
import { HOTSPOTS, UI_TEXT } from './data/content.js';
import { bToWorld, audToB, FRAME, FP, H } from './config.js';
import { pointInPolygon } from './core/geom.js';

const $ = (id) => document.getElementById(id);

export function initUI({ state, STAGES, LAYERS, VIEWPOINTS = [], backend, camera, renderer, actions }) {
  const t = (k) => UI_TEXT[state.lang][k] ?? k;

  // ---------------------------------------------------------------- timeline
  const stops = $('stops');
  const knots = $('knots');
  STAGES.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'stop';
    b.innerHTML = `<span class="yr"></span><span class="nm"></span>`;
    b.addEventListener('click', () => actions.goStop(i));
    stops.appendChild(b);
    const k = document.createElement('div');
    k.className = 'knot';
    k.style.left = `${(i / (STAGES.length - 1)) * 100}%`;
    knots.appendChild(k);
  });
  const scrub = $('scrub');
  scrub.addEventListener('input', () => actions.scrub(parseFloat(scrub.value)));

  const playBtn = $('btn-play');
  playBtn.addEventListener('click', () => actions.play());

  // ---------------------------------------------------------------- toolbar
  const ext = $('btn-ext'), xr = $('btn-xray');
  const setX = (on) => {
    ext.setAttribute('aria-pressed', String(!on));
    xr.setAttribute('aria-pressed', String(on));
    $('layer-card').hidden = !on;
    actions.setXray(on);
    if (on && window.innerWidth > 760) openPanel(true);
  };
  ext.addEventListener('click', () => setX(false));
  xr.addEventListener('click', () => setX(true));

  const cutBtn = $('btn-cut');
  cutBtn.addEventListener('click', () => {
    const on = cutBtn.getAttribute('aria-pressed') !== 'true';
    cutBtn.setAttribute('aria-pressed', String(on));
    $('cut-card').hidden = !on;
    actions.setCut(on);
    if (on && window.innerWidth > 760) openPanel(true);
  });
  const cutLong = $('cut-long'), cutPlan = $('cut-plan');
  const cutLabel = () => {
    // Czech uses a decimal comma and a true minus sign
    const num = (x) => { const s = x.toFixed(1).replace('-', '−'); return state.lang === 'cz' ? s.replace('.', ',') : s; };
    $('cut-long-v').textContent = `${num(+cutLong.value)} m ${t('fromAxis')}`;
    $('cut-plan-v').textContent = +cutPlan.value >= 45.9 ? '—' : `${num(+cutPlan.value + 191.3)} ${t('asl')}`;
  };
  const onCut = () => { cutLabel(); actions.setCutValues(parseFloat(cutLong.value), parseFloat(cutPlan.value)); };
  cutLong.addEventListener('input', onCut);
  cutPlan.addEventListener('input', onCut);
  cutLabel();

  const nightBtn = $('btn-night');
  nightBtn.addEventListener('click', () => {
    const on = nightBtn.getAttribute('aria-pressed') !== 'true';
    nightBtn.setAttribute('aria-pressed', String(on));
    actions.setNight(on);
  });

  // ---------------------------------------------------------------- bottom: description card and timeline can be put away
  // the description card is the stage card, or the fire card while the theatre burns; × or the "i" button hides it,
  // the chevron folds the whole timeline into a tab in the corner
  const bottomView = { desc: true, timeline: true };
  let fireOn = false;
  const descBtn = $('btn-desc');
  function applyBottom() {
    $('stagecard').classList.toggle('dismissed', !bottomView.desc);
    $('firecard').hidden = !(fireOn && bottomView.desc);
    descBtn.setAttribute('aria-pressed', String(bottomView.desc));
    document.body.classList.toggle('tl-hidden', !bottomView.timeline);
  }
  const setDesc = (on) => { bottomView.desc = on; applyBottom(); };
  descBtn.addEventListener('click', () => setDesc(!bottomView.desc));
  $('sc-close').addEventListener('click', () => setDesc(false));
  $('fire-close').addEventListener('click', () => setDesc(false));
  $('btn-tl-hide').addEventListener('click', () => { bottomView.timeline = false; applyBottom(); $('tl-show').focus(); });
  $('tl-show').addEventListener('click', () => { bottomView.timeline = true; applyBottom(); $('btn-tl-hide').focus(); });

  const fireBtn = $('btn-fire');
  function fireUI(on) {
    fireOn = on;
    fireBtn.setAttribute('aria-pressed', String(on));
    $('stagecard').style.visibility = on ? 'hidden' : '';
    applyBottom();
  }
  fireBtn.addEventListener('click', () => {
    const on = fireBtn.getAttribute('aria-pressed') !== 'true';
    fireUI(on);
    actions.fire(on);
  });
  $('btn-rebuild').addEventListener('click', () => {
    actions.rebuild();
    fireUI(false);
  });

  const panelBtn = $('btn-panel');
  const side = $('side');
  function openPanel(on) {
    side.dataset.collapsed = String(!on);
    panelBtn.setAttribute('aria-expanded', String(on));
    $('stagecard').classList.toggle('show-mobile', !on); // mobile: panel and stage card share the bottom area
  }
  panelBtn.addEventListener('click', () => openPanel(side.dataset.collapsed === 'true'));
  openPanel(window.innerWidth > 760);

  // ---------------------------------------------------------------- viewpoints
  const viewWrap = $('views');
  const viewBtns = VIEWPOINTS.map((vp) => {
    const b = document.createElement('button');
    b.className = 'view-btn';
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      viewBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      actions.viewpoint(vp.id);
    });
    viewWrap.appendChild(b);
    return b;
  });
  const clearViews = () => viewBtns.forEach((x) => x.setAttribute('aria-pressed', 'false'));
  stops.addEventListener('click', clearViews);

  // ---------------------------------------------------------------- layers
  const layerWrap = $('layers');
  const layerBtns = LAYERS.map((l) => {
    const b = document.createElement('button');
    b.className = 'layer';
    b.setAttribute('aria-pressed', 'true');
    b.innerHTML = `<span class="dot" style="background:${l.color}"></span><span class="lbl"></span>`;
    b.addEventListener('click', () => {
      const set = new Set(state.layers);
      if (set.has(l.id)) set.delete(l.id); else set.add(l.id);
      apply(set);
    });
    layerWrap.appendChild(b);
    return b;
  });
  function apply(set) {
    LAYERS.forEach((l, i) => layerBtns[i].setAttribute('aria-pressed', String(set.has(l.id))));
    actions.setLayers(set);
  }
  $('layers-all').addEventListener('click', () => apply(new Set(LAYERS.map((l) => l.id))));
  $('layers-none').addEventListener('click', () => apply(new Set()));

  // ---------------------------------------------------------------- language
  const cz = $('btn-cz'), en = $('btn-en');
  function setLang(lang) {
    state.lang = lang;
    document.documentElement.lang = lang === 'cz' ? 'cs' : 'en';
    cz.setAttribute('aria-pressed', String(lang === 'cz'));
    en.setAttribute('aria-pressed', String(lang === 'en'));
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
    document.querySelectorAll('[data-ta]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.ta)));
    document.querySelectorAll('[data-tt]').forEach((el) => { el.title = t(el.dataset.tt); });
    document.querySelectorAll('[data-talt]').forEach((el) => el.setAttribute('alt', t(el.dataset.talt)));
    items.forEach((it) => it.el.setAttribute('aria-label', it.h[lang].title));
    STAGES.forEach((s, i) => {
      const b = stops.children[i];
      b.querySelector('.yr').textContent = s.years.split(' · ')[0];
      b.querySelector('.nm').textContent = s[lang].title;
      b.setAttribute('aria-label', `${s[lang].title}, ${s.years}`);
    });
    LAYERS.forEach((l, i) => { layerBtns[i].querySelector('.lbl').textContent = l[lang]; });
    VIEWPOINTS.forEach((vp, i) => { viewBtns[i].textContent = vp[lang]; });
    playBtn.setAttribute('aria-label', state.playing ? t('pause') : t('play'));
    showStage(current);
    if (openHs) openInfo(openHs);
    renderAbout();
    cutLabel();
  }
  cz.addEventListener('click', () => setLang('cz'));
  en.addEventListener('click', () => setLang('en'));

  // ---------------------------------------------------------------- stage card
  let current = 7;
  function showStage(i) {
    current = i;
    const s = STAGES[i];
    $('sc-eyebrow').textContent = `${i === 0 ? '' : t('stageWord') + ' ' + i + ' · '}${s.years}`;
    $('sc-title').textContent = s[state.lang].title;
    $('sc-text').textContent = s[state.lang].text;
    [...stops.children].forEach((b, k) => (k === i ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
  }

  // ---------------------------------------------------------------- hotspots
  const layer = $('hotspots');
  const items = HOTSPOTS.map((h, idx) => {
    const el = document.createElement('button');
    el.className = 'hs' + (h.layer ? ' layer-hs' : '');
    el.tabIndex = -1;                      // hidden until updateHotspots shows it
    el.setAttribute('aria-hidden', 'true');
    el.textContent = h.layer ? '◆' : String(idx + 1);
    if (h.layer) {
      const c = LAYERS.find((l) => l.id === h.layer)?.color;
      el.style.color = c;
      el.style.borderColor = c;
    }
    el.addEventListener('click', (ev) => { ev.stopPropagation(); openInfo(h); });
    layer.appendChild(el);
    // aud: position given in the auditorium frame (Zítek's axis, see AXIS in config.js)
    const [bu, bv] = h.aud ? audToB(h.pos[0], h.pos[2]) : [h.pos[0], h.pos[2]];
    const world = h.world ? new THREE.Vector3(...h.pos) : bToWorld(bu, h.pos[1], bv);
    return { h, el, world, shown: false };
  });
  let openHs = null;
  function openInfo(h) {
    openHs = h;
    const c = h[state.lang];
    $('info-yr').textContent = h.year ?? (h.layer ? LAYERS.find((l) => l.id === h.layer)[state.lang] : '');
    $('info-title').textContent = c.title;
    $('info-text').textContent = c.text;
    const fig = $('info-fig');
    if (h.img) {
      fig.hidden = false;
      $('info-img').src = `assets/${h.img}.jpg`;
      $('info-img').alt = c.title;
      $('info-cap').textContent = (state.lang === 'en' ? h.creditEn : null) ?? h.credit ?? '';
    } else fig.hidden = true;
    $('info').hidden = false;
    items.forEach((it) => it.el.classList.toggle('active', it.h === h));
  }
  function closeInfo() {
    $('info').hidden = true;
    openHs = null;
    items.forEach((it) => it.el.classList.remove('active'));
  }
  $('info-close').addEventListener('click', closeInfo);

  const v = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  // is the camera inside the building? (then exterior hotspots would float through the walls)
  const cosR = Math.cos(FRAME.rotationY), sinR = Math.sin(FRAME.rotationY);
  function cameraInside() {
    const p = camera.position;
    const dx = p.x - FRAME.origin.x, dz = p.z - FRAME.origin.z;
    return p.y < H.cornice && pointInPolygon(dx * cosR - dz * sinR, dx * sinR + dz * cosR, FP.all);
  }
  function updateHotspots(T) {
    const w = renderer.domElement.clientWidth, hgt = renderer.domElement.clientHeight;
    camera.getWorldDirection(camDir);
    const inside = cameraInside();
    for (const it of items) {
      const h = it.h;
      let vis;
      if (h.layer) vis = !state.fire && state.xray && state.layers.has(h.layer) && T > 6.05; // services are built in stage 6
      else vis = !state.xray && !state.fire && (h.stops ?? []).includes(current) && T >= Math.min(h.from ?? 0, STAGES[current].t) - 0.001
        && (h.needsCut ? state.cutOn || inside : !inside); // interior hotspots need the section or a camera inside
      // an open card whose hotspot no longer belongs to the mode, stop or episode closes with it
      if (!vis && openHs === h) closeInfo();
      if (vis) {
        v.copy(it.world).sub(camera.position);
        if (v.dot(camDir) < 0.5) vis = false;
      }
      if (vis) {
        v.copy(it.world).project(camera);
        if (Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) vis = false;
        else {
          const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * hgt;
          it.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        }
      }
      if (vis !== it.shown) {
        it.el.style.opacity = vis ? '1' : '0';
        it.el.style.pointerEvents = vis ? 'auto' : 'none';
        it.el.tabIndex = vis ? 0 : -1;
        it.el.setAttribute('aria-hidden', String(!vis));
        it.shown = vis;
      }
    }
  }

  // ---------------------------------------------------------------- about
  function renderAbout() {
    const czText = `
      <p>Interaktivní model historické budovy Národního divadla (Josef Zítek, Josef Schulz, 1868–1883). Časová osa ukazuje postup stavby ve zjednodušených etapách: základy, zdivo, železnou kopuli, kamennou fasádu, interiéry a jevištní techniku; na konci je budova v dnešní podobě. Režim Rentgen zprůhlední plášť a ukáže konstrukce a technické systémy, Řez otevře budovu podél osy jako historický výkres.</p>
      <ul>
        <li>Půdorys: RÚIAN (č. p. 223, ČÚZK, CC BY 4.0); výšky, okolní budovy a terén: IPR Praha – Budovy 3D a výškové rastry (CC BY 4.0); řeka, most a ulice: © přispěvatelé OpenStreetMap (ODbL).</li>
        <li>Dispozice: půdorysy a podélný řez J. Fialky (Šubertův průvodce 1883) a řez z Architektonického obzoru 1914.</li>
        <li>Jevištní technika: technická dokumentace ND (2008–2021); TZB: seriál V. Mužíka, TOPIN 2023–2025; energetika: ENESA, ND 2018 a 2026.</li>
        <li>Historie: F. A. Šubert, Národní divadlo v Praze (1881, 1883), a časopis Světozor (1881, 1883); obrazové přílohy jsou volné dílo.</li>
        <li>Textury interiéru: Hynaisova opona podle fotografie Lehotsky (Wikimedia Commons, CC BY-SA 3.0); strop hlediště se Ženíškovými malbami podle fotografie Dobroš (CC BY-SA 4.0), narovnané do půdorysu; strop foyeru a Alšovy lunety podle fotografií Palickap (CC BY-SA 3.0); malby samotné jsou volné dílo.</li>
        <li>Fasády, střecha a kopule jsou porovnané s fotografiemi z Wikimedia Commons.</li>
      </ul>
      <p>Model je zjednodušená rekonstrukce v měřítku 1&nbsp;:&nbsp;1. Sochy a lustr jsou schematické; opona, stropy a lunety jsou textury z fotografií.</p>
      <p>Zdrojový kód je volně ke stažení na <a href="https://github.com/lukasersil/narodni-divadlo-3d" target="_blank" rel="noopener">GitHubu</a> (licence MIT). Model si můžete stáhnout a rozvíjet dál.</p>`;
    const enText = `
      <p>An interactive model of the National Theatre’s historic building (Josef Zítek, Josef Schulz, 1868–1883). The timeline shows the construction in simplified phases: foundations, walls, the iron dome, the stone façade, interiors and stage machinery, ending with the building as it is today. X-ray turns the shell transparent to show structure and building services; Section opens the building along its axis like the historic drawing.</p>
      <ul>
        <li>Footprint: RÚIAN (no. 223, ČÚZK, CC BY 4.0); heights, surrounding buildings and terrain: IPR Praha Buildings 3D and height rasters (CC BY 4.0); river, bridge and streets: © OpenStreetMap contributors (ODbL).</li>
        <li>Layout: J. Fialka’s plans and long section (Šubert’s guide, 1883) and the 1914 section from Architektonický obzor.</li>
        <li>Stage machinery: ND technical documentation (2008–2021); building services: V. Mužík’s series, TOPIN 2023–2025; energy: ENESA, ND 2018 and 2026.</li>
        <li>History: F. A. Šubert, Národní divadlo v Praze (1881, 1883), and the Světozor magazine (1881, 1883); illustrations are public domain.</li>
        <li>Interior textures: Hynais curtain after a photo by Lehotsky (Wikimedia Commons, CC BY-SA 3.0); the auditorium ceiling with Ženíšek’s paintings after a photo by Dobroš (CC BY-SA 4.0), rectified to the plan; the foyer ceiling and Aleš’s lunettes after photos by Palickap (CC BY-SA 3.0); the paintings themselves are public domain.</li>
        <li>Façades, roof and dome were checked against photographs from Wikimedia Commons.</li>
      </ul>
      <p>The model is a simplified 1:1 reconstruction. Statues and the chandelier are schematic; the curtain, ceilings and lunettes are textures made from photographs.</p>
      <p>The source code is free to download on <a href="https://github.com/lukasersil/narodni-divadlo-3d" target="_blank" rel="noopener">GitHub</a> (MIT licence), so you can take the model and build on it.</p>`;
    $('about-title').textContent = t('about');
    $('about-body').innerHTML = (state.lang === 'cz' ? czText : enText) +
      `<img class="drawing" src="assets/rez_1883.jpg" alt="${state.lang === 'cz' ? 'Podélný řez Národním divadlem, J. Fialka 1883' : 'Long section of the National Theatre, J. Fialka 1883'}">` +
      `<div class="about-foot"><div class="author"><img src="assets/avatar.png" alt="" width="36" height="36"><span><b>Lukáš Eršil</b><small>@lukasersil</small></span></div><span class="role">${t('author')}<span>${t('backend')}: ${backend}</span></span></div>`;
  }
  // About dialog: focus moves into it, Tab stays inside, focus returns to the button on close
  const about = $('about');
  const openAbout = () => { about.hidden = false; $('about-close').focus(); };
  const closeAbout = () => {
    if (about.hidden) return;
    about.hidden = true;
    $('btn-about').focus();
  };
  $('btn-about').addEventListener('click', openAbout);
  $('about-close').addEventListener('click', closeAbout);
  about.addEventListener('click', (e) => { if (e.target.id === 'about') closeAbout(); });
  about.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = [...about.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')].filter((el) => !el.hidden);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeAbout(); closeInfo(); }
  });

  // hint fades out after first interaction
  const hint = $('hint');
  const hideHint = () => { hint.style.opacity = '0'; };
  renderer.domElement.addEventListener('pointerdown', hideHint, { once: true });
  setTimeout(hideHint, 9000);

  setLang('cz');

  let lastPlaying = null;
  let lastT = null;
  return {
    showStage,
    setXray: setX,
    fireOff: () => fireUI(false),
    clearViews,
    syncCut(cut) {
      cutBtn.setAttribute('aria-pressed', String(cut.on));
      $('cut-card').hidden = !cut.on;
      if (cut.on) openPanel(window.innerWidth > 760);
    },
    update(T) {
      if (T !== lastT) { // the timeline DOM only changes with the clock
        lastT = T;
        scrub.value = String(T);
        $('rail-fill').style.width = `${(T / 7) * 100}%`;
        for (let i = 0; i < knots.children.length; i++) knots.children[i].classList.toggle('done', T >= STAGES[i].t - 0.001);
      }
      if (state.playing !== lastPlaying) {
        lastPlaying = state.playing;
        $('play-icon').setAttribute('d', state.playing ? 'M4 2.5h3v11H4zM9 2.5h3v11H9z' : 'M4 2.5v11l9-5.5z');
        playBtn.setAttribute('aria-label', state.playing ? t('pause') : t('play'));
      }
      updateHotspots(T);
    },
  };
}
