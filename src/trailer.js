// Komachi — the trailer camera, a hidden dev hook for recording clean footage: `MT.trailer({ view, rate, speed, hours, at })`
// hides the HUD (body.trailer) and turns the camera slowly round the town while the clock runs at the speed asked for, so a
// screen recorder can capture a grown town across a day, through rain or under snow with nothing in the way. Nothing here is
// reachable from the game's own UI. `MT.trailer.stop()` (or Esc) brings the HUD back where it was.
//   view   camera size (default 14, 3 near … 42 the whole island)
//   rate   turn in radians per real second (default 0.045, a full turn in about 2.3 minutes; negative turns the other way)
//   speed  game speed while it runs (default 1); with `hours` the trailer stops after that many game hours
//   at     { x, z } to circle round (default: the camera's current target)
//   pitch  camera pitch (optional)
import { S } from './state.js';
import { cam } from './scene.js';

const trailer = { active: false, rate: 0.045, until: 0, wasSpeed: 1, wasPitch: 0 };
function start(o = {}) {
  if (trailer.active) stop();
  trailer.active = true; trailer.rate = o.rate ?? 0.045; trailer.wasSpeed = S.speed; trailer.wasPitch = cam.pitch;
  if (o.at) cam.target.set(o.at.x, 0, o.at.z);
  if (o.view) cam.view = cam.tView = o.view;
  if (o.pitch) cam.pitch = o.pitch;
  S.speed = o.speed ?? 1; trailer.until = o.hours ? S.T + o.hours : 0;
  document.body.classList.add('trailer');
  return trailer;
}
function stop() {
  if (!trailer.active) return;
  trailer.active = false; document.body.classList.remove('trailer'); S.speed = trailer.wasSpeed; cam.pitch = trailer.wasPitch; cam.tYaw = cam.yaw;
}
/** each frame from main.js: the slow turn, and the end of a timed run */
function updateTrailer(dt) {
  if (!trailer.active) return;
  cam.yaw += trailer.rate * dt; cam.tYaw = cam.yaw;
  if (trailer.until && S.T >= trailer.until) stop();
}
addEventListener('keydown', e => { if (trailer.active && e.code === 'Escape') { e.stopPropagation(); stop(); } }, true);
export { trailer, start as startTrailer, stop as stopTrailer, updateTrailer };
