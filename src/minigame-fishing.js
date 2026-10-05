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
import { setFishStall, fishingNow } from './landmarks.js';
import { record } from './chronicle.js';
import { toast } from './toast.js';
import { pick } from './utils.js';
import { showFeeling, endTalk } from './bubbles.js';
import { residents } from './sim.js';
import { playFishingSound } from './audio.js';
import { createFishProp, animateFishProp } from './fish-prop.js';

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
const BITE_T = 1.65;
const game = { active: false, phase: 'idle', t: 0, biteAt: 0, caught: 0, spot: null, fish: null, tension: 0, progress: 0, holding: false, runT: 0, angler: null, reel: 0, strained: false, jolt: 0, sad: 0, show: 0 };
let float = null, rings = [], shadow = null, splashes = [], fishMesh = null;
let el = null, btn = null, line = null, near = null, sub = null, meter = null, needle = null, fill = null;
let session, cue, action, message, stage, status, result, tensionState, percent, savedCamera;
let pointerHeld = false, keyHeld = false;
let fishingLine = null, rodLine = null;
let framingDirty = true, framing = null;
const cameraAim = new THREE.Vector3(), cameraRight = new THREE.Vector3(), cameraUp = new THREE.Vector3();
const v = new THREE.Vector3(), tmp = new THREE.Vector3();

function build() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), new THREE.MeshStandardMaterial({ color: '#d94f3d', roughness: 0.6 })));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshStandardMaterial({ color: '#fff6e4', roughness: 0.6 })); cap.position.y = 0.034; g.add(cap);
  g.visible = false; scene.add(g); float = g;
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(27), 3));
  fishingLine = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#fff5df', transparent: true, opacity: 0.8 })); fishingLine.frustumCulled = false; fishingLine.visible = false; scene.add(fishingLine);
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
  if (!f.boot) return createFishProp(f);
  const g = new THREE.Group(); const L = f.len;
  if (f.boot) {
    const leather = new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.9 });
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(L * 0.45, L * 0.7, L * 0.5), leather); shaft.position.y = L * 0.25; g.add(shaft);
    const toe = new THREE.Mesh(new THREE.BoxGeometry(L * 0.45, L * 0.28, L * 0.95), leather); toe.position.set(0, -L * 0.2, L * 0.2); g.add(toe);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(L * 0.47, L * 0.06, L * 0.98), new THREE.MeshStandardMaterial({ color: '#2e2620', roughness: 1 })); sole.position.set(0, -L * 0.36, L * 0.2); g.add(sole);
    return g;
  }
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

function say(head, small) {
  if (!el) return;
  el.dataset.phase = game.phase;
  action.textContent = head; sub.textContent = small || '';
  btn.disabled = ['cast', 'wait', 'settle', 'catch'].includes(game.phase);
  const states = {
    idle: ['BY THE WATER', 'Ready', 'Take a moment by the water'],
    cast: ['CASTING', 'On its way', 'A little further out…'],
    wait: ['WATCH THE FLOAT', 'Waiting', 'A quiet moment. Watch for a dip.'],
    bite: ['SOMETHING BIT!', 'Bite!', 'The float dipped — strike now!'],
    fight: ['ON THE LINE', 'Hooked', 'Keep the line steady'],
    settle: ['ANOTHER CHANCE', 'No hurry', small],
    catch: ['YOUR CATCH', 'Landed', ''],
    show: ['YOUR CATCH', game.fish?.boot ? 'A surprise' : 'Landed', ''],
  };
  const s = states[game.phase]; stage.textContent = s[0]; status.textContent = s[1]; message.textContent = s[2];
  result.hidden = !['catch', 'show'].includes(game.phase);
  document.getElementById('fish-count').textContent = `${game.caught} caught`;
  framingDirty = true;
}
/** Frame the angler and float in the space above the card, or beside it on a short screen. */
function frameFishing(dt) {
  if (framingDirty) {
    const panel = el.getBoundingClientRect(), header = session.getBoundingClientRect();
    framing = innerHeight <= 520 ? { x: panel.left / 2, y: (header.bottom + innerHeight) / 2 } : { x: innerWidth / 2, y: (header.bottom + panel.top) / 2 };
    framingDirty = false;
  }
  cameraAim.copy(game.spot.deck).lerp(game.spot.water, 0.4); cameraAim.y = -0.25;
  cameraRight.set(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
  cameraUp.set(-Math.sin(cam.yaw) * Math.sin(cam.pitch), Math.cos(cam.pitch), -Math.cos(cam.yaw) * Math.sin(cam.pitch));
  cameraAim.addScaledVector(cameraRight, (0.5 - framing.x / innerWidth) * cam.view * innerWidth / innerHeight);
  cameraAim.addScaledVector(cameraUp, (framing.y / innerHeight - 0.5) * cam.view);
  cam.target.lerp(cameraAim, 1 - Math.exp(-dt * 8));
}
function showMeter(on) { if (meter) meter.hidden = !on; if (on) drawMeter(); }
function drawMeter() {
  if (!needle) return;
  needle.style.left = (game.tension * 100).toFixed(1) + '%'; fill.style.width = (game.progress * 100).toFixed(1) + '%';
  meter.classList.toggle('tight', game.tension > BAND[1]); meter.classList.toggle('slack', game.tension < BAND[0]);
  meter.classList.toggle('danger', game.tension > 0.86);
  const advice = game.tension > 0.86 ? 'Release now!' : game.tension > BAND[1] ? 'Ease off' : game.tension < BAND[0] ? 'Reel a little' : 'Steady';
  tensionState.textContent = advice;
  sub.textContent = game.tension > BAND[1] ? 'Release to ease the tension' : game.tension < BAND[0] ? 'Hold to take up the slack' : 'Hold to reel · release to ease tension';
  const p = Math.min(100, Math.round(game.progress * 100)), t = Math.min(100, Math.round(game.tension * 100));
  percent.textContent = `${p}%`;
  document.getElementById('fish-tension').setAttribute('aria-valuenow', t);
  document.getElementById('fish-tension').setAttribute('aria-valuetext', `${t} percent. ${advice}`);
  document.getElementById('fish-progress').setAttribute('aria-valuenow', p);
}
function start() {
  if (game.active) return; game.angler = pickAngler(); game.spot = fishingSpot(game.angler); if (!game.spot) return;
  if (!float) build();
  savedCamera = { target: cam.target.clone(), view: cam.tView, yaw: cam.tYaw };
  pointerHeld = false; keyHeld = false;
  game.active = true; game.phase = 'idle'; game.t = 0; game.holding = false; game.reel = 0; game.jolt = 0; game.sad = 0; game.show = 0; el.hidden = false; near.hidden = true; document.body.classList.add('fishing'); showMeter(false);
  const ch = anglerChar(); if (ch) ch.fishing = { reel: 0, strain: 0, jolt: 0, sad: 0, show: 0, fish: null };
  rodLine = ch?.accessory?.getObjectByName('Fishing_Line'); if (rodLine) rodLine.visible = false;
  session.hidden = false; result.hidden = true;
  document.getElementById('fish-angler').textContent = game.angler ? `A moment with ${game.angler.name.split(' ')[0]}` : 'A little time by the water';
  cam.target.copy(game.spot.deck).lerp(game.spot.water, 0.4); cam.target.y = -0.25; cam.tView = VIEW;
  say('Cast your line', 'Tap or press Space to cast'); btn.focus({ preventScroll: true });
}
function dropFish() { if (fishMesh) { fishMesh.removeFromParent(); const materials = new Set(); fishMesh.traverse(o => { if (o.isMesh) { o.geometry.dispose(); materials.add(o.material); } }); materials.forEach(m => m.dispose()); fishMesh = null; } const ch = anglerChar(); if (ch && ch.fishing) ch.fishing.fish = null; }
function stop() {
  if (!game.active) return; game.active = false; game.holding = false; el.hidden = true; document.body.classList.remove('fishing'); showMeter(false);
  pointerHeld = false; keyHeld = false; el.classList.remove('holding'); session.hidden = true; cue.hidden = true;
  fishingLine.visible = false; if (rodLine) rodLine.visible = true; rodLine = null;
  if (savedCamera) { cam.target.copy(savedCamera.target); cam.tView = savedCamera.view; cam.tYaw = savedCamera.yaw; savedCamera = null; }
  float.visible = false; shadow.visible = false; for (const r of rings) r.visible = false; for (const s of splashes) s.m.visible = false; dropFish();
  const ch = anglerChar(); if (ch) ch.fishing = null; if (game.angler) endTalk(game.angler); game.angler = null; game.show = 0;
  if (game.caught) toast(game.caught === 1 ? 'One fish for the market' : `${game.caught} fish for the market`); game.caught = 0;
}
/** the float drifts back to rest: a missed bite, a lost fish, or a strike too soon */
function settle(why, feeling = null) { game.phase = 'settle'; game.t = 0; game.holding = false; shadow.visible = false; showMeter(false); say('Try again', why); if (feeling) { feel(feeling, 2.5); game.sad = 1; } }
function tap() {
  if (game.phase === 'show') { if (game.t < 0.5) return; dropFish(); game.show = 0; game.phase = 'idle'; cam.tView = VIEW; }
  if (game.phase === 'idle') { game.phase = 'cast'; game.t = 0; float.visible = true; say('Casting…', 'Watch where your float lands'); playFishingSound('cast'); }
  else if (game.phase === 'bite') {   // the strike: hooked, the fight is on; the angler braces
    game.phase = 'fight'; game.t = 0; game.fish = pick(FISH); game.tension = 0.45; game.progress = 0; game.runT = 0; game.strained = false; game.jolt = 1; showMeter(true); endTalk(game.angler);
    shadow.visible = true; shadow.position.copy(game.spot.water).setY(WATER_Y - 0.015); splash(game.spot.water, 5, 0.7);
    say('Hold to reel', 'Keep the line in the green');
    playFishingSound('hook');
  }
}
function land() {
  const f = game.fish, real = !f.boot;
  game.phase = 'catch'; game.t = 0; game.holding = false; shadow.visible = false; showMeter(false);
  if (real) { game.caught++; setFishStall(true); if (game.caught === 1) record(`${game.angler ? game.angler.name : 'Someone'} caught ${f.name} off the jetty`); }
  dropFish(); fishMesh = makeFishMesh(f); fishMesh.position.copy(float.position); scene.add(fishMesh);   // the fish leaps with the float
  splash(float.position, 8, 1);
  const species = f.name.replace(/^(a|an) /, '');
  document.getElementById('fish-species').textContent = species[0].toUpperCase() + species.slice(1);
  document.getElementById('fish-result-kicker').textContent = real ? 'A lovely catch' : 'Well, that was unexpected';
  document.getElementById('fish-destination').textContent = real ? 'Sent to the fish market' : 'An old boot. Back it goes.';
  const portrait = document.getElementById('fish-portrait'); portrait.style.color = f.color;
  portrait.firstElementChild.className = `fa-solid ${real ? 'fa-fish' : 'fa-shoe-prints'}`;
  playFishingSound(real ? 'catch' : 'boot');
  say(real ? 'Caught!' : 'Hmm', real ? `${f.name[0].toUpperCase()}${f.name.slice(1)} for the fish market` : 'An old boot. Back it goes');
}
/** the catch is held up for a moment: the fish moves into the angler's hands, the camera leans in */
function showOff() {
  game.phase = 'show'; game.t = 0; game.show = 1; const f = game.fish;
  const ch = anglerChar();
  if (ch && fishMesh) { ch.grp.add(fishMesh); fishMesh.position.set(0, 0.345, 0.07); fishMesh.rotation.set(0, Math.PI / 2, f.boot ? 0 : 0.35); ch.fishing.fish = fishMesh; }
  else if (fishMesh) { fishMesh.position.copy(game.spot.deck).setY(game.spot.deck.y + 0.3); }
  feel(f.boot ? 'lost' : 'caught', f.boot ? SHOW_BOOT_T : SHOW_T); cam.tView = VIEW_SHOW;
  say('Cast again', 'Take your time · tap or press Space when ready');
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
    game.tension += dt * (0.3 + pull * 0.48 * surge);
    if (game.tension >= BAND[0] && game.tension <= BAND[1]) game.progress += dt / f.work;
    else if (game.tension > BAND[1]) game.progress += dt / f.work * 0.35;   // too tight still gains a little, at a risk
  } else {
    game.tension -= dt * (0.32 + 0.16 * surge);
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
    const head = P.at(P.len - 0.1, 0); const close = ENABLED && fishingNow() > 0 && cam.view < 9 && Math.hypot(cam.target.x - head.x, cam.target.z - head.z) < 5 && !document.body.classList.contains('menu-full') && !document.body.classList.contains('menu-pause');
    near.hidden = !close;
    if (close) { v.set(head.x, 0.35, head.z).project(camera); near.style.left = ((v.x + 1) / 2 * innerWidth).toFixed(0) + 'px'; near.style.top = ((1 - v.y) / 2 * innerHeight).toFixed(0) + 'px'; }
    return;
  }
  if (document.hidden || document.body.classList.contains('menu-pause') || document.body.classList.contains('menu-full')) { pointerHeld = false; keyHeld = false; game.holding = false; el.classList.remove('holding'); return; }
  game.t += dt; const { deck, water } = game.spot;
  game.jolt = Math.max(0, game.jolt - dt * 2.6); game.sad = Math.max(0, game.sad - dt * 0.45);
  if (game.phase === 'cast') {   // an arc from the deck out to the water
    const k = Math.min(1, game.t / 0.9), y = deck.y + 0.25 + Math.sin(k * Math.PI) * 0.35 - k * (deck.y + 0.25 - WATER_Y);
    float.position.set(deck.x + (water.x - deck.x) * k, y, deck.z + (water.z - deck.z) * k);
    if (k >= 1) { game.phase = 'wait'; game.t = 0; game.biteAt = 2 + Math.random() * 3.5; say('Waiting for a bite', 'Strike when the float dips'); ripple(water, 0.8); splash(water, 3, 0.4); }
  } else if (game.phase === 'wait' || game.phase === 'settle') {
    float.position.set(water.x, WATER_Y + 0.01 + Math.sin(game.t * 2.2) * 0.006, water.z);
    if (game.phase === 'settle' && game.t > 1.7) { game.phase = 'wait'; game.t = 0; game.biteAt = 2 + Math.random() * 3.5; say('Waiting for a bite', 'Strike when the float dips'); }
    else if (game.phase === 'wait' && game.t >= game.biteAt) { game.phase = 'bite'; game.t = 0; game.jolt = 1; ripple(water, 1.4); splash(water, 6, 0.8); say('Strike!', 'Tap or press Space now'); feel('bite', BITE_T); playFishingSound('bite'); }
  } else if (game.phase === 'bite') {
    float.position.y = WATER_Y - 0.03 + Math.sin(game.t * 18) * 0.012;   // the float dips and jitters for a moment
    if (game.t > BITE_T) settle('It slipped away. Another bite will come.');
  } else if (game.phase === 'fight') {
    fight(dt);
  } else if (game.phase === 'catch') {   // the float and the fish leap back toward the deck
    const k = Math.min(1, game.t / 0.8); float.position.set(water.x + (deck.x - water.x) * k, WATER_Y + Math.sin(k * Math.PI) * 0.5 + k * (deck.y + 0.2 - WATER_Y), water.z + (deck.z - water.z) * k);
    if (fishMesh) { fishMesh.position.copy(float.position).y += 0.03; fishMesh.rotation.set(-0.8 + k * 1.2, Math.atan2(deck.x - water.x, deck.z - water.z), Math.sin(k * 14) * 0.4); animateFishProp(fishMesh, game.t); }
    if (k >= 1) { float.visible = false; showOff(); }
  } else if (game.phase === 'show') {   // held up for a moment, with a little wriggle, then back to fishing
    if (fishMesh && !game.fish.boot) { const wriggle = Math.max(0, 1 - game.t / 1.5); fishMesh.rotation.z = 0.35 + Math.sin(game.t * 9) * 0.1 * wriggle; animateFishProp(fishMesh, game.t, wriggle); }
    if (game.t >= (game.fish.boot ? SHOW_BOOT_T : SHOW_T)) { dropFish(); game.show = 0; cam.tView = VIEW; }
  }
  cue.hidden = game.phase !== 'bite';
  frameFishing(dt);
  if (!cue.hidden) { v.copy(float.position).project(camera); cue.hidden = v.z < -1 || v.z > 1; cue.style.left = `${Math.max(55, Math.min(innerWidth - 55, (v.x + 1) / 2 * innerWidth))}px`; cue.style.top = `${Math.max(100, (1 - v.y) / 2 * innerHeight - 15)}px`; }
  if (game.phase !== 'fight') { game.holding = false; el.classList.remove('holding'); }
  fishingLine.visible = float.visible && game.phase !== 'show';
  if (fishingLine.visible) {
    const rod = anglerChar()?.accessory;
    if (rod) { rod.updateWorldMatrix(true, false); tmp.set(0, 0.415, 0.094); rod.localToWorld(tmp); }
    else tmp.copy(deck).add(new THREE.Vector3(0, 0.35, 0));
    const positions = fishingLine.geometry.attributes.position, slack = game.phase === 'fight' ? Math.max(0, 0.08 * (1 - game.tension)) : 0.08;
    for (let i = 0; i < positions.count; i++) { const k = i / (positions.count - 1); positions.setXYZ(i, tmp.x + (float.position.x - tmp.x) * k, tmp.y + (float.position.y - tmp.y) * k - Math.sin(k * Math.PI) * slack, tmp.z + (float.position.z - tmp.z) * k); }
    positions.needsUpdate = true;
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

// Pointer and keyboard holds are tracked independently, and focus loss always releases the line.
{
  el = document.getElementById('fishing'); near = document.getElementById('fish-near');
  if (el && near) {
    btn = el.querySelector('#fish-tap'); sub = el.querySelector('#fish-sub');
    line = document.getElementById('fish-end');
    meter = el.querySelector('#fish-meter'); needle = el.querySelector('#fish-needle'); fill = el.querySelector('#fish-fill');
    session = document.getElementById('fish-session'); cue = document.getElementById('fish-cue');
    action = document.getElementById('fish-action'); message = document.getElementById('fish-message'); stage = document.getElementById('fish-stage'); status = document.getElementById('fish-status');
    result = document.getElementById('fish-result'); tensionState = document.getElementById('fish-tension-state'); percent = document.getElementById('fish-percent');
    const syncHold = () => { game.holding = game.active && game.phase === 'fight' && (pointerHeld || keyHeld); el.classList.toggle('holding', game.holding); };
    const available = () => game.active && !document.hidden && !document.body.classList.contains('menu-pause') && !document.body.classList.contains('menu-full');
    btn.addEventListener('pointerdown', e => { if (e.button !== 0 || !available()) return; e.preventDefault(); btn.focus({ preventScroll: true }); btn.setPointerCapture(e.pointerId); pointerHeld = true; if (game.phase !== 'fight') tap(); syncHold(); });
    const releasePointer = () => { pointerHeld = false; syncHold(); };
    btn.addEventListener('pointerup', releasePointer); btn.addEventListener('pointercancel', releasePointer); btn.addEventListener('lostpointercapture', releasePointer);
    btn.addEventListener('click', e => { if (e.detail === 0 && available()) tap(); });
    addEventListener('keydown', e => {
      if (!available()) return;
      if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); stop(); return; }
      if (!['Space', 'Enter'].includes(e.code) || e.target.closest?.('#fish-end')) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (!e.repeat && !keyHeld) { keyHeld = true; if (game.phase !== 'fight') tap(); syncHold(); }
    }, true);
    addEventListener('keyup', e => { if (!game.active || !['Space', 'Enter'].includes(e.code) || (!keyHeld && e.target.closest?.('#fish-end'))) return; e.preventDefault(); e.stopImmediatePropagation(); keyHeld = false; syncHold(); }, true);
    const releaseAll = () => { pointerHeld = false; keyHeld = false; syncHold(); };
    addEventListener('blur', releaseAll); document.addEventListener('visibilitychange', releaseAll);
    addEventListener('resize', () => { framingDirty = true; });
    line.addEventListener('click', stop); near.addEventListener('click', start);
  }
}
export { updateFishingGame, start as startFishing, stop as stopFishing, game as fishingGame };
