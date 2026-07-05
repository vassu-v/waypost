// shader.js — the two signature vertex effects, injected into every material
// via onBeforeCompile:
//   1. CURVATURE: the world bends down with distance² from the camera, so the
//      flat torus reads as a tiny planet. Gameplay math stays flat.
//   2. WIND: one global wind uniform sways foliage/signs/laundry by vertex
//      height, phased by world position so everything breathes out of sync.
// Also builds the shared 3-step toon gradient and the material factory.

import * as THREE from 'three';

export const shared = {
  uCurve:  { value: 0.00078 },                    // bend strength (1/units) — strong enough to read as a tiny planet
  uWind:   { value: 0 },                          // advanced each frame
  uWindAmp:{ value: 1 },                          // weather scales this
  uCamPos: { value: new THREE.Vector3() },
};

// 3-step painterly tone ramp shared by all toon materials
let _gradient = null;
export function gradientMap() {
  if (_gradient) return _gradient;
  const data = new Uint8Array([80, 172, 255, 255]);   // shadow / mid / lit / lit
  _gradient = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  _gradient.minFilter = _gradient.magFilter = THREE.NearestFilter;
  _gradient.needsUpdate = true;
  return _gradient;
}

// Patch any material with curvature (+ optional wind sway).
// sway: 0 = rigid; ~0.15 tree; ~0.5 laundry/reeds. swayBase = height where
// sway begins (trunks stay planted).
// outline: inverted-hull ink pass — pushes vertices out along the smoothed
// 'sNormal' attribute (see smoothNormals), thickened slightly with camera
// distance so lines hold their weight across the diorama.
export function patch(mat, { sway = 0, swayBase = 0.4, outline = 0 } = {}) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCurve  = shared.uCurve;
    shader.uniforms.uWind   = shared.uWind;
    shader.uniforms.uWindAmp= shared.uWindAmp;
    shader.uniforms.uCamPos = shared.uCamPos;

    shader.vertexShader = `
      uniform float uCurve; uniform float uWind; uniform float uWindAmp;
      uniform vec3 uCamPos;
      ${outline > 0 ? 'attribute vec3 sNormal;' : ''}
    ` + shader.vertexShader.replace('#include <project_vertex>', `
      ${outline > 0 ? `
      {
        float dCam = distance((modelMatrix * vec4(transformed, 1.0)).xz, uCamPos.xz);
        transformed += sNormal * (${outline.toFixed(3)} * (0.6 + dCam * 0.012));
      }` : ''}
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
  // distinct programs per (sway, swayBase, outline) variant
  mat.customProgramCacheKey = () => `wp:${sway}:${swayBase}:${outline}`;
  return mat;
}

// ── ink outlines ──
// Weld coincident vertices of a (non-indexed, flat-shaded) geometry and store
// the position-averaged normal as 'sNormal' — an inverted hull expanded along
// these stays watertight where flat face normals would crack at every edge.
export function smoothNormals(geo) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, n = pos.count;
  const sn = new Float32Array(n * 3);
  const map = new Map();
  const pa = pos.array, na = nor.array;
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pa[i*3]*100)},${Math.round(pa[i*3+1]*100)},${Math.round(pa[i*3+2]*100)}`;
    let a = map.get(k);
    if (!a) { a = [0, 0, 0, []]; map.set(k, a); }
    a[0] += na[i*3]; a[1] += na[i*3+1]; a[2] += na[i*3+2]; a[3].push(i);
  }
  for (const a of map.values()) {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    const x = a[0]/l, y = a[1]/l, z = a[2]/l;
    for (const i of a[3]) { sn[i*3] = x; sn[i*3+1] = y; sn[i*3+2] = z; }
  }
  geo.setAttribute('sNormal', new THREE.BufferAttribute(sn, 3));
  return geo;
}

// Colored-ink hull material for the merged buckets: vertex color × dark
// scalar → lines read as deep tints of the thing they outline, not dead black.
// Ink is unlit, so world.js dims every entry in `inks` with daylight — else
// the lines would glow against night-darkened surfaces.
export const inks = [];   // { mat, base: THREE.Color }
export function inkBucketMat(opts = {}) {
  const m = new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, fog: true,
  });
  m.color.setScalar(0.26);
  inks.push({ mat: m, base: m.color.clone() });
  patch(m, { ...opts, outline: opts.outline ?? 0.05 });
  return m;
}

// Character outlines: per-part scaled hulls (primitives with centered origins
// scale into perfect cracks-free hulls). Thickness is absolute per axis.
let _inkChar = null;
export function addOutlines(group, t = 0.045) {
  if (!_inkChar) {
    _inkChar = new THREE.MeshBasicMaterial({ color: 0x241d17, side: THREE.BackSide, fog: true });
    inks.push({ mat: _inkChar, base: _inkChar.color.clone() });
    patch(_inkChar);
  }
  const targets = [];
  group.traverse(o => {
    if (o.isMesh && !o.userData.noOutline && !(o.geometry instanceof THREE.PlaneGeometry)) targets.push(o);
  });
  for (const m of targets) {
    m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox, s = new THREE.Vector3();
    bb.getSize(s);
    if (Math.max(s.x, s.y, s.z) < 0.12) continue;      // too small to ink
    const hull = new THREE.Mesh(m.geometry, _inkChar);
    hull.scale.set(
      1 + (2 * t) / Math.max(s.x, 0.06),
      1 + (2 * t) / Math.max(s.y, 0.06),
      1 + (2 * t) / Math.max(s.z, 0.06),
    );
    hull.userData.noOutline = true;
    hull.castShadow = false;
    m.add(hull);
  }
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
