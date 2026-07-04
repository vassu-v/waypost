// weather.js — clear / rain / mist, drifting on gentle timers, blended
// smoothly. Rain is a Points curtain around the camera; mist mostly acts
// through fog + wind amplitude.

import * as THREE from 'three';
import { shared } from './shader.js';

let rainPts, rainMat, rainBase;
const N = 500;

export function initWeather(scene) {
  const pos = new Float32Array(N * 3);
  rainBase = [];
  for (let i = 0; i < N; i++)
    rainBase.push({ x: Math.random() * 70 - 35, y: Math.random() * 30, z: Math.random() * 70 - 35, v: 24 + Math.random() * 10 });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  rainMat = new THREE.PointsMaterial({ color: 0xaac4d8, size: 0.32, transparent: true, opacity: 0, depthWrite: false });
  rainPts = new THREE.Points(g, rainMat);
  rainPts.frustumCulled = false;
  scene.add(rainPts);
}

export function updateWeather(dt, G, vibe) {
  const w = G.weather;
  w.next -= dt;
  if (w.next <= 0) {
    const r = Math.random();
    w.kind = r < 0.55 ? 'clear' : r < 0.8 ? 'mist' : 'rain';
    w.next = 70 + Math.random() * 110;
  }
  const target = w.kind === 'clear' ? 0 : 1;
  w.blend += (target - w.blend) * Math.min(1, dt * 0.25);
  const b = w.blend;

  // weather modulates the shared wind + the vibe's fog before it's applied
  shared.uWindAmp.value = 1 + (w.kind === 'rain' ? b * 0.9 : b * 0.35);
  if (w.kind === 'mist' || (w.kind === 'clear' && b > 0.02)) {
    vibe.fogNear -= b * 28;
    vibe.fogFar -= b * 95;
  }
  if (w.kind === 'rain') {
    vibe.fogFar -= b * 60;
    vibe.sun.multiplyScalar(1 - b * 0.35);
    vibe.skyTop.lerp(vibe.fog, b * 0.45);
    vibe.skyBot.lerp(vibe.fog, b * 0.3);
  }

  // rain curtain
  const want = w.kind === 'rain' ? 0.65 * b : 0;
  rainMat.opacity += (want - rainMat.opacity) * Math.min(1, dt * 1.2);
  rainPts.visible = rainMat.opacity > 0.01;
  if (rainPts.visible) {
    const arr = rainPts.geometry.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const r = rainBase[i];
      r.y -= r.v * dt;
      if (r.y < 0) r.y = 28 + Math.random() * 4;
      arr[i * 3] = G.px + r.x; arr[i * 3 + 1] = r.y; arr[i * 3 + 2] = G.pz + r.z;
    }
    rainPts.geometry.attributes.position.needsUpdate = true;
  }
}
