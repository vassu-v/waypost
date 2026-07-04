// ui.js — all DOM: HUD, compass ribbon, dialogue, job board / ledger /
// album / shop, pause, help, credits, title, finale sequence, toasts.

import { wrapDelta } from './wrap.js';
import { G, save, wipe } from './state.js';
import { ZONES, ZONE } from './palettes.js';
import { STAMP_ART } from './story.js';
import { SCARVES, applyScarf, P } from './player.js';
import * as AUDIO from './audio.js';
import { acceptJob, refreshBoard } from './deliveries.js';

const $ = id => document.getElementById(id);
let toastTimer = null, hooks = {};

export function initUI(h) {
  hooks = h;
  $('btn-start').onclick = () => h.onStart(true);
  $('btn-continue').onclick = () => h.onStart(false);
  $('btn-pause').onclick = pause;
  $('btn-resume').onclick = resume;
  $('btn-title').onclick = () => { save(); location.reload(); };
  $('set-sound').onclick = () => {
    G.settings.sound = !G.settings.sound;
    $('set-sound').textContent = G.settings.sound ? 'On' : 'Off';
    AUDIO.setSound(G.settings.sound);
  };
  $('set-quality').onclick = () => {
    G.settings.quality = G.settings.quality === 'high' ? 'low' : 'high';
    $('set-quality').textContent = G.settings.quality === 'high' ? 'High' : 'Low';
    h.onQuality();
  };
  $('set-help').onclick = () => { $('pause').classList.add('hidden'); $('help').classList.remove('hidden'); };
  $('btn-help-close').onclick = () => { $('help').classList.add('hidden'); if (G.mode === 'pause') $('pause').classList.remove('hidden'); };
  $('btn-credits').onclick = () => { $('pause').classList.add('hidden'); $('credits').classList.remove('hidden'); };
  $('btn-credits-close').onclick = () => {
    $('credits').classList.add('hidden');
    if (G.mode === 'pause') $('pause').classList.remove('hidden');
    else if (G.mode === 'finale-credits') { G.mode = 'play'; AUDIO.playMelody(false); }
  };
  $('modal-close').onclick = closeModal;
  for (const tab of document.querySelectorAll('.tab')) tab.onclick = () => openModal(tab.dataset.tab);

  addEventListener('keydown', e => {
    if (e.code === 'Escape') {
      if (G.mode === 'play') pause();
      else if (G.mode === 'pause') resume();
      else if (G.mode === 'modal') closeModal();
      else if (G.mode === 'dialogue') closeDialogue();
    }
    if (e.code === 'Tab') { e.preventDefault(); if (G.mode === 'play') openModal('ledger'); else if (G.mode === 'modal') closeModal(); }
  });

  // mobile?
  if ('ontouchstart' in window && matchMedia('(pointer: coarse)').matches)
    $('mobile').classList.remove('hidden');
}

export function showTitle(hasSaveFile) {
  G.mode = 'title';
  $('loading').classList.add('hidden');
  $('title').classList.remove('hidden');
  if (hasSaveFile) {
    $('btn-continue').classList.remove('hidden');
    $('btn-start').textContent = 'New route (erases save)';
  }
}

export function startPlay() {
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');
  G.mode = 'play';
  $('set-sound').textContent = G.settings.sound ? 'On' : 'Off';
  $('set-quality').textContent = G.settings.quality === 'high' ? 'High' : 'Low';
  refreshHUD();
}

function pause() { if (G.mode !== 'play') return; G.mode = 'pause'; $('pause').classList.remove('hidden'); save(); }
function resume() { G.mode = 'play'; $('pause').classList.add('hidden'); }

// ── toast ──
export function toast(msg, ms = 4200) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

// ── dialogue ──
export function showDialogue(name, text, actions = []) {
  G.mode = 'dialogue';
  $('dlg-name').textContent = name;
  $('dlg-text').textContent = '';
  $('dialogue').classList.remove('hidden');
  // gentle typewriter
  let i = 0;
  const el = $('dlg-text');
  const tick = () => {
    if (G.mode !== 'dialogue' && G.mode !== 'finale') return;
    el.textContent = text.slice(0, i);
    i += 2;
    if (i <= text.length + 1) setTimeout(tick, 14);
  };
  tick();
  const box = $('dlg-actions');
  box.innerHTML = '';
  for (const a of actions) {
    const b = document.createElement('button');
    b.textContent = a.label;
    b.onclick = a.act;
    box.appendChild(b);
  }
}

export function closeDialogue() {
  $('dialogue').classList.add('hidden');
  if (G.mode === 'dialogue') G.mode = 'play';
}

// ── finale ──
export function playFinale(lines, done) {
  G.mode = 'finale';
  AUDIO.playMelody(true);
  let i = 0;
  const next = () => {
    if (i >= lines.length) {
      $('dialogue').classList.add('hidden');
      done();
      G.mode = 'finale-credits';
      $('credits').classList.remove('hidden');
      return;
    }
    const [who, text] = lines[i++];
    showDialogue(who || '✉', text, [{ label: i >= lines.length ? 'Look up' : '…', act: next }]);
    G.mode = 'finale';
  };
  next();
}

// ── HUD ──
export function refreshHUD() {
  $('stamp-count').textContent = G.stamps;
  const job = G.active[0];
  if (job) {
    $('job-card').classList.remove('hidden');
    const badge = job.special ? `<span class="badge ${job.special}">${job.special}</span>` : '';
    $('job-title').innerHTML = job.title + badge;
    $('job-desc').textContent = (job.state === 'fetch' ? 'Collect, then deliver. ' : '') + (job.flavor || '');
    $('job-timer').classList.toggle('hidden', job.special !== 'urgent' || job.state !== 'carry');
  } else {
    $('job-card').classList.add('hidden');
  }
}

export function updateJobTimer() {
  const job = G.active[0];
  if (!job || job.special !== 'urgent' || job.state !== 'carry') return;
  $('job-timer').classList.remove('hidden');
  const f = Math.max(0, job.timer / job.timerMax);
  $('melt-fill').style.width = (f * 100).toFixed(1) + '%';
  $('icecream').textContent = f > 0.6 ? '🍦' : f > 0.25 ? '🍥' : f > 0 ? '💧' : '🫠';
}

let lastZone = '';
export function setZoneName(name) {
  if (name === lastZone) return;
  lastZone = name;
  const el = $('zone-name');
  el.style.opacity = 0;
  setTimeout(() => { el.textContent = name; el.style.opacity = 1; }, 500);
}

export function setPrompt(on) { $('prompt').classList.toggle('hidden', !on); }

// ── compass ribbon (wrap-aware bearings, of course) ──
const strip = () => $('compass-strip');
export function updateCompass(camYaw, target) {
  // camera forward bearing: 0 = north (-z), 90° = east (+x)
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
  const fwd = Math.atan2(fx, -fz);
  const marks = [
    ['N', 0], ['E', Math.PI / 2], ['S', Math.PI], ['W', -Math.PI / 2],
  ];
  let html = '';
  const W2 = 0.5;   // fraction of half-strip per 90°
  for (const [label, b] of marks) {
    const rel = angDelta(b - fwd);
    if (Math.abs(rel) < 1.9) html += `<span style="left:${50 + rel * 31}%">${label}</span>`;
  }
  if (target) {
    const dx = wrapDelta(G.px, target.x), dz = wrapDelta(G.pz, target.z);
    const tb = Math.atan2(dx, -dz);
    const rel = angDelta(tb - fwd);
    const clamped = Math.max(-1.55, Math.min(1.55, rel));
    html += `<span class="cmark" style="left:${50 + clamped * 31}%" title="${target.label}">✉</span>`;
  }
  strip().innerHTML = html;
}
function angDelta(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

// ── modal: board / ledger / album / shop ──
export function openModal(tab) {
  if (G.mode !== 'play' && G.mode !== 'modal') return;
  G.mode = 'modal';
  $('modal').classList.remove('hidden');
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t.dataset.tab === tab);
  const body = $('modal-body');
  if (tab === 'board') renderBoard(body);
  else if (tab === 'ledger') renderLedger(body);
  else if (tab === 'album') renderAlbum(body);
  else renderShop(body);
}
export function closeModal() { $('modal').classList.add('hidden'); if (G.mode === 'modal') G.mode = 'play'; }

function renderBoard(body) {
  refreshBoard();
  let html = '<p class="subtitle">Open jobs — pinned to the post office board</p>';
  if (!G.jobs.length) html += '<p>No open jobs right now. The mail rests; so should you.</p>';
  body.innerHTML = html;
  for (const job of G.jobs) {
    const row = document.createElement('div');
    row.className = 'job-row';
    const badge = job.special ? `<span class="badge ${job.special}">${job.special}</span>` : '';
    row.innerHTML = `<div class="jr-main"><div class="jr-title">${job.title}${badge}</div>
      <div class="jr-sub">${job.flavor} · to ${ZONE[job.zone].name} · +${job.reward} ✉</div></div>`;
    const btn = document.createElement('button');
    btn.textContent = 'Accept';
    btn.onclick = () => { if (acceptJob(job)) closeModal(); };
    row.appendChild(btn);
    body.appendChild(row);
  }
}

function renderLedger(body) {
  let html = `<p class="subtitle">Delivered: ${G.deliveredCount} · Stamps: ${G.stamps} ✉</p>`;
  html += '<h3 style="margin:6px 0">Zone trust</h3>';
  for (const z of ZONES) {
    if (z.key === 'dimstreet') continue;
    const t = G.trust[z.key] || 0;
    html += `<div class="trust-row"><span>${z.name}</span><span class="hearts">${'♥'.repeat(Math.min(5, t))}${'♡'.repeat(Math.max(0, 5 - t))}</span></div>`;
  }
  html += '<h3 style="margin:14px 0 6px">Recent deliveries</h3>';
  if (!G.ledger.length) html += '<p>Nothing yet. The board awaits.</p>';
  for (const l of G.ledger.slice(0, 12))
    html += `<div class="trust-row"><span>${l.title} → ${l.to}</span><span>+${l.reward} ✉</span></div>`;
  body.innerHTML = html;
}

function renderAlbum(body) {
  let html = '<p class="subtitle">One stamp design per zone — earn them by delivering there</p><div>';
  for (const z of ZONES) {
    const n = G.stampsSeen[z.key] || 0;
    html += `<div class="stamp ${n ? '' : 'locked'}"><div class="s-art">${STAMP_ART[z.key] || '✉'}</div>${z.name}<br>×${n}</div>`;
  }
  body.innerHTML = html + '</div>';
}

function renderShop(body) {
  body.innerHTML = `<p class="subtitle">The Post Shop — stamps well spent (you have ${G.stamps} ✉)</p>`;
  const items = [];
  if (G.satchel === 1) items.push({ name: 'Double satchel', desc: 'Carry two parcels at once', cost: 12, buy: () => { G.satchel = 2; } });
  if (G.satchel === 2) items.push({ name: 'Courier pannier', desc: 'Carry three parcels at once', cost: 30, buy: () => { G.satchel = 3; } });
  if (!G.bike) items.push({ name: 'The red bicycle', desc: 'Hold Shift to ride. The route shrinks.', cost: 25, buy: () => { G.bike = true; } });
  if (G.bike && !G.glider) items.push({ name: 'The gull-wing glider', desc: 'Shift+Space to soar. The route becomes a view.', cost: 60, buy: () => { G.glider = true; } });
  SCARVES.forEach((s, i) => {
    if (i !== 0 && i !== G.scarf) items.push({ name: `Scarf: ${s.name}`, desc: 'A courier is their scarf', cost: s.cost, buy: () => { G.scarf = i; applyScarf(); } });
  });
  if (G.scarf !== 0) items.push({ name: 'Scarf: Courier Red', desc: 'The original. It suits you.', cost: 0, buy: () => { G.scarf = 0; applyScarf(); } });

  for (const it of items) {
    const row = document.createElement('div');
    row.className = 'job-row';
    row.innerHTML = `<div class="jr-main"><div class="jr-title">${it.name}</div><div class="jr-sub">${it.desc}</div></div>`;
    const btn = document.createElement('button');
    btn.textContent = `${it.cost} ✉`;
    btn.disabled = G.stamps < it.cost;
    btn.onclick = () => {
      G.stamps -= it.cost; it.buy(); save(); AUDIO.blip('pickup');
      refreshHUD(); renderShop(body);
    };
    row.appendChild(btn);
    body.appendChild(row);
  }
}
