// main.js — boot, render loop, mode routing. Everything else lives in its
// own module; this file only wires them together.

import * as THREE from 'three';
import { wrapDist } from './wrap.js';
import { shared } from './shader.js';
import { G, save, load, hasSave, wipe } from './state.js';
import { BOARD, SPAWN } from './layout.js';
import { updateVibe, applyGrade, vibe } from './vibe.js';
import { initWorld, updateWorld, W } from './world.js';
import { initAmbient, updateAmbient } from './ambient.js';
import { initWeather, updateWeather } from './weather.js';
import { initPlayer, updatePlayer, applyScarf, P } from './player.js';
import { initNPCs, updateNPCs, nearestNPC } from './npc.js';
import { interact, updateDeliveries, compassTarget, refreshBoard } from './deliveries.js';
import * as UI from './ui.js';
import * as AUDIO from './audio.js';

// ── renderer / scene / camera ──
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1600);
camera.position.set(SPAWN.x + 14, 10, SPAWN.z + 14);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── build the world ──
const loadMsg = document.getElementById('load-msg');
loadMsg.textContent = 'raising the pines…';
initWorld(scene);
loadMsg.textContent = 'hanging the laundry…';
initAmbient(scene);
initWeather(scene);
initNPCs(scene);
initPlayer(scene, camera);
P.onAct = interact;

applyQuality();
UI.initUI({
  onStart(fresh) {
    if (fresh) { wipe(); }
    else { load(); applyScarf(); }
    G.px = fresh ? SPAWN.x : G.px; G.pz = fresh ? SPAWN.z : G.pz;
    AUDIO.initAudio(); AUDIO.resumeAudio();
    AUDIO.playMelody(false);
    refreshBoard();
    UI.startPlay();
    if (G.tutorial < 3) UI.toast('The postmaster is waiting inside the post office — the building with the brass horn. Press E near her.');
  },
  onQuality: applyQuality,
});

function applyQuality() {
  const high = G.settings.quality === 'high';
  renderer.setPixelRatio(high ? Math.min(devicePixelRatio, 2) : 1);
  if (W.sun) {
    W.sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
    if (W.sun.shadow.map) { W.sun.shadow.map.dispose(); W.sun.shadow.map = null; }
  }
  // low quality: drop the four diagonal wrap copies (fog hides the corners)
  W.clones.forEach((c, i) => { c.visible = high || i < 4; });
}

// ── title screen (living background: slow drift around the harbor) ──
UI.showTitle(hasSave());
AUDIO.initAudio; // (audio starts on first user gesture)
document.getElementById('title').addEventListener('pointerdown', () => {
  AUDIO.initAudio(); AUDIO.resumeAudio(); AUDIO.playMelody(true);
}, { once: true });

// ── the loop ──
window.G = G;                      // dev console access (harmless in prod)
const clock = new THREE.Clock();
let saveTimer = 0, uiTimer = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  G.dt = dt; G.time += dt;
  shared.uWind.value = G.time;          // the global breath — sways all foliage

  const playing = G.mode === 'play' || G.mode === 'dialogue' || G.mode === 'modal' || G.mode === 'finale' || G.mode === 'finale-credits';

  // time only passes while the world is awake (not on title/pause)
  if (playing) G.tod = (G.tod + dt / 600) % 1;

  updateVibe(G.px, G.pz, G.tod);
  updateWeather(dt, G, vibe);            // may soften fog/sun before applying
  scene.fog = scene.fog || new THREE.Fog(0xffffff, 60, 220);
  scene.fog.color.copy(vibe.fog);
  scene.fog.near = vibe.fogNear;
  scene.fog.far = vibe.fogFar;
  applyGrade();

  if (G.mode === 'title') {
    const a = G.time * 0.045;
    camera.position.set(BOARD.x + Math.cos(a) * 26, 11 + Math.sin(G.time * 0.1) * 2, BOARD.z + Math.sin(a) * 26);
    camera.lookAt(BOARD.x, 4, BOARD.z);
    shared.uCamPos.value.copy(camera.position);
  } else if (G.mode === 'play' || G.mode === 'finale') {
    updatePlayer(dt, camera);
  }

  if (playing || G.mode === 'title') {
    updateNPCs(dt, camera);
    updateAmbient(dt, G, vibe);
    updateWorld(dt, G, vibe, camera);
  }

  if (G.mode === 'play' || G.mode === 'finale') {
    updateDeliveries(dt);
    // HUD at ~10 Hz
    uiTimer -= dt;
    if (uiTimer <= 0) {
      uiTimer = 0.1;
      UI.updateCompass(P.camYaw, compassTarget());
      UI.setZoneName(vibe.zoneName);
      const near = wrapDist(G.px, G.pz, BOARD.x, BOARD.z) < 4.5 || nearestNPC(5.5) ||
        W.signs.some(s => wrapDist(G.px, G.pz, s.x, s.z) < 4);
      UI.setPrompt(!!near && G.mode === 'play');
    }
    saveTimer -= dt;
    if (saveTimer <= 0) { saveTimer = 12; save(); }
  }

  AUDIO.updateAudio(vibe, G.weather);
  renderer.render(scene, camera);
}

document.getElementById('loading').classList.add('hidden');
frame();
