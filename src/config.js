// Building frame "B": u = east (x), v = south along the long axis (z), y = up, metres.
// v = 0 is the main north façade line, the loggia projects to v ≈ −7.9, the south end is v ≈ 96.4.
// Derived from RÚIAN footprint (č. p. 223), OSM building parts, IPR Budovy 3D heights and
// J. Fialka's 1883 plans/section (podklady/01_plany_rezy_pohledy).
import * as THREE from 'three/webgpu';
import { SITE } from './data/site.js';
import { ccw } from './core/geom.js';

export const FRAME = {
  origin: new THREE.Vector3(...SITE.frame.originWorld),
  rotationY: SITE.frame.rotationY,
};

// building frame → world
export function bToWorld(u, y, v, out = new THREE.Vector3()) {
  const c = Math.cos(FRAME.rotationY), s = Math.sin(FRAME.rotationY);
  return out.set(FRAME.origin.x + u * c + v * s, y, FRAME.origin.z - u * s + v * c);
}

// Heights above street level (0 = 191.3 m Bpv)
export const H = {
  plinth: 1.1,
  ground: 8.0,          // top of rusticated ground floor (string course)
  piano: 15.6,          // top of piano nobile
  loggiaFloor: 6.6,     // floor of the loggia and the foyer behind it (1914 section)
  upperFloor: 14.4,     // floor above the foyer (its flat ceiling ≈13.9)
  mezz: 19.0,           // frieze / mezzanine with oval windows
  cornice: 21.4,        // top of main cornice
  balustrade: 22.7,
  atticTop: 29.6,       // set-back attic storey under the dome
  atticCornice: 30.6,
  domeBase: 30.6,
  domeTop: 39.0,        // top of the slate (1914 section ≈ 39.3)
  crownBand: 40.5,      // top of the gilded band above the slate = flat roof (IPR roof max 40.8 incl. skylight)
  crown: 41.9,          // gilded cresting ("zlatá koruna") on the band
  spire: 46.8,          // gilded corner spires: ball Ø ≈ 0.75 at ≈ 43.6, spike tip ≈ 46.8 (1914 section, photos)
  southCornice: 21.4,   // south wing main cornice (1914 elevation)
  provAttic: 26.8,      // attic storey of the former Provisional Theatre, flush with the façades
  southRoofProv: 31.0,  // its copper hip roof: eaves ≈ 28, ridge ≈ 31 (OSM 31)
  southRoofSchulz: 25.3, // low copper hip roof of the Schulz house behind its balustrade
  stageFloor: 3.0,
  pitBottom: -6.6,      // stage pit, ≈ −9.6 below the stage floor
  basement1: -4.4,
  basement2: -8.6,
  foundation: -9.6,
};

// Sections along the axis (v ranges)
export const V = {
  loggiaFront: -7.9,
  facade: 0,
  foyer: [1.4, 7.8],    // in the façade frame (FACADE): from the inner face of the north wall, 6.4 m deep (Fialka, I. tier plan)
  auditoriumBack: 13.7,  // centre line of the horseshoe wall on the axis (= AUD.cv − AUD.outerHalfWidth)
  portal: 36.6,         // proscenium wall centre (Fialka 1883 plans registered on the RÚIAN outline)
  stageBack: 52.1,      // back wall of the stage (Fialka 1883; stage 14 m deep), opening to the rear stage
  mainEnd: 52.2,
  connectorEnd: 57.8,
  provEnd: 76.5,
  south: 96.4,
};

// Footprints (B frame, CCW in x,z)
export const FP = {
  // full historic block (RÚIAN, simplified)
  all: ccw(SITE.frame.footprint),
  loggia: ccw([[-12.09, -1.19], [-11.54, -7.88], [13.05, -5.54], [12.66, 1.02]]),
  main: ccw([[-18.87, -1.76], [19.24, 1.76], [18.66, 52.2], [-15.82, 52.2], [-18.73, 17.77], [-19.04, 4.85]]),
  terrace: ccw([[-19.04, 4.85], [-18.73, 17.77], [-24.15, 18.29], [-25.35, 5.56]]),
  south: ccw([[-15.82, 52.2], [18.66, 52.2], [18.7, 55.27], [15.98, 94.73], [-4.35, 96.43], [-9.31, 76.14], [-12.88, 65.77], [-14.6, 55.6]]),
  // set-back attic storey and dome (trapezoid following the river façade; OSM parts 6 + 39)
  domeBase: ccw([[-15.2, 4.6], [13.3, 4.6], [13.4, 50.6], [-10.6, 50.6]]),
  domeTop: ccw([[-7.9, 12.6], [5.3, 12.6], [5.5, 43.2], [-5.6, 43.2]]),
  // pylons carrying the trigae (NW, NE corners of the main front)
  pylonW: ccw([[-18.87, -1.76], [-12.1, -1.18], [-12.2, 4.95], [-19.04, 4.85]]),
  pylonE: ccw([[12.66, 1.02], [19.24, 1.76], [19.1, 7.9], [12.6, 7.6]]),
};

// The auditorium and stage are symmetric about Zítek's axis, which is turned ≈ 3° from the
// building frame (dome crown in OSM: 2.9°, Fialka plans: 2.8°) and passes u ≈ +0.5 m at v = 28 m, midway between the side façades (Fialka 1883 plans, registered on RÚIAN).
export const AXIS = { pivotV: 28, shiftU: 0.5, angle: THREE.MathUtils.degToRad(3.0) };

// The north façade (Národní) runs 5.3° off the building frame; the foyer behind the loggia follows it.
// Façade frame: u' along the façade, v' = 0 on the façade line of the RÚIAN outline.
export const FACADE = { angle: Math.atan2(1.76 + 1.76, 19.24 + 18.87) };
export function facadeToB(u, v) {
  const c = Math.cos(FACADE.angle), s = Math.sin(FACADE.angle);
  return [u * c - v * s, u * s + v * c];
}

// auditorium frame ↔ building frame (u, v)
export function audToB(u, v) {
  const c = Math.cos(AXIS.angle), s = Math.sin(AXIS.angle), z = v - AXIS.pivotV;
  return [AXIS.shiftU + u * c + z * s, AXIS.pivotV - u * s + z * c];
}
export function bToAud(u, v) {
  const c = Math.cos(AXIS.angle), s = Math.sin(AXIS.angle), du = u - AXIS.shiftU, dv = v - AXIS.pivotV;
  return [du * c - dv * s, AXIS.pivotV + du * s + dv * c];
}

// Auditorium / stage geometry (symmetric about u = 0 in the auditorium frame).
// Horseshoe measured on Fialka's tier plans (tools/qa/plan_profile.py, plan_overlay_rings.py): straight sides
// from the proscenium boxes back to `cv`, then a half-ellipse. Parapets ≈ ±7.3 at the sides and v ≈ 17.7 on the
// axis; boxes ≈ 2.2 m deep (back wall ±9.5) with a corridor behind them; masonry wall ±11.6…13.0.
export const AUD = {
  axisU: 0,
  portalV: V.portal,
  cv: 26.0,                // end of the straight sides = centre of the curve
  front: V.portal - 3.0,   // proscenium boxes from here to the proscenium wall
  innerHalfWidth: 7.3,     // parapet half-width at the sides
  k: 1.14,                 // depth ÷ width of the parapet curve
  boxBack: 9.5,            // back wall of the boxes
  outerHalfWidth: 12.3,    // centre line of the horseshoe wall (a circle round cv)
  wallT: 1.4,              // its thickness: inner face 11.6, outer face 13.0
  // floors of the tiers and the edge of the painted ceiling (1914 long section; the ceiling rises ≈0.85 m)
  tiers: [3.2, 6.0, 9.5, 12.9, 17.7], // stall boxes, I., II., III. tier (I. galerie), IV. tier (II. galerie)
  parapets: [7.2, 7.3, 7.4, 7.5, 9.7], // parapet half-width per tier (the top tier is set back)
  parapetK: [1.14, 1.14, 1.15, 1.14, 1.07],
  // boxes run along the straight sides and this far into the curve (rad from each side); the rest of the
  // curve is an open balcony (I., II.) or gallery (III., IV.); the stalls level is open at the back
  boxSector: [0.55, 0.6, 0.9, 0, 0],
  ceiling: 23.2,
  ceilingCentre: V.portal - 11.0, // centre of Ženíšek's ceiling and of the chandelier
  ceilingR: 9.4,           // painted circle incl. the porphyry band
  girders: [24.8, 27.4],   // lattice girders over the ceiling; the painters' hall floor lies on them
  // II. gallery: amphitheatre behind the back of the horseshoe on the top tier (Fialka plan IV, 1914 section):
  // rows on arcs round cv from the colonnade (v ≈ 15.6) back to v ≈ 8.6, rising ≈4 m, own ceiling
  gallery: { halfAngle: THREE.MathUtils.degToRad(56), r0: 10.4, row: 0.7, rows: 10, rise: 0.4, ceiling: 24.6 },
};

// open path round the horseshoe (auditorium frame [u, v]): right front → curve → left front
export function hsPath(r, k = AUD.k, front = AUD.front, segs = 40) {
  const pts = [[r, front]];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI;
    pts.push([Math.cos(a) * r, AUD.cv - Math.sin(a) * r * k]);
  }
  pts.push([-r, front]);
  return pts;
}
// half-width of a horseshoe line at v
export function hsHalfWidth(v, r, k = AUD.k) {
  if (v >= AUD.cv) return r;
  const t = (AUD.cv - v) / (k * r);
  return t >= 1 ? 0 : r * Math.sqrt(1 - t * t);
}

// angle of an auditorium-frame point from the back of the horseshoe, seen from its centre (π in front)
export function backAngle(u, v) {
  return v < AUD.cv ? Math.abs(Math.atan2(u, AUD.cv - v)) : Math.PI;
}
// split a path round the horseshoe into [side, back sector, side] at the II. gallery's opening
export function splitAtGallery(path) {
  const inside = path.map(([u, v]) => backAngle(u, v) < AUD.gallery.halfAngle);
  const i0 = inside.indexOf(true), i1 = inside.lastIndexOf(true);
  if (i0 < 0) return [path, [], []];
  return [path.slice(0, i0 + 1), path.slice(i0, i1 + 1), path.slice(i1)];
}

export const STAGE = {
  width: 14.5, depth: 14.0, floor: H.stageFloor,
  portalWidth: 11.66, bridge: 8.03,
  galleries: [8.52, 10.82, 14.42],
  grid: 25.5,
  houseHalfWidth: 11.4,  // stage side walls (Fialka 1883: 21.3 m between the walls)
};

// fly tower above the cornice, kept under the dome (auditorium frame)
export const FLY = { half: 11.0, back: 49.4, top: 29.5 }; // top just under the attic deck (H.atticTop 29.6)

// rear stage (1983) in the former Provisional Theatre: 11 × 12 m, on the stage axis
export const REAR = { u: audToB(0, V.stageBack + 6.5)[0], v: V.stageBack + 6.5, half: 5.6, depth: 12 };

export const SITE_DATA = SITE;
