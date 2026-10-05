// Materials and procedural textures. Colours sampled from photos in
// podklady/03_exterier_reference/materialy_a_barvy.md.
import * as THREE from 'three/webgpu';
import {
  texture, uv, positionWorld, uniform, vec3, float, mix, clamp, smoothstep,
  normalView, positionViewDirection, dot, abs, color, time, fract, sin, oneMinus,
} from 'three/tsl';

export const U = {
  night: uniform(0),      // 0 day … 1 night
  burn: uniform(0),       // fire episode
  flow: uniform(1),       // duct flow animation speed
  xray: uniform(0),       // 0 normal … 1 X-ray ambience
};

// ----------------------------------------------------------------- canvas utils
function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

let seed = 1234567;
export function rnd() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

function smoothNoise(ctx, w, h, cells, alpha, light = 255, dark = 0) {
  const n = canvas(cells, cells);
  const nx = n.getContext('2d');
  const id = nx.createImageData(cells, cells);
  for (let i = 0; i < cells * cells; i++) {
    const v = rnd() < 0.5 ? dark : light;
    id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v;
    id.data[i * 4 + 3] = 255 * rnd();
  }
  nx.putImageData(id, 0, 0);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(n, 0, 0, w, h);
  ctx.restore();
}

function grain(ctx, w, h, amount) {
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = (rnd() - 0.5) * amount;
    d[i] += g; d[i + 1] += g; d[i + 2] += g;
  }
  ctx.putImageData(id, 0, 0);
}

function tex(c, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

const hsl = (h, s, l) => `hsl(${h} ${s}% ${l}%)`;

// Height canvas → tangent-space normal map
function normalFromHeight(hc, strength = 2) {
  const w = hc.width, h = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = canvas(w, h);
  const ox = out.getContext('2d');
  const id = ox.createImageData(w, h);
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      id.data[i] = (-dx / l * 0.5 + 0.5) * 255;
      id.data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
      id.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      id.data[i + 3] = 255;
    }
  }
  ox.putImageData(id, 0, 0);
  return tex(out, true, false);
}

// ----------------------------------------------------------------- textures (1 tile = 4 m unless noted)
function ashlar({ size = 1024, course = 0.55, minLen = 0.9, maxLen = 1.7, base = [35, 30, 60], joint = 'rgba(70,58,44,.55)', groove = 0 } = {}) {
  const c = canvas(size);
  const x = c.getContext('2d');
  const hc = canvas(size);
  const hx = hc.getContext('2d');
  const pxm = size / 4;
  hx.fillStyle = '#fff';
  hx.fillRect(0, 0, size, size);
  x.fillStyle = hsl(base[0], base[1], base[2]);
  x.fillRect(0, 0, size, size);
  const ch = course * pxm;
  for (let row = 0, y = 0; y < size; row++, y += ch) {
    let xx = -rnd() * maxLen * pxm;
    while (xx < size) {
      const len = (minLen + rnd() * (maxLen - minLen)) * pxm;
      const l = base[2] + (rnd() - 0.5) * 7;
      const s = base[1] + (rnd() - 0.5) * 8;
      x.fillStyle = hsl(base[0] + (rnd() - 0.5) * 6, s, l);
      x.fillRect(xx, y, len, ch);
      if (xx + len > size) { x.fillRect(xx - size, y, len, ch); }
      // joints
      const jw = groove ? groove * pxm : 2;
      x.fillStyle = joint;
      x.fillRect(xx, y, jw * 0.6, ch);
      hx.fillStyle = '#000';
      if (groove) hx.fillRect(xx - jw * 0.3, y, jw * 0.6, ch);
      xx += len;
    }
    x.fillStyle = joint;
    const jh = groove ? groove * pxm : 2;
    x.fillRect(0, y, size, jh);
    if (groove) {
      const g = hx.createLinearGradient(0, y - jh, 0, y + jh);
      g.addColorStop(0, '#fff'); g.addColorStop(0.5, '#000'); g.addColorStop(1, '#fff');
      hx.fillStyle = g;
      hx.fillRect(0, y - jh, size, jh * 2);
    }
  }
  smoothNoise(x, size, size, 24, 0.10, 255, 40);
  smoothNoise(x, size, size, 96, 0.06, 255, 60);
  grain(x, size, size, 16);
  return { map: tex(c), normal: groove ? normalFromHeight(hc, 3) : null };
}

function brickTex() {
  const size = 512; // 2 m tile
  const c = canvas(size);
  const x = c.getContext('2d');
  const pxm = size / 2;
  x.fillStyle = '#b8ab98';
  x.fillRect(0, 0, size, size);
  const bh = 0.075 * pxm, bl = 0.29 * pxm, m = 0.012 * pxm;
  for (let r = 0, y = 0; y < size; r++, y += bh + m) {
    const off = (r % 2) * (bl / 2);
    for (let xx = -off; xx < size; xx += bl + m) {
      x.fillStyle = hsl(14 + rnd() * 8, 45 + rnd() * 15, 34 + rnd() * 12);
      x.fillRect(xx, y, bl, bh);
    }
  }
  smoothNoise(x, size, size, 32, 0.12, 255, 0);
  grain(x, size, size, 20);
  return tex(c);
}

function slateTex() {
  // diamond (rhombic) slates laid diagonally, blue-grey, with crosses of pale grey slates on a diagonal
  // lattice (photo from the terrace: "stars" ≈ 1.4 m across, ≈ 2.5 m apart in a row, rows 1.25 m apart)
  const size = 1024; // 5 m tile (the dome strips map 5 m to one texture repeat)
  const c = canvas(size);
  const x = c.getContext('2d');
  const orm = canvas(size);
  const o = orm.getContext('2d');
  o.fillStyle = 'rgb(255,150,0)'; // R ao, G roughness .59, B metal 0
  o.fillRect(0, 0, size, size);
  x.fillStyle = '#2e333c';
  x.fillRect(0, 0, size, size);
  const N = 32, d = (size / N) * 2; // 16 diamonds across the tile, each 5/16 m wide and high
  const lattice = 8; // a pale cross every 8 cells along both slate diagonals (tiles exactly: 16 = 2 × 8)
  const isStar = (a, b) => {
    const A = ((a % lattice) + lattice) % lattice, B = ((b % lattice) + lattice) % lattice;
    const da = A > lattice / 2 ? A - lattice : A, db = B > lattice / 2 ? B - lattice : B;
    if (da === db && Math.abs(da) <= 2) return true;       // vertical arm
    return da === -db && Math.abs(da) <= 2;                // horizontal arm
  };
  for (let a = -4; a < N + 4; a++) {
    for (let b = -N / 2 - 4; b < N / 2 + 4; b++) {
      const cx = ((a - b) * d) / 2, cy = ((a + b) * d) / 2;
      if (cx < -d || cx > size + d || cy < -d || cy > size + d) continue;
      const pale = isStar(a, b);
      x.fillStyle = pale ? hsl(212, 8 + rnd() * 5, 50 + rnd() * 7) : hsl(220, 10 + rnd() * 7, 25 + rnd() * 9);
      x.beginPath();
      x.moveTo(cx, cy - d / 2 + 1.5); x.lineTo(cx + d / 2 - 1.5, cy); x.lineTo(cx, cy + d / 2 - 1.5); x.lineTo(cx - d / 2 + 1.5, cy);
      x.closePath();
      x.fill();
      // lower edge of each slate catches a little shadow
      x.strokeStyle = 'rgba(0,0,0,0.28)';
      x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(cx - d / 2 + 1.5, cy); x.lineTo(cx, cy + d / 2 - 1.5); x.lineTo(cx + d / 2 - 1.5, cy); x.stroke();
      if (pale) {
        o.fillStyle = 'rgb(255,120,0)';
        o.fillRect(cx - d / 4, cy - d / 4, d / 2, d / 2);
      }
    }
  }
  smoothNoise(x, size, size, 20, 0.08, 255, 0);
  grain(x, size, size, 10);
  return { map: tex(c), orm: tex(orm, true, false) };
}

function copperTex() {
  const size = 512; // 4 m
  const c = canvas(size);
  const x = c.getContext('2d');
  x.fillStyle = '#7fa595';
  x.fillRect(0, 0, size, size);
  smoothNoise(x, size, size, 16, 0.25, 230, 40);
  smoothNoise(x, size, size, 64, 0.12, 255, 0);
  const pxm = size / 4;
  x.fillStyle = 'rgba(40,70,60,.35)';
  for (let xx = 0; xx < size; xx += 0.6 * pxm) x.fillRect(xx, 0, 2, size);
  grain(x, size, size, 14);
  return tex(c);
}

function flatNoiseTex(hex, amount = 0.15, cells = 32, size = 256) {
  const c = canvas(size);
  const x = c.getContext('2d');
  x.fillStyle = hex;
  x.fillRect(0, 0, size, size);
  smoothNoise(x, size, size, cells, amount, 255, 0);
  grain(x, size, size, 12);
  return tex(c);
}

function pavingTex() {
  const size = 512; // 4 m
  const c = canvas(size);
  const x = c.getContext('2d');
  const pxm = size / 4;
  x.fillStyle = '#8d8a84';
  x.fillRect(0, 0, size, size);
  const s = 0.5 * pxm;
  for (let yy = 0; yy < size; yy += s) {
    for (let xx = 0; xx < size; xx += s) {
      x.fillStyle = hsl(30, 4, 50 + rnd() * 12);
      x.fillRect(xx + 1, yy + 1, s - 2, s - 2);
    }
  }
  grain(x, size, size, 18);
  return tex(c);
}

function checkerMarble() {
  const size = 512; // 4 m, 0.5 m squares
  const c = canvas(size);
  const x = c.getContext('2d');
  const s = size / 8;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    x.fillStyle = (i + j) % 2 ? '#e9e2d4' : '#6b2a22';
    x.fillRect(i * s, j * s, s, s);
  }
  smoothNoise(x, size, size, 64, 0.08, 255, 0);
  return tex(c);
}

// Foyer floor (photos): white marble with red-brown four-pointed stars and black crosses on a 1.2 m module
function starInlay() {
  const size = 512; // 2.4 m = two modules
  const c = canvas(size);
  const x = c.getContext('2d');
  x.fillStyle = '#ece6da';
  x.fillRect(0, 0, size, size);
  const m = size / 2;
  const star = (cx, cy, r, col) => {
    x.fillStyle = col;
    x.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * 0.32 : r;
      x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    x.closePath();
    x.fill();
  };
  const cross = (cx, cy, r, col) => {
    x.fillStyle = col;
    x.fillRect(cx - r, cy - r * 0.28, 2 * r, r * 0.56);
    x.fillRect(cx - r * 0.28, cy - r, r * 0.56, 2 * r);
  };
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    star(m * i + m / 2, m * j + m / 2, m * 0.42, '#7a3426');
    star(m * i + m / 2, m * j + m / 2, m * 0.16, '#ece6da');
    cross(m * i, m * j, m * 0.16, '#1c1a1a');
  }
  cross(size, 0, m * 0.16, '#1c1a1a'); cross(0, size, m * 0.16, '#1c1a1a'); cross(size, size, m * 0.16, '#1c1a1a');
  smoothNoise(x, size, size, 64, 0.06, 255, 0);
  return tex(c);
}

// border of the foyer floor: black and white diamonds (0.8 m band)
function diamondBorder() {
  const w = 512, h = 256; // 1.6 m × 0.8 m
  const c = canvas(w, h);
  const x = c.getContext('2d');
  x.fillStyle = '#1e1c1c';
  x.fillRect(0, 0, w, h);
  x.fillStyle = '#efe9de';
  for (let k = 0; k < 4; k++) {
    const cx = (k + 0.5) * (w / 4);
    x.beginPath(); x.moveTo(cx, 16); x.lineTo(cx + w / 8 - 6, h / 2); x.lineTo(cx, h - 16); x.lineTo(cx - w / 8 + 6, h / 2); x.closePath(); x.fill();
  }
  return tex(c);
}

// foyer walls (photos): ochre imitation marble with soft veins
function ochreMarble() {
  const size = 512; // 4 m
  const c = canvas(size);
  const x = c.getContext('2d');
  x.fillStyle = '#cf9f4e';
  x.fillRect(0, 0, size, size);
  for (let k = 0; k < 26; k++) {
    x.strokeStyle = k % 3 ? 'rgba(250,226,170,0.35)' : 'rgba(120,80,30,0.25)';
    x.lineWidth = 1 + (k % 4);
    x.beginPath();
    let px = rnd() * size, py = rnd() * size;
    x.moveTo(px, py);
    for (let j = 0; j < 6; j++) { px += (rnd() - 0.3) * 120; py += (rnd() - 0.5) * 90; x.lineTo(px, py); }
    x.stroke();
  }
  smoothNoise(x, size, size, 48, 0.1, 255, 0);
  return tex(c);
}

// Auditorium ceiling: ring of eight oval fields around the chandelier rose (Ženíšek)
function ceilingTex() {
  const size = 1024;
  const c = canvas(size);
  const x = c.getContext('2d');
  const cx = size / 2;
  x.fillStyle = '#b8955a';
  x.fillRect(0, 0, size, size);
  const g = x.createRadialGradient(cx, cx, 10, cx, cx, cx);
  g.addColorStop(0, '#f1dfae'); g.addColorStop(0.18, '#d4b26a'); g.addColorStop(0.2, '#8a6a34');
  g.addColorStop(0.22, '#e6cf96'); g.addColorStop(0.85, '#c9a45c'); g.addColorStop(0.9, '#6d5128');
  g.addColorStop(0.93, '#d8bd7e'); g.addColorStop(1, '#a8874c');
  x.fillStyle = g;
  x.beginPath(); x.arc(cx, cx, cx, 0, Math.PI * 2); x.fill();
  const figures = ['#c45a3c', '#e8d0b0', '#9b6a8a', '#f0c070', '#d07a50', '#e6dcc0', '#b88a5a', '#f2b5a0'];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const px = cx + Math.cos(a) * cx * 0.56, py = cx + Math.sin(a) * cx * 0.56;
    x.save();
    x.translate(px, py);
    x.rotate(a + Math.PI / 2);
    x.fillStyle = '#6d5128';
    x.beginPath(); x.ellipse(0, 0, 120, 150, 0, 0, Math.PI * 2); x.fill();
    const sky = x.createLinearGradient(0, -140, 0, 140);
    sky.addColorStop(0, '#9fb8d6'); sky.addColorStop(1, '#4b6a8f');
    x.fillStyle = sky;
    x.beginPath(); x.ellipse(0, 0, 108, 138, 0, 0, Math.PI * 2); x.fill();
    // allegorical figure, painted loosely
    x.fillStyle = figures[i];
    x.beginPath(); x.ellipse(-8, 30, 34, 70, 0.25, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#f0d6b8';
    x.beginPath(); x.arc(-22, -50, 16, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(255,240,210,.5)';
    x.beginPath(); x.ellipse(30, -10, 26, 55, -0.6, 0, Math.PI * 2); x.fill();
    x.restore();
  }
  // chandelier rose
  x.fillStyle = '#e8cd85';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    x.beginPath(); x.ellipse(cx + Math.cos(a) * 70, cx + Math.sin(a) * 70, 10, 26, a, 0, Math.PI * 2); x.fill();
  }
  grain(x, size, size, 10);
  const t = tex(c, false);
  return t;
}

// Ceremonial curtain (after Hynais 1883): painted scene in a gilt frame
function curtainTex() {
  const w = 1024, h = 1024;
  const c = canvas(w, h);
  const x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#d9c9a4'); sky.addColorStop(0.55, '#b7a07a'); sky.addColorStop(1, '#6e5a3e');
  x.fillStyle = sky;
  x.fillRect(0, 0, w, h);
  // temple architecture in the background
  x.fillStyle = 'rgba(240,230,205,.75)';
  for (let i = 0; i < 6; i++) x.fillRect(560 + i * 70, 260, 30, 380);
  x.fillRect(540, 220, 440, 50);
  x.beginPath(); x.moveTo(540, 220); x.lineTo(760, 120); x.lineTo(980, 220); x.fill();
  // crowd of figures
  const cols = ['#7a2e24', '#c9a06a', '#e7d9bc', '#3d4f6a', '#9a5a3a', '#d8b48a', '#5a6e4a'];
  for (let i = 0; i < 26; i++) {
    const fx = 60 + rnd() * 900, fy = 560 + rnd() * 330;
    x.fillStyle = cols[i % cols.length];
    x.beginPath(); x.ellipse(fx, fy, 22 + rnd() * 18, 70 + rnd() * 40, (rnd() - 0.5) * 0.5, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#e8c9a8';
    x.beginPath(); x.arc(fx + (rnd() - 0.5) * 10, fy - 80, 14, 0, Math.PI * 2); x.fill();
  }
  // allegory hovering top-left
  x.fillStyle = 'rgba(250,240,220,.85)';
  x.beginPath(); x.ellipse(260, 260, 120, 60, -0.3, 0, Math.PI * 2); x.fill();
  // gilt frame and the lower drapery band
  x.strokeStyle = '#c9a45c'; x.lineWidth = 36; x.strokeRect(18, 18, w - 36, h - 36);
  x.strokeStyle = '#7a5a2a'; x.lineWidth = 6; x.strokeRect(42, 42, w - 84, h - 84);
  smoothNoise(x, w, h, 48, 0.08, 255, 0);
  return tex(c, false);
}

function velvetTex() {
  return flatNoiseTex('#7a0e24', 0.12, 64, 256);
}

// textures prepared by tools/prep_textures.py
const loader = new THREE.TextureLoader();
export function loadTex(name, { repeat = false, srgb = true } = {}) {
  const t = loader.load(`assets/${name}`);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ----------------------------------------------------------------- material factory
function std(params) {
  return new THREE.MeshStandardNodeMaterial(params);
}

// Facade floodlighting at night: warm light from the ground fading upwards.
function floodNode(albedoNode, strength = 0.3) {
  const fall = mix(float(1.0), float(0.35), smoothstep(0.0, 42.0, positionWorld.y));
  return albedoNode.mul(vec3(1.0, 0.62, 0.32)).mul(U.night).mul(fall).mul(strength);
}

// reversedDepth: the renderer uses the reversed float depth buffer (sets the sign and size of the depth biases)
export function createMaterials({ reversedDepth = false } = {}) {
  const sand = ashlar();
  const rustic = ashlar({ course: 0.62, minLen: 1.3, maxLen: 1.9, base: [33, 26, 55], groove: 0.06 });
  const trim = ashlar({ course: 0.9, minLen: 1.6, maxLen: 2.6, base: [36, 30, 64] });
  const slate = slateTex();

  const M = {};

  M.stone = std({ map: sand.map, roughness: 0.86, metalness: 0, side: THREE.DoubleSide });
  M.stone.emissiveNode = floodNode(texture(sand.map, uv()).rgb);

  M.rustic = std({ map: rustic.map, normalMap: rustic.normal, roughness: 0.9, side: THREE.DoubleSide });
  M.rustic.normalScale = new THREE.Vector2(1.2, 1.2);
  M.rustic.emissiveNode = floodNode(texture(rustic.map, uv()).rgb, 0.34);

  M.trim = std({ map: trim.map, roughness: 0.82, side: THREE.DoubleSide });
  M.trim.emissiveNode = floodNode(texture(trim.map, uv()).rgb, 0.32);
  M.siteStone = std({ map: trim.map, roughness: 0.9, side: THREE.DoubleSide });

  M.statue = std({ color: '#cdbb9f', roughness: 0.85 });
  M.statue.emissiveNode = floodNode(vec3(0.8, 0.73, 0.62), 0.4);

  M.brick = std({ map: brickTex(), roughness: 0.95, side: THREE.DoubleSide });
  M.mortar = std({ color: '#8d8478', roughness: 1 });

  M.slate = std({ map: slate.map, roughnessMap: slate.orm, metalnessMap: slate.orm, roughness: 1, metalness: 1, side: THREE.DoubleSide });
  M.slate.emissiveNode = vec3(0.85, 0.62, 0.22).mul(U.night).mul(0.05);

  M.gold = std({ color: '#e0b850', metalness: 1, roughness: 0.28 });
  M.gold.emissiveNode = vec3(1.0, 0.72, 0.3).mul(U.night).mul(0.75);

  M.copper = std({ map: copperTex(), roughness: 0.7, metalness: 0.15, side: THREE.DoubleSide });
  M.bronze = std({ color: '#6e9e98', roughness: 0.55, metalness: 0.45 });
  M.bronze.emissiveNode = vec3(0.4, 0.55, 0.5).mul(U.night).mul(0.25);

  M.glass = std({ color: '#2b3138', roughness: 0.12, metalness: 0.1 });
  M.glass.emissiveNode = vec3(1.0, 0.72, 0.42).mul(U.night).mul(0.7);
  M.frame = std({ color: '#5a2e24', roughness: 0.6 });

  M.iron = std({ color: '#3a3d42', roughness: 0.55, metalness: 0.7 });
  M.ironNew = std({ color: '#7a3a2a', roughness: 0.7, metalness: 0.3 }); // red-lead primed iron
  M.steel = std({ color: '#8b9097', roughness: 0.45, metalness: 0.75 });
  M.wood = std({ color: '#9a7a52', roughness: 0.9 });
  M.woodDark = std({ color: '#5a3e28', roughness: 0.8 });

  M.earth = std({ map: flatNoiseTex('#6b5640', 0.35, 24), roughness: 1, side: THREE.DoubleSide });
  M.concrete = std({ map: flatNoiseTex('#9a978f', 0.25, 32), roughness: 0.95, side: THREE.DoubleSide });
  M.rubble = std({ map: flatNoiseTex('#7d7468', 0.45, 64), roughness: 1, side: THREE.DoubleSide });
  M.paving = std({ map: pavingTex(), roughness: 0.9 });
  M.asphalt = std({ map: flatNoiseTex('#3e3f42', 0.12, 64), roughness: 0.95 });
  M.ground = std({ map: flatNoiseTex('#8e8a80', 0.2, 32), roughness: 1 });
  M.grass = std({ map: flatNoiseTex('#5f7a45', 0.3, 48), roughness: 1 });
  M.water = std({ color: '#2d4a58', roughness: 0.08, metalness: 0.2 });
  M.water.colorNode = mix(color('#24414f'), color('#3a6070'),
    sin(positionWorld.x.mul(0.12).add(positionWorld.z.mul(0.07)).add(time.mul(0.6))).mul(0.5).add(0.5).mul(0.35));

  M.ctxWall = std({ color: '#c8c1b5', roughness: 0.92 });
  M.ctxRoof = std({ color: '#8a5c49', roughness: 0.85 });
  M.ctxGlass = std({ color: '#7fa6b8', roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.85 });
  M.ctxGlass.emissiveNode = vec3(0.5, 0.8, 1.0).mul(U.night).mul(0.12);

  // interior
  M.velvet = std({ map: velvetTex(), roughness: 0.95 });
  M.stucco = std({ color: '#d4af6a', metalness: 0.85, roughness: 0.38 });
  M.ivory = std({ color: '#e3d2b4', roughness: 0.7, side: THREE.DoubleSide });
  M.plaster = std({ color: '#e7dfcf', roughness: 0.9, side: THREE.DoubleSide });
  M.boxWall = std({ color: '#6a2a28', roughness: 0.85, side: THREE.DoubleSide });
  M.ceiling = std({ map: ceilingTex(), roughness: 0.7, side: THREE.DoubleSide });
  M.curtain = std({ map: curtainTex(), roughness: 0.9, side: THREE.DoubleSide });
  M.drape = std({ color: '#7a0e24', roughness: 0.95, side: THREE.DoubleSide });
  M.marble = std({ map: checkerMarble(), roughness: 0.3 });
  M.parquet = std({ map: flatNoiseTex('#7a4e2c', 0.2, 48), roughness: 0.6 });
  M.stageFloor = std({ color: '#2a2622', roughness: 0.8 });
  M.foyerWall = std({ map: ochreMarble(), roughness: 0.25, metalness: 0.05, side: THREE.DoubleSide });
  M.inlay = std({ map: starInlay(), roughness: 0.25 });
  M.inlayBorder = std({ map: diamondBorder(), roughness: 0.25 });
  M.lamp = std({ color: '#fff4dc', emissive: '#ffd9a0', emissiveIntensity: 2.2 });
  // grey granite (columns of the east arcade gallery, plinths)
  M.granite = std({ map: flatNoiseTex('#7c8084', 0.22, 24), roughness: 0.5, side: THREE.DoubleSide });
  M.granite.emissiveNode = floodNode(vec3(0.48, 0.5, 0.52), 0.3);

  // X-ray ghosts: fresnel rim, nearly clear faces
  const fres = oneMinus(abs(dot(normalView, positionViewDirection))).pow(1.8);
  M.ghost = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
  M.ghost.colorNode = vec3(0.62, 0.82, 1.0);
  M.ghost.opacityNode = fres.mul(0.3).add(0.018);
  M.ghostSoft = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
  M.ghostSoft.colorNode = vec3(0.85, 0.85, 0.9);
  M.ghostSoft.opacityNode = fres.mul(0.12).add(0.01);
  M.ghostStruct = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
  M.ghostStruct.colorNode = vec3(0.62, 0.79, 1.0);
  M.ghostStruct.opacityNode = fres.mul(0.32).add(0.045);

  // Section poché: walls are closed volumes, so where a section plane opens one we look at its
  // inside (back faces), drawn as a flat dark tone like the cut walls of a drawn section. The wall
  // materials draw only their faces; addSectionInsides() gives every wall a twin that draws the inside.
  // Wall faces are also pushed a hair away from the camera (GPU depth bias, keeps the early depth test):
  // frames, stucco and other details lying exactly on a wall then always cover it instead of flickering.
  // Order at equal depth: inside of a wall (M.sectionBias) > details (0) > wall faces (WALL_BIAS).
  const WALL_BIAS = reversedDepth ? -64 : 2;
  const walls = ['brick', 'plaster', 'stone', 'rustic', 'concrete', 'rubble'];
  for (const key of walls) {
    const m = M[key];
    m.side = THREE.FrontSide;
    m.shadowSide = THREE.DoubleSide; // shadows as before, from both sides
    m.userData.poche = true;         // clones (the plastered finish) keep the flag
  }
  for (const key of [...walls, 'foyerWall', 'boxWall']) {
    Object.assign(M[key], { polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: WALL_BIAS });
  }
  M.sectionBias = reversedDepth ? 256 : -8;

  return M;
}

// The dark inside of every wall in a section material (see above): a twin mesh with the same geometry
// that draws only the back faces in one flat tone. Many pieces touch exactly (a wall standing on a slab,
// one band of masonry on the next, a frame flush with the façade); in a section the dark inside of one
// and the lit face of the other would share a plane and flicker. The twin is pulled a little towards the
// camera with the GPU's depth bias (M.sectionBias), so the dark section always covers a face lying on it.
// With the reversed float depth buffer the bias grows with distance (≈ 2 mm at 60 m); the fixed 24-bit
// fallback needs a few units the other way. Faces keep the GPU's early depth test.
export function addSectionInsides(root, M) {
  const inside = new THREE.MeshBasicNodeMaterial({
    side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: M.sectionBias,
  });
  inside.colorNode = vec3(0.03, 0.026, 0.024);
  const walls = [];
  root.traverse((o) => { if (o.isMesh && o.material?.userData?.poche) walls.push(o); });
  for (const w of walls) {
    const twin = w.isInstancedMesh ? new THREE.InstancedMesh(w.geometry, inside, w.count) : new THREE.Mesh(w.geometry, inside);
    if (w.isInstancedMesh) twin.instanceMatrix = w.instanceMatrix; // shared: follows the build animation
    twin.name = (w.name || 'wall') + ':inside';
    twin.userData.pocheInside = true;
    twin.castShadow = twin.receiveShadow = false;
    twin.raycast = () => {};
    w.add(twin);
    w.userData.inside = twin;
  }
  return walls.length;
}

// Emissive material for an X-ray layer. flow=true animates moving stripes along tube UVs.
export function layerMaterial(hex, { flow = false, repeat = 8, opacity = 1 } = {}) {
  const c = new THREE.Color(hex);
  const m = new THREE.MeshStandardNodeMaterial({ color: c, roughness: 0.45, metalness: 0.1, transparent: opacity < 1, opacity });
  const base = vec3(c.r, c.g, c.b);
  if (flow) {
    const stripe = smoothstep(0.35, 0.5, fract(uv().x.mul(repeat).sub(time.mul(U.flow).mul(0.8))))
      .mul(oneMinus(smoothstep(0.5, 0.65, fract(uv().x.mul(repeat).sub(time.mul(U.flow).mul(0.8))))));
    m.emissiveNode = base.mul(stripe.mul(1.6).add(0.35));
  } else {
    m.emissiveNode = base.mul(0.55);
  }
  return m;
}

export function charredNode(baseColor) {
  // used by the fire episode: glowing embers flicker over a darkened surface
  const flicker = sin(time.mul(9).add(positionWorld.x.mul(1.7)).add(positionWorld.z)).mul(0.5).add(0.5);
  return mix(baseColor, vec3(0.05, 0.03, 0.02), U.burn).add(vec3(1.0, 0.35, 0.05).mul(U.burn).mul(flicker).mul(0.9));
}

export { clamp };
