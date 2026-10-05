// Every buildable piece registers here with the construction stage it belongs to.
// The build clock T runs 0…7; a piece of stage k animates while T goes from k to k+1,
// staggered by `order` (0…1). Pieces with `remove` disappear again during that stage
// (scaffolding). X-ray behaviour and layer membership also live here.
import * as THREE from 'three/webgpu';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// Which constant stretch of the clock an item is in (−1 while it animates). Between two calls in
// the same stretch nothing about the item changes, so update() can skip it.
function region(it, T) {
  let k = 0;
  if (it.stage != null) {
    if (T <= it.stage) k = 1; else if (T >= it.stage + 1) k = 2; else return -1;
  }
  if (it.remove != null) {
    if (T >= it.remove + 1) k += 10; else if (T > it.remove) return -1;
  }
  if (it.until != null && T > it.until) k += 100;
  return k;
}

function phase(T, stage, order, dur) {
  if (stage == null) return 1;
  const span = 1 - dur;
  return clamp01((T - stage - order * span) / dur);
}

const _m = new THREE.Matrix4();
const _s = new THREE.Matrix4();
const _t = new THREE.Matrix4();
const _tiny = new THREE.Vector3(1e-4, 1e-4, 1e-4);

export class Registry {
  constructor() {
    this.items = [];
    this.T = -1;
    this.mode = { xray: false, layers: new Set(), fire: 0 };
    this.ghostMaterials = {};
    this.hooks = [];
  }

  // custom per-frame behaviour driven by the build clock (e.g. raising the curtain)
  hook(fn) {
    this.hooks.push(fn);
  }

  /**
   * @param obj Object3D (Mesh/InstancedMesh/Group)
   * @param o.stage   stage index 0…6 (null = always there)
   * @param o.order   0…1 stagger within the stage
   * @param o.dur     share of the stage one piece takes to animate (default .3)
   * @param o.mode    'rise' | 'grow' | 'drop' | 'pop' | 'slide'
   * @param o.remove  stage index during which it disappears
   * @param o.xray    'ghost' | 'hide' | 'keep' | 'struct'
   * @param o.layer   X-ray layer id (shown only in X-ray with layer on)
   * @param o.orders  per-instance orders (InstancedMesh)
   * @param o.modern  present-day addition (trams, New Stage, stage lanterns): hidden in the 1881 fire
   */
  add(obj, o = {}) {
    const item = {
      obj,
      stage: o.stage ?? null,
      order: o.order ?? 0,
      dur: o.dur ?? 0.3,
      mode: o.mode ?? 'rise',
      remove: o.remove ?? null,
      removeOrder: o.removeOrder ?? 0,
      xray: o.xray ?? (o.layer ? 'layer' : 'keep'),
      layer: o.layer ?? null,
      dropHeight: o.dropHeight ?? 18,
      until: o.until ?? null,
      modern: o.modern ?? false,
      baseScale: obj.scale.clone(),
      basePos: obj.position.clone(),
      material: obj.material,
      e: -1,
    };
    if (obj.isInstancedMesh) {
      item.orders = o.orders ?? new Float32Array(obj.count).fill(item.order);
      item.baseMatrices = new Float32Array(obj.instanceMatrix.array);
      item.instHeight = o.instHeight ?? 1;
      obj.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      item.lastSig = -1;
    }
    obj.userData.item = item;
    this.items.push(item);
    return obj;
  }

  setGhostMaterial(kind, material) {
    this.ghostMaterials[kind] = material;
  }

  // ------------------------------------------------------------------ build clock
  update(T, force = false) {
    const changed = T !== this.T;
    this.T = T;
    if (changed || force) for (const fn of this.hooks) fn(T);
    for (const it of this.items) {
      if (!changed && !force && !it.dirty) continue;
      const r = region(it, T);
      if (!force && !it.dirty && r >= 0 && r === it.region) continue; // settled, nothing to redo
      it.region = r;
      it.dirty = false;
      this.updateItem(it, T);
    }
  }

  updateItem(it, T) {
    const obj = it.obj;
    if (obj.isInstancedMesh && it.stage != null && it.mode !== 'none') {
      this.updateInstanced(it, T);
    } else {
      let e = it.stage == null ? 1 : easeOut(phase(T, it.stage, it.order, it.dur));
      if (it.remove != null) e *= 1 - easeInOut(phase(T, it.remove, it.removeOrder, it.dur));
      if (it.until != null && T > it.until) e = 0;
      it.e = e;
      this.applyTransform(it, e);
    }
    this.applyVisibility(it);
  }

  applyTransform(it, e) {
    const obj = it.obj;
    const s = it.baseScale;
    const p = it.basePos;
    switch (it.mode) {
      case 'rise':
        obj.scale.set(s.x, s.y * Math.max(e, 1e-3), s.z);
        break;
      case 'grow':
        obj.scale.copy(s).multiplyScalar(Math.max(e, 1e-3));
        break;
      case 'drop':
        obj.position.set(p.x, p.y + (1 - e) * it.dropHeight, p.z);
        break;
      case 'pop':
        obj.scale.copy(s).multiplyScalar(0.92 + 0.08 * e);
        break;
      case 'slide':
        obj.position.set(p.x, p.y - (1 - e) * it.dropHeight, p.z);
        break;
      default:
        break;
    }
  }

  updateInstanced(it, T) {
    const obj = it.obj;
    const arr = obj.instanceMatrix.array;
    const base = it.baseMatrices;
    let any = false;
    let all = true;
    let n0 = 0, n1 = 0, partial = 0; // instances hidden / complete / animating
    const n = obj.count;
    for (let i = 0; i < n; i++) {
      let e = easeOut(phase(T, it.stage, it.orders[i], it.dur));
      if (it.remove != null) e *= 1 - easeInOut(phase(T, it.remove, it.orders[i] * 0.6, it.dur));
      if (e > 0.001) any = true;
      if (e < 0.999) all = false;
      if (e > 0.999) n1++; else if (e < 0.001) n0++; else partial++;
      _m.fromArray(base, i * 16);
      if (e >= 0.999) {
        _m.toArray(arr, i * 16);
        continue;
      }
      const k = Math.max(e, 1e-4);
      switch (it.mode) {
        case 'drop':
          _t.makeTranslation(0, (1 - e) * it.dropHeight, 0);
          _m.premultiply(_t);
          if (e <= 0.001) _m.scale(_tiny);
          break;
        case 'rise':
          _s.makeScale(1, k, 1);
          _m.multiply(_s);
          break;
        default:
          _s.makeScale(k, k, k);
          _m.multiply(_s);
      }
      _m.toArray(arr, i * 16);
    }
    // phases are monotonic in T, so the counts identify the state (no per-frame strings)
    const signature = n0 * 1000003 + n1;
    if (signature !== it.lastSig || partial > 0) {
      obj.instanceMatrix.needsUpdate = true;
      it.lastSig = signature;
    }
    it.e = any ? (all ? 1 : 0.5) : 0;
  }

  // ------------------------------------------------------------------ visibility
  setMode(patch) {
    Object.assign(this.mode, patch);
    for (const it of this.items) this.applyVisibility(it);
  }

  applyVisibility(it) {
    const obj = it.obj;
    const built = it.e > 0.001;
    const { xray, layers } = this.mode;
    let visible = built;
    let mat = it.material;
    switch (it.xray) {
      case 'ghost':
        if (xray) mat = this.ghostMaterials.shell ?? mat;
        break;
      case 'ghostSoft':
        if (xray) mat = this.ghostMaterials.soft ?? mat;
        break;
      case 'hide':
        if (xray) visible = false;
        break;
      case 'struct':
        // brick core: visible while building; in X-ray only with the structure layer
        if (xray) {
          visible = built && layers.has('structure');
          mat = this.ghostMaterials.structure ?? mat;
        }
        break;
      case 'layer':
        visible = built && xray && layers.has(it.layer);
        break;
      case 'layerAlways':
        // part of the building (e.g. stage lifts) that X-ray highlights with its layer colour
        if (xray) {
          visible = built && layers.has(it.layer);
          mat = this.ghostMaterials['layer:' + it.layer] ?? mat;
        }
        break;
      default:
        break;
    }
    if (this.mode.fire && it.modern) visible = false;
    const override = mat !== it.material ? mat : null;
    // the dark inside of a wall (addSectionInsides) shows only with the wall's own material, not with a ghost
    if (obj.isMesh) {
      if (obj.material !== mat && mat) obj.material = mat;
      if (obj.userData.inside) obj.userData.inside.visible = !override;
    } else if (override || it.overridden) {
      // groups: swap the materials of every descendant mesh
      obj.traverse((c) => {
        if (!c.isMesh || c === obj) return;
        if (c.userData.pocheInside) { c.visible = !override; return; }
        c.userData.origMat ??= c.material;
        c.material = override ?? c.userData.origMat;
      });
      it.overridden = !!override;
    }
    obj.visible = visible;
  }

  // Objects of a layer (for highlight etc.)
  byLayer(layer) {
    return this.items.filter((it) => it.layer === layer).map((it) => it.obj);
  }
}
