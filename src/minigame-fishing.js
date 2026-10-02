// Komachi — fishing at the jetty, the first mini-game (2026-09-25; the fight added 2026-10-02). Zoom in on the stone jetty while
// a resident is fishing there and a "Join the anglers" button floats over its head. Cast: a float arcs out and settles; wait
// for the bite (the float dips and rings spread); strike in time and the fight begins: hold the button to reel, let go to give
// line. The tension bar must stay in the green band while the catch bar fills; too tight and the line goes slack, the fish is
// off and the float settles again. Bigger fish pull harder and take longer. Nothing can be lost: a missed bite or a lost fish
// just means another cast. A catch opens the fish stall at the market for the day and the first goes into the chronicle. All
// input goes through the card's one button (hold with the pointer or Space), so the town's own pointer handling is untouched.
import * as THREE from 'three';
import { scene, camera, cam } from './scene.js';
import { S } from './state.js';
import { pierFrame } from './island.js';
import { setFishStall, anglersAtQuay } from './landmarks.js';
import { record } from './chronicle.js';
import { toast } from './toast.js';
import { pick } from './utils.js';
import { showFeeling, endTalk } from './bubbles.js';
import { residents } from './sim.js';

// on since 2026-10-02; the invitation only shows while a resident is fishing there (join them, never an empty quay)
const ENABLED = true;
const WATER_Y = -0.78;
// what bites: pull is how hard it drags the tension up while you reel and how fast it runs when you let go, work is how long it
// takes to land; the boot is heavy and does not fight
const FISH = [
  { name: 'a sardine', pull: 0.25, work: 2.4 }, { name: 'a horse mackerel', pull: 0.4, work: 3.2 }, { name: 'a small flounder', pull: 0.45, work: 3.6 },
  { name: 'a rockfish', pull: 0.55, work: 4.2 }, { name: 'a sea bream', pull: 0.65, work: 5 }, { name: 'an old boot', pull: 0.1, work: 2, boot: true },
];
const BAND = [0.35, 0.72];   // the green band of the tension bar
const game = { active: false, phase: 'idle', t: 0, biteAt: 0, caught: 0, spot: null, fish: null, tension: 0, progress: 0, holding: false, runT: 0, angler: null, reel: 0, strained: false };
let float = null, rings = [], el = null, btn = null, line = null, near = null, sub = null, meter = null, needle = null, fill = null;
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
/** the water a little out from the jetty head, where the float lands; with an angler, the line starts at their hands */
function fishingSpot(angler) {
  const P = pierFrame(); if (!P) return null;
  if (angler) { const p = angler.mesh.position, f = angler.mesh.rotation.y; return { deck: new THREE.Vector3(p.x, p.y + 0.1, p.z), water: new THREE.Vector3(p.x + Math.sin(f) * 0.6, WATER_Y, p.z + Math.cos(f) * 0.6) }; }
  return { deck: P.at(P.len - 0.1, 0), water: P.at(P.len + 0.55, 0.15).setY(WATER_Y) };
}
/** the resident the player fishes as: whoever is fishing nearest the jetty head (none when the game is started by hand) */
function pickAngler() {
  const P = pierFrame(); if (!P) return null; const head = P.at(P.len - 0.1, 0);
  const out = residents.filter(r => r.trip && r.trip.landmark && r.trip.landmark.kind === 'pier' && r.trip.held && r.mesh.visible);
  out.sort((a, b) => a.mesh.position.distanceTo(head) - b.mesh.position.distanceTo(head)); return out[0] || null;
}
const anglerChar = () => game.angler && game.angler.mesh.userData.char;
function feel(key, seconds) { if (game.angler) showFeeling(game.angler, key, seconds); }

function say(head, small) { if (sub) sub.textContent = small || ''; if (btn) btn.textContent = head; }
function showMeter(on) { if (meter) meter.hidden = !on; if (on) drawMeter(); }
function drawMeter() {
  if (!needle) return;
  needle.style.left = (game.tension * 100).toFixed(1) + '%'; fill.style.width = (game.progress * 100).toFixed(1) + '%';
  meter.classList.toggle('tight', game.tension > BAND[1]); meter.classList.toggle('slack', game.tension < BAND[0]);
}
function start() {
  if (game.active) return; game.angler = pickAngler(); game.spot = fishingSpot(game.angler); if (!game.spot) return;
  if (!float) build();
  game.active = true; game.phase = 'idle'; game.t = 0; game.holding = false; game.reel = 0; el.hidden = false; near.hidden = true; document.body.classList.add('fishing'); showMeter(false);
  const ch = anglerChar(); if (ch) ch.fishing = { reel: 0, strain: 0 };
  cam.target.set(game.spot.deck.x, 0, game.spot.deck.z); cam.tView = 4.5;
  say('Cast', 'Tap when the float dips');
}
function stop() {
  if (!game.active) return; game.active = false; game.holding = false; el.hidden = true; document.body.classList.remove('fishing'); showMeter(false);
  const ch = anglerChar(); if (ch) ch.fishing = null; if (game.angler) endTalk(game.angler); game.angler = null;
  float.visible = false; for (const r of rings) r.visible = false;
  if (game.caught) toast(game.caught === 1 ? 'One fish for the market' : `${game.caught} fish for the market`); game.caught = 0;
}
/** the float drifts back to rest: a missed bite, a lost fish, or a strike too soon */
function settle(why, feeling = null) { game.phase = 'settle'; game.t = 0; game.holding = false; showMeter(false); say('…', why); if (feeling) feel(feeling, 2.5); }
function tap() {
  if (game.phase === 'idle') { game.phase = 'cast'; game.t = 0; float.visible = true; say('…', 'Waiting'); }
  else if (game.phase === 'wait') settle('Too soon. The float settles');
  else if (game.phase === 'bite') {   // the strike: the fight is on
    game.phase = 'fight'; game.t = 0; game.fish = pick(FISH); game.tension = 0.45; game.progress = 0; game.runT = 0; game.strained = false; showMeter(true); endTalk(game.angler);
    say('Hold to reel', 'Keep the line in the green');
  }
}
function land() {
  const f = game.fish, real = !f.boot;
  game.phase = 'catch'; game.t = 0; game.holding = false; showMeter(false);
  if (real) { game.caught++; setFishStall(true); if (game.caught === 1) record(`${game.angler ? game.angler.name : 'Someone'} caught ${f.name} off the jetty`); }
  feel(real ? 'caught' : 'lost', 3);
  say(real ? 'Caught!' : 'Hmm', real ? `${f.name[0].toUpperCase()}${f.name.slice(1)} for the fish market` : 'An old boot. Back it goes');
}
/** the fight, every frame: reeling tightens the line and winds the fish in while the tension sits in the band; giving line
 *  lets the tension fall and the fish run a little; past the top of the bar the line goes slack and the fish is off */
function fight(dt) {
  const f = game.fish, pull = f.pull;
  game.runT += dt; const surge = 0.6 + 0.4 * Math.sin(game.runT * (1.6 + pull * 2));   // the fish does not pull evenly
  if (game.holding) {
    game.tension += dt * (0.55 + pull * 0.9 * surge);
    if (game.tension >= BAND[0] && game.tension <= BAND[1]) game.progress += dt / f.work;
    else if (game.tension > BAND[1]) game.progress += dt / f.work * 0.35;   // too tight still gains a little, at a risk
  } else {
    game.tension -= dt * (0.5 + 0.3 * surge);
    if (game.tension < BAND[0]) game.progress = Math.max(0, game.progress - dt * pull * 0.25);   // slack line: the fish runs
  }
  game.tension = Math.max(0, game.tension);
  if (game.tension > 0.82 && !game.strained) { game.strained = true; feel('strain', 1.6); } else if (game.tension < 0.6) game.strained = false;   // sweat when the line sings
  if (game.tension >= 1) { settle(`${f.name[0].toUpperCase()}${f.name.slice(1)} got away. The float settles`, 'lost'); return; }
  if (game.progress >= 1) { land(); return; }
  drawMeter();
  const { water } = game.spot, k = game.tension;   // the float strains toward the fish and jitters with the pull
  float.position.set(water.x + Math.sin(game.runT * 2.3) * 0.05 * (1 + pull), WATER_Y - 0.02 * k + Math.sin(game.runT * 14) * 0.006, water.z + Math.cos(game.runT * 1.7) * 0.05 * (1 + pull));
  if (Math.floor(game.runT * 3) !== Math.floor((game.runT - dt) * 3)) ripple();
}
/** every frame: the float's arc, the wait, the bite, the fight and the rings; the invitation follows the jetty head */
function updateFishingGame(dt) {
  const P = pierFrame(); if (!P) return;
  if (!game.active) {   // the invitation: close to the jetty, zoomed in, and a resident fishing there
    const head = P.at(P.len - 0.1, 0); const close = ENABLED && anglersAtQuay() > 0 && cam.view < 9 && Math.hypot(cam.target.x - head.x, cam.target.z - head.z) < 5 && !document.body.classList.contains('menu-full') && !document.body.classList.contains('menu-pause');
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
    if (game.phase === 'settle' && game.t > 1.2) { game.phase = 'wait'; game.t = 0; game.biteAt = 2 + Math.random() * 5; say('…', 'Waiting'); }
    else if (game.phase === 'wait' && game.t >= game.biteAt) { game.phase = 'bite'; game.t = 0; ripple(); say('Now!', 'It bit'); feel('bite', 1.4); }
  } else if (game.phase === 'bite') {
    float.position.y = WATER_Y - 0.03 + Math.sin(game.t * 18) * 0.012;   // the float dips and jitters for a moment
    if (game.t > 1.1) settle('Missed it. The float settles');
  } else if (game.phase === 'fight') {
    fight(dt);
  } else if (game.phase === 'catch') {   // the float leaps back toward the deck
    const k = Math.min(1, game.t / 0.8); float.position.set(water.x + (deck.x - water.x) * k, WATER_Y + Math.sin(k * Math.PI) * 0.5 + k * (deck.y + 0.2 - WATER_Y), water.z + (deck.z - water.z) * k);
    if (k >= 1) { game.phase = 'idle'; game.t = 0; float.visible = false; say('Cast again', 'Tap when the float dips'); }
  }
  // the angler: reel and strain for the pose, and they stay put while the player is fishing as them
  if (game.angler) {
    const ch = anglerChar(); game.reel += (((game.phase === 'fight' && game.holding) ? 1 : 0) - game.reel) * Math.min(1, dt * 10);
    if (ch) ch.fishing = { reel: game.reel, strain: game.phase === 'fight' ? Math.max(0, (game.tension - 0.3) / 0.7) : 0 };
    const tr = game.angler.trip; if (tr && tr.held && tr.landmark && tr.landmark.kind === 'pier') tr.holdUntil = Math.max(tr.holdUntil, S.T + 0.08); else stop();   // they left (or were cleared): the game ends with them
  }
  for (const r of rings) if (r.visible) { r.userData.t += dt; const s = 1 + r.userData.t * 2.2; r.scale.set(s, s, s); r.material.opacity = Math.max(0, 0.6 - r.userData.t * 0.5); if (r.material.opacity <= 0) r.visible = false; }
}
function ripple() { const { water } = game.spot; rings.forEach((r, k) => { r.position.set(water.x, WATER_Y + 0.005, water.z); r.scale.setScalar(1); r.userData.t = -k * 0.25; r.material.opacity = 0; r.visible = true; }); }

// the card and the invitation button: a tap (or Space) strikes and casts; holding the button (or Space) reels during the fight
{
  el = document.getElementById('fishing'); near = document.getElementById('fish-near');
  if (el && near) {
    btn = el.querySelector('#fish-tap'); sub = el.querySelector('#fish-sub'); line = el.querySelector('#fish-end');
    meter = el.querySelector('#fish-meter'); needle = el.querySelector('#fish-needle'); fill = el.querySelector('#fish-fill');
    const hold = on => { if (game.phase === 'fight') game.holding = on; };
    btn.addEventListener('pointerdown', e => { e.preventDefault(); btn.setPointerCapture(e.pointerId); if (game.phase === 'fight') hold(true); else tap(); });
    btn.addEventListener('pointerup', () => hold(false)); btn.addEventListener('pointercancel', () => hold(false)); btn.addEventListener('lostpointercapture', () => hold(false));
    btn.addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); if (game.phase === 'fight') hold(true); else if (!e.repeat) tap(); } });
    btn.addEventListener('keyup', e => { if (e.code === 'Space' || e.code === 'Enter') { e.stopPropagation(); hold(false); } });
    line.addEventListener('click', stop); near.addEventListener('click', start);
    addEventListener('keydown', e => { if (game.active && e.code === 'Escape') { e.stopPropagation(); stop(); } }, true);
  }
}
export { updateFishingGame, start as startFishing, stop as stopFishing, game as fishingGame };
