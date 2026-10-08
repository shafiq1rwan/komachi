// Komachi — the progression core (Phase 11.5, 2026-10-08, docs/GOALS-AND-PROGRESSION-PLAN.md): goals, chapters, town levels and
// what the player may build, as pure data and functions. Nothing here touches the DOM or the world: main.js's adapter
// (src/progress.js) hands in facts about the town and acts on the events that come back, and scripts/test-progression.mjs
// runs this file under plain Node. Levels are earned by completed goals, never by time; rewards latch and never regress.
//
// State shape (saved per town by save.js as `progression`):
//   { version: 1, mode: 'guided' | 'free', completedGoalIds: [], completedChapterIds: [], activeGoalId, collapsed, entitlements: [] }

export const VERSION = 1;
export const CONTENT_VERSION = 1;
/** tuning values the brief asks to keep in content configuration */
export const TUNING = { streetCells: 2, neighbours: 10 };

export const CHAPTERS = [
  { id: 'first-neighbours', title: 'First Neighbours', level: 3, levelTitle: 'First Neighbours',
    copy: 'Build your first neighbourhood. Connect a street, build a home, and welcome your first neighbours.',
    goals: ['first-street', 'first-home', 'first-household'], sequential: true },
  { id: 'living-street', title: 'A Living Street', level: 4, levelTitle: 'A Living Street',
    copy: 'Give your neighbours somewhere to shop and work.',
    goals: ['first-shop', 'first-workplace', 'ten-neighbours'], sequential: false },
];
export const GOALS = {
  'first-street': { chapter: 'first-neighbours', title: 'A street to somewhere', tool: 'road',
    how: 'Choose Streets, then drag a street away from the station ring.', why: 'Streets help people reach your town.',
    done: f => f.drawnConnected >= TUNING.streetCells, progress: f => [Math.min(f.drawnConnected, TUNING.streetCells), TUNING.streetCells] },
  'first-home': { chapter: 'first-neighbours', title: 'A place to call home', tool: 'res',
    how: 'Choose Homes and drag across one cell beside your street.', why: 'A home is where your first neighbours will live.',
    done: f => f.homesConnected >= 1, progress: f => [Math.min(f.homesConnected, 1), 1] },
  'first-household': { chapter: 'first-neighbours', title: 'Welcome your neighbours', tool: null,
    how: 'A crew comes by train and builds the home in daylight. When it is nearly done, a household boards the next train.', why: 'Your first neighbours make it a town.',
    done: f => f.housed >= 1, progress: f => [Math.min(f.housed, 1), 1] },
  'first-shop': { chapter: 'living-street', title: 'The corner shop', tool: 'shop',
    how: 'Choose Shops and place one beside a street. It opens when the crew finishes.', why: 'Somewhere to buy bread and milk.',
    done: f => f.shopsDone >= 1, progress: f => [Math.min(f.shopsDone, 1), 1] },
  'first-workplace': { chapter: 'living-street', title: 'Room to work', tool: 'work',
    how: 'Choose Work and place a workplace beside a street.', why: 'Neighbours with a job nearby stop commuting to the city.',
    done: f => f.worksDone >= 1, progress: f => [Math.min(f.worksDone, 1), 1] },
  'ten-neighbours': { chapter: 'living-street', title: 'A growing neighbourhood', tool: 'res',
    how: 'More homes beside your streets. Households arrive by train as homes finish.', why: 'Ten neighbours and the street feels alive.',
    done: f => f.housed >= TUNING.neighbours, progress: f => [Math.min(f.housed, TUNING.neighbours), TUNING.neighbours] },
};
export const GOAL_ORDER = CHAPTERS.flatMap(c => c.goals);

export const LEVELS = [
  null,
  { title: 'A New Beginning', unlocks: { res: ['detached', 'narrow'] }, note: 'Streets, basic homes and car parks' },
  { title: 'Foundations', unlocks: { shop: ['konbini', 'bakery', 'ramen'], work: ['studio', 'office', 'workshop'] }, note: 'A konbini, a bakery, a ramen shop; a studio, an office, a workshop' },
  { title: 'First Neighbours', unlocks: { shop: ['cafe', 'grocery'], fishing: true }, note: 'A café, a grocery, and fishing at the quay' },
  { title: 'A Living Street', unlocks: { res: ['terrace'], civic: ['community'] }, note: 'Terrace homes and the community centre' },
];
/** the first release has two chapters: Level 4 also opens the rest of the catalogue (`release-catalogue-access`) so nothing is
 *  left unreachable until later chapters ship */
export const RELEASE_BRIDGE = 'release-catalogue-access';
export const MAX_LEVEL = 4;

export const fresh = (mode = 'guided') => ({ version: VERSION, mode, completedGoalIds: [], completedChapterIds: [], activeGoalId: mode === 'guided' ? 'first-street' : null, collapsed: false, entitlements: [] });
/** anything from a save (or nothing) becomes a well-formed state; a save without progression is a Free Build town */
export function normalise(raw) {
  if (!raw || typeof raw !== 'object') return fresh('free');
  const mode = raw.mode === 'guided' ? 'guided' : 'free';
  const ids = a => Array.isArray(a) ? a.filter(x => typeof x === 'string') : [];
  const s = { version: VERSION, mode, completedGoalIds: ids(raw.completedGoalIds).filter(id => GOALS[id]), completedChapterIds: ids(raw.completedChapterIds).filter(id => CHAPTERS.some(c => c.id === id)), activeGoalId: typeof raw.activeGoalId === 'string' && GOALS[raw.activeGoalId] ? raw.activeGoalId : null, collapsed: !!raw.collapsed, entitlements: ids(raw.entitlements) };
  // chapters follow from goals, so a save that lost one line still adds up
  for (const c of CHAPTERS) if (c.goals.every(g => s.completedGoalIds.includes(g)) && !s.completedChapterIds.includes(c.id)) s.completedChapterIds.push(c.id);
  if (s.completedChapterIds.includes('living-street') && !s.entitlements.includes(RELEASE_BRIDGE)) s.entitlements.push(RELEASE_BRIDGE);
  if (mode === 'guided' && (!s.activeGoalId || s.completedGoalIds.includes(s.activeGoalId))) s.activeGoalId = nextGoal(s);
  return s;
}
export const chapterOf = id => CHAPTERS.find(c => c.goals.includes(id));
const chapterDone = (s, c) => s.completedChapterIds.includes(c.id);
/** the chapter the player is in: the first with work left */
export function currentChapter(s) { return CHAPTERS.find(c => !chapterDone(s, c)) || null; }
/** the goal to show: in a sequential chapter the first undone one, otherwise the chosen one if still open, else the first undone */
export function nextGoal(s) {
  const c = currentChapter(s); if (!c) return null;
  const open = c.goals.filter(g => !s.completedGoalIds.includes(g));
  if (!open.length) return null;
  return !c.sequential && s.activeGoalId && open.includes(s.activeGoalId) ? s.activeGoalId : open[0];
}
/** the town's level from what has been earned */
export function levelOf(s) {
  if (s.mode !== 'guided') return MAX_LEVEL;
  const has = id => s.completedGoalIds.includes(id);
  let lv = 1;
  if (has('first-street') && has('first-home')) lv = 2;
  if (chapterDone(s, CHAPTERS[0])) lv = 3;
  if (chapterDone(s, CHAPTERS[1])) lv = 4;
  return lv;
}
export const levelTitle = lv => (LEVELS[lv] || LEVELS[MAX_LEVEL]).title;
/** Progress toward the next level, including real partial requirements rather than the previous chapter. */
export function nextLevelProgress(s, facts) {
  const lv = levelOf(s), goals = lv === 1 ? ['first-street', 'first-home'] : lv === 2 ? ['first-household'] : lv === 3 ? CHAPTERS[1].goals : [];
  const done = goals.filter(id => s.completedGoalIds.includes(id)).length;
  const fraction = goals.length ? goals.reduce((sum, id) => {
    if (s.completedGoalIds.includes(id)) return sum + 1;
    const [n, total] = goalProgress(id, facts); return sum + Math.max(0, Math.min(1, n / total));
  }, 0) / goals.length : 1;
  return { level: lv, next: goals.length ? lv + 1 : null, done, total: goals.length, fraction };
}
/** which level first opens a kind (null when only the release bridge does) */
export function unlockLevel(type, kind) {
  for (let lv = 1; lv <= MAX_LEVEL; lv++) { const u = LEVELS[lv].unlocks[type]; if (u && u.includes(kind)) return lv; }
  return null;
}
/** may the player build this kind now? */
export function available(s, type, kind) {
  if (s.mode !== 'guided' || s.entitlements.includes(RELEASE_BRIDGE)) return true;
  const lv = unlockLevel(type, kind); return lv !== null && lv <= levelOf(s);
}
export const fishingAllowed = s => s.mode !== 'guided' || s.entitlements.includes(RELEASE_BRIDGE) || levelOf(s) >= 3;
/** the kinds of `pool` the player may build */
export const allowedOf = (s, type, pool) => pool.filter(k => available(s, type, k));
/** why a kind is locked, for a chip or a rejected placement */
export function lockReason(s, type, kind) {
  if (available(s, type, kind)) return null;
  const lv = unlockLevel(type, kind);
  if (lv === null) return `Unlocks after ${LEVELS[MAX_LEVEL].title} (Town Level ${MAX_LEVEL})`;
  return `Unlocks at Town Level ${lv}: ${LEVELS[lv].title}`;
}
/** what a level opens, for the celebration (the bridge is described as the rest of the catalogue) */
export function levelRewards(lv) {
  const L = LEVELS[lv]; if (!L) return [];
  const out = [];
  for (const [type, kinds] of Object.entries(L.unlocks)) { if (type === 'fishing') out.push({ type: 'fishing', kind: 'fishing' }); else for (const k of kinds) out.push({ type, kind: k }); }
  return out;
}

/** apply the town's facts: goals complete and latch, chapters and levels follow; returns the events that are new this time.
 *  facts: { drawnConnected, homesConnected, housed, shopsDone, worksDone } (counts, all numbers) */
export function evaluate(s, facts) {
  const events = [];
  if (s.mode !== 'guided') return { state: s, events };
  const before = levelOf(s);
  for (const id of GOAL_ORDER) {
    if (s.completedGoalIds.includes(id)) continue;
    if (GOALS[id].done(facts)) { s.completedGoalIds.push(id); events.push({ type: 'goal', id }); }
  }
  for (const c of CHAPTERS) {
    if (chapterDone(s, c) || !c.goals.every(g => s.completedGoalIds.includes(g))) continue;
    s.completedChapterIds.push(c.id); events.push({ type: 'chapter', id: c.id });
    if (c.id === 'living-street' && !s.entitlements.includes(RELEASE_BRIDGE)) { s.entitlements.push(RELEASE_BRIDGE); events.push({ type: 'entitlement', id: RELEASE_BRIDGE }); }
  }
  const after = levelOf(s);
  for (let lv = before + 1; lv <= after; lv++) events.push({ type: 'level', level: lv });
  if (!s.activeGoalId || s.completedGoalIds.includes(s.activeGoalId)) s.activeGoalId = nextGoal(s);
  return { state: s, events };
}
/** the player chose which open goal to show (concurrent chapters only) */
export function chooseGoal(s, id) { const c = currentChapter(s); if (c && !c.sequential && c.goals.includes(id) && !s.completedGoalIds.includes(id)) s.activeGoalId = id; return s; }
/** the one-way switch: the town keeps everything it earned and every kind opens */
export function switchToFree(s) { s.mode = 'free'; s.activeGoalId = null; return s; }
/** progress of a goal as [done, of] from the facts */
export const goalProgress = (id, facts) => GOALS[id] ? GOALS[id].progress(facts) : [0, 1];
export const allDone = s => CHAPTERS.every(c => chapterDone(s, c));
