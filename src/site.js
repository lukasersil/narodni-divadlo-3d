// Surroundings: IPR terrain + context buildings, OSM river, embankment, roads, Most Legií, trees.
import * as THREE from 'three/webgpu';
import { SITE_DATA as SITE, FP, bToWorld } from './config.js';
import { capGeometry, ccw, wallGeometry, offsetPolygon, pointInPolygon, mergeGeometries } from './core/geom.js';

const WATER_Y = -5.75;

function decode(b64, Type) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Type(bytes.buffer);
}

// ------------------------------------------------------------------ terrain sampler
export function makeTerrain() {
  const { rows, cols } = SITE.terrain;
  const pos = decode(SITE.terrain.pos, Float32Array);
  const P = (i, j) => {
    const k = (i * cols + j) * 3;
    return [pos[k], pos[k + 1], pos[k + 2]];
  };
  const p00 = P(0, 0), p01 = P(0, 1), p10 = P(1, 0);
  const dc = [p01[0] - p00[0], p01[2] - p00[2]];
  const dr = [p10[0] - p00[0], p10[2] - p00[2]];
  const det = dc[0] * dr[1] - dc[1] * dr[0];
  function height(x, z) {
    const rx = x - p00[0], rz = z - p00[2];
    const j = (rx * dr[1] - rz * dr[0]) / det;
    const i = (dc[0] * rz - dc[1] * rx) / det;
    if (i < 0 || j < 0 || i > rows - 1 || j > cols - 1) return null;
    const i0 = Math.min(Math.floor(i), rows - 2), j0 = Math.min(Math.floor(j), cols - 2);
    const fi = i - i0, fj = j - j0;
    const h00 = P(i0, j0)[1], h01 = P(i0, j0 + 1)[1], h10 = P(i0 + 1, j0)[1], h11 = P(i0 + 1, j0 + 1)[1];
    return (h00 * (1 - fj) + h01 * fj) * (1 - fi) + (h10 * (1 - fj) + h11 * fj) * fi;
  }
  return { rows, cols, pos, P, height };
}

// world footprint of the theatre (+ margin) – terrain is cut out there
function theatreHoleWorld(margin) {
  return offsetPolygon(FP.all, margin).map(([u, v]) => {
    const w = bToWorld(u, 0, v);
    return [w.x, w.z];
  });
}

export function buildSite(scene, M, registry) {
  const group = new THREE.Group();
  group.name = 'site';
  scene.add(group);
  const terrain = makeTerrain();

  // ---- terrain mesh (cut out under the theatre, flattened to street level around it)
  {
    const { rows, cols, P } = terrain;
    const hole = theatreHoleWorld(6);
    const flat = theatreHoleWorld(14);
    const inRiver = (x, z) => SITE.osm.river.some((r) => pointInPolygon(x, z, r.outer) && !r.holes.some((h) => pointInPolygon(x, z, h)));
    const positions = [];
    const uvs = [];
    const idx = [];
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const [x, y, z] = P(i, j);
        let yy = y - 0.02;
        if (pointInPolygon(x, z, flat)) yy = -0.02;
        else if (y < -3.5 && inRiver(x, z)) yy = -7.5; // riverbed below the water surface
        positions.push(x, yy, z);
        uvs.push(x / 4, z / 4);
      }
    }
    for (let i = 0; i < rows - 1; i++) {
      for (let j = 0; j < cols - 1; j++) {
        const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
        const cx = (positions[a * 3] + positions[d * 3]) / 2;
        const cz = (positions[a * 3 + 2] + positions[d * 3 + 2]) / 2;
        if (pointInPolygon(cx, cz, hole)) continue;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    // make sure faces point up
    const n = g.attributes.normal;
    let up = 0;
    for (let k = 0; k < n.count; k += 37) up += n.getY(k);
    if (up < 0) {
      for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
      g.setIndex(idx);
      g.computeVertexNormals();
    }
    const mesh = new THREE.Mesh(g, M.ground);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    group.add(mesh);
    registry.add(mesh, { stage: null, xray: 'ghostSoft' }); // see-through in X-ray: tunnels and the energy centre lie underground
  }

  // ---- far ground below everything (fog hides the edge)
  {
    const g = new THREE.PlaneGeometry(6000, 6000);
    g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, M.ground);
    mesh.position.y = -24; // below the deepest basement (energy centre −16), so nothing underground is covered
    group.add(mesh);
    registry.add(mesh, { stage: null, xray: 'hide' });
  }

  // ---- river
  for (const p of SITE.osm.river) {
    const outer = ccw(p.outer);
    const holes = p.holes.map((h) => h);
    const g = capGeometry(outer, WATER_Y, true, holes, 8);
    const water = new THREE.Mesh(g, M.water);
    water.receiveShadow = true;
    water.name = 'vltava';
    group.add(water);
    registry.add(water, { stage: null, xray: 'ghostSoft' });
    // islands (holes) as grass above water
    for (const h of p.holes) {
      const isl = new THREE.Mesh(capGeometry(ccw(h), -3.2, true, [], 4), M.grass);
      isl.receiveShadow = true;
      group.add(isl);
      const bank = new THREE.Mesh(wallGeometry(ccw(h), -6.2, -3.2, 3), M.siteStone);
      group.add(bank);
    }
    // embankment walls where the ground is high next to the water
    const walls = [];
    const ring = outer;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      if (Math.hypot(mx, mz) > 380) continue;
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const l = Math.hypot(dx, dz) || 1;
      // outward (land side) normal for CCW ring
      const nx = dz / l, nz = -dx / l;
      const h = terrain.height(mx + nx * 6, mz + nz * 6);
      if (h == null || h < -4.2) continue;
      walls.push(wallGeometry([a, b, [b[0] + nx * 0.8, b[1] + nz * 0.8], [a[0] + nx * 0.8, a[1] + nz * 0.8]], -6.6, h + 0.9, 2));
    }
    if (walls.length) {
      const mesh = new THREE.Mesh(mergeGeometries(walls), M.siteStone);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.name = 'nabrezi';
      group.add(mesh);
    }
  }

  // ---- roads (asphalt strips draped on the terrain)
  {
    const geos = [];
    for (const r of SITE.osm.roads) {
      if (r.bridge) continue;
      const pts = r.pts;
      const half = r.w / 2;
      const pos = [], idx = [];
      for (let k = 0; k < pts.length; k++) {
        const p = pts[k];
        const prev = pts[Math.max(0, k - 1)], next = pts[Math.min(pts.length - 1, k + 1)];
        const dx = next[0] - prev[0], dz = next[1] - prev[1];
        const l = Math.hypot(dx, dz) || 1;
        const nx = -dz / l, nz = dx / l;
        for (const s of [-1, 1]) {
          const x = p[0] + nx * half * s, z = p[1] + nz * half * s;
          const h = terrain.height(x, z);
          pos.push(x, (h ?? 0) + 0.06, z);
        }
        if (k > 0) {
          const a = (k - 1) * 2;
          idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
      g.setIndex(idx);
      geos.push(g.toNonIndexed());
    }
    const merged = mergeGeometries(geos);
    merged.computeVertexNormals();
    const mesh = new THREE.Mesh(merged, M.asphalt);
    mesh.material = M.asphalt.clone();
    mesh.material.side = THREE.DoubleSide;
    mesh.material.polygonOffset = true;
    mesh.material.polygonOffsetFactor = -2;
    mesh.receiveShadow = true;
    mesh.name = 'ulice';
    group.add(mesh);
  }

  // ---- Most Legií (deck from OSM, piers on a 26 m rhythm)
  for (const b of SITE.osm.bridges) {
    const outer = ccw(b.outer);
    const deck = new THREE.Mesh(mergeGeometries([
      capGeometry(outer, 0.15, true, [], 4),
      capGeometry(outer, -1.4, false, [], 4),
      wallGeometry(outer, -1.4, 0.15, 3),
    ]), M.siteStone);
    deck.castShadow = deck.receiveShadow = true;
    group.add(deck);
    // principal axis via covariance
    let mx = 0, mz = 0;
    for (const p of outer) { mx += p[0]; mz += p[1]; }
    mx /= outer.length; mz /= outer.length;
    let sxx = 0, sxz = 0, szz = 0;
    for (const p of outer) { const dx = p[0] - mx, dz = p[1] - mz; sxx += dx * dx; sxz += dx * dz; szz += dz * dz; }
    const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz);
    const ax = [Math.cos(ang), Math.sin(ang)];
    let tmin = Infinity, tmax = -Infinity, wmax = 0;
    for (const p of outer) {
      const t = (p[0] - mx) * ax[0] + (p[1] - mz) * ax[1];
      const w = Math.abs(-(p[0] - mx) * ax[1] + (p[1] - mz) * ax[0]);
      tmin = Math.min(tmin, t); tmax = Math.max(tmax, t); wmax = Math.max(wmax, w);
    }
    const len = tmax - tmin;
    if (len < 60) continue;
    const piers = [];
    for (let t = tmin + 22; t < tmax - 12; t += 26) {
      const cx = mx + ax[0] * t, cz = mz + ax[1] * t;
      const h = terrain.height(cx, cz);
      if (h != null && h > -3) continue; // on land / island
      const pier = new THREE.BoxGeometry(4.2, 6, wmax * 2 + 1.5);
      pier.rotateY(-ang);
      pier.translate(cx, -4.4, cz);
      piers.push(pier);
      // arch spandrel hint
      const arch = new THREE.CylinderGeometry(11, 11, wmax * 2 - 0.5, 24, 1, true, 0, Math.PI);
      arch.rotateX(Math.PI / 2);
      arch.rotateZ(Math.PI / 2);
      arch.rotateY(-ang + Math.PI / 2);
      arch.scale(1, 0.32, 1);
      arch.translate(cx + ax[0] * 13, -4.9, cz + ax[1] * 13);
      piers.push(arch);
    }
    if (piers.length) {
      const pm = new THREE.Mesh(mergeGeometries(piers.map((g) => g.toNonIndexed())), M.siteStone);
      pm.castShadow = true;
      group.add(pm);
    }
  }

  // ---- context buildings (IPR Budovy 3D, 2009)
  const ctx = {};
  for (const key of ['wall', 'roof', 'glass', 'glassroof']) {
    const c = SITE.context[key];
    const g = new THREE.BufferGeometry();
    const pos = decode(c.pos, Float32Array);
    for (let k = 1; k < pos.length; k += 3) pos[k] -= 0.0;
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(decode(c.idx, Uint32Array), 1));
    const ng = g.toNonIndexed();
    ng.computeVertexNormals();
    const mat = key === 'wall' ? M.ctxWall : key === 'roof' ? M.ctxRoof : M.ctxGlass;
    const mesh = new THREE.Mesh(ng, mat);
    mesh.material = mat.clone();
    mesh.material.side = THREE.DoubleSide;
    mesh.castShadow = key !== 'glass';
    mesh.receiveShadow = true;
    mesh.name = 'okoli_' + key;
    group.add(mesh);
    ctx[key] = mesh;
  }
  // The New Stage (1983) only appears with the finished state
  registry.add(ctx.glass, { stage: 6, order: 0.6, mode: 'rise', xray: 'keep', modern: true });
  registry.add(ctx.glassroof, { stage: 6, order: 0.6, mode: 'rise', xray: 'keep', modern: true });

  // ---- trees along the embankment
  {
    const embank = SITE.osm.roads.find((r) => r.name === 'Masarykovo nábřeží' && !r.bridge);
    const spots = [];
    for (const r of SITE.osm.roads) {
      if (r.name !== 'Masarykovo nábřeží' && r.name !== 'Smetanovo nábřeží') continue;
      const pts = r.pts;
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let s = 4; s < l; s += 9) {
          const t = s / l;
          const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
          // river side: step towards lower terrain
          const nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l;
          for (const sgn of [1, -1]) {
            const tx = x + nx * 11 * sgn, tz = z + nz * 11 * sgn;
            const h0 = terrain.height(tx, tz);
            const hw = terrain.height(x + nx * 22 * sgn, z + nz * 22 * sgn);
            if (h0 != null && hw != null && hw < -4 && h0 > -2.5 && Math.hypot(tx, tz) < 330) spots.push([tx, h0, tz]);
          }
        }
      }
    }
    void embank;
    if (spots.length) {
      const trunkG = new THREE.CylinderGeometry(0.18, 0.28, 4, 6);
      trunkG.translate(0, 2, 0);
      const crownG = new THREE.IcosahedronGeometry(2.6, 1);
      crownG.translate(0, 6.2, 0);
      const trunks = new THREE.InstancedMesh(trunkG, M.woodDark, spots.length);
      const crowns = new THREE.InstancedMesh(crownG, new THREE.MeshStandardNodeMaterial({ color: '#56703f', roughness: 1, flatShading: true }), spots.length);
      const m = new THREE.Matrix4();
      spots.forEach(([x, y, z], i) => {
        const s = 0.85 + Math.random() * 0.35;
        m.makeScale(s, s, s).setPosition(x, y, z);
        trunks.setMatrixAt(i, m);
        crowns.setMatrixAt(i, m);
      });
      crowns.castShadow = trunks.castShadow = true;
      group.add(trunks, crowns);
    }
  }

  return { group, terrain };
}
