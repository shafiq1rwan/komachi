// Poki's first neighbourhood: one spotlight placement, then optional resident requests.
// Progress markers live in the existing saved entitlements, so reloads never repeat a reward.
import * as THREE from 'three';
import { POKI } from './poki.js';
import { S } from './state.js';
import { cam, camera, cx, cz } from './scene.js';
import { blocks, cells, cell, DIR4, STATION, DONE, drawable, drawRoad, placeable, placeBlock, townNet } from './world.js';
import { residents, setIntroductoryPace, inviteNeighbour, awaitCornerShop } from './sim.js';
import { isGuided, progressState, activeCue, updateProgress, pokeProgress, logEvent } from './progress.js';
import { selectBuilding } from './picker.js';
import { playLevelUpSound } from './audio.js';

let hooks, card, shade, plot, started = false, locked = false, elapsed = 0, stage = '', inviteAcc = 0;
const marker = key => `poki-opening-${key}`;
const has = key => progressState().entitlements.includes(marker(key));
const blocked = () => document.hidden || ['menu-full', 'menu-pause', 'opening', 'photo', 'fishing', 'trailer'].some(c => document.body.classList.contains(c)) || !document.getElementById('loading')?.classList.contains('gone');
function remember(key) {
  if (has(key)) return;
  progressState().entitlements.push(marker(key)); hooks.save(); logEvent('poki-opening', key);
}
const first = type => blocks.find(b => b.type === type);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function initPokiOnboarding(h) {
  if (!POKI || !isGuided() || has('done') || has('skipped')) return;
  if (!has('started') && blocks.some(b => b.type !== 'station')) return;
  hooks = h;
  setIntroductoryPace(b => started && !has('skipped') && !has('done') && elapsed < 180 && (!b || (['res', 'shop', 'work'].includes(b.type) && first(b.type) === b)));
}
function starterStreet() {
  if (activeCue()?.id !== 'first-street') return true;
  const net = townNet();
  for (const r of cells) {
    if (r.type !== 'road' || !net.has(r) || Math.abs(r.i - STATION.anchor.cell.i) + Math.abs(r.j - STATION.anchor.cell.j) > 5) continue;
    for (const [di, dj] of DIR4) {
      const run = [1, 2, 3].map(n => cell(r.i + di * n, r.j + dj * n));
      if (!run.every(c => c && c.type === 'empty' && drawable(c, 0))) continue;
      const end = run[2], sides = [cell(end.i - dj, end.j + di), cell(end.i + dj, end.j - di)];
      if (!sides.every(c => c && c.type === 'empty' && !(c.h || 0) && !c.landmark && !c.yard && !c.slip)) continue;
      drawRoad(run[0], end); pokeProgress(); updateProgress(0.5); return true;
    }
  }
  return false;
}
function release() {
  locked = false; shade?.remove(); shade = null;
  hooks.gate(() => true); document.body.classList.remove('poki-spotlight');
}
function skip() {
  remember('skipped'); release(); hooks.setTool('explore'); card?.remove(); document.body.classList.remove('poki-onboarding'); stage = 'skipped';
}
function show(key, title, copy, actions = '') {
  if (stage === key) return;
  stage = key;
  if (!card) {
    card = document.createElement('section'); card.id = 'poki-opening-card'; card.setAttribute('aria-live', 'polite'); document.body.appendChild(card);
    card.addEventListener('click', e => {
      const button = e.target.closest('button'); if (!button) return;
      const action = button.dataset.intro;
      if (action === 'skip') skip();
      else if (action === 'home' && locked && placeable(plot, [plot])) { placeBlock('res', [plot], { variant: 'detached' }); pokeProgress(); release(); }
      else if (action === 'watch') { const r = residents.find(r => r.home && !r.movingIn); if (r) hooks.follow(r); }
      else if (action === 'build') {
        hooks.setTool(button.dataset.type); selectBuilding(button.dataset.type, button.dataset.kind);
        if (stage === 'reward') { remember('done'); card.remove(); document.body.classList.remove('poki-onboarding'); }
      }
      else if (action === 'finish') { remember('done'); card.remove(); document.body.classList.remove('poki-onboarding'); }
    });
  }
  card.innerHTML = `<small>YOUR FIRST NEIGHBOURHOOD</small><h2>${escape(title)}</h2><p>${escape(copy)}</p><div class="po-actions">${actions}</div><button class="po-skip" data-intro="skip">Skip introduction</button>`;
  logEvent('poki-opening-step', key);
}
const buildButton = (type, kind, label) => `<button data-intro="build" data-type="${type}" data-kind="${kind}">${label}</button>`;
function begin() {
  if (!first('res') && !starterStreet()) { hooks = null; return false; }
  started = true; document.body.classList.add('poki-onboarding'); remember('started');
  document.getElementById('intro')?.remove();
  if (!first('res')) {
    plot = activeCue()?.cells.find(c => placeable(c, [c]));
    if (plot) {
      locked = true; hooks.setTool('res'); selectBuilding('res', 'detached');
      hooks.gate((type, c, sel) => !locked || (type === 'res' && c === plot && sel.length === 0));
      cam.target.set(cx(plot.i), 0, cz(plot.j)); cam.tView = 7;
      if (innerWidth <= 720) cam.target.addScaledVector(new THREE.Vector3(-Math.sin(cam.tYaw), 0, -Math.cos(cam.tYaw)), -cam.tView * 0.24);   // phones: the card takes the lower half, so the plot sits in the upper half
      shade = document.createElement('div'); shade.id = 'poki-spotlight'; document.body.appendChild(shade);
      document.body.classList.add('poki-spotlight');
      show('home', 'Give your first neighbours a home', 'Click the glowing plot. The street is ready for you.', '<button data-intro="home">Build home here</button>');
      card.querySelector('[data-intro="home"]').focus({ preventScroll: true });
    }
  }
  return true;
}
// The canvas remains interactive only at the highlighted plot; the normal placement gate checks the exact cell.
document.addEventListener('pointerdown', e => {
  if (!locked || blocked() || e.target.closest('#poki-opening-card, #btn-menu')) return;
  const rect = shade?.getBoundingClientRect();
  if (e.target.id === 'c' && e.button === 0 && rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);
document.addEventListener('click', e => {
  if (!locked || blocked() || e.target.closest('#poki-opening-card, #btn-menu') || e.target.id === 'c') return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);
document.addEventListener('keydown', e => {
  if (!locked || blocked()) return;
  if (e.code === 'Escape') { skip(); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if (['Tab', 'Enter', 'Space'].includes(e.code) && e.target.closest('#poki-opening-card, #btn-menu')) return;
  if (e.code !== 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);

export function updatePokiOnboarding(dt) {
  if (!hooks || blocked()) { if (card) card.hidden = true; if (shade) shade.hidden = true; return; }
  if (!isGuided()) { release(); card?.remove(); document.body.classList.remove('poki-onboarding'); hooks = null; return; }
  if (has('done') || has('skipped')) return;
  if (!started && !begin()) return;
  if (card) card.hidden = false; if (shade) shade.hidden = false;
  if (S.speed > 0) elapsed += dt;
  const home = first('res'), shop = first('shop'), neighbour = residents.find(r => r.home && !r.movingIn);
  if (locked && home) release();
  if (locked) {
    const p = new THREE.Vector3(cx(plot.i), .15, cz(plot.j)).project(camera);
    const size = Math.max(50, innerHeight / cam.view * .95);
    Object.assign(shade.style, { left: `${(p.x + 1) * innerWidth / 2 - size / 2}px`, top: `${(1 - p.y) * innerHeight / 2 - size / 2}px`, width: `${size}px`, height: `${size}px` });
    return;
  }
  if (!home) { show('replace-home', 'Your neighbours need a home', 'Choose a home and place it beside your street.', buildButton('res', 'detached', 'Choose a home')); return; }
  if (!neighbour) {
    show('builders', 'You made room for a family', 'Watch the crew build your home. You can keep building while your neighbours travel here.', buildButton('shop', 'bakery', 'Choose a bakery')); return;
  }
  if (!has('welcomed')) { remember('welcomed'); hooks.follow(neighbour); }
  if (elapsed < 180 && (!shop || shop.stage < DONE)) awaitCornerShop();
  const name = neighbour.name.split(' ')[0];
  if (!shop) {
    show('request', `${name} has moved in!`, '“We’d love somewhere nearby to buy a bite to eat.” Pick your corner shop, then place it beside a street.', buildButton('shop', 'bakery', 'Bakery') + buildButton('shop', 'ramen', 'Ramen shop') + buildButton('shop', 'konbini', 'Konbini')); return;
  }
  if (shop.stage < DONE) {
    show('shop-building', 'Your corner shop is taking shape', 'The crew is getting it ready. Add another home or somewhere to work while they finish.', buildButton('work', 'studio', 'Choose a workplace')); return;
  }
  const earned = progressState().entitlements.includes('poki-first-customer-terrace');
  if (!earned && !(shop.visitsToday > 0 || shop.visitScore > 0)) {
    inviteAcc += dt;
    if (inviteAcc >= 2) { inviteAcc = 0; inviteNeighbour(shop); }
    show('customer', 'Open for your neighbours', 'Your shop is ready. Watch for the first neighbour coming through the door.', '<button data-intro="watch">Watch a neighbour</button>'); return;
  }
  if (!earned) {
    progressState().entitlements.push('poki-first-customer-terrace'); remember('customer'); pokeProgress(); playLevelUpSound();
  }
  show('reward', 'You brought a street to life', 'Your first customer has visited! Terrace homes are now yours to build. Choose one and drag across two plots beside a street.', buildButton('res', 'terrace', 'Build terrace homes') + '<button data-intro="finish">Keep exploring</button>');
}
export const pokiOnboardingState = () => ({ started, locked, stage, elapsed, plot: plot ? { i: plot.i, j: plot.j } : null });
