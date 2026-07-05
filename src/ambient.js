// ambient.js — the world must feel inhabited when the player stands still.
// Zone particles (Points clouds that fade by vibe weight) + creatures:
// gulls over the harbor, herons in the marsh, cats, market crowd, steam.

import * as THREE from 'three';
import { MAP, nearestCopy, wrapDist } from './wrap.js';
import { ZONES, ZONE, SKY } from './palettes.js';
import { toon } from './shader.js';

const clouds = {};   // particleKey -> { pts, mat, base:[], n, kind }
let gulls = [], herons = [], cats = [], crowd = [], puffs = [];
let dyn;

function makeCloud(scene, key, color, n, size, opacity) {
  const pos = new Float32Array(n * 3), base = [];
  for (let i = 0; i < n; i++) {
    base.push({ x: Math.random() * 90 - 45, y: Math.random() * 12, z: Math.random() * 90 - 45, s: Math.random() * 6.3, v: 0.3 + Math.random() });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color, size, transparent: true, opacity: 0, depthWrite: false,
    blending: key === 'fireflies' || key === 'stars' ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  clouds[key] = { pts, mat, base, n, maxOp: opacity };
}

function bird(color, wing) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 6, 5), toon(color));
  body.scale.set(1.6, 0.8, 0.8);
  const wl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 1.4), toon(wing));
  const wr = wl.clone();
  wl.position.z = 0.75; wr.position.z = -0.75;
  g.add(body, wl, wr);
  g.userData.wings = [wl, wr];
  return g;
}

function cat(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.4), toon(color));
  body.position.y = 0.35;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.35), toon(color));
  head.position.set(0.55, 0.6, 0);
  const earMat = toon(color);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 4), earMat);
    ear.position.set(0.55, 0.85, s * 0.12);
    g.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.8, 5), toon(color));
  tail.position.set(-0.5, 0.6, 0); tail.rotation.z = 0.8;
  g.add(body, head, tail);
  g.tailMesh = tail;
  return g;
}

export function initAmbient(scene) {
  dyn = new THREE.Group();
  scene.add(dyn);

  makeCloud(scene, 'seeds',     ZONE.farms.colors.fields,  60, 0.5, 0.8);   // drifting seeds
  makeCloud(scene, 'steam',     ZONE.spring.colors.steam,  50, 2.6, 0.35);  // hot-spring steam
  makeCloud(scene, 'dust',      ZONE.souk.colors.dust,     70, 0.4, 0.5);   // souk dust motes
  makeCloud(scene, 'fireflies', ZONE.marsh.colors.firefly, 46, 0.9, 0.95);  // marsh fireflies
  makeCloud(scene, 'mist',      ZONE.pine.colors.mist,     40, 7.0, 0.16);  // pine mist
  makeCloud(scene, 'rainmote',  ZONE.neon.colors.cyan,     40, 0.35, 0.4);  // neon drizzle motes

  // gulls: five birds on lazy loops over the bay
  for (let i = 0; i < 5; i++) {
    const b = bird('#F5EBDC', '#D8D2C4');
    b.userData.orbit = { cx: 195 + i * 6, cz: 292 + (i % 3) * 8, r: 12 + i * 3, h: 10 + i * 2, ph: i * 1.3, sp: 0.25 + i * 0.04 };
    gulls.push(b); dyn.add(b);
  }
  // herons: two, standing very still in the marsh, occasionally shrugging
  for (const [x, z] of [[50, 280], [90, 266]]) {
    const h = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 6, 5), toon('#9BAF9E'));
    body.position.y = 1.15; body.scale.set(1.3, 1, 0.8);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.0, 5), toon('#9BAF9E'));
    neck.position.set(0.4, 1.8, 0); neck.rotation.z = -0.3;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), toon('#7A8B6F'));
    head.position.set(0.62, 2.3, 0);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 4), toon('#E8B04B'));
    beak.position.set(0.95, 2.28, 0); beak.rotation.z = -Math.PI / 2;
    for (const s of [-0.12, 0.12]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.15, 4), toon('#6B4A36'));
      leg.position.set(0, 0.55, s);
      h.add(leg);
    }
    h.add(body, neck, head, beak);
    h.userData = { x, z, ph: Math.random() * 9 };
    herons.push(h); dyn.add(h);
  }
  // cats: one on the harbor crates, one prowling Lantern Row
  const c1 = cat('#E8B04B'); c1.userData = { x: 190.5, z: 280.5, y: 2.0, ry: 0.8 };
  const c2 = cat('#3A3A44'); c2.userData = { x: 279, z: 264, y: 0, ry: 2.4 };
  cats = [c1, c2]; dyn.add(c1, c2);

  // market crowd: soft cone-people milling among the souk stalls
  const crowdCols = ['#8A3324', '#33656B', '#C98A3D', '#5B4B8A', '#B5651D', '#F0DFB8'];
  for (let i = 0; i < 7; i++) {
    const p = new THREE.Group();
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 6), toon(crowdCols[i % 6]));
    robe.position.y = 0.75;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), toon('#E8C8A0'));
    head.position.y = 1.7;
    p.add(robe, head);
    p.userData = { cx: 324 + (i % 3) * 6, cz: 158 + ((i * 7) % 20), r: 1.5 + (i % 3), ph: i * 2.1, sp: 0.12 + (i % 4) * 0.05 };
    crowd.push(p); dyn.add(p);
  }

  // low-poly clouds: fat flattened puffs drifting slowly west→east, high
  // enough to frame the diorama without shading the ground
  const cloudMat = toon(SKY.cloud), shadeMat = toon(SKY.cloudShade);
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group();
    const n = 3 + (i % 3);
    let cx = 0;
    for (let k = 0; k < n; k++) {
      const s = 3.2 + ((i * 5 + k * 3) % 4);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.5, 7, 5), k === n - 1 ? shadeMat : cloudMat);
      puff.scale.set(s * 2.1, s * (k === n - 1 ? 0.7 : 1.15), s * 1.6);
      puff.position.set(cx, k === n - 1 ? -1.2 : (k % 2) * 1.4, ((k * 7) % 5) - 2);
      cx += s * 1.5;
      g.add(puff);
    }
    g.userData = {
      x: (i * 53) % MAP, z: (i * 149 + 40) % MAP,
      y: 54 + (i % 4) * 6, sp: 1.0 + (i % 3) * 0.4, ph: i * 1.7,
    };
    puffs.push(g); dyn.add(g);
  }
}

// weights: vibe.weights indexed by ZONES order; map particle key -> zone index
const PKEY = {};
ZONES.forEach((z, i) => { if (z.particles !== 'none') PKEY[z.particles] = i; });

export function updateAmbient(dt, G, vibe) {
  const t = G.time;
  // particle clouds hover around the player; each fades by its zone's weight
  for (const key in clouds) {
    const c = clouds[key];
    const zi = PKEY[key];
    let w = zi !== undefined ? vibe.weights[zi] : 0;
    if (key === 'fireflies' || key === 'stars') w *= Math.max(0, vibe.night - 0.15) * 1.6;   // night-only
    if (key === 'rainmote') w *= 0.5 + vibe.night * 0.8;
    c.mat.opacity += ((w > 0.06 ? c.maxOp * Math.min(1, w * 1.8) : 0) - c.mat.opacity) * Math.min(1, dt * 1.5);
    if (c.mat.opacity < 0.01) { c.pts.visible = false; continue; }
    c.pts.visible = true;
    const arr = c.pts.geometry.attributes.position.array;
    for (let i = 0; i < c.n; i++) {
      const b = c.base[i];
      let y = b.y, dx = 0;
      if (key === 'seeds') { dx = Math.sin(t * 0.5 + b.s) * 4 + t * 1.2 % 9; y = 1.5 + (b.y * 0.6 + Math.sin(t * b.v + b.s) * 1.4); }
      else if (key === 'steam') { y = ((b.y + t * b.v * 1.6) % 13); dx = Math.sin(t * 0.8 + b.s) * (0.4 + y * 0.22); }
      else if (key === 'fireflies') { dx = Math.sin(t * b.v + b.s) * 2.2; y = 0.6 + Math.abs(Math.sin(t * 0.6 * b.v + b.s)) * 2.2; }
      else if (key === 'mist') { dx = Math.sin(t * 0.14 + b.s) * 7; y = 0.8 + b.y * 0.35; }
      else if (key === 'dust') { dx = Math.sin(t * 0.4 + b.s) * 2.5; y = 0.4 + ((b.y * 0.4 + t * 0.25 + b.s) % 4); }
      else { y = 3 + b.y * 0.5 + Math.sin(t * 2.2 + b.s) * 0.4; dx = Math.sin(t + b.s); }
      arr[i * 3]     = G.px + b.x + dx;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = G.pz + b.z + Math.cos(t * 0.3 + b.s) * 1.5;
    }
    c.pts.geometry.attributes.position.needsUpdate = true;
  }

  // gulls wheel; wings flap
  for (const g of gulls) {
    const o = g.userData.orbit;
    const a = t * o.sp + o.ph;
    const p = nearestCopy(o.cx + Math.cos(a) * o.r, o.cz + Math.sin(a) * o.r, G.px, G.pz);
    g.position.set(p.x, o.h + Math.sin(t * 0.7 + o.ph) * 1.6, p.z);
    g.rotation.y = -a - Math.PI / 2;
    const flap = Math.sin(t * 6 + o.ph) * 0.5;
    g.userData.wings[0].rotation.x = flap;
    g.userData.wings[1].rotation.x = -flap;
  }
  for (const h of herons) {
    const p = nearestCopy(h.userData.x, h.userData.z, G.px, G.pz);
    h.position.set(p.x, 0.1, p.z);
    h.rotation.y = Math.sin(t * 0.11 + h.userData.ph) * 0.7;   // slow scanning
  }
  for (const c of cats) {
    const u = c.userData;
    const p = nearestCopy(u.x, u.z, G.px, G.pz);
    c.position.set(p.x, u.y, p.z);
    c.rotation.y = u.ry;
    c.tailMesh.rotation.x = Math.sin(t * 1.7) * 0.4;           // the tail never sleeps
  }
  for (const cl of puffs) {
    const u = cl.userData;
    const x = (u.x + t * u.sp) % MAP;
    const p = nearestCopy(x, u.z, G.px, G.pz);
    cl.position.set(p.x, u.y + Math.sin(t * 0.08 + u.ph) * 1.5, p.z);
  }
  for (const p of crowd) {
    const u = p.userData;
    const a = t * u.sp + u.ph;
    const q = nearestCopy(u.cx + Math.cos(a) * u.r, u.cz + Math.sin(a) * u.r * 0.6, G.px, G.pz);
    p.position.set(q.x, Math.abs(Math.sin(t * 3 + u.ph)) * 0.06, q.z);
    p.rotation.y = -a;
    p.visible = vibe.daylight > 0.25;                          // market sleeps at night
  }
}
