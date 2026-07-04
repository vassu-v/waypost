// deliveries.js — the courier loop: board jobs, fetch → carry → deliver,
// stamps, trust, tutorial, and the mystery-parcel thread. No fail states:
// melted or jostled parcels still land, just humbler.

import { wrapDist } from './wrap.js';
import { G, save } from './state.js';
import { BOARD, NPCS } from './layout.js';
import { ZONE } from './palettes.js';
import { W } from './world.js';
import { findNPC, nearestNPC } from './npc.js';
import { jostle } from './player.js';
import { TUTORIAL_JOBS, STORY_PARCELS, GREETINGS, FINALE } from './story.js';
import * as UI from './ui.js';
import * as AUDIO from './audio.js';

const zoneOf = key => NPCS.find(n => n.key === key)?.zone || 'harbor';

// ── authored board-job templates: [giver, recipient, title, flavor, special, tier] ──
const TEMPLATES = [
  ['saffron', 'bram',  'A thermos of soup', 'Still hot. Bram forgets to eat when the pines need him.', 'urgent', 1],
  ['pello',  'saffron','A sack of barley', 'For the inn kitchen. Smells like summer.', null, 1],
  ['yuzu',   'nikko',  'Six glass bowls', 'Nikko keeps breaking them. Do not add to the tally.', 'fragile', 1],
  ['nikko',  'yuzu',   'Noodles, extra steam', 'A thank-you for the bowls. Eat-by: immediately.', 'urgent', 1],
  ['bram',   'tam',    'A tin of pine tar', 'For boat seams. Smells like the highlands.', null, 1],
  ['tam',    'pello',  'Marsh-cedar tool handles', 'Balanced. Tam does not make unbalanced things.', null, 1],
  ['poppy',  'vesper', 'A crayon drawing of the telescope', 'The telescope is smiling in it.', null, 1],
  ['wick',   'nikko',  'A box of spare sign-bulbs', 'Warm ones. Nikko trades broth for light.', 'fragile', 1],
  ['saffron','nikko',  'A recipe, sealed', 'The soup summit continues.', null, 1],
  ['basira', 'vesper', 'A repaired pocketwatch', 'It keeps observatory time now — deliberately slow.', null, 2],
  ['vesper', 'basira', 'A roll of star charts', 'For calibrating chimes to the sky.', 'fragile', 2],
  ['basira', 'wick',   'A small clock for Lantern Row', 'So the lamps know when dusk is, officially.', null, 2],
  ['yuzu',   'vesper', 'A hand-ground eyepiece', 'Perfect in the middle. She will understand.', 'fragile', 2],
  ['pello',  'nikko',  'A crate of fresh greens', 'Wilting is a crime in two zones.', 'urgent', 2],
];

let jobSeq = 0;
function mkJob(t) {
  const [giver, recipient, title, flavor, special, tier] = t;
  const gn = NPCS.find(n => n.key === giver), rn = NPCS.find(n => n.key === recipient);
  const dist = wrapDist(gn.sched[0].x, gn.sched[0].z, rn.sched[0].x, rn.sched[0].z);
  return {
    id: 'j' + (jobSeq++), giver, recipient, title, flavor, special, tier,
    zone: zoneOf(recipient),
    reward: 3 + Math.round(dist / 30) + (special ? 2 : 0) + (tier - 1) * 2,
    state: 'open', timer: special === 'urgent' ? 75 : null, timerMax: 75,
    broken: false,
  };
}

export function refreshBoard() {
  const tierFor = z => (G.trust[z] || 0) >= 3 ? 2 : 1;
  const avail = TEMPLATES.filter(t =>
    t[5] <= tierFor(zoneOf(t[1])) &&
    !G.jobs.some(j => j.title === t[2]) &&
    !G.active.some(j => j.title === t[2]));
  while (G.jobs.length < 5 && avail.length) {
    const i = Math.floor(Math.random() * avail.length);
    G.jobs.push(mkJob(avail.splice(i, 1)[0]));
  }
}

export function acceptJob(job) {
  if (G.active.length >= G.satchel) { UI.toast('Your satchel is full. Deliver something first — or buy a bigger satchel.'); return false; }
  G.jobs = G.jobs.filter(j => j !== job);
  job.state = 'fetch';
  G.active.push(job);
  UI.toast(`Accepted: ${job.title}. First, collect it from ${nameOf(job.giver)}.`);
  UI.refreshHUD();
  return true;
}

export function nameOf(key) {
  if (key === 'marin' && !G.flags.marinAshore) return 'the Ferryman';
  const n = NPCS.find(n => n.key === key);
  return n ? n.name : key;
}

// ── the E key: board > NPC > signs ──
export function interact() {
  if (G.mode !== 'play') return;

  if (wrapDist(G.px, G.pz, BOARD.x, BOARD.z) < 4.5) { UI.openModal('board'); return; }

  const near = nearestNPC(5.5);
  if (near) { talkTo(near); return; }

  for (const s of W.signs) {
    if (wrapDist(G.px, G.pz, s.x, s.z) < 4) { UI.toast('The sign reads: ' + s.text); return; }
  }
}

function talkTo(n) {
  const key = n.def.key;

  // 1. deliver? (generous radius for the ferryman — he's on a moving boat)
  for (const job of G.active) {
    if (job.state === 'carry' && job.recipient === key) { completeJob(job, n); return; }
    if (job.state === 'fetch' && job.giver === key) {
      job.state = 'carry';
      if (job.special === 'fragile') { jostle.fragileHeld = true; jostle.amount = 0; }
      UI.toast(`Picked up: ${job.title}. Now deliver it to ${nameOf(job.recipient)}. Follow the ribbon.`);
      UI.refreshHUD(); AUDIO.blip('pickup');
      return;
    }
  }

  // 2. Odile: tutorial, then the mystery drawer
  if (key === 'odile') {
    if (G.tutorial < 3 && !G.active.some(j => j.tut)) { offerTutorial(); return; }
    const st = G.story.stage;
    if (G.tutorial >= 3 && st < STORY_PARCELS.length &&
        G.deliveredCount >= STORY_PARCELS[st].minDeliveries &&
        !G.active.some(j => j.story !== undefined)) {
      offerStory(); return;
    }
  }

  // 3. plain conversation
  const lines = GREETINGS[key] || ['…'];
  UI.showDialogue(nameOf(key), lines[Math.floor(Math.random() * lines.length)], [
    { label: 'Take care', act: UI.closeDialogue },
  ]);
}

function offerTutorial() {
  const t = TUTORIAL_JOBS[G.tutorial];
  UI.showDialogue('Odile', t.dialog, [
    { label: 'Take the job', act: () => {
      const job = {
        id: t.id, tut: true, giver: t.fetchFrom || 'odile', recipient: t.recipient,
        title: t.title, flavor: t.desc, special: null, reward: t.reward,
        zone: zoneOf(t.recipient),
        state: t.fetchFrom ? 'fetch' : 'carry', timer: null, broken: false,
      };
      G.active.push(job);
      UI.closeDialogue();
      UI.toast(t.fetchFrom ? `Collect it from ${nameOf(t.fetchFrom)} first.` : 'Follow the compass ribbon at the top of the screen.');
      UI.refreshHUD();
    } },
    { label: 'Not yet', act: UI.closeDialogue },
  ]);
}

function offerStory() {
  const s = STORY_PARCELS[G.story.stage];
  UI.showDialogue('Odile', s.offer, [
    { label: 'I’ll take it', act: () => {
      G.active.push({
        id: 'story' + s.stage, story: s.stage, giver: 'odile', recipient: s.recipient,
        title: s.title, flavor: s.item, special: 'mystery', reward: 8,
        zone: zoneOf(s.recipient), state: 'carry', timer: null, broken: false,
      });
      UI.closeDialogue(); UI.refreshHUD();
      UI.toast('The parcel is older than your satchel. Carry it kindly.');
    } },
    { label: 'Not yet', act: UI.closeDialogue },
  ]);
}

function completeJob(job, npc) {
  G.active = G.active.filter(j => j !== job);
  if (job.special === 'fragile') jostle.fragileHeld = G.active.some(j => j.state === 'carry' && j.special === 'fragile');

  let reward = job.reward, note = '';
  if (job.special === 'urgent' && job.timer <= 0) { reward = Math.max(1, Math.round(reward / 2)); note = ' (a little melted — half stamps, no hard feelings)'; }
  if (job.special === 'fragile' && jostle.amount > 3) { reward = Math.max(1, Math.round(reward / 2)); note = ' (it rattles ominously — half stamps)'; }
  jostle.amount = 0;

  G.stamps += reward;
  G.deliveredCount++;
  G.trust[job.zone] = (G.trust[job.zone] || 0) + 1;
  G.stampsSeen[job.zone] = (G.stampsSeen[job.zone] || 0) + 1;
  G.ledger.unshift({ title: job.title, to: nameOf(job.recipient), reward, when: G.deliveredCount });
  G.ledger = G.ledger.slice(0, 30);
  AUDIO.blip('deliver');

  if (job.tut) {
    G.tutorial++;
    if (job.id === 'tut3' && !G.flags.wrapHintShown) {
      G.flags.wrapHintShown = true;
      UI.toast('Yuzu: "You came over the bay? Ha! The old signs never learned the world is round-ish."');
    }
  }

  if (job.story !== undefined) {
    const s = STORY_PARCELS[job.story];
    G.story.stage = job.story + 1;
    if (s.recipient === 'marin') {
      G.flags.marinAshore = true;
      UI.showDialogue('Marin', s.memory, [{ label: 'To the hill, then', act: UI.closeDialogue }]);
    } else {
      UI.showDialogue(nameOf(s.recipient), s.memory, [{ label: '…', act: UI.closeDialogue }]);
    }
  } else {
    UI.showDialogue(nameOf(job.recipient),
      `"${job.title}" — delivered. ${npc ? '' : ''}+${reward} ✉${note}`,
      [{ label: 'Another day, another letter', act: UI.closeDialogue }]);
  }

  refreshBoard();
  UI.refreshHUD();
  save();
}

// ── per-frame: urgent timers, finale trigger, compass target ──
export function updateDeliveries(dt) {
  for (const job of G.active) {
    if (job.special === 'urgent' && job.state === 'carry' && job.timer > 0) job.timer -= dt;
  }

  // stage 6: everyone gathers at the Great Eye
  if (G.story.stage === FINALE.stage && !G.story.done &&
      wrapDist(G.px, G.pz, FINALE.location.x, FINALE.location.z) < FINALE.location.r) {
    G.story.done = true;
    UI.playFinale(FINALE.lines, () => {
      G.stamps += 25;
      UI.toast('The route is yours. +25 ✉ — and the whole small world.');
      save();
    });
  }
  UI.updateJobTimer();
}

// compass points to the active objective, the short way round
export function compassTarget() {
  const job = G.active[0];
  if (!job) {
    if (G.tutorial < 3 || (G.story.stage < STORY_PARCELS.length && G.deliveredCount >= (STORY_PARCELS[G.story.stage]?.minDeliveries ?? 1e9)))
      return { x: BOARD.x, z: BOARD.z, label: 'Post Office' };
    if (G.story.stage === FINALE.stage && !G.story.done)
      return { x: FINALE.location.x, z: FINALE.location.z, label: 'The Great Eye' };
    return null;
  }
  const key = job.state === 'fetch' ? job.giver : job.recipient;
  const n = findNPC(key);
  if (!n) return null;
  return { x: n.x, z: n.z, label: (job.state === 'fetch' ? 'Collect: ' : 'Deliver: ') + nameOf(key) };
}
