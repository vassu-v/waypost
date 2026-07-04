// shader.js — the two signature vertex effects, injected into every material
// via onBeforeCompile:
//   1. CURVATURE: the world bends down with distance² from the camera, so the
//      flat torus reads as a tiny planet. Gameplay math stays flat.
//   2. WIND: one global wind uniform sways foliage/signs/laundry by vertex
//      height, phased by world position so everything breathes out of sync.
// Also builds the shared 3-step toon gradient and the material factory.

import * as THREE from 'three';

export const shared = {
  uCurve:  { value: 0.00042 },                    // bend strength (1/units)
  uWind:   { value: 0 },                          // advanced each frame
  uWindAmp:{ value: 1 },                          // weather scales this
  uCamPos: { value: new THREE.Vector3() },
};

// 3-step painterly tone ramp shared by all toon materials
let _gradient = null;
export function gradientMap() {
  if (_gradient) return _gradient;
  const data = new Uint8Array([90, 175, 255, 255]);   // shadow / mid / lit / lit
  _gradient = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  _gradient.minFilter = _gradient.magFilter = THREE.NearestFilter;
  _gradient.needsUpdate = true;
  return _gradient;
}

// Patch any material with curvature (+ optional wind sway).
// sway: 0 = rigid; ~0.15 tree; ~0.5 laundry/reeds. swayBase = height where
// sway begins (trunks stay planted).
export function patch(mat, { sway = 0, swayBase = 0.4 } = {}) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCurve  = shared.uCurve;
    shader.uniforms.uWind   = shared.uWind;
    shader.uniforms.uWindAmp= shared.uWindAmp;
    shader.uniforms.uCamPos = shared.uCamPos;

    shader.vertexShader = `
      uniform float uCurve; uniform float uWind; uniform float uWindAmp;
      uniform vec3 uCamPos;
    ` + shader.vertexShader.replace('#include <project_vertex>', `
      vec4 wpos = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        wpos = instanceMatrix * wpos;
      #endif
      wpos = modelMatrix * wpos;

      ${sway > 0 ? `
      // wind sway: grows with height above swayBase, phased by world position
      {
        float h = smoothstep(${swayBase.toFixed(2)}, ${(swayBase + 3).toFixed(2)}, transformed.y);
        float ph = wpos.x * 0.35 + wpos.z * 0.41;
        float g = sin(uWind * 1.7 + ph) + 0.5 * sin(uWind * 3.1 + ph * 1.7);
        wpos.x += g * h * ${sway.toFixed(3)} * uWindAmp;
        wpos.z += 0.6 * cos(uWind * 1.3 + ph) * h * ${sway.toFixed(3)} * uWindAmp;
      }` : ''}

      // world curvature: sink with distance² from the camera on XZ
      {
        vec2 cd = wpos.xz - uCamPos.xz;
        wpos.y -= uCurve * dot(cd, cd);
      }

      vec4 mvPosition = viewMatrix * wpos;
      gl_Position = projectionMatrix * mvPosition;
    `);
  };
  // distinct programs per (sway, swayBase) variant
  mat.customProgramCacheKey = () => `wp:${sway}:${swayBase}`;
  return mat;
}

// toon material factory — flat colors, stepped light, curvature+wind baked in
const cache = new Map();
export function toon(color, opts = {}) {
  const key = `${color}|${opts.sway || 0}|${opts.swayBase || 0}|${opts.emissive || ''}|${opts.ei || 0}|${opts.flat ? 1 : 0}`;
  if (!opts.nocache && cache.has(key)) return cache.get(key);
  const mat = new THREE.MeshToonMaterial({
    color, gradientMap: gradientMap(),
    emissive: opts.emissive || 0x000000,
    emissiveIntensity: opts.ei ?? 1,
    transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
    side: opts.side || THREE.FrontSide,
    fog: opts.fog !== false,
  });
  patch(mat, opts);
  if (!opts.nocache) cache.set(key, mat);
  return mat;
}
