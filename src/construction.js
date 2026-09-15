// Komachi — construction crews and deliveries. Builders ride in on the train, walk to the site, work
// until 18:00 and go back down the stairs; nothing gets built without them. Kei trucks bring
// materials from the station at the start of each stage. Purely a layer over the stage timers in sim.js.
import { S } from './state.js';
import { pick, rand } from './utils.js';
import { GIVEN, FAMILY, SKIN, HAIR, CARS } from './palette.js';
import { peopleGroup, disposeGroup } from './scene.js';
import { blocks, STATION, DONE } from './world.js';
import { unitLocal } from './buildings.js';
import { hourOf, routeCells, roadNeighbors, frontRoad, buildPoints, makePerson, makeCar, moveAlong, setProgressRate, onTrain, carMeshes } from './sim.js';
import { toast } from './toast.js';

const workers = [], trucks = [], pending = [];      // pending: { t, fn } things that happen a little after a train pulls in
const MAX_WORKERS = 9, CREW_SIZE = 3, WORK_END = 18;
const VEST = '#e9a25a', HELMET = '#e8cf7a';
const SPOTS = [[-0.42, 0.62], [0.46, 0.6], [0.62, -0.12]];   // where the crew stands, in the unit's local space
const WORK_ACTS = ['hammering', 'measuring twice', 'mixing cement', 'checking the plans', 'carrying timber', 'on a tea break'];

const site = b => b.units[0];
const stationRoads = () => roadNeighbors(STATION.anchor.cell);
const activeSites = () => blocks.filter(b => b.type !== 'station' && b.stage < DONE);

function spawnWorker(b) {
  const k = { id: S.nextId++, name: `${pick(GIVEN)} ${pick(FAMILY)}`, site: b, state: 'toSite', trip: null, activity: 'walking to the site', phase: rand(0, 6.28),
    skin: pick(SKIN), shirt: VEST, pants: '#4a4340', hair: pick(HAIR), hat: true, hatColor: HELMET, bag: false };
  k.mesh = makePerson(k); k.mesh.userData.res = null; k.mesh.userData.worker = k;
  workers.push(k); b.crew.push(k);
  walkToSite(k, STATION.entrance.clone()); return k;
}
function removeWorker(k) {
  peopleGroup.remove(k.mesh); disposeGroup(k.mesh);
  workers.splice(workers.indexOf(k), 1); const ci = k.site.crew.indexOf(k); if (ci >= 0) k.site.crew.splice(ci, 1);
}
function walkToSite(k, from) {
  const u = site(k.site), [lx, lz] = SPOTS[Math.max(0, k.site.crew.indexOf(k)) % SPOTS.length];
  const dest = unitLocal(u, lx, lz, 0.1); k.spotPos = dest; k.faceTo = unitLocal(u, 0, 0, 0.1);
  const path = routeCells(stationRoads(), frontRoad(u));
  const pts = path ? buildPoints(path, from.setY(0.12), dest, 0.34, 0.1) : [from.clone().setY(0.12), dest.clone()];
  k.trip = { pts, i: 0, t: 0, speed: 0.95 }; k.state = 'toSite'; k.activity = 'walking to the site'; k.mesh.visible = true; k.mesh.position.copy(pts[0]);
}
function walkToStation(k, why) {
  const u = site(k.site), path = routeCells(frontRoad(u), stationRoads());
  const pts = path ? buildPoints(path, k.mesh.position.clone().setY(0.1), STATION.entrance.clone(), 0.34, 0.1) : [k.mesh.position.clone(), STATION.entrance.clone().setY(0.12)];
  k.trip = { pts, i: 0, t: 0, speed: 0.95 }; k.state = 'toStation'; k.activity = why;
}

// crews ride the trains: a fresh crew for any site without one (daytime), and crews that went home
// for the night come back on the first morning train
onTrain(h => {
  if (h >= 16.5) return;
  let t = S.T + 0.1;
  for (const k of workers) if (k.state === 'away' && h < 9) { pending.push({ t: (t += 0.06), fn: () => { if (blocks.includes(k.site) && k.site.stage < DONE) walkToSite(k, STATION.entrance.clone()); else removeWorker(k); } }); }
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
  const u = site(b), path = routeCells(stationRoads(), frontRoad(u)); if (!path) return;
  const start = stationRoads()[0], from = { x: start.i - blocks.length * 0, z: 0 }; void from;
  const startPos = unitLocal({ cell: start, facing: 0 }, 0, 0, 0.08);
  const kerb = unitLocal(u, 0.2, 0.66, 0.08);
  const mesh = makeCar(pick(CARS), 'truck'); mesh.visible = true;
  const pts = buildPoints(path, startPos, kerb, 0.17, 0.08, -1);
  trucks.push({ mesh, site: b, trip: { pts, i: 0, t: 0, speed: 2.2 }, state: 'toSite', wait: 0 });
  mesh.position.copy(pts[0]);
}
function removeTruck(tr) { peopleGroup.remove(tr.mesh); disposeGroup(tr.mesh); const ci = carMeshes.indexOf(tr.mesh); if (ci >= 0) carMeshes.splice(ci, 1); trucks.splice(trucks.indexOf(tr), 1); }

function updateConstruction(dh, simDt, realT) {
  const h = hourOf();
  while (pending.length && S.T >= pending[0].t) pending.shift().fn();
  for (const b of activeSites()) if (b.stage !== b.deliveredStage && b.stage >= 1 && h >= 6 && h < 20) { b.deliveredStage = b.stage; sendTruck(b); }
  for (let i = workers.length - 1; i >= 0; i--) {
    const k = workers[i];
    if (!blocks.includes(k.site)) { removeWorker(k); continue; }
    if (k.state === 'toSite' || k.state === 'toStation') {
      if (moveAlong(k.mesh, k.trip, k.trip.speed * simDt)) {
        if (k.state === 'toSite') { k.state = 'working'; k.mesh.position.copy(k.spotPos); k.mesh.rotation.y = Math.atan2(k.faceTo.x - k.spotPos.x, k.faceTo.z - k.spotPos.z); k.activity = pick(WORK_ACTS); k.nextAct = S.T + rand(0.3, 0.8); }
        else if (k.site.stage >= DONE) removeWorker(k);
        else { k.state = 'away'; k.mesh.visible = false; k.activity = 'gone home for the night'; }
      } else k.mesh.position.y = 0.1 + Math.abs(Math.sin(realT * 9 + k.phase)) * 0.018;
      continue;
    }
    if (k.state === 'working') {
      if (k.site.stage >= DONE) { walkToStation(k, 'job done, heading to the station'); continue; }
      if (h >= WORK_END || h < 5) { walkToStation(k, 'heading home for the night'); continue; }
      if (S.T >= k.nextAct) { k.activity = pick(WORK_ACTS); k.nextAct = S.T + rand(0.3, 0.8); }
      const hammer = Math.max(0, Math.sin(realT * 5 + k.phase));
      k.mesh.position.y = 0.1 + hammer * 0.015; k.mesh.userData.upper.rotation.x = hammer * 0.12;
    }
  }
  for (let i = trucks.length - 1; i >= 0; i--) {
    const tr = trucks[i];
    if (tr.state === 'toSite') { if (moveAlong(tr.mesh, tr.trip, tr.trip.speed * simDt)) { tr.state = 'unloading'; tr.wait = 0.35; } }
    else if (tr.state === 'unloading') {
      tr.wait -= dh;
      if (tr.wait <= 0) {
        const path = tr.site.units[0] && blocks.includes(tr.site) ? routeCells(frontRoad(tr.site.units[0]), stationRoads()) : null;
        if (!path) { removeTruck(tr); continue; }
        const end = unitLocal({ cell: stationRoads()[0], facing: 0 }, 0, 0, 0.08);
        tr.trip = { pts: buildPoints(path, tr.mesh.position.clone().setY(0.08), end, 0.17, 0.08, -1), i: 0, t: 0, speed: 2.2 }; tr.state = 'back';
      }
    } else if (moveAlong(tr.mesh, tr.trip, tr.trip.speed * simDt)) removeTruck(tr);
  }
}

export { updateConstruction, workers, trucks };
