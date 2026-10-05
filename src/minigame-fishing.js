// Komachi — fishing at the jetty, the first mini-game (2026-09-25; the fight 2026-10-02; the angler and the life around the
// line 2026-10-02/05). Zoom in on the stone jetty while a resident is fishing there and "Join the anglers" floats over its
// head: the player takes over the resident fishing nearest the head, so the line starts at their hands. Cast: a float arcs
// out and settles; wait for the bite (the angler jolts, the float dips, a splash); strike in time and the fight begins: a
// fish shadow darts under the water on the line, pulled in while the button is held and running out when it is let go, the
// tension bar must stay in the green while the catch bar fills; too tight and the line goes slack, the fish is off and the
// angler slumps. A catch leaps out of the water and is held up over the angler's head for a moment, the camera leaning in,
// before they go back to fishing. Nothing can be lost: a miss or a lost fish just means another cast. A catch opens the fish
// stall at the market for the day and the first goes into the chronicle. All input goes through the card's one button (hold
// with the pointer or Space), so the town's own pointer handling is untouched.
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
const WATER_Y = -0.78, VIEW = 4.5, VIEW_SHOW = 3.1;
// what bites: pull is how hard it drags the tension up while you reel and how fast it runs when you let go, work is how long it
// takes to land, len and color draw the fish held up afterwards; the boot is heavy and does not fight
const FISH = [
  { name: 'a sardine', pull: 0.25, work: 2.4, len: 0.085, color: '#b6c2cc', belly: '#e8eef0' },
  { name: 'a horse mackerel', pull: 0.4, work: 3.2, len: 0.105, color: '#5f8fa3', belly: '#d9e4e6' },
  { name: 'a small flounder', pull: 0.45, work: 3.6, len: 0.12, color: '#9c805c', belly: '#e2d6c0', flat: true },
  { name: 'a rockfish', pull: 0.55, work: 4.2, len: 0.12, color: '#b25a47', belly: '#e3b9a6' },
  { name: 'a sea bream', pull: 0.65, work: 5, len: 0.14, color: '#d9a0a6', belly: '#f2e3e1' },
  { name: 'an old boot', pull: 0.1, work: 2, len: 0.1, color: '#5a4634', boot: true },
];
const BAND = [0.35, 0.72];   // the green band of the tension bar
const SHOW_T = 2.6, SHOW_BOOT_T = 1.8;   // seconds the catch is held up
const game = { active: false, phase: 'idle', t: 0, biteAt: 0, caught: 0, spot: null, fish: null, tension: 0, progress: 0, holding: false, runT: 0, angler: null, reel: 0, strained: false, jolt: 0, sad: 0, show: 0 };
let float = null, rings = [], shadow = null, splashes = [], fishMesh = null;
let el = null, btn = null, line = null, near = null, sub = null, meter = null, needle = null, fill = null;
const v = new THREE.Vector3(), tmp = new THREE.Vector3();

function build() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), new THREE.MeshStandardMaterial({ color: '#d94f3d', roughness: 0.6 })));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshStandardMaterial({ color: '#fff6e4', roughness: 0.6 })); cap.position.y = 0.034; g.add(cap);
  g.visible = false; scene.add(g); float = g;
  for (let k = 0; k < 4; k++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.062, 24), new THREE.MeshBasicMaterial({ color: '#eaf4f2', transparent: true, opacity: 0, depthWrite: false }));
    r.rotation.x = -Math.PI / 2; r.visible = false; scene.add(r); rings.push(r);
  }
  // the fish under the water during the fight: a soft dark shape just below the surface
  shadow = new THREE.Mesh(new THREE.CircleGeometry(0.05, 18), new THREE.MeshBasicMaterial({ color: '#213239', transparent: true, opacity: 0.42, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1.7, 1, 1); shadow.visible = false; scene.add(shadow);
  // droplets for the bite and the leap
  for (let k = 0; k < 10; k++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 5), new THREE.MeshBasicMaterial({ color: '#f2f8f7', transparent: true, opacity: 0.9, depthWrite: false }));
    d.visible = false; scene.add(d); splashes.push({ m: d, vel: new THREE.Vector3(), life: 0 });
  }
}
/** the fish (or boot) the angler holds up: a few primitives in the species' colours, nose along +z */
function makeFishMesh(f) {
  const g = new THREE.Group(); const L = f.len;
  if (f.boot) {
    const leather = new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.9 });
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(L * 0.45, L * 0.7, L * 0.5), leather); shaft.position.y = L * 0.25; g.add(shaft);
    const toe = new THREE.Mesh(new THREE.BoxGeometry(L * 0.45, L * 0.28, L * 0.95), leather); toe.position.set(0, -L * 0.2, L * 0.2); g.add(toe);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(L * 0.47, L * 0.06, L * 0.98), new THREE.MeshStandardMaterial({ color: '#2e2620', roughness: 1 })); sole.position.set(0, -L * 0.36, L * 0.2); g.add(sole);
    return g;
  }
  const skin = new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.45, metalness: 0.15 }), belly = new THREE.MeshStandardMaterial({ color: f.belly, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), skin); body.scale.set(L * (f.flat ? 0.34 : 0.2), L * (f.flat ? 0.08 : 0.24), L * 0.5); g.add(body);
  const under = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), belly); under.scale.copy(body.scale).multiplyScalar(0.92); under.position.y = -L * 0.03; g.add(under);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(L * 0.16, L * 0.26, 3), skin); tail.rotation.x = Math.PI / 2; tail.position.z = -L * 0.56; tail.scale.x = 0.35; g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.03, L * 0.12, L * 0.3), skin); fin.position.y = L * (f.flat ? 0.08 : 0.24); fin.position.z = -L * 0.05; g.add(fin);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(L * 0.03, 6, 5), new THREE.MeshBasicMaterial({ color: '#1c2224' })); eye.position.set(L * 0.17, L * 0.06, L * 0.3); g.add(eye);
  return g;
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
  game.active = true; game.phase = 'idle'; game.t = 0; game.holding = false; game.reel = 0; game.jolt = 0; game.sad = 0; game.show = 0; el.hidden = false; near.hidden = true; document.body.classList.add('fishing'); showMeter(false);
  const ch = anglerChar(); if (ch) ch.fishing = { reel: 0, strain: 0, jolt: 0, sad: 0, show: 0, fish: null };
  cam.target.set(game.spot.deck.x, 0, game.spot.deck.z); cam.tView = VIEW;
  say('Cast', 'Tap when the float dips');
}
function dropFish() { if (fishMesh) { fishMesh.removeFromParent(); fishMesh.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); fishMesh = null; } const ch = anglerChar(); if (ch && ch.fishing) ch.fishing.fish = null; }
function stop() {
  if (!game.active) return; game.active = false; game.holding = false; el.hidden = true; document.body.classList.remove('fishing'); showMeter(false);
  float.visible = false; shadow.visible = false; for (const r of rings) r.visible = false; for (const s of splashes) s.m.visible = false; dropFish();
  const ch = anglerChar(); if (ch) ch.fishing = null; if (game.angler) endTalk(game.angler); game.angler = null; game.show = 0;
  if (game.caught) toast(game.caught === 1 ? 'One fish for the market' : `${game.caught} fish for the market`); game.caught = 0;
}
/** the float drifts back to rest: a missed bite, a lost fish, or a strike too soon */
function settle(why, feeling = null) { game.phase = 'settle'; game.t = 0; game.holding = false; shadow.visible = false; showMeter(false); say('…', why); if (feeling) { feel(feeling, 2.5); game.sad = 1; } }
function tap() {
  if (game.phase === 'idle') { game.phase = 'cast'; game.t = 0; float.visible = true; say('…', 'Waiting'); }
  else if (game.phase === 'wait') settle('Too soon. The float settles');
  else if (game.phase === 'bite') {   // the strike: hooked, the fight is on; the angler braces
    game.phase = 'fight'; game.t = 0; game.fish = pick(FISH); game.tension = 0.45; game.progress = 0; game.runT = 0; game.strained = false; game.jolt = 1; showMeter(true); endTalk(game.angler);
    shadow.visible = true; shadow.position.copy(game.spot.water).setY(WATER_Y - 0.015); splash(game.spot.water, 5, 0.7);
    say('Hold to reel', 'Keep the line in the green');
  }
}
function land() {
  const f = game.fish, real = !f.boot;
  game.phase = 'catch'; game.t = 0; game.holding = false; shadow.visible = false; showMeter(false);
  if (real) { game.caught++; setFishStall(true); if (game.caught === 1) record(`${game.angler ? game.angler.name : 'Someone'} caught ${f.name} off the jetty`); }
  dropFish(); fishMesh = makeFishMesh(f); fishMesh.position.copy(float.position); scene.add(fishMesh);   // the fish leaps with the float
  splash(float.position, 8, 1);
  say(real ? 'Caught!' : 'Hmm', real ? `${f.name[0].toUpperCase()}${f.name.slice(1)} for the fish market` : 'An old boot. Back it goes');
}
/** the catch is held up for a moment: the fish moves into the angler's hands, the camera leans in */
function showOff() {
  game.phase = 'show'; game.t = 0; game.show = 1; const f = game.fish;
  const ch = anglerChar();
  if (ch && fishMesh) { ch.grp.add(fishMesh); fishMesh.position.set(0, 0.345, 0.07); fishMesh.rotation.set(0, Math.PI / 2, f.boot ? 0 : 0.35); ch.fishing.fish = fishMesh; }
  else if (fishMesh) { fishMesh.position.copy(game.spot.deck).setY(game.spot.deck.y + 0.3); }
  feel(f.boot ? 'lost' : 'caught', f.boot ? SHOW_BOOT_T : SHOW_T); cam.tView = VIEW_SHOW;
}
/** a handful of droplets from a point on the water */
function splash(at, n, power) {
  let k = 0;
  for (const s of splashes) { if (s.life > 0 || k >= n) continue; k++; s.life = 0.55; s.m.visible = true; s.m.position.copy(at).setY(WATER_Y + 0.01); const a = Math.random() * Math.PI * 2, r = 0.25 + Math.random() * 0.45; s.vel.set(Math.cos(a) * r * power, (0.9 + Math.random() * 0.7) * power, Math.sin(a) * r * power); }
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
  // the fish under the water: it circles on the line, out at the start and drawn toward the deck as the catch bar fills, and
  // darts further out when it runs; the float is dragged after it
  const { water, deck } = game.spot, a = game.runT * (1.1 + pull) + Math.sin(game.runT * 2.7) * 0.6;
  const out = (0.1 + 0.26 * (1 - game.progress)) * (1 + (game.holding ? 0 : 0.35 * (1 - game.tension)));
  tmp.copy(water).lerp(deck, 0.35 * game.progress); shadow.position.set(tmp.x + Math.cos(a) * out, WATER_Y - 0.015, tmp.z + Math.sin(a) * out * 0.7);
  shadow.rotation.z = -a; shadow.material.opacity = 0.3 + 0.15 * Math.sin(game.runT * 5);
  float.position.set(tmp.x + (shadow.position.x - tmp.x) * 0.55, WATER_Y - 0.025 * game.tension + Math.sin(game.runT * 14) * 0.006, tmp.z + (shadow.position.z - tmp.z) * 0.55);
  if (Math.floor(game.runT * 3) !== Math.floor((game.runT - dt) * 3)) ripple(shadow.position, 1);
}
/** every frame: the float's arc, the wait, the bite, the fight, the leap and the rings; the invitation follows the jetty head */
function updateFishingGame(dt) {
  const P = pierFrame(); if (!P) return;
  if (!game.active) {   // the invitation: close to the jetty, zoomed in, and a resident fishing there
    const head = P.at(P.len - 0.1, 0); const close = ENABLED && anglersAtQuay() > 0 && cam.view < 9 && Math.hypot(cam.target.x - head.x, cam.target.z - head.z) < 5 && !document.body.classList.contains('menu-full') && !document.body.classList.contains('menu-pause');
    near.hidden = !close;
    if (close) { v.set(head.x, 0.35, head.z).project(camera); near.style.left = ((v.x + 1) / 2 * innerWidth).toFixed(0) + 'px'; near.style.top = ((1 - v.y) / 2 * innerHeight).toFixed(0) + 'px'; }
    return;
  }
  game.t += dt; const { deck, water } = game.spot;
  game.jolt = Math.max(0, game.jolt - dt * 2.6); game.sad = Math.max(0, game.sad - dt * 0.45);
  if (game.phase === 'cast') {   // an arc from the deck out to the water
    const k = Math.min(1, game.t / 0.9), y = deck.y + 0.25 + Math.sin(k * Math.PI) * 0.35 - k * (deck.y + 0.25 - WATER_Y);
    float.position.set(deck.x + (water.x - deck.x) * k, y, deck.z + (water.z - deck.z) * k);
    if (k >= 1) { game.phase = 'wait'; game.t = 0; game.biteAt = 2 + Math.random() * 5; ripple(water, 0.8); splash(water, 3, 0.4); }
  } else if (game.phase === 'wait' || game.phase === 'settle') {
    float.position.set(water.x, WATER_Y + 0.01 + Math.sin(game.t * 2.2) * 0.006, water.z);
    if (game.phase === 'settle' && game.t > 1.2) { game.phase = 'wait'; game.t = 0; game.biteAt = 2 + Math.random() * 5; say('…', 'Waiting'); }
    else if (game.phase === 'wait' && game.t >= game.biteAt) { game.phase = 'bite'; game.t = 0; game.jolt = 1; ripple(water, 1.4); splash(water, 6, 0.8); say('Now!', 'It bit'); feel('bite', 1.4); }
  } else if (game.phase === 'bite') {
    float.position.y = WATER_Y - 0.03 + Math.sin(game.t * 18) * 0.012;   // the float dips and jitters for a moment
    if (game.t > 1.1) settle('Missed it. The float settles');
  } else if (game.phase === 'fight') {
    fight(dt);
  } else if (game.phase === 'catch') {   // the float and the fish leap back toward the deck
    const k = Math.min(1, game.t / 0.8); float.position.set(water.x + (deck.x - water.x) * k, WATER_Y + Math.sin(k * Math.PI) * 0.5 + k * (deck.y + 0.2 - WATER_Y), water.z + (deck.z - water.z) * k);
    if (fishMesh) { fishMesh.position.copy(float.position).y += 0.03; fishMesh.rotation.set(-0.8 + k * 1.2, Math.atan2(deck.x - water.x, deck.z - water.z), Math.sin(k * 14) * 0.4); }
    if (k >= 1) { float.visible = false; showOff(); }
  } else if (game.phase === 'show') {   // held up for a moment, with a little wriggle, then back to fishing
    if (fishMesh && !game.fish.boot) fishMesh.rotation.z = 0.35 + Math.sin(game.t * 9) * 0.12 * Math.max(0, 1 - game.t / 1.5);
    if (game.t >= (game.fish.boot ? SHOW_BOOT_T : SHOW_T)) { dropFish(); game.show = 0; game.phase = 'idle'; game.t = 0; cam.tView = VIEW; say('Cast again', 'Tap when the float dips'); }
  }
  for (const r of rings) if (r.visible) { r.userData.t += dt; const s = r.userData.k * (1 + r.userData.t * 2.2); r.scale.set(s, s, s); r.material.opacity = Math.max(0, 0.6 - r.userData.t * 0.5); if (r.material.opacity <= 0) r.visible = false; }
  for (const s of splashes) if (s.life > 0) { s.life -= dt; s.vel.y -= dt * 3.2; s.m.position.addScaledVector(s.vel, dt); s.m.material.opacity = Math.min(0.9, s.life * 2); if (s.life <= 0 || s.m.position.y < WATER_Y) { s.life = 0; s.m.visible = false; } }
  // the angler: reel, strain and the moment's reaction for the pose; they stay put while the player is fishing as them
  if (game.angler) {
    const ch = anglerChar(); game.reel += (((game.phase === 'fight' && game.holding) ? 1 : 0) - game.reel) * Math.min(1, dt * 10);
    if (ch) ch.fishing = { reel: game.reel, strain: game.phase === 'fight' ? Math.max(0, (game.tension - 0.3) / 0.7) : 0, jolt: game.jolt, sad: game.sad, show: game.show, fish: game.phase === 'show' ? fishMesh : null };
    const tr = game.angler.trip; if (tr && tr.held && tr.landmark && tr.landmark.kind === 'pier') tr.holdUntil = Math.max(tr.holdUntil, S.T + 0.08); else stop();   // they left (or were cleared): the game ends with them
  }
}
function ripple(at, k = 1) { rings.forEach((r, i) => { r.position.set(at.x, WATER_Y + 0.005, at.z); r.userData.k = k; r.scale.setScalar(k); r.userData.t = -i * 0.22; r.material.opacity = 0; r.visible = true; }); }

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
