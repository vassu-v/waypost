// world.js — turns layout.js into meshes. Strategy: everything static is
// baked into a handful of merged, vertex-colored buckets (one draw call
// each), grouped by wind behaviour:
//   static — buildings, roads, rocks     (no sway)
//   tree   — trees, heather              (gentle sway)
//   flex   — reeds, laundry, awnings…    (strong sway)
//   win    — window/lamp quads           (emissive at night)
//   neon   — neon signs                  (emissive at night, brighter)
// The whole root is then cloned 8× for the 3×3 wrap grid.

import * as THREE from 'three';
import { MAP, OFFSETS, wrapDist } from './wrap.js';
import { ZONE } from './palettes.js';
import { ROADS, BRIDGES, BUILDINGS, PROPS, SCATTER, WATER, EXTRA_COLLIDERS } from './layout.js';
import { patch, gradientMap, smoothNormals, inkBucketMat, inks, shared } from './shader.js';
import { zoneWeights } from './vibe.js';

// ── tiny deterministic RNG for authored scatter ──
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── base geometries (cloned + transformed into buckets) ──
const GEO = {
  box:  new THREE.BoxGeometry(1, 1, 1),
  cyl:  new THREE.CylinderGeometry(0.5, 0.5, 1, 7),
  cyl4: new THREE.CylinderGeometry(0.5, 0.65, 1, 4),
  cone: new THREE.ConeGeometry(0.55, 1, 7),
  pyr:  new THREE.ConeGeometry(0.74, 1, 4),
  sph:  new THREE.SphereGeometry(0.5, 7, 5),
  quad: new THREE.PlaneGeometry(1, 1),
  dome: new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
};
GEO.pyr.rotateY(Math.PI / 4);
GEO.cyl4.rotateY(Math.PI / 4);

const buckets = { static: [], tree: [], flex: [], win: [], neon: [] };
const _e = new THREE.Euler(), _q = new THREE.Quaternion(),
      _v = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();

function put(bucket, geo, color, x, y, z, o = {}) {
  const g = GEO[geo].clone().toNonIndexed();
  _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
  _m.compose(_v.set(x, y, z), _q.setFromEuler(_e), _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1));
  g.applyMatrix4(_m);
  const c = new THREE.Color(color), n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  buckets[bucket].push(g);
}

function mergeBucket(list) {
  let total = 0;
  for (const g of list) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3),
        col = new Float32Array(total * 3);
  let off = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, off * 3);
    nor.set(g.attributes.normal.array, off * 3);
    col.set(g.attributes.color.array, off * 3);
    off += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

// ── shared world output ──
export const W = {
  root: null, clones: [],
  colliders: [], signs: [], rotors: [], wakeSigns: [],
  winMat: null, neonMat: null, waterMat: null,
  skyMat: null, starsMat: null, sun: null, hemi: null,
  boardPos: null,
};

// ═══════════════ builders ═══════════════

function buildRoads() {
  const c = '#B49B72';
  for (const r of ROADS) {
    if (r.axis === 'z') put('static', 'box', c, r.at, 0.03, MAP / 2, { sx: r.w, sy: 0.08, sz: MAP });
    else                put('static', 'box', c, MAP / 2, 0.03, r.at, { sx: MAP, sy: 0.08, sz: r.w });
  }
  for (const b of BRIDGES) {
    const len = b.z1 - b.z0, mid = (b.z0 + b.z1) / 2;
    put('static', 'box', '#8A6A48', b.x, 0.55, mid, { sx: b.w, sy: 0.35, sz: len });
    put('static', 'box', '#8A6A48', b.x - b.w / 2, 1.0, mid, { sx: 0.35, sy: 0.9, sz: len });
    put('static', 'box', '#8A6A48', b.x + b.w / 2, 1.0, mid, { sx: 0.35, sy: 0.9, sz: len });
    for (let z = b.z0; z <= b.z1; z += 8) {
      put('static', 'cyl', '#6B4A36', b.x - b.w / 2, 0.4, z, { sx: 0.5, sy: 1.6, sz: 0.5 });
      put('static', 'cyl', '#6B4A36', b.x + b.w / 2, 0.4, z, { sx: 0.5, sy: 1.6, sz: 0.5 });
    }
  }
}

function windows(x, y, z, ry, w, h, color, rows = 1, cols = 2, gap = 1.6) {
  // little glowing quads pasted just off a wall; ry faces outward.
  // each gets a dark frame box sunk slightly into the wall behind it.
  const right = { x: Math.cos(ry), z: -Math.sin(ry) };
  const out = { x: Math.sin(ry), z: Math.cos(ry) };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const off = (c - (cols - 1) / 2) * gap;
    const wx = x + right.x * off, wz = z + right.z * off, wy = y + r * 1.7;
    put('static', 'box', '#4E4438', wx - out.x * 0.09, wy, wz - out.z * 0.09,
      { ry, sx: w + 0.22, sy: h + 0.22, sz: 0.1 });
    put('win', 'quad', color, wx, wy, wz, { ry, sx: w, sy: h });
  }
}

function house(b) {
  const P = ZONE[b.zone].colors;
  const baseWall = P.walls || P.ochre || P.asphalt || '#EADFC8';
  const baseRoof = P.roofs || P.stripeA || P.wet || '#B0563A';
  const w = b.w || 7, d = b.d || 6, h = b.h || 7;
  // every house its own weathering — same palette, slightly different life
  const jr = mulberry32((b.x * 13 + b.z * 7) | 0);
  const wall = new THREE.Color(baseWall).offsetHSL((jr() - 0.5) * 0.015, (jr() - 0.5) * 0.06, (jr() - 0.5) * 0.05);
  const roof = new THREE.Color(baseRoof).offsetHSL((jr() - 0.5) * 0.02, (jr() - 0.5) * 0.08, (jr() - 0.5) * 0.05);
  const trim = wall.clone().multiplyScalar(0.62);

  put('static', 'box', wall, b.x, h / 2, b.z, { sx: w, sy: h, sz: d, ry: b.rot });
  // plinth: houses sit on the ground, they don't float on it
  put('static', 'box', trim, b.x, 0.35, b.z, { sx: w + 0.4, sy: 0.7, sz: d + 0.4, ry: b.rot });
  if (b.flat) {
    put('static', 'box', roof, b.x, h + 0.25, b.z, { sx: w + 0.7, sy: 0.5, sz: d + 0.7, ry: b.rot });
  } else {
    // hip roof matched to the footprint, resting on a fascia band, with a
    // chimney planted on the ridge (not hovering beside it)
    const rh = 2.2 + Math.min(w, d) * 0.22;
    put('static', 'box', roof.clone().multiplyScalar(0.8), b.x, h + 0.22, b.z, { sx: w + 1.1, sy: 0.44, sz: d + 1.1, ry: b.rot });
    put('static', 'pyr', roof, b.x, h + 0.44 + rh / 2, b.z, { sx: w * 1.08 + 0.9, sy: rh, sz: d * 1.08 + 0.9, ry: b.rot });
    const cox = w * 0.18, chy = h + 0.44 + rh * 0.72;
    put('static', 'box', '#8A7A62', b.x + Math.cos(b.rot) * cox, chy, b.z - Math.sin(b.rot) * cox, { sx: 0.85, sy: rh, sz: 0.85, ry: b.rot });
    put('static', 'box', '#6E6250', b.x + Math.cos(b.rot) * cox, chy + rh / 2 + 0.08, b.z - Math.sin(b.rot) * cox, { sx: 1.05, sy: 0.18, sz: 1.05, ry: b.rot });
  }
  // door + windows on the "front" (rot faces +z-ish)
  const ox = Math.sin(b.rot), oz = Math.cos(b.rot);
  const fx = b.x + ox * (d / 2 + 0.06), fz = b.z + oz * (d / 2 + 0.06);
  put('static', 'box', trim, fx - ox * 0.05, 1.35, fz - oz * 0.05, { sx: 1.8, sy: 2.7, sz: 0.16, ry: b.rot });
  put('static', 'box', '#6B4A36', fx, 1.2, fz, { sx: 1.4, sy: 2.4, sz: 0.18, ry: b.rot });
  put('static', 'box', trim, fx + ox * 0.3, 0.09, fz + oz * 0.3, { sx: 1.9, sy: 0.18, sz: 1.0, ry: b.rot });
  const glow = ZONE[b.zone].colors.lamps || ZONE[b.zone].colors.windowglow || '#F2C14E';
  const floors = Math.max(1, Math.floor(h / 4));
  windows(fx, 3.6, fz, b.rot, 0.9, 1.1, glow, floors, 2, 2.2);
  // side windows so no face of a home is a blank slab
  for (const s of [1, -1]) {
    const sr = b.rot + s * Math.PI / 2;
    const sx2 = b.x + Math.sin(sr) * (w / 2 + 0.06), sz2 = b.z + Math.cos(sr) * (w / 2 + 0.06);
    windows(sx2, 3.2, sz2, sr, 0.85, 1.05, glow, floors, 2, Math.max(2, d * 0.36));
  }
  if (b.neon) {
    const nc = Math.random ? null : null; // deterministic below
    const colors = [P.pink, P.cyan, P.windowglow];
    const pick = colors[(b.x + b.z) % 3 | 0] || P.pink;
    put('neon', 'box', pick, b.x, h + 1.6, b.z, { sx: w * 0.7, sy: 1.7, sz: 0.5, ry: b.rot });
    put('neon', 'box', colors[((b.x + b.z) | 0 + 1) % 3], fx, h * 0.55, fz, { sx: 0.5, sy: h * 0.5, sz: 0.3, ry: b.rot });
  }
  W.colliders.push({ x: b.x, z: b.z, r: Math.max(w, d) / 2 + 0.6, name: b.name });
}

function postoffice(b) {
  const P = ZONE.harbor.colors;
  put('static', 'box', P.walls, b.x, 3.5, b.z, { sx: 12, sy: 7, sz: 8 });
  put('static', 'pyr', P.roofs, b.x, 8.6, b.z, { sx: 14, sy: 3.6, sz: 14 });
  // striped awning over the door
  for (let i = -2; i <= 2; i++)
    put('flex', 'box', i % 2 ? '#FFFFFF' : P.roofs, b.x + i * 1.1, 4.6, b.z - 4.4, { sx: 1.1, sy: 0.14, sz: 2.2, rx: 0.28 });
  put('static', 'box', '#6B4A36', b.x, 1.4, b.z - 4.1, { sx: 2.0, sy: 2.8, sz: 0.2 });
  windows(b.x, 4.4, b.z - 4.06, 0, 1.1, 1.3, P.lamps, 1, 3, 3.4);
  // the brass horn on the roof — a courier's landmark
  put('static', 'cone', '#E8B04B', b.x, 11.2, b.z, { sx: 1.6, sy: 2.2, rz: Math.PI * 0.55 });
  W.colliders.push({ x: b.x, z: b.z, r: 7, name: b.name });
}

function tower(b) {
  const P = ZONE[b.zone].colors;
  for (let i = 0; i < 4; i++)
    put('static', 'cyl', i % 2 ? '#F5EBDC' : (P.roofs || '#C1502E'), b.x, i * 3 + 1.5, b.z, { sx: 3.4 - i * 0.3, sy: 3, sz: 3.4 - i * 0.3 });
  put('win', 'box', '#FFE9B0', b.x, 13.2, b.z, { sx: 2.2, sy: 1.6, sz: 2.2 });
  put('static', 'cone', P.roofs || '#C1502E', b.x, 14.9, b.z, { sx: 2.8, sy: 1.8 });
  W.colliders.push({ x: b.x, z: b.z, r: 2.6, name: b.name });
}

function mill(b) {
  const P = ZONE.farms.colors;
  put('static', 'cyl', P.mills, b.x, 4, b.z, { sx: 4.4, sy: 8, sz: 4.4 });
  put('static', 'cone', '#8A6A48', b.x, 9.3, b.z, { sx: 5, sy: 2.6 });
  // rotor is a live mesh (named, rotated each frame in all clones)
  const rotor = new THREE.Group();
  rotor.name = 'rotor';
  const bladeMat = worldMats.static;
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(GEO.box, bladeMat);
    blade.scale.set(0.7, 7.5, 0.12);
    blade.position.y = 3.4;
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    arm.add(blade); rotor.add(arm);
  }
  rotor.position.set(b.x + Math.sin(b.rot) * 2.6, 7.4, b.z + Math.cos(b.rot) * 2.6);
  rotor.rotation.y = b.rot;
  pendingLive.push(rotor);
  W.colliders.push({ x: b.x, z: b.z, r: 3, name: b.name });
}

function stall(b) {
  const P = ZONE.souk.colors;
  for (const [dx, dz] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]])
    put('static', 'cyl', '#8A6A48', b.x + dx, 1.1, b.z + dz, { sx: 0.3, sy: 2.2, sz: 0.3, ry: b.rot });
  for (let i = -2; i <= 2; i++)  // slats offset along the stall's local x, not world x
    put('flex', 'box', i % 2 ? P.stripeA : P.stripeB,
      b.x + Math.cos(b.rot) * i * 0.8, 2.5, b.z - Math.sin(b.rot) * i * 0.8,
      { sx: 0.8, sy: 0.12, sz: 3.4, ry: b.rot, rx: 0.12 });
  put('static', 'box', '#9A7A52', b.x, 0.9, b.z, { sx: 3, sy: 0.8, sz: 2, ry: b.rot });
  put('static', 'box', P.stripeA, b.x - 0.6, 1.5, b.z, { sx: 0.8, sy: 0.5, sz: 0.8, ry: b.rot });
  put('static', 'sph', P.stripeB, b.x + 0.7, 1.5, b.z + 0.3, { sx: 0.7, sy: 0.7, sz: 0.7 });
}

function bathhouse(b) {
  const P = ZONE.spring.colors;
  put('static', 'box', P.timber, b.x, 2.6, b.z, { sx: 12, sy: 5.2, sz: 9, ry: b.rot });
  put('static', 'box', '#5A3A30', b.x, 5.6, b.z, { sx: 13.5, sy: 0.9, sz: 10.5, ry: b.rot });
  put('static', 'box', P.timber, b.x, 7.0, b.z, { sx: 9, sy: 2.4, sz: 6.5, ry: b.rot });
  put('static', 'box', '#5A3A30', b.x, 8.5, b.z, { sx: 10.5, sy: 0.8, sz: 8, ry: b.rot });
  windows(b.x, 2.6, b.z - 4.6, 0, 1.0, 1.4, P.lanterns, 1, 4, 2.6);
  put('win', 'box', P.lanterns, b.x - 5.5, 3.4, b.z - 4.6, { sx: 0.6, sy: 0.9, sz: 0.6 });
  put('win', 'box', P.lanterns, b.x + 5.5, 3.4, b.z - 4.6, { sx: 0.6, sy: 0.9, sz: 0.6 });
  W.colliders.push({ x: b.x, z: b.z, r: 7, name: b.name });
}

function pagoda(b) {
  const P = ZONE.spring.colors;
  put('static', 'box', P.timber, b.x, 2.2, b.z, { sx: 6.5, sy: 4.4, sz: 5.5, ry: b.rot });
  put('static', 'box', '#5A3A30', b.x, 4.8, b.z, { sx: 8, sy: 0.7, sz: 7, ry: b.rot });
  put('static', 'box', '#6B4A36', b.x + Math.sin(b.rot) * 2.8, 1.1, b.z + Math.cos(b.rot) * 2.8, { sx: 1.2, sy: 2.2, sz: 0.16, ry: b.rot });
  windows(b.x + Math.sin(b.rot) * 2.8, 3.0, b.z + Math.cos(b.rot) * 2.8, b.rot, 0.9, 1.0, P.lanterns, 1, 2, 2.4);
  W.colliders.push({ x: b.x, z: b.z, r: 3.8, name: b.name });
}

function arcade(b) {
  // Lantern Row: shuttered arcade fronts whose signs wake as you approach
  const P = ZONE.dimstreet.colors;
  put('static', 'box', P.shutter, b.x, 3, b.z, { sx: 13, sy: 6, sz: 6, ry: b.rot });
  put('static', 'box', '#4A4038', b.x, 6.4, b.z, { sx: 14, sy: 0.8, sz: 7, ry: b.rot });
  const fz = b.z + Math.cos(b.rot) * 3.2;
  for (let i = -1; i <= 1; i++)
    put('static', 'box', '#4E4438', b.x + i * 3.8, 1.6, fz, { sx: 2.6, sy: 3.2, sz: 0.2, ry: b.rot });
  // the wake-sign: its own material so proximity can light it
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000, fog: true });
  patch(mat);
  const sign = new THREE.Mesh(GEO.box, mat);
  sign.scale.set(4.5, 1.1, 0.3);
  sign.position.set(b.x, 5.2, fz);
  sign.rotation.y = b.rot;
  sign.name = 'wakesign';
  pendingLive.push(sign);
  W.wakeSigns.push({ mat, x: b.x, z: b.z, color: new THREE.Color(P.dimglow), lit: 0 });
  W.colliders.push({ x: b.x, z: b.z, r: 6.8 });
}

function observatory(b) {
  const P = ZONE.observatory.colors;
  put('static', 'cyl', P.shadow, b.x, 3.5, b.z, { sx: 13, sy: 7, sz: 13 });
  put('static', 'dome', P.heather, b.x, 7, b.z, { sx: 14, sy: 12, sz: 14 });
  put('static', 'box', P.shadow, b.x, 11.5, b.z + 3.5, { sx: 2.2, sy: 5, sz: 4 });
  // the Great Eye — one enormous brass telescope, tilted at the sky
  put('static', 'cyl', P.brass, b.x, 13.5, b.z + 1, { sx: 2.2, sy: 11, sz: 2.2, rx: -0.7 });
  put('static', 'cyl', '#C4B080', b.x, 16.4, b.z - 2.4, { sx: 2.7, sy: 2.6, sz: 2.7, rx: -0.7 });
  windows(b.x, 3.4, b.z - 6.6, 0, 1.0, 1.4, P.starlight, 1, 3, 3);
  W.colliders.push({ x: b.x, z: b.z, r: 7.2, name: b.name });
}

function shack(b) {
  const P = ZONE[b.zone].colors;
  const wall = P.bark || P.reeds || '#7A6A52';
  const base = b.stilts ? 1.6 : 0;
  if (b.stilts) for (const [dx, dz] of [[-2, -1.5], [2, -1.5], [-2, 1.5], [2, 1.5]])
    put('static', 'cyl', '#5A4A38', b.x + dx, 0.8, b.z + dz, { sx: 0.4, sy: 1.7, sz: 0.4 });
  put('static', 'box', wall, b.x, base + 1.8, b.z, { sx: 5.5, sy: 3.6, sz: 4.5, ry: b.rot });
  put('static', 'box', '#5A4A38', b.x, base + 3.9, b.z, { sx: 6.5, sy: 0.6, sz: 5.5, ry: b.rot, rz: 0.12 });
  windows(b.x + Math.sin(b.rot) * 2.3, base + 2.2, b.z + Math.cos(b.rot) * 2.3, b.rot, 0.8, 0.9, '#F2C14E', 1, 1);
  W.colliders.push({ x: b.x, z: b.z, r: 3.4, name: b.name });
}

const BUILDERS = { house, postoffice, tower, mill, stall, bathhouse, pagoda, arcade, observatory, shack };

// ── props ──
function buildProp(p) {
  const P = ZONE[p.zone].colors;
  switch (p.type) {
    case 'sign': {
      // signboards are nailed on — they do not dance in the wind
      put('static', 'cyl', '#6B4A36', p.x, 1.2, p.z, { sx: 0.3, sy: 2.4, sz: 0.3 });
      put('static', 'box', '#D8C9A8', p.x, 2.5, p.z, { sx: 2.6, sy: 0.9, sz: 0.15, ry: p.rot });
      W.signs.push({ x: p.x, z: p.z, text: p.text });
      break;
    }
    case 'dock': {
      put('static', 'box', '#8A6A48', p.x, 0.45, p.z + 4, { sx: 4, sy: 0.3, sz: 10, ry: p.rot });
      for (let i = 0; i < 3; i++)
        put('static', 'cyl', '#6B4A36', p.x - 1.8, 0.3, p.z + i * 4, { sx: 0.5, sy: 1.4, sz: 0.5 });
      break;
    }
    case 'laundry': {
      const dx = Math.cos(p.rot) * 3, dz = Math.sin(p.rot) * 3;
      put('static', 'cyl', '#6B4A36', p.x - dx, 1.4, p.z - dz, { sx: 0.22, sy: 2.8, sz: 0.22 });
      put('static', 'cyl', '#6B4A36', p.x + dx, 1.4, p.z + dz, { sx: 0.22, sy: 2.8, sz: 0.22 });
      put('flex', 'box', '#D8D2C4', p.x, 2.55, p.z, { sx: 6, sy: 0.05, sz: 0.05, ry: -p.rot });
      const cloth = ['#E8B04B', '#7FB3C8', '#F5EBDC', '#C1502E'];
      for (let i = 0; i < 4; i++) {
        const t = (i - 1.5) / 2;
        put('flex', 'quad', cloth[i], p.x + dx * t * 0.8, 2.0, p.z + dz * t * 0.8, { sx: 1.1, sy: 1.1, ry: -p.rot + Math.PI / 2 });
      }
      break;
    }
    case 'well': {
      put('static', 'cyl', '#5B7A8C', p.x, 0.6, p.z, { sx: 2.2, sy: 1.2, sz: 2.2 });
      put('static', 'pyr', '#C1502E', p.x, 3.1, p.z, { sx: 2.6, sy: 1.2, sz: 2.6 });
      put('static', 'cyl', '#6B4A36', p.x - 1, 1.9, p.z, { sx: 0.2, sy: 2.6, sz: 0.2 });
      put('static', 'cyl', '#6B4A36', p.x + 1, 1.9, p.z, { sx: 0.2, sy: 2.6, sz: 0.2 });
      W.colliders.push({ x: p.x, z: p.z, r: 1.6 });
      break;
    }
    case 'torii': {
      put('static', 'cyl', P.lanterns, p.x - 3, 2.5, p.z, { sx: 0.7, sy: 5, sz: 0.7 });
      put('static', 'cyl', P.lanterns, p.x + 3, 2.5, p.z, { sx: 0.7, sy: 5, sz: 0.7 });
      put('static', 'box', P.lanterns, p.x, 5.1, p.z, { sx: 8.4, sy: 0.6, sz: 0.9 });
      put('static', 'box', '#5A3A30', p.x, 5.8, p.z, { sx: 9.4, sy: 0.5, sz: 1.1 });
      break;
    }
    case 'spring': {
      put('static', 'cyl', P.melt, p.x, 0.12, p.z, { sx: 6, sy: 0.2, sz: 6 });
      const rng = mulberry32(p.x * 7 + p.z);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        put('static', 'sph', '#8A8478', p.x + Math.cos(a) * 3.1, 0.4, p.z + Math.sin(a) * 3.1, { sx: 1 + rng(), sy: 0.8, sz: 1 + rng() });
      }
      break;
    }
    case 'antenna': {
      put('flex', 'cyl', '#8A92A4', p.x, 16 + 2, p.z, { sx: 0.15, sy: 5, sz: 0.15 });
      put('flex', 'box', '#8A92A4', p.x, 19, p.z, { sx: 1.6, sy: 0.08, sz: 0.08, ry: p.rot });
      break;
    }
    case 'cratepile': {
      put('static', 'box', '#A98A5B', p.x, 0.5, p.z, { sx: 1.1, sy: 1, sz: 1.1, ry: p.rot });
      put('static', 'box', '#8A6A48', p.x + 1, 0.45, p.z + 0.4, { sx: 0.9, sy: 0.9, sz: 0.9, ry: p.rot + 0.5 });
      put('static', 'box', '#A98A5B', p.x + 0.4, 1.4, p.z + 0.1, { sx: 0.8, sy: 0.8, sz: 0.8, ry: p.rot + 0.9 });
      break;
    }
    case 'bench': {
      put('static', 'box', '#8A6A48', p.x, 0.55, p.z, { sx: 2.4, sy: 0.12, sz: 0.7, ry: p.rot });
      put('static', 'box', '#6B4A36', p.x - 0.9, 0.28, p.z, { sx: 0.15, sy: 0.55, sz: 0.6, ry: p.rot });
      put('static', 'box', '#6B4A36', p.x + 0.9, 0.28, p.z, { sx: 0.15, sy: 0.55, sz: 0.6, ry: p.rot });
      break;
    }
    case 'lamppost': lamppost(p.x, p.z); break;
  }
}

function lamppost(x, z) {
  put('static', 'cyl', '#3E4A52', x, 1.9, z, { sx: 0.24, sy: 3.8, sz: 0.24 });
  put('win', 'box', '#FFE9B0', x, 3.9, z, { sx: 0.55, sy: 0.7, sz: 0.55 });
}

// ── scatter builders ──
const SCATTER_BUILDERS = {
  pinetree(x, z, rng) {
    const P = ZONE.pine.colors;
    const s = 0.8 + rng() * 0.7, h = 5 + rng() * 4;
    // per-tree hue drift so a forest reads as many greens, not one
    const pine = new THREE.Color(P.pines).offsetHSL((rng() - 0.5) * 0.02, (rng() - 0.5) * 0.08, (rng() - 0.5) * 0.05);
    put('tree', 'cyl', P.bark, x, h * 0.2, z, { sx: 0.5 * s, sy: h * 0.4, sz: 0.5 * s });
    put('tree', 'cone', pine, x, h * 0.45, z, { sx: 3.2 * s, sy: h * 0.5 });
    put('tree', 'cone', pine, x, h * 0.72, z, { sx: 2.5 * s, sy: h * 0.45 });
    put('tree', 'cone', P.moss, x, h * 0.97, z, { sx: 1.7 * s, sy: h * 0.4 });
  },
  roundtree(x, z, rng) {
    const F = ZONE.farms.colors;
    const s = 0.8 + rng() * 0.6;
    const fall = rng() < 0.14;                        // scattered autumn accents
    const lo = new THREE.Color(fall ? F.autumn : F.canopy)
      .offsetHSL((rng() - 0.5) * 0.02, (rng() - 0.5) * 0.1, (rng() - 0.5) * 0.05);
    const hi = new THREE.Color(fall ? F.autumnHi : F.canopyHi)
      .offsetHSL((rng() - 0.5) * 0.02, 0, (rng() - 0.5) * 0.04);
    put('tree', 'cyl', '#6B4A36', x, 1.4 * s, z, { sx: 0.6 * s, sy: 2.8 * s, sz: 0.6 * s });
    put('tree', 'sph', lo, x, 3.6 * s, z, { sx: 3.4 * s, sy: 3 * s, sz: 3.4 * s });
    // sunlit crown cap — the cheap two-tone that sells stylized foliage
    put('tree', 'sph', hi, x + 0.4 * s, 4.5 * s, z - 0.3 * s, { sx: 2.1 * s, sy: 1.7 * s, sz: 2.1 * s });
  },
  palm(x, z, rng) {
    const h = 4.5 + rng() * 2, lean = rng() * 0.3 - 0.15;
    put('tree', 'cyl', '#9A7A52', x, h / 2, z, { sx: 0.4, sy: h, sz: 0.4, rz: lean });
    // fronds droop outward and DOWN (positive rz lifted the tips — the
    // inverted-umbrella look). Two tiers so the crown reads full.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rng();
      const g = new THREE.Color('#4E7A42').offsetHSL(0, (rng() - 0.5) * 0.1, (rng() - 0.5) * 0.06);
      put('flex', 'box', g, x + Math.cos(a) * 1.15, h + 0.35, z + Math.sin(a) * 1.15,
        { sx: 2.5, sy: 0.09, sz: 0.55, ry: -a, rz: -0.38 });
      if (i % 2 === 0)
        put('flex', 'box', g, x + Math.cos(a + 0.5) * 0.7, h + 0.6, z + Math.sin(a + 0.5) * 0.7,
          { sx: 1.7, sy: 0.08, sz: 0.45, ry: -(a + 0.5), rz: -0.16 });
    }
    // coconuts, because someone will look
    put('static', 'sph', '#6B4A36', x + 0.28, h + 0.1, z + 0.1, { sx: 0.34, sy: 0.34, sz: 0.34 });
    put('static', 'sph', '#5A4A38', x - 0.2, h + 0.05, z - 0.22, { sx: 0.3, sy: 0.3, sz: 0.3 });
  },
  fieldrow(x, z, rng) {
    const P = ZONE.farms.colors;
    put('static', 'box', P.soil, x, 0.12, z, { sx: 10 + rng() * 6, sy: 0.24, sz: 2.4, ry: rng() * 0.3 });
    put('flex', 'box', P.fields, x, 0.6, z, { sx: 9 + rng() * 6, sy: 0.9, sz: 1.8, ry: rng() * 0.3 });
  },
  reed(x, z, rng) {
    const P = ZONE.marsh.colors;
    put('flex', 'cyl', P.reeds, x, 0.9, z, { sx: 0.12, sy: 1.8 + rng(), sz: 0.12, rz: rng() * 0.2 - 0.1 });
  },
  cattail(x, z, rng) {
    const P = ZONE.marsh.colors;
    put('flex', 'cyl', P.moss, x, 1.0, z, { sx: 0.1, sy: 2.2, sz: 0.1 });
    put('flex', 'cyl', '#6B4A36', x, 2.2, z, { sx: 0.3, sy: 0.7, sz: 0.3 });
  },
  heather(x, z, rng) {
    const P = ZONE.observatory.colors;
    put('tree', 'sph', rng() > 0.4 ? P.heather : P.violet, x, 0.5, z, { sx: 1.4 + rng(), sy: 1, sz: 1.4 + rng() });
  },
  lantern(x, z, rng) {
    const P = ZONE.spring.colors;
    put('static', 'cyl', '#5A3A30', x, 1.1, z, { sx: 0.2, sy: 2.2, sz: 0.2 });
    put('win', 'box', P.lanterns, x, 2.4, z, { sx: 0.6, sy: 0.8, sz: 0.6 });
  },
  rock(x, z, rng) {
    put('static', 'sph', '#8A8478', x, 0.3 + rng() * 0.3, z, { sx: 1 + rng() * 1.5, sy: 0.8 + rng(), sz: 1 + rng() * 1.5, ry: rng() * 3 });
  },
  grasstuft(x, z, rng) {
    const g = new THREE.Color('#7A9A5A').offsetHSL((rng() - 0.5) * 0.03, (rng() - 0.5) * 0.15, (rng() - 0.5) * 0.08);
    put('flex', 'cone', g, x, 0.45, z, { sx: 0.8, sy: 0.9, ry: rng() * 3 });
    put('flex', 'cone', g, x + 0.5, 0.32, z + 0.3, { sx: 0.55, sy: 0.65, ry: rng() * 3 });
  },
  bush(x, z, rng) {
    const g = new THREE.Color(rng() > 0.5 ? '#5E8C4A' : '#6E9C52').offsetHSL(0, (rng() - 0.5) * 0.12, (rng() - 0.5) * 0.07);
    const s = 0.7 + rng() * 0.8;
    put('tree', 'sph', g, x, 0.55 * s, z, { sx: 1.8 * s, sy: 1.2 * s, sz: 1.8 * s });
    put('tree', 'sph', g.clone().offsetHSL(0, 0.04, 0.05), x + 0.7 * s, 0.42 * s, z + 0.4 * s, { sx: 1.1 * s, sy: 0.8 * s, sz: 1.1 * s });
  },
  flower(x, z, rng) {
    // little clusters of colour breaking up the green
    const cols = ['#E8B04B', '#C1502E', '#F25C9B', '#F5EBDC', '#7FB3C8'];
    const c = cols[(rng() * cols.length) | 0];
    for (let i = 0; i < 3 + (rng() * 3 | 0); i++) {
      const fx = x + (rng() - 0.5) * 2.2, fz = z + (rng() - 0.5) * 2.2, fh = 0.35 + rng() * 0.25;
      put('flex', 'cyl', '#5E7A4A', fx, fh / 2, fz, { sx: 0.06, sy: fh, sz: 0.06 });
      put('flex', 'sph', c, fx, fh + 0.08, fz, { sx: 0.22, sy: 0.18, sz: 0.22 });
    }
  },
  lamppost(x, z) { lamppost(x, z); },
};

function nearRoad(x, z, pad) {
  for (const r of ROADS) {
    const d = r.axis === 'z' ? Math.abs(x - r.at) : Math.abs(z - r.at);
    if (d < r.w / 2 + pad) return true;
  }
  return false;
}
function inWater(x, z, pad) { return z > WATER.z0 - pad && z < WATER.z1 + pad; }
function nearBuilding(x, z) {
  for (const c of W.colliders) if (wrapDist(x, z, c.x, c.z) < c.r + 2) return true;
  return false;
}

function buildScatter() {
  for (const s of SCATTER) {
    const rng = mulberry32(s.seed);
    let placed = 0, guard = 0;
    while (placed < s.n && guard++ < s.n * 12) {
      const x = s.x0 + rng() * (s.x1 - s.x0);
      const z = s.z0 + rng() * (s.z1 - s.z0);
      if (s.avoidRoads && (nearRoad(x, z, 2.5) || inWater(x, z, 5) || nearBuilding(x, z))) continue;
      SCATTER_BUILDERS[s.type](x, z, rng);
      placed++;
    }
  }
}

// ── ground: one vertex-colored plane, zone-blended, with beach + bay tint ──
function buildGround() {
  const seg = 96;
  const g = new THREE.PlaneGeometry(MAP, MAP, seg, seg);
  g.rotateX(-Math.PI / 2);
  g.translate(MAP / 2, 0, MAP / 2);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const wts = new Float32Array(16);
  const _hsl = { h: 0, s: 0, l: 0 };
  const c = new THREE.Color(), sand = new THREE.Color('#E4C590'),
        deep = new THREE.Color(ZONE.harbor.colors.deep).multiplyScalar(0.55);
  const { ZONES } = { ZONES: null };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    zoneWeights(((x % MAP) + MAP) % MAP, ((z % MAP) + MAP) % MAP, wts);
    c.setRGB(0, 0, 0);
    let k = 0;
    for (const zn of Object.values(ZONE)) {
      const gc = new THREE.Color(zn.ground.day);
      c.r += gc.r * wts[k]; c.g += gc.g * wts[k]; c.b += gc.b * wts[k];
      k++;
    }
    // beach + bay
    const dToBand = Math.max(WATER.z0 - z, z - WATER.z1);
    if (dToBand < 0) c.copy(deep);
    else if (dToBand < 7) c.lerp(sand, 1 - dToBand / 7);
    // vibrance + hand-painted blotches: quiet vertex noise so big fields
    // never read as one flat fill
    c.getHSL(_hsl);
    const blotch = Math.sin(x * 0.37 + z * 0.53) * Math.sin(x * 0.11 - z * 0.17)
                 + 0.6 * Math.sin(x * 0.051 + z * 0.043) * Math.sin(x * 0.023 - z * 0.067);
    c.setHSL(_hsl.h + blotch * 0.006, Math.min(1, _hsl.s * 1.28), _hsl.l * (1 + blotch * 0.07));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap() });
  patch(mat);
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// ═══════════════ assembly ═══════════════
let pendingLive = [];      // live meshes (rotors, wake signs) added pre-clone
const worldMats = {};

export function initWorld(scene) {
  // bucket materials (created before builders run — mill needs one)
  // sway is a whisper, not a dance: only foliage tips and hanging cloth move
  worldMats.static = mkToon(0);
  worldMats.tree   = mkToon(0.06, 1.2);
  worldMats.flex   = mkToon(0.2, 0.3);
  W.winMat  = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  W.neonMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  patch(W.winMat); patch(W.neonMat);

  for (const b of EXTRA_COLLIDERS) W.colliders.push({ ...b });
  buildRoads();
  for (const b of BUILDINGS) BUILDERS[b.type](b);
  for (const p of PROPS) buildProp(p);
  buildScatter();

  const root = new THREE.Group();
  root.add(buildGround());

  const meshes = {
    static: new THREE.Mesh(mergeBucket(buckets.static), worldMats.static),
    tree:   new THREE.Mesh(mergeBucket(buckets.tree),   worldMats.tree),
    flex:   new THREE.Mesh(mergeBucket(buckets.flex),   worldMats.flex),
    win:    new THREE.Mesh(mergeBucket(buckets.win),    W.winMat),
    neon:   new THREE.Mesh(mergeBucket(buckets.neon),   W.neonMat),
  };
  meshes.static.castShadow = meshes.static.receiveShadow = true;
  meshes.tree.castShadow = true;
  for (const m of Object.values(meshes)) root.add(m);

  // ink outlines: inverted hulls over the rigid & foliage buckets, expanded
  // along smoothed normals so low-poly edges stay watertight. Shares the
  // merged geometry — 2 extra draw calls per copy.
  for (const [name, sway, swayBase] of [['static', 0, 0.4], ['tree', 0.12, 0.5]]) {
    smoothNormals(meshes[name].geometry);
    const hull = new THREE.Mesh(meshes[name].geometry, inkBucketMat({ sway, swayBase, outline: 0.05 }));
    root.add(hull);
  }
  for (const live of pendingLive) root.add(live);

  // ── the bay: painted water — depth gradient, drifting foam scallops at
  // each bank, gentle waves. All wave frequencies are 2πn/MAP so the surface
  // is seamless across wrap copies.
  const wg = new THREE.PlaneGeometry(MAP, WATER.z1 - WATER.z0, 96, 8);
  wg.rotateX(-Math.PI / 2);
  wg.translate(MAP / 2, 0.14, (WATER.z0 + WATER.z1) / 2);
  const HC = ZONE.harbor.colors;
  W.waterMat = new THREE.ShaderMaterial({
    transparent: true, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime:    { value: 0 },
      uNight:   { value: 0 },
      uDeep:    { value: new THREE.Color(HC.deep) },
      uShallow: { value: new THREE.Color(HC.shallow) },
      uFoam:    { value: new THREE.Color(HC.foam) },
    }]),
    vertexShader: `
      uniform float uCurve; uniform vec3 uCamPos; uniform float uTime;
      varying vec2 vUv; varying vec3 vW;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 wpos = modelMatrix * vec4(position, 1.0);
        wpos.y += sin(wpos.x * 0.7854 + uTime * 1.1) * 0.05
                + cos(wpos.z * 0.5 + uTime * 0.8) * 0.05;
        vec2 cd = wpos.xz - uCamPos.xz;
        wpos.y -= uCurve * dot(cd, cd);
        vW = wpos.xyz;
        vec4 mvPosition = viewMatrix * wpos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform vec3 uDeep, uShallow, uFoam; uniform float uTime, uNight;
      varying vec2 vUv; varying vec3 vW;
      #include <fog_pars_fragment>
      void main() {
        float edge = min(vUv.y, 1.0 - vUv.y) * ${(WATER.z1 - WATER.z0).toFixed(1)};
        vec3 col = mix(uShallow, uDeep, smoothstep(0.4, 13.0, edge));
        // broad painterly bands drifting through the deep
        float wob = sin(vW.x * 0.4712 + uTime * 0.5 + sin(vW.z * 0.9)) ;
        col *= 1.0 + wob * 0.035;
        // foam: a scalloped bright line hugging each bank, plus broken dashes
        float scallop = sin(vW.x * 2.042 + uTime * 1.3) * 0.4
                      + sin(vW.x * 5.1836 - uTime * 0.8) * 0.25;
        float f1 = 1.0 - smoothstep(0.0, 1.15 + scallop * 0.5, edge);
        float dash = step(0.25, sin(vW.x * 1.0996 + uTime * 0.55));
        float f2 = smoothstep(0.7, 0.0, abs(edge - 3.2 - scallop)) * dash * 0.55;
        col = mix(col, uFoam, clamp(f1 + f2, 0.0, 0.92));
        col *= 1.0 - uNight * 0.7;
        gl_FragColor = vec4(col, 0.94);
        #include <fog_fragment>
      }`,
  });
  W.waterMat.uniforms.uCurve = shared.uCurve;
  W.waterMat.uniforms.uCamPos = shared.uCamPos;
  root.add(new THREE.Mesh(wg, W.waterMat));

  // marsh mirror ponds
  const pondMat = new THREE.MeshToonMaterial({ color: ZONE.marsh.colors.deepwater, gradientMap: gradientMap() });
  patch(pondMat);
  for (const [px, pz, pr] of [[48, 282, 9], [92, 268, 7], [66, 246, 6]]) {
    const pg = new THREE.CircleGeometry(pr, 12);
    pg.rotateX(-Math.PI / 2); pg.translate(px, 0.1, pz);
    root.add(new THREE.Mesh(pg, pondMat));
  }

  scene.add(root);
  W.root = root;

  // 8 wrapped copies — geometry & materials fully shared
  for (const [ox, oz] of OFFSETS.slice(1)) {
    const c = root.clone();
    c.position.set(ox * MAP, 0, oz * MAP);
    scene.add(c);
    W.clones.push(c);
  }

  // collect every live rotor across all copies
  const rotAll = [];
  scene.traverse(o => { if (o.name === 'rotor') rotAll.push(o); });
  W.rotors = rotAll;

  // ── sky dome + stars (camera-centered, fog-free) ──
  const skyGeo = new THREE.SphereGeometry(700, 20, 12);
  W.skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color('#8FD4D9') }, uBot: { value: new THREE.Color('#F2E8CE') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uTop; uniform vec3 uBot; varying vec3 vP;
      void main(){ float h = clamp(normalize(vP).y * 1.6 + 0.18, 0.0, 1.0);
        gl_FragColor = vec4(mix(uBot, uTop, pow(h, 0.8)), 1.0); }`,
  });
  W.sky = new THREE.Mesh(skyGeo, W.skyMat);
  W.sky.renderOrder = -10;
  scene.add(W.sky);

  const starN = 340, sp = new Float32Array(starN * 3), rng = mulberry32(7);
  for (let i = 0; i < starN; i++) {
    const a = rng() * Math.PI * 2, e = 0.12 + rng() * 1.35, r = 660;
    sp[i * 3] = Math.cos(a) * Math.cos(e) * r;
    sp[i * 3 + 1] = Math.sin(e) * r;
    sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  W.starsMat = new THREE.PointsMaterial({ color: 0xF2E8FF, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  W.stars = new THREE.Points(sg, W.starsMat);
  scene.add(W.stars);

  // ── lights ──
  W.hemi = new THREE.HemisphereLight(0xcfe8e0, 0x6a7a5a, 0.65);
  scene.add(W.hemi);
  W.sun = new THREE.DirectionalLight(0xfff0d0, 1.6);
  W.sun.castShadow = true;
  W.sun.shadow.mapSize.set(2048, 2048);
  const sc = W.sun.shadow.camera;
  sc.left = sc.bottom = -55; sc.right = sc.top = 55; sc.near = 10; sc.far = 400;
  W.sun.shadow.bias = -0.0003;
  W.sun.shadow.normalBias = 1.0;     // enough to kill wall acne without peter-panning contact shadows
  scene.add(W.sun, W.sun.target);

  buckets.static = buckets.tree = buckets.flex = buckets.win = buckets.neon = null;
  pendingLive = [];
  return W;
}

function mkToon(sway, swayBase) {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap() });
  patch(m, { sway, swayBase });
  return m;
}

// ── per-frame world update: sun path, night materials, rotors, wake signs ──
const _sunDir = new THREE.Vector3();
export function updateWorld(dt, G, vibe, camera) {
  // sky follows the camera
  W.sky.position.copy(camera.position);
  W.stars.position.copy(camera.position);
  W.skyMat.uniforms.uTop.value.copy(vibe.skyTop);
  W.skyMat.uniforms.uBot.value.copy(vibe.skyBot);
  W.starsMat.opacity = vibe.night * 0.9;

  // sun swings around the loop; at night it becomes soft moonlight
  const az = (G.tod - 0.25) * Math.PI * 2;
  const el = 0.28 + Math.max(0, Math.sin(((G.tod - 0.22) / 0.56) * Math.PI)) * 0.85;
  _sunDir.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
  W.sun.position.set(G.px + _sunDir.x * 160, _sunDir.y * 160, G.pz + _sunDir.z * 160);
  W.sun.target.position.set(G.px, 0, G.pz);
  W.sun.color.copy(vibe.sun);
  W.sun.intensity = 0.5 + vibe.daylight * 1.25;
  W.hemi.color.copy(vibe.skyTop);
  W.hemi.groundColor.copy(vibe.fog);
  W.hemi.intensity = 0.62 + vibe.daylight * 0.3;

  // windows & neon wake at dusk
  const n = vibe.night;
  W.winMat.color.setScalar(0.3 + n * 1.8);
  W.neonMat.color.setScalar(0.15 + n * 2.6);

  // windmills turn with the wind
  for (const r of W.rotors) r.children.forEach((arm, i) => { arm.rotation.z += dt * 0.5; });

  // Lantern Row signs wake as the courier approaches (and only after dusk-ish)
  for (const s of W.wakeSigns) {
    const d = wrapDist(G.px, G.pz, s.x, s.z);
    const want = Math.max(0.06, (d < 26 ? 1 : 0) * (0.35 + n * 0.65));
    s.lit += (want - s.lit) * Math.min(1, dt * 2.2);
    s.mat.color.copy(s.color).multiplyScalar(s.lit * 1.5);
  }

  // ink outlines are unlit — sink them with the daylight so they never glow
  const inkF = 0.2 + vibe.daylight * 0.8;
  for (const k of inks) k.mat.color.copy(k.base).multiplyScalar(inkF);

  // water: advance waves/foam, dim toward night
  W.waterMat.uniforms.uTime.value = G.time;
  W.waterMat.uniforms.uNight.value = vibe.night;
}
