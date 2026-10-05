// Komachi — the guided first town (Phase 11.1, 2026-10-05). A new island gets five gentle prompts in the milestone card, each
// cleared by doing the thing rather than by a button: a street from the station ring, two homes beside it, a shop and a
// workplace, the builders arriving by train, the first family moving in. The tool a step needs pulses in the dock. It runs
// once per town (`S.guide` 'done' is saved), never on a loaded save that already has blocks, the demo or a scratch tab, and
// waits for the opening and the welcome card to be out of the way. Dev hooks: MT.startGuide(), MT.guideState().
import { S } from './state.js';
import { blocks, STATION } from './world.js';
import { residents } from './sim.js';
import { announce, holdMilestone, dismissMilestone } from './milestone.js';
import { scratch } from './slots.js';
import { opening } from './opening.js';
import { menuOpen } from './title.js';
import { save } from './save.js';

const STEPS = [
  { key: 'street', tool: 'road', title: 'Draw a street', line: 'Choose Streets and drag a road away from the station ring.', icon: 'train',
    done: () => blocks.some(b => b.type !== 'station') || cellsDrawn() > 0 },
  { key: 'homes', tool: 'res', title: 'Two homes beside it', line: 'Choose Homes and drag across one to three cells next to your street. Twice.', icon: 'people',
    done: () => blocks.filter(b => b.type === 'res').length >= 2 },
  { key: 'shops', tool: 'shop', title: 'Somewhere to shop, somewhere to work', line: 'A Shops block and a Work block beside a street. The town picks what they become.', icon: 'festival',
    done: () => blocks.some(b => b.type === 'shop') && blocks.some(b => b.type === 'work') },
  { key: 'crew', tool: null, title: 'Builders are on the train', line: 'Crews arrive at the station and work in daylight. Watch the first one walk to your site.', icon: 'train', look: true,
    done: () => blocks.some(b => b.type !== 'station' && b.crew && b.crew.some(k => k.state === 'working')) },
  { key: 'family', tool: null, title: 'Your first family', line: 'When a home is nearly finished its household boards the next train. Here they come.', icon: 'people', look: true,
    done: () => residents.some(r => r.home) },
];
const guide = { active: false, step: -1, since: 0 };   // since: when the welcome card went (real seconds), so the first prompt follows it after a beat
let cellsDrawn = () => 0;   // world.js's drawn-road count, handed in by main.js to keep this module's imports light
let setToolPulse = () => {};
const introUp = () => { const i = document.getElementById('intro'); return !!i && !i.hidden; };   // the welcome card: removed by its button, only hidden on the title's Continue path

/** main.js: the hooks this module needs, and whether the town qualifies */
export function initGuide({ drawnCount, pulse }) { cellsDrawn = drawnCount; setToolPulse = pulse; }
export const guideWanted = () => !scratch && S.guide !== 'done' && !blocks.some(b => b.type !== 'station');
export function startGuide() { if (guide.active) return; guide.active = true; guide.step = -1; S.guide = 'running'; next(); }
function pulse(tool) { setToolPulse(tool); }
function next() {
  guide.step++;
  if (guide.step >= STEPS.length) { finish(); return; }
  const s = STEPS[guide.step];
  announce({ title: s.title, line: s.line, icon: s.icon, at: s.look ? STATION.entrance : null, view: 7 }); holdMilestone(true);
  pulse(s.tool);
}
function finish() {
  guide.active = false; S.guide = 'done'; pulse(null); holdMilestone(false); save();   // the flag goes into the town's save now
  announce({ title: 'The town is yours', line: 'Everything from here happens on its own. Hover anything to see who is there; the menu has the rest.', icon: 'hill' });
}
/** every frame from main.js: start when the welcome card is gone, advance as each step's condition comes true */
export function updateGuide() {
  if (!guide.active) {
    if (S.guide === 'pending' && !opening.active && !menuOpen() && !introUp()) { const t = performance.now() / 1000; if (!guide.since) guide.since = t; else if (t - guide.since > 0.6) startGuide(); } else guide.since = 0;
    return;
  }
  if (opening.active) return;
  const s = STEPS[guide.step]; if (s && s.done()) { dismissMilestone(); next(); }
}
export const guideState = () => ({ active: guide.active, step: guide.step, key: STEPS[guide.step] ? STEPS[guide.step].key : null, state: S.guide });
