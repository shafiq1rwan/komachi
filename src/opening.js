// Komachi — the opening scene (Phase 9): newcomers on the underground train into Komachi. Slice 1 (2026-09-25): the carriage
// interior, built from boxes like the station pavilion, with four seated Kenney people (two chatting with speech bubbles, one on
// a phone, one behind a newspaper), a gentle sway and tunnel lights passing the windows. It lives in the main scene far below
// the island, so the shared orthographic camera, the rich post chain and bubbles.js all work unchanged; `updateOpening` aims the
// camera itself while it plays. Slice 2 adds the iris wipe onto the island, the skip button and the menu's replay entry.
import * as THREE from 'three';
import { S } from './state.js';
import { scene, camera, cam } from './scene.js';
import { box, cyl, colorize, mergeMesh } from './geometry.js';
import { PAL, SKIN, SHIRTS, HAIR, GIVEN, FAMILY } from './palette.js';
import { pick } from './utils.js';
import { makePerson } from './sim.js';
import { holdItem } from './characters.js';
import { createPhone, createNewspaper } from './hand-items.js';
import { startTalk, endTalk } from './bubbles.js';

const X0 = 420, Y0 = 0;                           // the carriage stands out past the sea plane's edge (600 wide), so nothing of the town is in frame
const L = 2.7, W = 0.82, H = 0.6, SEAT = 0.114;   // carriage length (x), width (z), ceiling, seat top (the station bench's height above its plinth)
const opening = { active: false, root: null, people: [], lights: [], t: 0 };
const view = { target: new THREE.Vector3(X0 + 0.1, Y0 + 0.2, -0.05), yaw: 0.36, pitch: 0.5, size: 1.5 };
let skyWas = null, fogWas = null;   // the town's sky and fog, put back when the scene ends

const PASSENGERS = [
  { x: -0.98, kind: 'chat', shirt: SHIRTS[2], gaze: -0.55 },
  { x: -0.56, kind: 'chat', shirt: SHIRTS[0], gaze: 0.55 },
  { x: 0.18, kind: 'phone', shirt: SHIRTS[4] },
  { x: 0.82, kind: 'paper', shirt: SHIRTS[7] },
];

/** the carriage: floor, far wall with the window band and a route map, the bench along it, ceiling with light strips and
 *  hand straps, doors and poles at both ends; the near side is open so the camera looks in */
function buildCarriage() {
  const g = [], glow = [];
  const steel = '#b9bec4', dark = '#3a4149', fabric = '#5f8f8a', trim = '#e9e4d8', panel = '#eef0ee', night = '#151c27';
  g.push(box(L, 0.04, W, '#8d8f8a', 0, -0.02, 0));                               // floor
  g.push(box(L, 0.012, 0.16, '#a9aba4', 0, 0.001, 0.12));                        // a worn strip down the aisle
  g.push(box(L, H, 0.04, panel, 0, H / 2, -W / 2));                              // far wall
  for (const x of [-L / 2, L / 2]) g.push(box(0.04, H, W, panel, x, H / 2, 0));  // end walls
  g.push(box(L, 0.04, 0.3, '#e4e6e2', 0, H + 0.02, -W / 2 + 0.15));               // a cornice of ceiling over the far side; the rest is open to the camera
  // the tunnel outside: dark walls behind and beneath the carriage, so nothing of the sky shows through the windows
  g.push(box(L + 6, 4, 0.2, '#1a2029', 0, 1.2, -W / 2 - 0.9)); g.push(box(L + 6, 0.06, 6, '#232830', 0, -0.08, -1.5));
  for (const x of [-L / 2 - 3, L / 2 + 3]) g.push(box(0.2, 4, 6, '#1a2029', x, 1.2, -1.5));
  // the window band: night outside, a sill and a top rail; the tunnel lights are separate meshes that slide past
  g.push(box(L - 0.5, 0.2, 0.012, night, 0, 0.36, -W / 2 + 0.03));
  g.push(box(L - 0.4, 0.02, 0.05, steel, 0, 0.255, -W / 2 + 0.04));
  g.push(box(L - 0.4, 0.02, 0.05, steel, 0, 0.465, -W / 2 + 0.04));
  for (const x of [-0.75, 0, 0.75]) g.push(box(0.03, 0.22, 0.012, steel, x, 0.36, -W / 2 + 0.035));   // window mullions
  // the route map and a couple of adverts above the windows
  g.push(box(0.6, 0.06, 0.008, trim, -0.45, 0.53, -W / 2 + 0.03)); for (let k = 0; k < 7; k++) g.push(box(0.014, 0.014, 0.01, k === 6 ? PAL.roofRose : PAL.roofTeal, -0.7 + k * 0.083, 0.53, -W / 2 + 0.025));
  g.push(box(0.022, 0.006, 0.01, PAL.roofTeal, -0.45, 0.53, -W / 2 + 0.025));
  g.push(box(0.3, 0.07, 0.008, PAL.roofPeach, 0.4, 0.53, -W / 2 + 0.03)); g.push(box(0.3, 0.07, 0.008, '#cfe0ea', 0.85, 0.53, -W / 2 + 0.03));
  // the bench along the far wall: a cushion, a backrest and a plinth, with dividers
  g.push(box(L - 0.6, 0.05, 0.27, fabric, 0, SEAT - 0.025, -W / 2 + 0.17));
  g.push(box(L - 0.6, 0.16, 0.05, fabric, 0, SEAT + 0.06, -W / 2 + 0.055));
  g.push(box(L - 0.6, SEAT - 0.05, 0.25, dark, 0, (SEAT - 0.05) / 2, -W / 2 + 0.17));
  for (const x of [-L / 2 + 0.3, L / 2 - 0.3]) g.push(box(0.03, 0.22, 0.28, steel, x, 0.11, -W / 2 + 0.17));
  // hand straps from a rail along the ceiling, and a pole by each door
  { const rail = new THREE.CylinderGeometry(0.008, 0.008, L - 0.5, 6); rail.rotateZ(Math.PI / 2); rail.translate(0, H - 0.09, -0.02); g.push(colorize(rail, steel)); }
  for (let k = 0; k < 6; k++) { const x = -1.05 + k * 0.42; g.push(box(0.008, 0.07, 0.008, '#4a4340', x, H - 0.125, -0.02)); g.push(box(0.05, 0.03, 0.01, trim, x, H - 0.17, -0.02)); }
  for (const x of [-L / 2 + 0.18, L / 2 - 0.18]) g.push(cyl(0.012, 0.012, H, steel, x, H / 2, 0.16, 8));
  for (const x of [-L / 2 + 0.02, L / 2 - 0.02]) { g.push(box(0.03, 0.5, 0.36, '#d7dad6', x, 0.25, 0.1)); g.push(box(0.034, 0.22, 0.14, night, x, 0.36, 0.1)); }   // end doors with their windows
  // ceiling light strips (emissive), and the small stop-name display
  for (const x of [-0.7, 0.7]) glow.push(box(1.0, 0.012, 0.08, '#fff7e0', x, H - 0.01, -W / 2 + 0.18));   // light strips under the cornice
  glow.push(box(0.26, 0.05, 0.01, '#3b5b4f', 0.05, 0.53, -W / 2 + 0.03));                            // the next-stop display above the windows
  const root = new THREE.Group(); root.position.set(X0, Y0, 0);
  const body = mergeMesh(g, true); if (body) root.add(body);
  const lit = mergeMesh(glow, false); if (lit) { lit.material = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#fff2cc', emissiveIntensity: 0.9, roughness: 1 }); root.add(lit); }
  // tunnel lights: pale bars behind the glass that slide past and wrap
  for (let k = 0; k < 5; k++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.006), new THREE.MeshStandardMaterial({ color: '#4d5d78', emissive: '#c9d6ee', emissiveIntensity: 0.8 }));
    m.position.set(-1.3 + k * 0.6, 0.36, -W / 2 + 0.046); root.add(m); opening.lights.push(m);   // just in front of the night band, behind the mullions
  }
  const warm = new THREE.PointLight('#ffe7c2', 1.1, 2.4, 1.6); warm.position.set(0, H - 0.05, 0.05); root.add(warm);
  scene.add(root); return root;
}

/** four newcomers on the bench, at the town's people scale, already seated when the scene opens */
function seatPassengers(root) {
  for (const p of PASSENGERS) {
    const who = { id: S.nextId++, name: `${pick(GIVEN)} ${pick(FAMILY)}`, skin: pick(SKIN), shirt: p.shirt, pants: pick(['#4a4340', '#6b6f7a', '#8a7a6f']), hair: pick(HAIR), hat: false, bag: false, state: 'inside', paused: true, passenger: true };
    const mesh = makePerson(who); mesh.userData.res = null; mesh.userData.rider = who; who.mesh = mesh;
    root.add(mesh); mesh.position.set(p.x, SEAT - 0.025, -W / 2 + 0.17 + 0.04); mesh.rotation.y = 0; mesh.visible = true;
    const ch = mesh.userData.char;
    if (ch) {
      ch.sitting = true; if (ch.sit) { ch.sitBlend = 1; }
      if (p.kind === 'phone') { holdItem(ch, createPhone()); ch.fidget = 'phone'; }
      else if (p.kind === 'paper') { holdItem(ch, createNewspaper()); ch.fidget = 'paper'; }
      else ch.gaze = p.gaze;
    }
    who.kind = p.kind; opening.people.push(who);
  }
  const [a, b] = opening.people;
  startTalk(a, b, pick(['home', 'weather', 'food']), S.T + 1e6);
}

/** show the scene: build it once, then point the camera into the carriage */
function startOpening() {
  if (!opening.root) { opening.root = buildCarriage(); seatPassengers(opening.root); }
  opening.root.visible = true; opening.active = true; opening.t = 0;
  cam.view = cam.tView = view.size;   // bubbles.js hides its bubbles when the view is wide
  fogWas = scene.fog; scene.fog = null; scene.background = new THREE.Color('#12171f'); skyWas = true;   // underground: a dark backdrop instead of the sky's clear colour, no haze
}
function stopOpening() {
  opening.active = false; if (opening.root) opening.root.visible = false;
  if (skyWas) { scene.background = null; scene.fog = fogWas; skyWas = null; fogWas = null; }
  const [a] = opening.people; if (a) endTalk(a);
}

/** the sway, the passing lights and the camera; called from the frame loop instead of the town's update while it plays */
function updateOpening(dt) {
  if (!opening.active) return;
  opening.t += dt; const t = opening.t, root = opening.root;
  root.rotation.z = Math.sin(t * 1.7) * 0.006 + Math.sin(t * 4.3) * 0.002;
  root.position.y = Y0 + Math.sin(t * 2.9) * 0.004;
  for (const m of opening.lights) { m.position.x -= dt * 1.4; if (m.position.x < -1.5) m.position.x += 3; m.material.emissiveIntensity = 0.55 + 0.45 * Math.max(0, Math.sin(t * 6 + m.position.x)); }
  // the camera: the game's orthographic frame, aimed into the carriage
  const aspect = innerWidth / innerHeight, v = view.size;
  camera.left = -v * aspect / 2; camera.right = v * aspect / 2; camera.top = v / 2; camera.bottom = -v / 2; camera.updateProjectionMatrix();
  const dir = new THREE.Vector3(Math.sin(view.yaw) * Math.cos(view.pitch), Math.sin(view.pitch), Math.cos(view.yaw) * Math.cos(view.pitch));
  camera.position.copy(view.target).addScaledVector(dir, 120); camera.lookAt(view.target);
}

export { opening, startOpening, stopOpening, updateOpening };
