// vibe.js — blends every zone's look by wrapped distance. Sky, fog, sun,
// color grade, particle & audio weights all come from here. No hard switches:
// weights are smooth inverse-power falloffs, normalized.

import * as THREE from 'three';
import { ZONES } from './palettes.js';
import { wrapDist } from './wrap.js';

const N = ZONES.length;
const w = new Float32Array(N);

// scratch colors to avoid GC
const cA = new THREE.Color(), cB = new THREE.Color();

export const vibe = {
  weights: w,
  skyTop: new THREE.Color(), skyBot: new THREE.Color(),
  fog: new THREE.Color(), sun: new THREE.Color(),
  grade: new THREE.Color(),
  daylight: 1, night: 0,
  zoneName: '', zoneKey: '',
  fogNear: 60, fogFar: 210,
};

// smooth daylight curve: dawn ~.22, dusk ~.78 on the 0..1 day
export function daylight(tod) {
  const rise = smooth(0.19, 0.28, tod);
  const set  = 1 - smooth(0.72, 0.81, tod);
  return Math.min(rise, set);
}
function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function zoneWeights(x, z, out = w) {
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const zn = ZONES[i];
    const d = wrapDist(x, z, zn.cx, zn.cz) / zn.radius;
    const v = 1 / (1 + d * d * d * d);          // soft plateau, quick falloff
    out[i] = v; sum += v;
  }
  for (let i = 0; i < N; i++) out[i] /= sum;
  return out;
}

// blend a per-zone {day, night} color field by weights + daylight
function blendField(get, dl, target) {
  target.setRGB(0, 0, 0);
  for (let i = 0; i < N; i++) {
    if (w[i] < 0.004) continue;
    const f = get(ZONES[i]);
    cA.set(f.day); cB.set(f.night);
    cA.lerp(cB, 1 - dl);
    target.r += cA.r * w[i]; target.g += cA.g * w[i]; target.b += cA.b * w[i];
  }
  return target;
}

export function updateVibe(px, pz, tod) {
  zoneWeights(px, pz);
  const dl = daylight(tod);
  vibe.daylight = dl; vibe.night = 1 - dl;

  blendField(z => ({ day: z.sky.day[0],  night: z.sky.night[0] }), dl, vibe.skyTop);
  blendField(z => ({ day: z.sky.day[1],  night: z.sky.night[1] }), dl, vibe.skyBot);
  blendField(z => z.fog,   dl, vibe.fog);
  blendField(z => z.sun,   dl, vibe.sun);
  blendField(z => z.grade, dl, vibe.grade);

  // fog distance breathes a little: pine & marsh mist pull it closer
  let mist = 0;
  for (let i = 0; i < N; i++) {
    const k = ZONES[i].key;
    if (k === 'pine' || k === 'marsh') mist += w[i];
  }
  vibe.fogNear = 55 - mist * 25;
  vibe.fogFar  = 220 - mist * 70;

  // dominant zone for the HUD label
  let best = 0;
  for (let i = 1; i < N; i++) if (w[i] > w[best]) best = i;
  if (w[best] > 0.42) {
    vibe.zoneName = ZONES[best].name; vibe.zoneKey = ZONES[best].key;
  }
  return vibe;
}

// ── color-grade overlay: a multiply-blended DOM layer, cheapest film look ──
let gradeEl = null;
export function applyGrade() {
  if (!gradeEl) {
    gradeEl = document.createElement('div');
    gradeEl.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:4;mix-blend-mode:multiply;opacity:.5;';
    document.body.appendChild(gradeEl);
  }
  gradeEl.style.background = '#' + vibe.grade.getHexString();
}
