// npc.js — twelve inhabitants on daily loops, plus the ferry (and the
// ferryman who never comes ashore… until he does). NPCs live once in the
// scene and are re-seated at their nearest wrapped copy every frame.

import * as THREE from 'three';
import { nearestCopy, wrapDist, wrapDelta } from './wrap.js';
import { NPCS, FERRY } from './layout.js';
import { MAP } from './wrap.js';
import { toon } from './shader.js';
import { G } from './state.js';

export const npcs = [];      // { def, group, x, z, tx, tz, facing }
export let ferry = null;

function buildNPC(def) {
  const g = new THREE.Group();
  const scale = def.small ? 0.62 : 1;
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.58, 1.25, 7), toon(def.color));
  robe.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.37, 8, 6), toon('#E8C8A0'));
  head.position.y = 1.95;
  g.add(robe, head);
  switch (def.hat) {
    case 'cap': {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 0.2, 7), toon('#4A3B2A'));
      h.position.y = 2.25; g.add(h); break;
    }
    case 'brim': {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 0.1, 8), toon('#C9B278'));
      h.position.y = 2.2; g.add(h);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.25, 7), toon('#C9B278'));
      top.position.y = 2.33; g.add(top); break;
    }
    case 'wrap': {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), toon(def.color));
      h.position.y = 2.05; g.add(h); break;
    }
    case 'band': {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.12, 7), toon('#F25C9B'));
      h.position.y = 2.18; g.add(h); break;
    }
  }
  if (def.key === 'marin') {
    // the foreshadowing: a faded courier satchel with trim like yours
    const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.24), toon('#9A8468'));
    satchel.position.set(-0.48, 0.95, 0);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.09, 0.26), toon('#C1502E'));
    trim.position.set(-0.48, 1.12, 0);
    g.add(satchel, trim);
  }
  g.scale.setScalar(scale);
  g.traverse(o => { o.castShadow = true; });
  return g;
}

export function initNPCs(scene) {
  for (const def of NPCS) {
    const g = buildNPC(def);
    const start = def.sched[0] || { x: 200, z: 300 };
    const n = { def, group: g, x: start.x, z: start.z, tx: start.x, tz: start.z, facing: 0, bob: Math.random() * 9 };
    npcs.push(n);
    scene.add(g);
  }

  // the ferry: flat hull + cabin + smokestack, forever crossing the bay
  ferry = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 1.2, 3), toon('#5B7A8C'));
  hull.position.y = 0.5;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.2, 2.6), toon('#C9B278'));
  deck.position.y = 1.15;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 2), toon('#F5EBDC'));
  cabin.position.set(-1, 1.95, 0);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.4, 7), toon('#C1502E'));
  stack.position.set(-1.6, 3.1, 0);
  ferry.add(hull, deck, cabin, stack);
  ferry.traverse(o => { o.castShadow = true; });
  scene.add(ferry);
}

// where is NPC scheduled to be at time-of-day t? (windows may wrap midnight)
function schedTarget(def, tod) {
  for (const s of def.sched) {
    const inWin = s.t0 <= s.t1 ? (tod >= s.t0 && tod < s.t1) : (tod >= s.t0 || tod < s.t1);
    if (inWin) return s;
  }
  return def.sched[0];
}

export function ferryPos(time) {
  // the ferry crosses the whole map east→west in the bay — through the wrap
  const x = (time * FERRY.speed) % MAP;
  return { x, z: FERRY.z + Math.sin(time * 0.3) * 4 };
}

export function updateNPCs(dt, camera) {
  const t = G.time;
  for (const n of npcs) {
    const def = n.def;
    if (def.onFerry && !G.flags.marinAshore) {
      // Marin rides the ferry, always facing away from the player
      const fp = ferryPos(t);
      n.x = fp.x; n.z = fp.z;
      const p = nearestCopy(n.x, n.z, G.px, G.pz);
      n.group.position.set(p.x + 1.2, 1.25, p.z);
      const away = Math.atan2(wrapDelta(G.px, n.x), wrapDelta(G.pz, n.z));
      n.group.rotation.y = away;      // back turned to whoever approaches
      continue;
    }
    if (def.key === 'marin' && G.flags.marinAshore) {
      // after the reveal he waits on Observatory Hill
      n.x = 326; n.z = 66;
    } else if (!def.onFerry) {
      const s = schedTarget(def, G.tod);
      n.tx = s.x; n.tz = s.z;
      const dx = wrapDelta(n.x, n.tx), dz = wrapDelta(n.z, n.tz);
      const d = Math.hypot(dx, dz);
      if (d > 0.4) {
        const sp = Math.min(2.6, d) * dt * 1.4;
        n.x += (dx / d) * sp * 2.6; n.z += (dz / d) * sp * 2.6;
        n.facing = Math.atan2(dx, dz);
        n.bob += dt * 9;
      } else {
        // idle: face the player if they're close (Marin excepted, above)
        const pd = wrapDist(n.x, n.z, G.px, G.pz);
        if (pd < 7) n.facing = Math.atan2(wrapDelta(n.x, G.px), wrapDelta(n.z, G.pz));
        n.bob += dt * 2;
      }
    }
    const p = nearestCopy(n.x, n.z, G.px, G.pz);
    n.group.position.set(p.x, Math.abs(Math.sin(n.bob)) * 0.05, p.z);
    n.group.rotation.y += ((n.facing - n.group.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 6);
  }

  // ferry itself
  if (!G.flags.marinAshore) {
    const fp = ferryPos(t);
    const p = nearestCopy(fp.x, fp.z, G.px, G.pz);
    ferry.position.set(p.x, 0.1 + Math.sin(t * 0.9) * 0.08, p.z);
    ferry.rotation.y = -Math.PI / 2;
    ferry.rotation.z = Math.sin(t * 0.7) * 0.02;
  } else {
    // docked at the harbor pier, at rest at last
    const p = nearestCopy(206, 308, G.px, G.pz);
    ferry.position.set(p.x, 0.1 + Math.sin(t * 0.5) * 0.04, p.z);
    ferry.rotation.y = -Math.PI / 2 + 0.3;
  }
}

export function findNPC(key) { return npcs.find(n => n.def.key === key); }

// nearest interactable NPC within reach
export function nearestNPC(maxD = 4.5) {
  let best = null, bd = maxD;
  for (const n of npcs) {
    // Marin unreachable while the ferry sails, unless it's passing the bridge
    const d = wrapDist(n.x, n.z, G.px, G.pz);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
