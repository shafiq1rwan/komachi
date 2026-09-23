// A small live plan for the rich view. Drawing at twice the displayed size
// keeps the coastline and streets crisp on high density screens.
import { S } from './state.js';
import { cells } from './world.js';
import { coastPoint, hillCentre } from './island.js';
import { cam, cx, cz, N } from './scene.js';
import { hash } from './utils.js';

const canvas = document.getElementById('mini-c');
const ctx = canvas.getContext('2d');
const w = canvas.width / 2, h = canvas.height / 2;
const xy = (x, z) => [w / 2 + x * 4.9, h / 2 + z * 4.05];
const at = (i, j) => i >= 0 && i < N && j >= 0 && j < N ? cells[j * N + i] : null;

function coast(extra) {
  ctx.beginPath();
  for (let k = 0; k <= 200; k++) {
    const [x, z] = coastPoint(k / 200 * Math.PI * 2, extra), [px, py] = xy(x, z);
    if (!k) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
function links(type, color, width) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath();
  for (const c of cells) {
    if (c.type !== type) continue;
    const [x, y] = xy(cx(c.i), cz(c.j));
    for (const n of [at(c.i + 1, c.j), at(c.i, c.j + 1)]) {
      if (!n || n.type !== type) continue;
      const [nx, ny] = xy(cx(n.i), cz(n.j)); ctx.moveTo(x, y); ctx.lineTo(nx, ny);
    }
  }
  ctx.stroke();
  for (const c of cells) if (c.type === type) { const [x, y] = xy(cx(c.i), cz(c.j)); ctx.beginPath(); ctx.arc(x, y, width / 2, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
}
function draw() {
  if (S.look !== 'rich') return;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  const sea = ctx.createLinearGradient(0, 0, w, h);
  sea.addColorStop(0, '#abc6c7'); sea.addColorStop(1, '#86a9b1');
  ctx.fillStyle = sea; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(239,248,242,.26)'; ctx.lineWidth = .7;
  for (let k = 0; k < 28; k++) {
    const x = hash(k, 38) * w, y = hash(21, k) * h;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3 + hash(k, 19) * 5, y - 1); ctx.stroke();
  }

  coast(0.58); ctx.fillStyle = '#dfd5b4'; ctx.fill();
  coast(0); const land = ctx.createLinearGradient(30, 20, w - 20, h);
  land.addColorStop(0, '#b8caa1'); land.addColorStop(1, '#91ad84'); ctx.fillStyle = land; ctx.fill();
  ctx.save(); ctx.clip();
  for (let k = 0; k < 48; k++) {
    const x = hash(k, 7) * w, y = hash(12, k) * h, r = 4 + hash(k, 91) * 12;
    ctx.fillStyle = k % 3 ? 'rgba(115,153,107,.12)' : 'rgba(219,204,157,.17)';
    ctx.beginPath(); ctx.ellipse(x, y, r, r * .65, hash(k, 5) * 3, 0, Math.PI * 2); ctx.fill();
  }
  const [hx, hy] = xy(hillCentre.x, hillCentre.z);
  ctx.strokeStyle = 'rgba(88,125,86,.26)'; ctx.lineWidth = 1.4;
  for (const [rx, ry] of [[22, 14], [16, 10], [9, 6]]) { ctx.beginPath(); ctx.ellipse(hx, hy, rx, ry, .2, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
  coast(0); ctx.strokeStyle = 'rgba(247,245,219,.82)'; ctx.lineWidth = 1.3; ctx.stroke();

  links('canal', '#73a2ab', 4.2);
  links('road', '#778985', 3.1);
  for (const c of cells) {
    const [x, y] = xy(cx(c.i), cz(c.j));
    if (c.type === 'lot') {
      ctx.fillStyle = c.block?.type === 'res' ? '#d8b5a5' : c.block?.type === 'shop' ? '#e7cf9f' : c.block?.type === 'station' ? '#f3efe3' : '#b8c9c5';
      ctx.fillRect(x - 1.7, y - 1.5, 3.4, 3);
    } else if (c.type === 'empty' && c.tree && c.tree.kind !== 'rock' && c.tree.kind !== 'reed') {
      ctx.beginPath(); ctx.arc(x, y, c.tree.kind === 'tree' || c.tree.kind === 'pine' ? 1.8 : 1.2, 0, Math.PI * 2);
      ctx.fillStyle = c.tree.kind === 'tree' && c.tree.c < .25 ? '#d5ae93' : '#688d72'; ctx.fill();
    }
  }
  const [tx, ty] = xy(cam.target.x, cam.target.z);
  ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.roundRect(tx - 14, ty - 10, 28, 20, 2); ctx.fill(); ctx.stroke();
}
setInterval(draw, 1800);
setTimeout(draw, 0);
