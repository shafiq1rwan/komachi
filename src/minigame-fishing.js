// Komachi — fishing at the jetty, the first mini-game (2026-09-25). Zoom in on the stone jetty and a "Cast a line" button
// floats over its head. Cast: a float arcs out and settles; wait for the bite (the float dips and rings spread); strike in
// time and a fish comes up. Nothing can be lost: a missed bite just means the float settles again. A catch opens the fish
// stall at the market for the day and goes into the chronicle. All input goes through the card's one button, so the town's
// own pointer handling is untouched; Esc or "Enough for today" ends it.
import * as THREE from 'three';
import { scene, camera, cam } from './scene.js';
import { pierFrame } from './island.js';
import { setFishStall } from './landmarks.js';
import { record } from './chronicle.js';
import { toast } from './toast.js';
import { pick } from './utils.js';

// hidden for now (the user, 2026-09-25: still buggy): no invitation button, but the MT.startFishing hook runs it for testing
const ENABLED = false;
const WATER_Y = -0.78;
const FISH = ['a sea bream', 'a horse mackerel', 'a small flounder', 'a sardine', 'a rockfish', 'an old boot (thrown back)'];
const game = { active: false, phase: 'idle', t: 0, biteAt: 0, caught: 0, spot: null };
let float = null, rings = [], el = null, btn = null, line = null, near = null, sub = null;
const v = new THREE.Vector3();

function build() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), new THREE.MeshStandardMaterial({ color: '#d94f3d', roughness: 0.6 })));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshStandardMaterial({ color: '#fff6e4', roughness: 0.6 })); cap.position.y = 0.034; g.add(cap);
  g.visible = false; scene.add(g); float = g;
  for (let k = 0; k < 3; k++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.062, 24), new THREE.MeshBasicMaterial({ color: '#eaf4f2', transparent: true, opacity: 0, depthWrite: false }));
    r.rotation.x = -Math.PI / 2; r.visible = false; scene.add(r); rings.push(r);
  }
}
/** the water a little out from the jetty head, where the float lands */
function fishingSpot() { const P = pierFrame(); if (!P) return null; return { deck: P.at(P.len - 0.1, 0), water: P.at(P.len + 0.55, 0.15).setY(WATER_Y) }; }

function say(head, small) { if (sub) sub.textContent = small || ''; if (btn) btn.textContent = head; }
function start() {
  if (game.active) return; game.spot = fishingSpot(); if (!game.spot) return;
  if (!float) build();
  game.active = true; game.phase = 'idle'; game.t = 0; el.hidden = false; near.hidden = true; document.body.classList.add('fishing');
  cam.target.set(game.spot.deck.x, 0, game.spot.deck.z); cam.tView = 4.5;
  say('Cast', 'Tap when the float dips');
}
function stop() {
  if (!game.active) return; game.active = false; el.hidden = true; document.body.classList.remove('fishing');
  float.visible = false; for (const r of rings) r.visible = false;
  if (game.caught) toast(game.caught === 1 ? 'One fish for the market' : `${game.caught} fish for the market`); game.caught = 0;
}
function tap() {
  if (game.phase === 'idle') { game.phase = 'cast'; game.t = 0; float.visible = true; say('…', 'Waiting'); }
  else if (game.phase === 'wait') { game.phase = 'settle'; game.t = 0; say('…', 'Too soon. The float settles'); }
  else if (game.phase === 'bite') {
    game.phase = 'catch'; game.t = 0; const f = pick(FISH); const real = !f.includes('boot');
    if (real) { game.caught++; setFishStall(true); if (game.caught === 1) record(`Someone caught ${f} off the jetty`); }
    say(real ? 'Caught!' : 'Hmm', real ? `${f[0].toUpperCase()}${f.slice(1)} for the fish market` : 'An old boot. Back it goes');
  }
}
/** every frame: the float's arc, the wait, the bite and the rings; the "Cast a line" button follows the jetty head */
function updateFishingGame(dt) {
  const P = pierFrame(); if (!P) return;
  if (!game.active) {   // the invitation: close to the jetty and zoomed in
    const head = P.at(P.len - 0.1, 0); const close = ENABLED && cam.view < 9 && Math.hypot(cam.target.x - head.x, cam.target.z - head.z) < 5 && !document.body.classList.contains('menu-full') && !document.body.classList.contains('menu-pause');
    near.hidden = !close;
    if (close) { v.set(head.x, 0.35, head.z).project(camera); near.style.left = ((v.x + 1) / 2 * innerWidth).toFixed(0) + 'px'; near.style.top = ((1 - v.y) / 2 * innerHeight).toFixed(0) + 'px'; }
    return;
  }
  game.t += dt; const { deck, water } = game.spot;
  if (game.phase === 'cast') {   // an arc from the deck out to the water
    const k = Math.min(1, game.t / 0.9), y = deck.y + 0.25 + Math.sin(k * Math.PI) * 0.35 - k * (deck.y + 0.25 - WATER_Y);
    float.position.set(deck.x + (water.x - deck.x) * k, y, deck.z + (water.z - deck.z) * k);
    if (k >= 1) { game.phase = 'wait'; game.t = 0; game.biteAt = 2 + Math.random() * 5; ripple(); }
  } else if (game.phase === 'wait' || game.phase === 'settle') {
    float.position.set(water.x, WATER_Y + 0.01 + Math.sin(game.t * 2.2) * 0.006, water.z);
    if (game.phase === 'settle' && game.t > 1.2) { game.phase = 'wait'; game.t = 0; game.biteAt = 2 + Math.random() * 5; }
    else if (game.phase === 'wait' && game.t >= game.biteAt) { game.phase = 'bite'; game.t = 0; ripple(); say('Now!', 'It bit'); }
  } else if (game.phase === 'bite') {
    float.position.y = WATER_Y - 0.03 + Math.sin(game.t * 18) * 0.012;   // the float dips and jitters for a moment
    if (game.t > 1.1) { game.phase = 'settle'; game.t = 0; say('…', 'Missed it. The float settles'); }
  } else if (game.phase === 'catch') {   // the float leaps back toward the deck
    const k = Math.min(1, game.t / 0.8); float.position.set(water.x + (deck.x - water.x) * k, WATER_Y + Math.sin(k * Math.PI) * 0.5 + k * (deck.y + 0.2 - WATER_Y), water.z + (deck.z - water.z) * k);
    if (k >= 1) { game.phase = 'idle'; game.t = 0; float.visible = false; say('Cast again', 'Tap when the float dips'); }
  }
  for (const r of rings) if (r.visible) { r.userData.t += dt; const s = 1 + r.userData.t * 2.2; r.scale.set(s, s, s); r.material.opacity = Math.max(0, 0.6 - r.userData.t * 0.5); if (r.material.opacity <= 0) r.visible = false; }
}
function ripple() { const { water } = game.spot; rings.forEach((r, k) => { r.position.set(water.x, WATER_Y + 0.005, water.z); r.scale.setScalar(1); r.userData.t = -k * 0.25; r.material.opacity = 0; r.visible = true; }); }

// the card and the invitation button
{
  el = document.getElementById('fishing'); near = document.getElementById('fish-near');
  if (el && near) {
    btn = el.querySelector('#fish-tap'); sub = el.querySelector('#fish-sub'); line = el.querySelector('#fish-end');
    btn.addEventListener('click', tap); line.addEventListener('click', stop); near.addEventListener('click', start);
    addEventListener('keydown', e => { if (game.active && e.code === 'Escape') { e.stopPropagation(); stop(); } }, true);
  }
}
export { updateFishingGame, start as startFishing, stop as stopFishing, game as fishingGame };
