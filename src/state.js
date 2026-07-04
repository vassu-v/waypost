// state.js — single shared game state + autosave. No logic here beyond IO.
import { SPAWN } from './layout.js';

const SAVE_KEY = 'waypost-save-v1';

export const G = {
  mode: 'title',            // title | play | pause | dialogue | modal | finale
  time: 0,                  // seconds since boot
  tod: 0.34,                // time of day 0..1 (10-minute loop); start mid-morning
  dt: 0,

  // player
  px: SPAWN.x, pz: SPAWN.z, heading: 0,
  moving: false, running: false, riding: false, gliding: false,

  // economy & progression
  stamps: 0,
  satchel: 1,               // carry capacity
  bike: false, glider: false,
  scarf: 0,                 // cosmetic index
  trust: {},                // zoneKey -> points
  deliveredCount: 0,

  // jobs
  jobs: [],                 // open board jobs
  active: [],               // accepted jobs (up to satchel size)
  story: { stage: 0, done: false },   // 0..7; 7 = finale seen

  ledger: [],               // completed job summaries (last 30)
  stampsSeen: {},           // stamp album unlocks: zoneKey -> count

  settings: { sound: true, quality: 'high' },
  tutorial: 0,              // 0..3 postmaster jobs done
  weather: { kind: 'clear', next: 90, blend: 0 },

  flags: {},                // misc story flags (wrapHintShown, etc.)
};

export function save() {
  const s = {
    tod: G.tod, px: G.px, pz: G.pz,
    stamps: G.stamps, satchel: G.satchel, bike: G.bike, glider: G.glider,
    scarf: G.scarf, trust: G.trust, deliveredCount: G.deliveredCount,
    story: G.story, ledger: G.ledger, stampsSeen: G.stampsSeen,
    settings: G.settings, tutorial: G.tutorial, flags: G.flags,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    Object.assign(G, JSON.parse(raw));
    return true;
  } catch (e) { return false; }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function wipe() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}
