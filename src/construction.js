// Komachi — construction crews and deliveries. Builders ride in on the train, walk to the site, work
// until 18:00 and go back down the stairs; nothing gets built without them. Kei trucks bring
// materials from the station at the start of each stage. Purely a layer over the stage timers in sim.js.
import { S } from './state.js';
import { pick, rand } from './utils.js';
import { GIVEN, FAMILY, SKIN, HAIR } from './palette.js';
import { peopleGroup, disposeGroup, cx, cz } from './scene.js';
import { detachCharacter, holdTool } from './characters.js';
import { blocks, cells, STATION, stationStairs, DONE, terrainY } from './world.js';
import { unitLocal, dims, rebuildUnitMesh } from './buildings.js';
import * as THREE from 'three';
import { box, cyl, colorize, mergeMesh } from './geometry.js';
import { hourOf, routeCells, roadNeighbors, frontRoad, buildPoints, makePerson, makeCar, moveAlong, setProgressRate, onTrain, carMeshes, trafficFactor } from './sim.js';
import { toast } from './toast.js';

const workers = [], trucks = [], pending = [];      // pending: { t, fn } things that happen a little after a train pulls in
const MAX_WORKERS = 9, CREW_SIZE = 3, WORK_END = 18;
const VEST = '#e9a25a', HELMET = '#e8cf7a';
const SPOTS = [[-0.42, 0.62], [0.46, 0.6], [0.62, -0.12]];   // where the crew stands, in the unit's local space
// ── tools: little meshes held in the right hand (box person hands sit at about (±0.08, 0.17, 0)) ──
const WOOD = '#b98a5b', METAL = '#8fa3ad', DARK = '#4a4340', YELLOW = '#e8cf7a';
function makeTool(name) {
  const g = [];
  if (name === 'hammer') { g.push(cyl(0.008, 0.008, 0.14, WOOD, 0, 0.07, 0, 5)); g.push(box(0.05, 0.025, 0.025, METAL, 0, 0.14, 0)); }
  else if (name === 'drill') { g.push(box(0.045, 0.04, 0.08, YELLOW, 0, 0.02, 0.03)); g.push(box(0.02, 0.05, 0.03, DARK, 0, -0.03, 0)); g.push(cyl(0.005, 0.005, 0.06, METAL, 0, 0.02, 0.1, 5)); }
  else if (name === 'plank') { g.push(box(0.035, 0.035, 0.6, WOOD, 0, 0, 0)); g.push(box(0.035, 0.035, 0.6, '#a3764a', 0.036, 0.01, 0.02)); }
  else if (name === 'shovel') { const h = new THREE.CylinderGeometry(0.008, 0.008, 0.32, 5); h.rotateX(0.9); h.translate(0, 0.1, 0.06); g.push(colorize(h, WOOD)); const bl = new THREE.BoxGeometry(0.06, 0.09, 0.012); bl.rotateX(0.9); bl.translate(0, -0.02, 0.2); g.push(colorize(bl, METAL)); }
  else if (name === 'roller') { g.push(cyl(0.008, 0.008, 0.18, METAL, 0, 0.09, 0, 5)); const r = new THREE.CylinderGeometry(0.02, 0.02, 0.07, 8); r.rotateZ(Math.PI / 2); r.translate(0, 0.19, 0.02); g.push(colorize(r, '#f3c6c0')); }
  else if (name === 'bucket') { g.push(cyl(0.04, 0.035, 0.07, METAL, 0, -0.05, 0, 8)); g.push(box(0.005, 0.06, 0.005, DARK, 0, 0.0, 0)); g.push(cyl(0.035, 0.035, 0.01, '#8fb0c9', 0, -0.02, 0, 8)); }
  else if (name === 'saw') { g.push(box(0.05, 0.03, 0.02, WOOD, 0, 0, -0.02)); g.push(box(0.012, 0.05, 0.22, METAL, 0, 0, 0.11)); }
  else if (name === 'level') { g.push(box(0.5, 0.03, 0.03, YELLOW, 0, 0, 0)); g.push(box(0.04, 0.02, 0.032, '#8fb0c9', 0, 0.005, 0)); }
  else if (name === 'barrow') { g.push(box(0.16, 0.08, 0.22, METAL, 0, 0.13, 0.22)); g.push(box(0.12, 0.05, 0.16, '#d9c3a1', 0, 0.19, 0.22)); const w = new THREE.CylinderGeometry(0.045, 0.045, 0.03, 10); w.rotateZ(Math.PI / 2); w.translate(0, 0.045, 0.34); g.push(colorize(w, DARK)); for (const x of [-0.07, 0.07]) { g.push(box(0.012, 0.012, 0.26, WOOD, x, 0.16, 0.1)); g.push(box(0.012, 0.1, 0.012, METAL, x, 0.05, 0.14)); } }
  else if (name === 'clipboard') { g.push(box(0.09, 0.12, 0.008, '#f7efe2', 0, 0, 0)); g.push(box(0.05, 0.02, 0.012, DARK, 0, 0.055, 0)); }
  const m = mergeMesh(g, false); m.castShadow = true; return m;
}
const TOOL_POSE = {   // where each tool sits relative to the builder's feet origin (facing +z)
  hammer: [0.09, 0.17, 0.06, 0, 0, 0], drill: [0.08, 0.19, 0.08, 0, 0, 0], plank: [0.07, 0.31, 0.04, 0.12, 0, 0], shovel: [0.03, 0.14, 0.05, 0, 0, 0],
  roller: [0.08, 0.14, 0.1, 0, 0, 0], bucket: [0.11, 0.1, 0.02, 0, 0, 0], saw: [0.09, 0.15, 0.06, 0.2, 0, 0], level: [0, 0.2, 0.1, 0, 0, 0], barrow: [0, 0, 0, 0, 0, 0], clipboard: [0.06, 0.19, 0.08, -0.3, 0, 0],
};
function giveTool(k, name) {
  if (k.tool) { if (k.tool.parent) k.tool.parent.remove(k.tool); disposeGroup(k.tool); k.tool = null; k.toolName = null; }
  if (k.mesh.userData.char) k.mesh.userData.char.pose = null;
  if (!name) return;
  const m = makeTool(name); const p = TOOL_POSE[name]; m.position.set(p[0], p[1], p[2]); m.rotation.set(p[3], p[4], p[5]);
  const ch = k.mesh.userData.char;
  if (ch) { if (name === 'barrow') { m.position.set(0, 0, 0); k.mesh.add(m); } else holdTool(ch, m); }   // the barrow stays on the ground in front
  else k.mesh.add(m);
  k.tool = m; k.toolName = name; k.toolBase = { y: p[1], z: p[2], rx: p[3] };
}

// ── tasks per stage: sequences of steps [where (local x, z, y), face (local x, z), tool, how long, motion] ──
function planTask(k) {
  const b = k.site, u = b.units[0], { w, d } = dims(b.type, b.level), st = b.stage, r = Math.random();
  const P = 0.12, SCAF = 0.12 + 0.42;                             // plinth top, first scaffold plank
  const slot = Math.max(0, b.crew.indexOf(k)) - 1;                 // -1, 0, +1 across the crew
  const wallX = slot * 0.22 + rand(-0.06, 0.06), wallZ = d / 2 + 0.16 + Math.abs(slot) * 0.04, scafZ = slot * 0.2 + rand(-0.05, 0.05);
  const step = (to, face, tool, dur, motion, label) => ({ to, face, tool, dur, motion, label });
  let steps;
  if (st === 0) {
    steps = r < 0.35 ? [step([0, 0, P], [0, 1], 'level', rand(0.25, 0.4), 'look', 'measuring the plot')]
      : r < 0.7 ? [step([-0.3, 0.26, P], [-0.38, 0.33], 'hammer', rand(0.2, 0.35), 'hammerLow', 'driving in a stake')]
      : [step([0.2, -0.2, P], [0.4, -0.3], 'clipboard', rand(0.25, 0.4), 'look', 'checking the plans')];
  } else if (st === 1) {
    steps = r < 0.4 ? [step([0.1 + slot * 0.18, 0.32, P], [0.1 + slot * 0.18, 0.44], 'shovel', rand(0.3, 0.5), 'dig', 'digging')]
      : r < 0.75 ? [step([0.36, 0.26, P], [0.36, 0.42], null, 0.1, 'idle', 'loading the barrow'), step([-0.05 + slot * 0.15, 0.3, P], [0, 0], 'barrow', 0.05, 'idle', 'pushing the wheelbarrow'), step([-0.05 + slot * 0.15, 0.3, P], [0, 0], null, rand(0.15, 0.25), 'dig', 'tipping out gravel')]
      : [step([-0.15, -0.15, P], [0.3, 0], 'level', rand(0.2, 0.35), 'look', 'levelling the slab')];
  } else if (st === 2) {
    steps = r < 0.4 ? [step([0.36 + slot * 0.06, 0.28, P], [0.36, 0.42], null, 0.08, 'idle', 'picking up timber'), step([wallX, wallZ, P], [wallX, 0], 'plank', 0.05, 'idle', 'carrying timber'), step([wallX, wallZ, P], [wallX, 0], null, rand(0.15, 0.3), 'hammer', 'fixing a beam')]
      : r < 0.7 ? [step([-0.1 + slot * 0.08, 0.34, P], [-0.1, 0.46], 'saw', rand(0.3, 0.45), 'saw', 'sawing planks')]
      : [step([wallX, wallZ, P], [wallX, 0], 'hammer', rand(0.3, 0.45), 'hammer', 'hammering')];
  } else if (st === 3) {
    steps = r < 0.35 ? [step([w / 2 + 0.22, scafZ, SCAF], [0, scafZ], 'drill', rand(0.3, 0.45), 'drill', 'drilling on the scaffold')]
      : r < 0.6 ? [step([-0.38, 0.32, P], [-0.38, 0.44], null, 0.08, 'idle', 'picking up timber'), step([w / 2 + 0.22, scafZ, SCAF], [0, scafZ], 'plank', 0.05, 'idle', 'carrying timber up'), step([w / 2 + 0.22, scafZ, SCAF], [0, scafZ], null, rand(0.15, 0.3), 'hammer', 'fixing the roof frame')]
      : r < 0.8 ? [step([0.4, 0.3, P], [0.4, 0.42], 'shovel', rand(0.25, 0.4), 'mix', 'mixing cement')]
      : [step([0.02, 0.36, P], [0.02, 0.48], 'saw', rand(0.3, 0.45), 'saw', 'sawing planks')];
  } else {
    steps = r < 0.4 ? [step([wallX, wallZ, P], [wallX, 0], 'roller', rand(0.3, 0.5), 'paint', 'painting the wall')]
      : r < 0.65 ? [step([w / 2 + 0.22, scafZ, SCAF], [0, scafZ], 'roller', rand(0.3, 0.45), 'paint', 'painting up high')]
      : r < 0.85 ? [step([-0.4, 0.32, P], [-0.4, 0.44], null, 0.08, 'idle', 'fetching paint'), step([wallX, wallZ, P], [wallX, 0], 'bucket', 0.05, 'idle', 'carrying a bucket'), step([wallX, wallZ, P], [wallX, 0], 'roller', rand(0.2, 0.35), 'paint', 'painting the trim')]
      : [step([wallX + 0.1, wallZ, P], [wallX + 0.1, 0], 'drill', rand(0.25, 0.4), 'drill', 'fitting the sign')];
  }
  k.task = { steps, i: 0, phase: 'go', until: 0, stage: st }; k.activity = steps[0].label;
  void u;
}
function stepTarget(k, s) { const u = k.site.units[0]; return unitLocal(u, s.to[0], s.to[1], s.to[2]); }
function runTask(k, dh, simDt, realT) {
  const t = k.task, s = t.steps[t.i], up = k.mesh.userData.upper;
  if (t.phase === 'go') {
    const dest = stepTarget(k, s);
    if (!k.trip) { const from = k.mesh.position.clone(); from.y -= terrainY(from.x, from.z); if (from.distanceTo(dest) < 0.02) { t.phase = 'do'; } else { k.trip = { pts: [from, dest], i: 0, t: 0, speed: k.toolName === 'barrow' ? 0.5 : 0.7 }; } }
    if (k.trip) {
      if (k.mesh.userData.char) k.mesh.userData.char.pose = null;
      if (moveAlong(k.mesh, k.trip, k.trip.speed * simDt)) { k.trip = null; t.phase = 'do'; }
      else if (up) { up.rotation.x = 0; k.mesh.position.y += Math.abs(Math.sin(realT * 9 + k.phase)) * 0.012; }
      if (k.trip) return;
    }
    // arrived: face the work, take the tool, start the motion
    const u = k.site.units[0], f = unitLocal(u, s.face[0], s.face[1], 0); const p = k.mesh.position;
    k.mesh.rotation.y = Math.atan2(f.x - p.x, f.z - p.z); giveTool(k, s.tool); t.until = S.T + s.dur; k.activity = s.label;
  }
  // doing
  const ch = k.mesh.userData.char, tool = ch ? null : k.tool, tb = k.toolBase, ph = realT * 1 + k.phase;   // rigged people animate the tool through the arm
  if (ch) ch.pose = { hammer: 'swing', hammerLow: 'swing', drill: 'swing', saw: 'swing', dig: 'swing', mix: 'swing', paint: 'swing', look: k.toolName ? 'hold' : 'crouch' }[s.motion] || (k.toolName === 'barrow' ? 'holdBoth' : k.toolName ? 'hold' : null);
  if (up) up.rotation.set(0, 0, 0);
  switch (s.motion) {
    case 'hammer': case 'hammerLow': { const sw = Math.max(0, Math.sin(ph * 7)); if (up) up.rotation.x = 0.1 + sw * 0.35; if (tool) { tool.rotation.x = (s.motion === 'hammerLow' ? 0.6 : -0.2) - sw * 1.2 + (tb.rx || 0); tool.position.y = tb.y + (s.motion === 'hammerLow' ? -0.06 : 0); } break; }
    case 'drill': { const j = Math.sin(ph * 45) * 0.012; if (up) { up.rotation.z = j; up.rotation.x = 0.15; } if (tool) { tool.position.z = tb.z + 0.03 + j; tool.rotation.x = -0.2; } break; }
    case 'saw': { const sw = Math.sin(ph * 5); if (up) up.rotation.x = 0.3 + sw * 0.08; if (tool) { tool.position.z = tb.z + 0.04 + sw * 0.05; tool.rotation.x = 0.9; tool.position.y = tb.y - 0.03; } break; }
    case 'dig': { const cyc = Math.sin(ph * 2.2); if (up) up.rotation.x = 0.35 + cyc * 0.3; if (tool) { tool.rotation.x = -0.3 + cyc * 0.5; tool.position.y = tb.y - 0.03 + Math.max(0, cyc) * 0.05; } break; }
    case 'mix': { if (up) up.rotation.x = 0.25; if (tool) { tool.rotation.y = ph * 3; tool.rotation.x = 0.5; tool.position.y = tb.y - 0.02; } break; }
    case 'paint': { const cyc = Math.sin(ph * 3.2); if (up) up.rotation.x = 0.1 + cyc * 0.05; if (tool) { tool.position.y = tb.y + 0.08 + cyc * 0.08; tool.rotation.x = -0.35; } break; }
    case 'look': { if (up) { up.rotation.y = Math.sin(ph * 1.2) * 0.35; up.rotation.x = 0.05; } break; }
    default: break;
  }
  if (ch) ch.hammer = 0;
  if (S.T >= t.until) {
    t.i++;
    if (t.i >= t.steps.length) { giveTool(k, null); k.task = null; if (up) up.rotation.set(0, 0, 0); k.mesh.position.y = 0.12 + terrainY(k.mesh.position.x, k.mesh.position.z); k.pause = S.T + rand(0.03, 0.12); }
    else { t.phase = 'go'; const ns = t.steps[t.i]; if (ns.tool !== s.tool) giveTool(k, ns.tool); k.activity = ns.label; }
  }
}

const site = b => b.units[0];
let yardStart = null;   // the ferry's slipway, once it exists: trucks load at the builders' yard there
function setYardStart(fn) { yardStart = fn; }
const stationRoads = () => { const y = yardStart && yardStart(); return y ? [y] : roadNeighbors(STATION.anchor.cell); };   // trucks: the yard
const crewRoads = () => roadNeighbors(STATION.anchor.cell);   // crews come and go by train, never via the yard
const activeSites = () => blocks.filter(b => b.type !== 'station' && b.stage < DONE);

function spawnWorker(b) {
  const k = { id: S.nextId++, name: `${pick(GIVEN)} ${pick(FAMILY)}`, site: b, state: 'toSite', trip: null, activity: 'walking to the site', phase: rand(0, 6.28),
    skin: pick(SKIN), shirt: VEST, pants: '#4a4340', hair: pick(HAIR), hat: true, hatColor: HELMET, bag: false, builder: true };
  k.mesh = makePerson(k); k.mesh.userData.res = null; k.mesh.userData.worker = k;
  workers.push(k); b.crew.push(k);
  walkToSite(k, stationStairs(true)); return k;
}
function removeWorker(k) {
  giveTool(k, null); detachCharacter(k.mesh); peopleGroup.remove(k.mesh); disposeGroup(k.mesh);
  workers.splice(workers.indexOf(k), 1); const ci = k.site.crew.indexOf(k); if (ci >= 0) k.site.crew.splice(ci, 1);
}
function walkToSite(k, from) {
  const u = site(k.site), [lx, lz] = SPOTS[Math.max(0, k.site.crew.indexOf(k)) % SPOTS.length];
  const dest = unitLocal(u, lx, lz, 0.1); k.spotPos = dest; k.faceTo = unitLocal(u, 0, 0, 0.1);
  const path = routeCells(crewRoads(), frontRoad(u));
  const start = Array.isArray(from) ? from : [from.clone().setY(0.12)];   // crews off the train start at the foot of the pavilion's stairs
  const pts = path ? buildPoints(path, start, dest, 0.34, 0.1) : [...start, dest.clone()];
  k.trip = { pts, i: 0, t: 0, speed: 0.95 }; k.state = 'toSite'; k.activity = 'walking to the site'; k.mesh.visible = true; k.mesh.position.copy(pts[0]);
}
function walkToStation(k, why) {
  const u = site(k.site), path = routeCells(frontRoad(u), crewRoads());
  const pts = path ? buildPoints(path, k.mesh.position.clone().setY(0.12), stationStairs(false), 0.34, 0.1) : [k.mesh.position.clone().setY(0.12), ...stationStairs(false)];
  k.trip = { pts, i: 0, t: 0, speed: 0.95 }; k.state = 'toStation'; k.activity = why;
}

// crews ride the trains: a fresh crew for any site without one (daytime), and crews that went home
// for the night come back on the first morning train
onTrain(h => {
  if (h >= 16.5) return;
  let t = S.T + 0.1;
  for (const k of workers) if (k.state === 'away' && h < 9) { pending.push({ t: (t += 0.06), fn: () => { if (blocks.includes(k.site) && k.site.stage < DONE) walkToSite(k, stationStairs(true)); else removeWorker(k); } }); }
  for (const b of activeSites()) {
    if (b.crew.length || b.crewBooked) continue;
    const n = Math.min(CREW_SIZE, MAX_WORKERS - workers.length - pending.length); if (n <= 0) break;
    b.crewBooked = true;
    for (let k = 0; k < n; k++) pending.push({ t: (t += 0.06), fn: () => { b.crewBooked = false; if (blocks.includes(b) && b.stage < DONE) spawnWorker(b); } });
    if (blocks.filter(x => x.type !== 'station').length <= 2) toast('A construction crew arrived on the train');
  }
});

// sites only progress while builders are on them; three builders are a little faster than one
setProgressRate(b => { const n = b.crew.filter(k => k.state === 'working').length; return n ? 0.6 + 0.2 * Math.min(n, 3) : 0; });

// materials: one kei truck from the station whenever a site enters a new stage (daytime only)
function sendTruck(b) {
  const u = site(b); let start = stationRoads()[0], path = routeCells(stationRoads(), frontRoad(u));
  if (!path) { const st = roadNeighbors(STATION.anchor.cell); path = routeCells(st, frontRoad(u)); start = st[0]; }   // the yard is cut off from town: the truck comes from the station side instead
  if (!path) return;
  const startPos = unitLocal({ cell: start, facing: 0 }, 0, 0, 0.08);
  const kerb = unitLocal(u, -0.2, 0.88, 0.08);   // on the asphalt in front of the plot, clear of the pavement
  const mesh = makeCar(null, 'builder'); mesh.visible = true;
  const pts = buildPoints(path, startPos, kerb, 0.17, 0.08, -1);
  trucks.push({ mesh, site: b, road: frontRoad(u)[0], trip: { pts, i: 0, t: 0, speed: 2.2 }, state: 'toSite', wait: 0 });
  mesh.position.copy(pts[0]);
}
function removeTruck(tr) { peopleGroup.remove(tr.mesh); disposeGroup(tr.mesh); const ci = carMeshes.indexOf(tr.mesh); if (ci >= 0) carMeshes.splice(ci, 1); trucks.splice(trucks.indexOf(tr), 1); }

// the road crew that opened the hill: three builders stand at the top of the slope road for a moment, looking down over the
// town, then walk down to the station and leave on the train. Not tied to a site, so they live in their own list.
const hillCrew = [];
function sendHillCrew(top, down) {
  const x0 = cx(top.i), z0 = cz(top.j), px = -down.z, pz = down.x;
  for (let n = 0; n < 3; n++) {
    const k = { id: S.nextId++, name: `${pick(GIVEN)} ${pick(FAMILY)}`, state: 'standing', trip: null, activity: 'looking over the new hill road', phase: rand(0, 6.28),
      skin: pick(SKIN), shirt: VEST, pants: '#4a4340', hair: pick(HAIR), hat: true, hatColor: HELMET, bag: false, builder: true, top, until: S.T + 1.0 + n * 0.08 };
    k.mesh = makePerson(k); k.mesh.userData.res = null; k.mesh.userData.worker = k;
    const off = (n - 1) * 0.22, x = x0 + px * off - down.x * (n === 1 ? 0.12 : 0), z = z0 + pz * off - down.z * (n === 1 ? 0.12 : 0);
    k.mesh.position.set(x, 0.1 + terrainY(x, z), z); k.mesh.rotation.y = Math.atan2(down.x, down.z); k.mesh.visible = true;
    hillCrew.push(k);
  }
}
function holdHillCrew(hours) { for (const k of hillCrew) if (k.state === 'standing') k.until = Math.max(k.until, S.T + hours); }
function updateHillCrew(simDt) {
  for (let i = hillCrew.length - 1; i >= 0; i--) {
    const k = hillCrew[i];
    if (k.state === 'standing') {
      if (S.T < k.until) continue;
      const path = routeCells([k.top], crewRoads());
      const from = k.mesh.position.clone().setY(0.12), pts = path ? buildPoints(path, from, stationStairs(false), 0.34, 0.1) : [from, ...stationStairs(false)];
      k.trip = { pts, i: 0, t: 0, speed: 0.95 }; k.state = 'toStation'; k.activity = 'heading down to the station, job done';
    } else if (moveAlong(k.mesh, k.trip, k.trip.speed * simDt)) {
      detachCharacter(k.mesh); peopleGroup.remove(k.mesh); disposeGroup(k.mesh); hillCrew.splice(i, 1);
    }
  }
}

function updateConstruction(dh, simDt, realT) {
  const h = hourOf();
  updateHillCrew(simDt);
  while (pending.length && S.T >= pending[0].t) pending.shift().fn();
  for (const b of activeSites()) if (b.stage !== b.deliveredStage && b.stage >= 1 && h >= 6 && h < 20) { b.deliveredStage = b.stage; sendTruck(b); }
  // the queue: three crews work at once, so a plot no crew has reached yet is only staked and roped off, waiting its turn (in the
  // order the plots were zoned); the card says its place in line. Once builders stand on it, it becomes a survey site.
  let line = 0;
  for (const b of activeSites()) {
    const waiting = b.stage === 0 && b.stageT === 0 && !b.crew.some(k => k.state === 'working');
    b.queuePos = waiting && !b.crewBooked && !b.crew.length ? ++line : 0;
    if (waiting !== !!b.waiting) { b.waiting = waiting; for (const u of b.units) rebuildUnitMesh(u); }
  }
  for (let i = workers.length - 1; i >= 0; i--) {
    const k = workers[i];
    if (!blocks.includes(k.site)) { removeWorker(k); continue; }
    if (k.state === 'toSite' || k.state === 'toStation') {
      if (moveAlong(k.mesh, k.trip, k.trip.speed * simDt)) {
        if (k.state === 'toSite') { k.state = 'working'; k.mesh.position.copy(k.spotPos).setY(0.12 + terrainY(k.spotPos.x, k.spotPos.z)); k.task = null; k.pause = 0; k.activity = 'arriving on site'; }
        else if (k.site.stage >= DONE) removeWorker(k);
        else { k.state = 'away'; k.mesh.visible = false; k.activity = 'gone home for the night'; }
      } else if (!k.mesh.userData.char) k.mesh.position.y = terrainY(k.mesh.position.x, k.mesh.position.z) + 0.1 + Math.abs(Math.sin(realT * 9 + k.phase)) * 0.018;
      continue;
    }
    if (k.state === 'working') {
      if (k.site.stage >= DONE || h >= WORK_END || h < 5) { giveTool(k, null); k.task = null; k.trip = null; if (k.mesh.userData.upper) k.mesh.userData.upper.rotation.set(0, 0, 0); walkToStation(k, k.site.stage >= DONE ? 'job done, heading to the station' : 'heading home for the night'); continue; }
      if (k.task && k.task.stage !== k.site.stage) { giveTool(k, null); k.task = null; k.trip = null; }   // the site moved on: drop what you were doing
      if (!k.task) { if (S.T < (k.pause || 0)) { k.activity = pick(['having a breather', 'checking the plans', 'stretching']); continue; } planTask(k); }
      runTask(k, dh, simDt, realT);
    }
  }
  for (let i = trucks.length - 1; i >= 0; i--) {
    const tr = trucks[i];
    const crane = tr.mesh.userData.crane;
    if (crane) { const want = tr.state === 'unloading' ? (tr.wait > 0.12 ? 1.4 : 0) : 0; crane.rotation.y += (want - crane.rotation.y) * Math.min(1, simDt * 2); }   // swing the load off over the kerb, then fold back
    if (tr.state === 'unloading' && tr.wait < 0.2) for (const c of tr.mesh.userData.cargo || []) c.visible = false;   // the timber is off
    if (tr.state === 'toSite') { if (moveAlong(tr.mesh, tr.trip, tr.trip.speed * simDt * trafficFactor(tr.mesh))) { tr.state = 'unloading'; tr.wait = 0.35; } }
    else if (tr.state === 'unloading') {
      tr.wait -= dh;
      if (tr.wait <= 0) {
        // back to the yard; to the station side if the yard is cut off (as the way out does); failing that, as far along the
        // street as it can get. It only ever vanishes at the end of a drive, never on the spot in front of the site
        const from = blocks.includes(tr.site) && tr.site.units[0] && frontRoad(tr.site.units[0]).length ? frontRoad(tr.site.units[0]) : [tr.road];
        let path = routeCells(from, stationRoads()) || routeCells(from, roadNeighbors(STATION.anchor.cell));
        if (!path) { let far = null, fl = 1; for (const c of cells) if (c.type === 'road') { const p = routeCells(from, [c]); if (p && p.length > fl) { fl = p.length; far = p; } } path = far; }
        if (!path) { removeTruck(tr); continue; }
        const end = unitLocal({ cell: path[path.length - 1], facing: 0 }, 0, 0, 0.08);
        tr.trip = { pts: buildPoints(path, tr.mesh.position.clone().setY(0.08), end, 0.17, 0.08, -1), i: 0, t: 0, speed: 2.2 }; tr.state = 'back';
      }
    } else if (moveAlong(tr.mesh, tr.trip, tr.trip.speed * simDt * trafficFactor(tr.mesh))) removeTruck(tr);
  }
}

export { updateConstruction, workers, trucks, setYardStart, sendHillCrew, holdHillCrew, hillCrew };
