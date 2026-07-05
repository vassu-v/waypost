// player.js — the courier: readable silhouette (scarf + satchel), walk/run,
// bicycle & glider upgrades, spring-arm orbit camera, keyboard + mobile input.
// Position lives unwrapped in G.px/G.pz; after each step we renormalize into
// [0,MAP) and shift the camera by the same amount — invisible, since every
// copy of the world is identical.

import * as THREE from 'three';
import { MAP, wrap, wrapDist, wrapDelta } from './wrap.js';
import { G } from './state.js';
import { toon, shared, addOutlines } from './shader.js';
import { W } from './world.js';

export const SCARVES = [
  { name: 'Courier Red', color: '#C1502E', cost: 0 },
  { name: 'Harbor Teal', color: '#2E8B8B', cost: 8 },
  { name: 'Dusk Violet', color: '#5B4B8A', cost: 15 },
  { name: 'Postmaster Gold', color: '#E8B04B', cost: 22 },
];

export const P = {
  group: null, scarfSegs: [], legs: [], arms: [], bikeGroup: null, gliderGroup: null,
  camYaw: 0.4, camPitch: 0.42, camDist: 13,
  keys: {}, joy: { x: 0, z: 0, active: false }, mobileRun: false,
  onAct: null,          // set by main: fired on E / tap
  bobT: 0, speed: 0,
  scarfMat: null,
};

export function initPlayer(scene, camera) {
  const g = new THREE.Group();
  const skin = toon('#E8C8A0'), navy = toon('#3E5A6E'), boot = toon('#4A3B2A');
  P.scarfMat = toon(SCARVES[G.scarf].color, { nocache: true });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.15, 7), navy);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), skin);
  head.position.y = 2.0;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.22, 7), P.scarfMat);
  cap.position.y = 2.32;
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.34), P.scarfMat);
  brim.position.set(0, 2.24, 0.42);

  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.6, 5), boot);
    leg.position.set(s * 0.2, 0.32, 0);
    leg.geometry.translate(0, -0.2, 0); leg.position.y = 0.52;
    P.legs.push(leg); g.add(leg);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.7, 5), navy);
    arm.geometry.translate(0, -0.32, 0);
    arm.position.set(s * 0.58, 1.55, 0);
    P.arms.push(arm); g.add(arm);
  }
  // the satchel — a courier is their bag
  const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.28), toon('#8A6A48'));
  satchel.position.set(-0.5, 1.0, -0.05); satchel.rotation.z = 0.12;
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.3, 0.06), toon('#6B4A36'));
  strap.position.set(0, 1.5, -0.3); strap.rotation.z = 0.55;

  // the scarf — three trailing segments, animated every frame
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.34 - i * 0.06, 0.1, 0.5), P.scarfMat);
    P.scarfSegs.push(seg); g.add(seg);
  }
  const wrapSeg = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.18, 7), P.scarfMat);
  wrapSeg.position.y = 1.72;

  g.add(body, head, cap, brim, satchel, strap, wrapSeg);
  g.traverse(o => { o.castShadow = true; });
  addOutlines(g, 0.04);

  // bicycle (hidden until bought + auto while moving on roads)
  const bike = new THREE.Group();
  const bmat = toon('#C1502E'), tire = toon('#2A2A2A');
  for (const dz of [-0.55, 0.55]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 6, 12), tire);
    wheel.position.set(0, 0.42, dz);
    bike.add(wheel);
  }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 1.1), bmat);
  frame.position.y = 0.62; frame.rotation.x = 0.15;
  const bars = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.06), bmat);
  bars.position.set(0, 1.0, 0.55);
  bike.add(frame, bars);
  bike.visible = false;
  P.bikeGroup = bike; g.add(bike);

  // glider (unfurls when gliding)
  const glider = new THREE.Group();
  const wingMat = toon('#E8B04B', { nocache: true });
  const wing = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 3), wingMat);
  wing.rotation.x = Math.PI / 2; wing.rotation.y = Math.PI;
  wing.scale.set(1, 1, 0.35); wing.position.y = 2.9;
  glider.add(wing);
  glider.visible = false;
  P.gliderGroup = glider; g.add(glider);

  scene.add(g);
  P.group = g;

  bindInput(camera);
  return P;
}

// ── input ──
function bindInput(camera) {
  addEventListener('keydown', e => {
    if (e.repeat) return;
    P.keys[e.code] = true;
    if (e.code === 'KeyE' && G.mode === 'play' && P.onAct) P.onAct();
  });
  addEventListener('keyup', e => { P.keys[e.code] = false; });

  // mouse orbit (drag)
  let dragging = false, lx = 0, ly = 0;
  const cv = document.getElementById('game');
  cv.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; });
  addEventListener('pointermove', e => {
    if (!dragging || G.mode !== 'play') return;
    P.camYaw -= (e.clientX - lx) * 0.006;
    P.camPitch = Math.min(1.15, Math.max(0.12, P.camPitch + (e.clientY - ly) * 0.004));
    lx = e.clientX; ly = e.clientY;
  });
  addEventListener('pointerup', () => { dragging = false; });
  cv.addEventListener('wheel', e => {
    P.camDist = Math.min(24, Math.max(7, P.camDist + e.deltaY * 0.01));
  }, { passive: true });

  // mobile joystick
  const joyEl = document.getElementById('joystick'), stick = document.getElementById('stick');
  if (joyEl) {
    const setStick = (dx, dz) => { stick.style.left = 35 + dx * 30 + 'px'; stick.style.top = 35 + dz * 30 + 'px'; };
    joyEl.addEventListener('touchstart', e => { P.joy.active = true; e.preventDefault(); }, { passive: false });
    joyEl.addEventListener('touchmove', e => {
      const t = e.touches[0], r = joyEl.getBoundingClientRect();
      let dx = (t.clientX - r.left - 55) / 45, dz = (t.clientY - r.top - 55) / 45;
      const m = Math.hypot(dx, dz); if (m > 1) { dx /= m; dz /= m; }
      P.joy.x = dx; P.joy.z = dz; setStick(dx, dz);
      e.preventDefault();
    }, { passive: false });
    joyEl.addEventListener('touchend', () => { P.joy.active = false; P.joy.x = P.joy.z = 0; setStick(0, 0); });
    document.getElementById('m-run').addEventListener('touchstart', e => { P.mobileRun = !P.mobileRun; e.preventDefault(); }, { passive: false });
    document.getElementById('m-act').addEventListener('touchstart', e => { if (P.onAct) P.onAct(); e.preventDefault(); }, { passive: false });
  }
}

export function applyScarf() {
  P.scarfMat.color.set(SCARVES[G.scarf].color);
}

// carrying a fragile parcel? deliveries.js sets this
export let jostle = { fragileHeld: false, amount: 0 };

const _camTarget = new THREE.Vector3(), _camPos = new THREE.Vector3();

export function updatePlayer(dt, camera) {
  if (G.mode !== 'play' && G.mode !== 'finale' && G.mode !== 'title') return;

  // input vector, camera-relative
  let ix = 0, iz = 0;
  if (G.mode === 'play') {
    if (P.keys.KeyW || P.keys.ArrowUp) iz -= 1;
    if (P.keys.KeyS || P.keys.ArrowDown) iz += 1;
    if (P.keys.KeyA || P.keys.ArrowLeft) ix -= 1;
    if (P.keys.KeyD || P.keys.ArrowRight) ix += 1;
    ix += P.joy.x; iz += P.joy.z;
  }
  const mag = Math.min(1, Math.hypot(ix, iz));
  G.moving = mag > 0.05;
  const wantRun = !!(P.keys.ShiftLeft || P.keys.ShiftRight || P.mobileRun);
  G.running = G.moving && wantRun;

  // ride the bike automatically when running, if owned (and no fragile cargo)
  G.riding = G.bike && G.running && !jostle.fragileHeld;
  G.gliding = G.glider && G.running && (P.keys.Space || false);

  let speed = 5.2;
  if (G.running) speed = 9.0;
  if (G.riding) speed = 14.5;
  if (G.gliding) speed = 19;
  const targetSpeed = G.moving ? speed * mag : 0;
  P.speed += (targetSpeed - P.speed) * Math.min(1, dt * 8);

  if (G.moving) {
    // camera-relative: W walks away from the camera (the extra π here once
    // inverted every direction)
    const a = Math.atan2(ix, iz) + P.camYaw;
    const vx = Math.sin(a), vz = Math.cos(a);
    G.heading += wrapAngle(a - G.heading) * Math.min(1, dt * 10);
    let nx = G.px + vx * P.speed * dt;
    let nz = G.pz + vz * P.speed * dt;

    // circular colliders, wrap-aware
    for (const c of W.colliders) {
      const dx = wrapDelta(c.x, wrap(nx)), dz = wrapDelta(c.z, wrap(nz));
      const d = Math.hypot(dx, dz);
      if (d < c.r && d > 0.001) {
        const push = (c.r - d);
        nx += (dx / d) * push; nz += (dz / d) * push;
        if (jostle.fragileHeld && P.speed > 8) jostle.amount += 1.2;  // bumped the parcel!
      }
    }
    G.px = nx; G.pz = nz;
  }

  // fragile parcels dislike sprinting on foot too
  if (jostle.fragileHeld && G.running && !G.riding) jostle.amount += dt * 0.55;

  // renormalize into [0,MAP) and shift the camera with us (invisible)
  const wx = wrap(G.px), wz = wrap(G.pz);
  if (wx !== G.px || wz !== G.pz) {
    camera.position.x += wx - G.px;
    camera.position.z += wz - G.pz;
    G.px = wx; G.pz = wz;
  }

  // ── animate the body ──
  const g = P.group;
  g.position.set(G.px, G.gliding ? 2.2 : 0, G.pz);
  g.rotation.y = G.heading;

  P.bobT += dt * (4 + P.speed * 1.6);
  const stride = G.riding ? 0.25 : Math.min(1, P.speed / 6);
  P.legs[0].rotation.x = Math.sin(P.bobT) * 0.75 * stride;
  P.legs[1].rotation.x = -Math.sin(P.bobT) * 0.75 * stride;
  P.arms[0].rotation.x = -Math.sin(P.bobT) * 0.6 * stride;
  P.arms[1].rotation.x = Math.sin(P.bobT) * 0.6 * stride;
  g.position.y += Math.abs(Math.sin(P.bobT)) * 0.07 * stride;

  P.bikeGroup.visible = G.riding;
  P.gliderGroup.visible = G.gliding;

  // the scarf trails: wind when idle, motion when moving
  const windT = shared.uWind.value;
  const trail = Math.min(1, P.speed / 9);
  for (let i = 0; i < 3; i++) {
    const s = P.scarfSegs[i];
    const back = 0.35 + i * 0.42;
    const sway = Math.sin(windT * 2.2 + i * 1.1) * (0.16 + 0.1 * i) * (1 - trail * 0.4)
               + Math.sin(P.bobT * 0.9 + i) * 0.08 * trail;
    s.position.set(sway * 0.6, 1.78 - i * 0.06 + Math.sin(windT * 1.8 + i) * 0.05 * (1 + trail),
                   -back - trail * 0.22 * i);
    s.rotation.x = -0.25 - trail * 0.75 - i * 0.12;
    s.rotation.z = sway;
  }

  // ── spring-arm camera ──
  const cy = Math.sin(P.camPitch) * P.camDist;
  const ch = Math.cos(P.camPitch) * P.camDist;
  _camTarget.set(G.px, 2.2, G.pz);
  _camPos.set(
    G.px + Math.sin(P.camYaw) * ch,
    2.2 + cy,
    G.pz + Math.cos(P.camYaw) * ch
  );

  // occlusion: shrink the arm if the sight line pierces a building collider,
  // so the camera never ends up inside a house (2D ray vs circle, wrap-aware)
  {
    const dx = _camPos.x - G.px, dz = _camPos.z - G.pz;
    const len = Math.hypot(dx, dz);
    if (len > 0.001) {
      const ux = dx / len, uz = dz / len;
      let L = len;
      for (const c of W.colliders) {
        const ox = -wrapDelta(c.x, G.px), oz = -wrapDelta(c.z, G.pz);
        const tc = ox * ux + oz * uz;
        if (tc < 0 || tc > len + c.r) continue;
        const d2 = ox * ox + oz * oz - tc * tc;
        const r = c.r + 0.5;
        if (d2 >= r * r) continue;
        const t = tc - Math.sqrt(r * r - d2);
        if (t > 0.5 && t < L) L = t;
      }
      if (L < len) {
        const f = Math.max(0.12, (L - 0.4) / len);
        _camPos.set(G.px + dx * f, 2.2 + cy * f, G.pz + dz * f);
      }
    }
  }

  // tight follow — the courier stays centered, no drifting off-frame
  const k = Math.min(1, dt * 14);
  camera.position.lerp(_camPos, k);
  camera.lookAt(_camTarget);
  shared.uCamPos.value.copy(camera.position);
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
