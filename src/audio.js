// audio.js — procedural WebAudio soundscape. One bed per zone ambience,
// crossfaded by vibe weights; a rain layer; a soft music-box melody for the
// title and finale; small blips for pickups/deliveries.
//
// DROP-IN OVERRIDE: put seamless OGG loops in assets/audio/ named
// harbor.ogg farms.ogg pine.ogg spring.ogg souk.ogg neon.ogg marsh.ogg
// observatory.ogg dimstreet.ogg rain.ogg melody.ogg — if a file exists it
// replaces the synth bed automatically.

import { ZONES } from './palettes.js';
import { G } from './state.js';

let ctx = null, master = null, started = false;
const beds = {};        // ambience key -> { gain }
let rainGain = null, melodyGain = null, melodyTimer = null;

function noiseBuffer(seconds = 2) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function mkNoiseVoice(dest, { type = 'lowpass', freq = 400, q = 0.8, gain = 0.15, lfoRate = 0, lfoDepth = 0 }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(); src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(dest);
  if (lfoRate) {
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = lfoRate; lg.gain.value = lfoDepth;
    lfo.connect(lg).connect(g.gain); lfo.start();
  }
  src.start();
}

function mkDrone(dest, { freq = 110, type = 'sine', gain = 0.03, detune = 4 }) {
  for (const dt of [-detune, detune]) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq; o.detune.value = dt;
    const g = ctx.createGain(); g.gain.value = gain / 2;
    o.connect(g).connect(dest); o.start();
  }
}

// per-ambience synth recipes — quiet, textural, no melody
const RECIPES = {
  harbor:      d => { mkNoiseVoice(d, { freq: 320, gain: 0.5, lfoRate: 0.11, lfoDepth: 0.22 }); mkNoiseVoice(d, { type: 'bandpass', freq: 1800, q: 3, gain: 0.05, lfoRate: 0.4, lfoDepth: 0.04 }); },
  farms:       d => { mkNoiseVoice(d, { freq: 700, gain: 0.24, lfoRate: 0.17, lfoDepth: 0.12 }); mkDrone(d, { freq: 98, gain: 0.02 }); },
  pine:        d => { mkNoiseVoice(d, { freq: 500, gain: 0.34, lfoRate: 0.07, lfoDepth: 0.2 }); mkDrone(d, { freq: 65, gain: 0.025 }); },
  spring:      d => { mkNoiseVoice(d, { type: 'bandpass', freq: 900, q: 1.4, gain: 0.2, lfoRate: 0.9, lfoDepth: 0.1 }); mkDrone(d, { freq: 146, gain: 0.02 }); },
  souk:        d => { mkNoiseVoice(d, { type: 'bandpass', freq: 1200, q: 0.9, gain: 0.14, lfoRate: 1.7, lfoDepth: 0.07 }); mkDrone(d, { freq: 220, type: 'triangle', gain: 0.012 }); },
  neon:        d => { mkDrone(d, { freq: 55, type: 'sawtooth', gain: 0.018 }); mkDrone(d, { freq: 110.3, gain: 0.02 }); mkNoiseVoice(d, { type: 'highpass', freq: 4000, gain: 0.02, lfoRate: 2.3, lfoDepth: 0.015 }); },
  marsh:       d => { mkNoiseVoice(d, { freq: 420, gain: 0.2, lfoRate: 0.13, lfoDepth: 0.1 }); mkNoiseVoice(d, { type: 'bandpass', freq: 2400, q: 8, gain: 0.03, lfoRate: 0.5, lfoDepth: 0.03 }); },
  observatory: d => { mkNoiseVoice(d, { freq: 260, gain: 0.3, lfoRate: 0.05, lfoDepth: 0.18 }); mkDrone(d, { freq: 174, gain: 0.018 }); mkDrone(d, { freq: 261, gain: 0.01 }); },
  dimstreet:   d => { mkNoiseVoice(d, { freq: 240, gain: 0.2, lfoRate: 0.09, lfoDepth: 0.1 }); mkDrone(d, { freq: 82, gain: 0.015 }); },
};

async function tryFile(name, dest) {
  try {
    const res = await fetch(`assets/audio/${name}.ogg`);
    if (!res.ok) return false;
    const buf = await ctx.decodeAudioData(await res.arrayBuffer());
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    src.connect(dest); src.start();
    return true;
  } catch (e) { return false; }
}

export function initAudio() {
  if (started) return;
  started = true;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = G.settings.sound ? 0.85 : 0;
  master.connect(ctx.destination);

  for (const z of ZONES) {
    if (beds[z.ambience]) continue;
    const g = ctx.createGain(); g.gain.value = 0;
    g.connect(master);
    beds[z.ambience] = { gain: g };
    tryFile(z.ambience, g).then(ok => { if (!ok) RECIPES[z.ambience]?.(g); });
  }

  rainGain = ctx.createGain(); rainGain.gain.value = 0; rainGain.connect(master);
  tryFile('rain', rainGain).then(ok => { if (!ok) mkNoiseVoice(rainGain, { type: 'highpass', freq: 1400, gain: 0.4, lfoRate: 0.3, lfoDepth: 0.1 }); });

  melodyGain = ctx.createGain(); melodyGain.gain.value = 0; melodyGain.connect(master);
}

export function setSound(on) {
  if (!master) return;
  master.gain.linearRampToValueAtTime(on ? 0.85 : 0, ctx.currentTime + 0.4);
}

// crossfade beds by vibe weights (call each frame; cheap)
export function updateAudio(vibe, weather) {
  if (!ctx || ctx.state === 'suspended') return;
  const t = ctx.currentTime;
  for (let i = 0; i < ZONES.length; i++) {
    const bed = beds[ZONES[i].ambience];
    if (!bed) continue;
    const want = Math.min(0.9, vibe.weights[i] * 1.4);
    bed.gain.gain.setTargetAtTime(want, t, 0.8);
  }
  if (rainGain) rainGain.gain.setTargetAtTime(weather.kind === 'rain' ? weather.blend * 0.5 : 0, t, 1.2);
}

export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

// ── the melody: a music box wandering a warm pentatonic, for title & finale ──
const SCALE = [0, 3, 5, 7, 10, 12, 15, 17];   // minor pentatonic-ish, wistful
function note(step, when, dur = 1.6, vol = 0.16) {
  const f = 392 * Math.pow(2, step / 12);      // around G4
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vol, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, when + dur);
  o.connect(g).connect(melodyGain);
  o.start(when); o.stop(when + dur + 0.1);
}

const PHRASE = [0, 2, 3, 2, 5, 3, 2, 0, 1, 2, 4, 3, 2, 1, 0, 0];
let phraseAt = 0;
export function playMelody(on) {
  if (!ctx) return;
  if (melodyTimer) { clearInterval(melodyTimer); melodyTimer = null; }
  if (!on) { melodyGain?.gain.setTargetAtTime(0, ctx.currentTime, 1.5); return; }
  melodyGain.gain.setTargetAtTime(0.8, ctx.currentTime, 0.5);
  tryFile('melody', melodyGain).then(usedFile => {
    if (usedFile) return;
    const step = () => {
      const t = ctx.currentTime + 0.05;
      const idx = PHRASE[phraseAt % PHRASE.length];
      note(SCALE[idx], t, 2.2, 0.11);
      if (phraseAt % 4 === 0) note(SCALE[idx] - 12, t, 3.2, 0.05);   // soft low echo
      phraseAt++;
    };
    step();
    melodyTimer = setInterval(step, 950);
  });
}

// small diegetic blips
export function blip(kind) {
  if (!ctx || !G.settings.sound) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  if (kind === 'deliver') { o.frequency.setValueAtTime(660, t); o.frequency.linearRampToValueAtTime(990, t + 0.12); }
  else if (kind === 'pickup') { o.frequency.setValueAtTime(440, t); o.frequency.linearRampToValueAtTime(550, t + 0.08); }
  else { o.frequency.setValueAtTime(330, t); }
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + 0.4);
}
