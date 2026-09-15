// Komachi — DOM references, the inspect card and the stats strip
import { clamp } from './utils.js';
import { blocks, unitCap, stageHours, TYPE_LABEL, TYPE_COLOR, STATION, KIND_LABEL } from './world.js';
import { jobUnits, residents, growthAllowed, nextTrainAt } from './sim.js';

const ui = { time: document.getElementById('time'), day: document.getElementById('day'), sun: document.getElementById('sun'), inspect: document.getElementById('inspect'), toast: document.getElementById('toast'), tags: document.getElementById('tags'),
  pop: document.getElementById('s-pop'), homes: document.getElementById('s-homes'), jobs: document.getElementById('s-jobs'), shops: document.getElementById('s-shops'), wait: document.getElementById('s-wait') };
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function whereIs(r) {
  if (r.state === 'away') return 'in the city for the night';
  if (r.state !== 'inside') return `${r.state === 'driving' ? 'driving' : 'walking'} · ${r.activity}`;
  if (!r.at) return 'somewhere';
  if (r.home && r.at === r.home) return `home · ${r.activity}`;
  if (r.at === STATION.anchor) return `at the station · ${r.activity}`;
  return `at ${r.at.block.name} · ${r.activity}`;
}
function fmtHour(h) { h = ((h % 24) + 24) % 24; return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`; }
function renderStation(b) {
  const waiting = residents.filter(r => !r.home && !r.movingIn);
  let html = `<div class="kind" style="--k:${TYPE_COLOR.station}">Station</div><h2>${esc(b.name)}</h2><div class="sub">Underground line · trains every 1½ hours, 6:00–23:30</div>`;
  html += `<div class="row"><span>Next train</span><b>${fmtHour(nextTrainAt())}</b></div>`;
  html += `<div class="row"><span>Trains so far</span><b>${b.trains}</b></div>`;
  html += `<div class="row"><span>Waiting for a home</span><b>${waiting.length}</b></div>`;
  html += `<div class="divider"></div><ul>`;
  for (const r of waiting) html += personLi(r, r.state === 'away' ? 'staying in the city tonight' : r.activity);
  if (!waiting.length) html += `<li class="empty">Nobody is waiting right now</li>`;
  html += `</ul>`;
  const vacancies = blocks.filter(x => x.type === 'res' && x.stage === 3).reduce((s, x) => s + x.units.reduce((t, u) => t + Math.max(0, unitCap(u) - u.residents.length - u.incoming), 0), 0);
  html += `<div class="empty">${vacancies > 0 ? `${vacancies} free bed${vacancies > 1 ? 's' : ''} in town. Newcomers move in as they arrive.` : 'Zone a Residential block and newcomers will move in.'}</div>`;
  return html;
}
function growthRow(b) {
  if (b.level >= 3) return '';
  const p = clamp(b.occT / 20, 0, 1);
  if (p >= 1 && !growthAllowed(b)) return `<div class="empty">Ready to grow once the town is bigger${b.level === 1 ? ' (3+ blocks, with homes and jobs)' : ' (6+ blocks of every kind)'}</div>`;
  return `<div class="row"><span>Growing</span><b>${Math.round(100 * p)}%</b></div><div class="bar"><i style="width:${100 * p}%"></i></div>`;
}
function personLi(r, detail) { return `<li style="--p:${r.shirt};--h:${r.hat ? r.hatColor : r.hair}"><i></i><b>${esc(r.name)}</b><span>${esc(detail)}</span></li>`; }
function renderInspect(target) {
  if (!target) { ui.inspect.classList.remove('show'); return; }
  let html = '';
  if (target.unit && target.unit.block.type === 'station') html = renderStation(target.unit.block);
  else if (target.unit) {
    const u = target.unit, b = u.block, type = b.type;
    html += `<div class="kind" style="--k:${TYPE_COLOR[type]}">${TYPE_LABEL[type]}</div><h2>${esc(b.name)}</h2>`;
    html += `<div class="sub">${esc(KIND_LABEL[b.kind || u.variant] || '')} · ${b.cells.length > 1 ? `Block of ${b.cells.length} · ` : ''}${b.stage < 3 ? ['Surveying the plot', 'Laying foundations', 'Raising the frame'][b.stage] : `Level ${b.level}${b.level < 3 ? '' : ' · fully grown'}`}</div>`;
    if (b.stage < 3) {
      const SH = stageHours(b), totalH = SH.reduce((a, c) => a + c, 0), done = SH.slice(0, b.stage).reduce((a, c) => a + c, 0) + b.stageT;
      html += `<div class="row"><span>Construction</span><b>${Math.round(100 * done / totalH)}%</b></div><div class="bar"><i style="width:${100 * done / totalH}%"></i></div>`;
      html += `<div class="empty">${b.summoned ? 'The new household is on its way by train.' : 'Builders work faster in daylight.'}</div>`;
    } else {
      const inside = Array.from(u.inside);
      if (type === 'res') {
        html += `<div class="row"><span>Residents</span><b>${u.residents.length} / ${unitCap(u)}</b></div>`;
        html += growthRow(b);
        html += `<div class="divider"></div><ul>`;
        const home = u.residents.filter(r => r.at === u), away = u.residents.filter(r => r.at !== u);
        for (const r of home) html += personLi(r, r.activity);
        for (const r of away) html += personLi(r, whereIs(r));
        if (!u.residents.length) html += `<li class="empty">Nobody has moved in yet</li>`;
        html += `</ul>`;
        const guests = inside.filter(r => r.home !== u); if (guests.length) { html += `<div class="divider"></div><ul>`; for (const r of guests) html += personLi(r, 'visiting'); html += `</ul>`; }
      } else {
        const staffIn = u.staff.filter(r => r.at === u), visitors = inside.filter(r => !u.staff.includes(r));
        html += `<div class="row"><span>${type === 'shop' ? 'Staff' : 'Workers'}</span><b>${u.staff.length} / ${unitCap(u)}</b></div>`;
        html += `<div class="row"><span>Here now</span><b>${inside.length}</b></div>`;
        if (type === 'shop') html += `<div class="row"><span>Popularity</span><b>${'★'.repeat(clamp(Math.round(b.visitScore / (2 * b.level)), 0, 5)) || '–'}</b></div>`;
        html += growthRow(b);
        html += `<div class="divider"></div><ul>`;
        for (const r of staffIn) html += personLi(r, r.activity);
        for (const r of u.staff.filter(r => r.at !== u)) html += personLi(r, whereIs(r));
        if (!u.staff.length) html += `<li class="empty">${type === 'shop' ? 'Looking for a shopkeeper' : 'Hiring…'}</li>`;
        html += `</ul>`;
        if (visitors.length) { html += `<div class="divider"></div><ul>`; for (const r of visitors) html += personLi(r, r.activity); html += `</ul>`; }
        else if (type === 'shop') html += `<div class="empty">No customers right now</div>`;
      }
    }
  } else if (target.res) {
    const r = target.res;
    html += `<div class="kind" style="--k:${r.shirt}">${r.home ? 'Resident' : 'Newcomer'}</div><h2>${esc(r.name)}</h2><div class="sub">${esc(r.state === 'inside' ? whereIs(r) : `${r.state} · ${r.activity}`)}</div><div class="divider"></div>`;
    html += `<div class="row"><span>Home</span><b>${r.home ? esc(r.home.block.name) : 'none yet'}</b></div>`;
    if (!r.home) html += `<div class="row"><span>Arrived</span><b>Day ${r.arrivedDay} by train</b></div>`;
    html += `<div class="row"><span>Works at</span><b>${r.job ? esc(r.job.block.name) : 'looking for work'}</b></div>`;
    if (r.trip && r.trip.dest) html += `<div class="row"><span>Heading to</span><b>${esc(r.trip.dest.block.name)}</b></div>`;
    html += `<div class="row"><span>Wakes at</span><b>${String(Math.floor(r.wake)).padStart(2, '0')}:${String(Math.floor((r.wake % 1) * 60)).padStart(2, '0')}</b></div>`;
    html += `<div class="row"><span>Gets around</span><b>${r.hasCar ? 'by car' : 'on foot'}</b></div>`;
  }
  ui.inspect.innerHTML = html; ui.inspect.classList.add('show');
}
function updateStats() {
  ui.pop.textContent = residents.length;
  ui.homes.textContent = blocks.filter(b => b.type === 'res' && b.stage === 3).reduce((s, b) => s + b.units.length, 0);
  ui.jobs.textContent = jobUnits().reduce((s, u) => s + unitCap(u), 0);
  ui.shops.textContent = blocks.filter(b => b.type === 'shop' && b.stage === 3).reduce((s, b) => s + b.units.length, 0);
  ui.wait.textContent = residents.filter(r => !r.home).length;
}

export { ui, esc, whereIs, renderInspect, updateStats };
