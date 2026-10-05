// The fire of 12 August 1881: flames start at the roof by the Provisional Theatre side, spread over
// the dome, the roof frame collapses into the auditorium, only the outer walls remain.
import * as THREE from 'three/webgpu';
import { vec3, float, uv, time, sin, hash, instanceIndex, smoothstep, length, sub, vec2, mix } from 'three/tsl';
import { bToWorld, audToB, AUD, V } from '../config.js';

const N_FLAMES = 360;
const N_SMOKE = 90;

export class Fire {
  constructor(ctx) {
    this.ctx = ctx;
    this.R = ctx.R;
    this.active = false;
    this.t = 0;
    const { root } = ctx;

    // flame billboards (additive, feed the bloom through the emissive channel)
    const fm = new THREE.MeshStandardNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const h = hash(instanceIndex);
    const d = length(sub(uv(), vec2(0.5, 0.42)));
    const flick = sin(time.mul(13).add(h.mul(60))).mul(0.25).add(0.75);
    const alpha = float(1).sub(smoothstep(0.05, 0.48, d)).mul(flick);
    fm.colorNode = vec3(0, 0, 0);
    fm.emissiveNode = mix(vec3(0.9, 0.16, 0.02), vec3(1.0, 0.55, 0.12), float(1).sub(uv().y)).mul(alpha).mul(1.25);
    fm.opacityNode = alpha;
    const geo = new THREE.PlaneGeometry(1, 1.6).translate(0, 0.8, 0);
    this.flames = new THREE.InstancedMesh(geo, fm, N_FLAMES);
    this.flames.frustumCulled = false;
    this.flames.visible = false;
    root.add(this.flames);

    const sm = new THREE.MeshStandardNodeMaterial({ color: '#3a3430', transparent: true, opacity: 0.3, depthWrite: false, roughness: 1 });
    this.smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), sm, N_SMOKE);
    this.smoke.frustumCulled = false;
    this.smoke.visible = false;
    root.add(this.smoke);

    this.light = new THREE.PointLight(0xff7a2a, 0, 220, 1.4);
    bToWorld(0, 34, 30, this.light.position);
    ctx.scene.add(this.light);

    // spawn points: dome surface (sampled), later the auditorium below
    this.spots = [];
    const dome = ctx.dome;
    for (let i = 0; i < N_FLAMES; i++) {
      const side = i % 4, t = Math.random(), s = Math.random() * 0.95;
      const p = dome.domePoint(side, t, s);
      // ignition near the south-west corner (towards the Provisional Theatre): delay by distance
      const delay = Math.hypot(p.x + 8, p.z - 48) / 9;
      // burning interior: random points of the auditorium (auditorium frame → building frame)
      const [iu, iv] = audToB((Math.random() - 0.5) * 2 * AUD.innerHalfWidth, V.auditoriumBack + 3 + Math.random() * 30);
      const inside = new THREE.Vector3(iu, 2 + Math.random() * 16, iv);
      this.spots.push({ roof: p, inside, delay, size: 1.6 + Math.random() * 2.6, phase: Math.random() * 10 });
    }
    this.smokeState = Array.from({ length: N_SMOKE }, () => ({ p: new THREE.Vector3(), age: Math.random() * 8, life: 6 + Math.random() * 4 }));
    this.collapse = []; // items that fall
    this.fallE = 0;     // how far the roof has fallen (0…1), for the rebuild
    // scratch objects reused every frame
    this._m = new THREE.Matrix4();
    this._pos = new THREE.Vector3();
    this._scl = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._q0 = new THREE.Quaternion();
    this._drift = new THREE.Vector3();
  }

  start() {
    if (this.active) this.stop(); // restarted during the rebuild: put the roof back first
    this.active = true;
    this.t = 0;
    this.R.setMode({ fire: 1 }); // the present-day additions did not exist in 1881
    // smoke starts over the burning roof, already spread over its life cycle
    for (const s of this.smokeState) {
      s.p.copy(this.spots[(Math.random() * N_FLAMES) | 0].roof);
      s.age = Math.random() * s.life;
    }
    this.flames.visible = true;
    this.smoke.visible = true;
    this.rebuilding = false;
    // what burns: the roof (stage 2) and the interiors (4, 5) – not the foyer, the loggia or the terrace,
    // which survived ("Přežily obvodové zdi, foyer a lodžie")
    const survives = (it) => {
      if (it.obj.userData.survives) return true;
      for (let o = it.obj; o; o = o.parent) if (o.name === 'foyer-frame') return true;
      return false;
    };
    this.collapse = this.R.items.filter((it) => it.stage === 2 && it.remove == null && !survives(it));
    this.inside = this.R.items.filter((it) => (it.stage === 4 || it.stage === 5) && !survives(it));
    this.fallE = 0;
    // rest height from the registry, so a fire started during a rebuild does not keep a sunken roof
    this.collapse.forEach((it) => { it.fireY = it.basePos.y; });
  }

  stop() {
    this.active = false;
    this.flames.visible = false;
    this.smoke.visible = false;
    this.light.intensity = 0;
    this.collapse.forEach((it) => { it.obj.position.y = it.fireY ?? it.obj.position.y; });
    this.R.mode.fire = 0;
    this.R.update(this.R.T, true);
  }

  // Schulz's rebuild: the roof rises back, then the interiors return
  rebuild() {
    if (!this.active) return;
    this.rebuilding = true;
    this.rt = 0;
  }

  update(dt) {
    if (!this.active) return;
    if (this.rebuilding) {
      this.rt += dt;
      const k = Math.max(0, 1 - this.rt / 3.2);
      this.collapse.forEach((it) => {
        this.R.applyVisibility(it); // as built, and as X-ray shows it
        it.obj.position.y = (it.fireY ?? 0) - k * k * 16 * this.fallE; // only as far as it actually fell
      });
      this.flames.visible = this.rt < 1.2;
      this.light.intensity *= 0.9;
      if (this.rt > 3.4) { this.rebuilding = false; this.stop(); }
      return;
    }
    this.t += dt;
    const t = this.t;
    const cam = this.ctx.camera;
    // billboard orientation in the root's local space
    const q = this.ctx.root.getWorldQuaternion(this._q).invert().multiply(cam.quaternion);
    const m = this._m, pos = this._pos, scl = this._scl;
    const collapseT = 7.5;
    const fallen = t > collapseT;
    this.spots.forEach((s, i) => {
      const grow = THREE.MathUtils.clamp((t - s.delay) / 1.5, 0, 1);
      const fade = t > 16 ? THREE.MathUtils.clamp(1 - (t - 16) / 6, 0.15, 1) : 1;
      const k = grow * fade * (0.8 + 0.2 * Math.sin(t * 6 + s.phase));
      const src = fallen && i % 2 === 0 ? s.inside : s.roof;
      pos.copy(src);
      pos.y += Math.sin(t * 3 + s.phase) * 0.2;
      scl.setScalar(Math.max(1e-3, s.size * k * (fallen ? 1.4 : 1)));
      m.compose(pos, q, scl);
      this.flames.setMatrixAt(i, m);
    });
    this.flames.instanceMatrix.needsUpdate = true;

    // smoke columns
    this.smokeState.forEach((s, i) => {
      s.age += dt;
      if (s.age > s.life) {
        s.age = 0;
        const sp = this.spots[(Math.random() * N_FLAMES) | 0];
        s.p.copy(sp.roof);
      }
      const a = s.age / s.life;
      pos.copy(s.p).add(this._drift.set(a * 14, a * 34, a * 4));
      const on = THREE.MathUtils.clamp(t / 3, 0, 1);
      scl.setScalar((1.5 + a * 7) * on);
      m.compose(pos, this._q0, scl);
      this.smoke.setMatrixAt(i, m);
    });
    this.smoke.instanceMatrix.needsUpdate = true;

    this.light.intensity = (THREE.MathUtils.clamp(t / 3, 0, 1) * (fallen ? 5200 : 3600)) * (0.8 + 0.2 * Math.sin(t * 17));

    // collapse of the roof frame and cladding into the auditorium; interiors burn out
    if (t > collapseT) {
      const k = THREE.MathUtils.clamp((t - collapseT) / 1.6, 0, 1);
      const e = k * k;
      this.fallE = e;
      this.collapse.forEach((it) => {
        it.obj.position.y = (it.fireY ?? 0) - e * 16;
        if (k >= 1) it.obj.visible = false;
      });
      if (k >= 1) this.inside.forEach((it) => { it.obj.visible = false; });
    }
  }
}
