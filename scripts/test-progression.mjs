// The progression core under plain Node (no browser): fresh availability, latching, out-of-order credit, chapters, levels,
// the release bridge, normalisation of odd saves, the Free Build switch. Run: node scripts/test-progression.mjs (npm test runs it first).
import assert from 'node:assert/strict';
import { fresh, normalise, evaluate, levelOf, available, fishingAllowed, lockReason, nextGoal, chooseGoal, switchToFree, allowedOf, RELEASE_BRIDGE, MAX_LEVEL, GOAL_ORDER, CHAPTERS, GOALS, nextLevelProgress } from '../src/progression.js';

const facts = (o = {}) => ({ drawnConnected: 0, homesConnected: 0, housed: 0, shopsDone: 0, worksDone: 0, ...o });
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('PASS  ' + name); };

ok('a fresh guided town has only the starter kit', () => {
  const s = fresh();
  assert.equal(levelOf(s), 1); assert.equal(nextGoal(s), 'first-street');
  assert.ok(available(s, 'res', 'detached') && available(s, 'res', 'narrow'));
  for (const k of ['terrace', 'apartment', 'manshon']) assert.ok(!available(s, 'res', k), k);
  for (const k of ['konbini', 'cafe', 'supermarket']) assert.ok(!available(s, 'shop', k), k);
  assert.ok(!available(s, 'work', 'office') && !available(s, 'civic', 'community') && !available(s, 'farm', 'field'));
  assert.ok(!fishingAllowed(s));
  assert.deepEqual(allowedOf(s, 'res', ['detached', 'narrow', 'terrace']), ['detached', 'narrow']);
});
ok('every goal id in the chapters has content, in order', () => {
  for (const id of GOAL_ORDER) assert.ok(GOALS[id], id);
  assert.deepEqual(GOAL_ORDER, ['first-street', 'first-home', 'first-household', 'first-shop', 'first-workplace', 'ten-neighbours']);
});
ok('a disconnected or single road cell does not complete the street goal; two connected cells do', () => {
  const s = fresh();
  assert.equal(evaluate(s, facts({ drawnConnected: 1 })).events.length, 0);
  const r = evaluate(s, facts({ drawnConnected: 2 }));
  assert.deepEqual(r.events, [{ type: 'goal', id: 'first-street' }]); assert.equal(nextGoal(s), 'first-home');
});
ok('street and home give Level 2 once, however many homes; removing them never regresses', () => {
  const s = fresh();
  let r = evaluate(s, facts({ drawnConnected: 3, homesConnected: 3 }));
  assert.deepEqual(r.events.map(e => e.type + ':' + (e.id || e.level)), ['goal:first-street', 'goal:first-home', 'level:2']);
  assert.equal(levelOf(s), 2); assert.ok(available(s, 'shop', 'konbini') && available(s, 'work', 'office') && !available(s, 'shop', 'cafe'));
  r = evaluate(s, facts({ drawnConnected: 0, homesConnected: 0 }));
  assert.equal(r.events.length, 0); assert.equal(levelOf(s), 2); assert.equal(s.completedGoalIds.length, 2);
  r = evaluate(s, facts({ drawnConnected: 5, homesConnected: 9 })); assert.equal(r.events.length, 0);   // no second payout
});
ok('the first household completes Chapter 1: Level 3, fishing, café and grocery', () => {
  const s = fresh(); evaluate(s, facts({ drawnConnected: 2, homesConnected: 1 }));
  const r = evaluate(s, facts({ drawnConnected: 2, homesConnected: 1, housed: 1 }));
  assert.deepEqual(r.events.map(e => e.type + ':' + (e.id || e.level)), ['goal:first-household', 'chapter:first-neighbours', 'level:3']);
  assert.ok(fishingAllowed(s) && available(s, 'shop', 'cafe') && available(s, 'shop', 'grocery') && !available(s, 'res', 'terrace'));
  assert.equal(nextGoal(s), 'first-shop');
});
ok('out-of-order work is credited when its chapter arrives, and Chapter 2 opens the whole catalogue', () => {
  const s = fresh();
  // a shop and a workplace finished during Chapter 1 count as soon as they are facts, Chapter 2 completes with the tenth neighbour
  let r = evaluate(s, facts({ drawnConnected: 2, homesConnected: 2, shopsDone: 1, worksDone: 1 }));
  assert.ok(r.events.some(e => e.id === 'first-shop') && r.events.some(e => e.id === 'first-workplace'));
  assert.equal(levelOf(s), 2);   // the chapter-2 goals are done early but Level 3 still needs the first household
  r = evaluate(s, facts({ drawnConnected: 2, homesConnected: 4, shopsDone: 1, worksDone: 1, housed: 10 }));
  const kinds = r.events.map(e => e.type + ':' + (e.id || e.level));
  assert.deepEqual(kinds, ['goal:first-household', 'goal:ten-neighbours', 'chapter:first-neighbours', 'chapter:living-street', 'entitlement:' + RELEASE_BRIDGE, 'level:3', 'level:4']);
  assert.equal(levelOf(s), MAX_LEVEL); assert.ok(s.entitlements.includes(RELEASE_BRIDGE));
  for (const [t, k] of [['res', 'manshon'], ['shop', 'arcade'], ['civic', 'townhall'], ['farm', 'paddy']]) assert.ok(available(s, t, k), t + ':' + k);
  assert.equal(nextGoal(s), null);
  assert.equal(evaluate(s, facts({ housed: 10 })).events.length, 0);
});
ok('Chapter 2 goals run concurrently and the player may choose which one to show', () => {
  const s = fresh(); evaluate(s, facts({ drawnConnected: 2, homesConnected: 1, housed: 1 }));
  assert.equal(nextGoal(s), 'first-shop'); chooseGoal(s, 'ten-neighbours'); assert.equal(s.activeGoalId, 'ten-neighbours'); assert.equal(nextGoal(s), 'ten-neighbours');
  chooseGoal(s, 'first-street'); assert.equal(s.activeGoalId, 'ten-neighbours');   // not an open goal of this chapter
  evaluate(s, facts({ drawnConnected: 2, homesConnected: 4, housed: 10 })); assert.equal(s.activeGoalId, 'first-shop');   // the chosen one is done: the next open one
});
ok('lock reasons name the level, or the release bridge for kinds beyond it', () => {
  const s = fresh();
  assert.equal(lockReason(s, 'shop', 'konbini'), 'Unlocks at Town Level 2: Foundations');
  assert.equal(lockReason(s, 'res', 'terrace'), 'Unlocks at Town Level 4: A Living Street');
  assert.equal(lockReason(s, 'res', 'manshon'), 'Unlocks after A Living Street (Town Level 4)');
  assert.equal(lockReason(s, 'res', 'detached'), null);
});
ok('a save without progression is Free Build with everything open, and odd fields normalise', () => {
  for (const raw of [undefined, null, 'x', {}, { mode: 'nonsense', completedGoalIds: 'oops' }]) { const s = normalise(raw); assert.equal(s.mode, 'free'); assert.equal(levelOf(s), MAX_LEVEL); assert.ok(available(s, 'civic', 'square') && fishingAllowed(s)); }
  const s = normalise({ mode: 'guided', completedGoalIds: ['first-street', 'bogus', 7], completedChapterIds: [], entitlements: null, activeGoalId: 'nope', collapsed: 1 });
  assert.deepEqual(s.completedGoalIds, ['first-street']); assert.equal(s.activeGoalId, 'first-home'); assert.equal(s.collapsed, true); assert.deepEqual(s.entitlements, []);
  const t = normalise({ mode: 'guided', completedGoalIds: GOAL_ORDER.slice() });   // chapters and the bridge follow from the goals
  assert.deepEqual(t.completedChapterIds, CHAPTERS.map(c => c.id)); assert.ok(t.entitlements.includes(RELEASE_BRIDGE)); assert.equal(levelOf(t), MAX_LEVEL);
});
ok('switching to Free Build keeps what was earned and opens everything', () => {
  const s = fresh(); evaluate(s, facts({ drawnConnected: 2, homesConnected: 1 }));
  switchToFree(s); assert.equal(s.mode, 'free'); assert.deepEqual(s.completedGoalIds, ['first-street', 'first-home']);
  assert.ok(available(s, 'civic', 'square') && fishingAllowed(s)); assert.equal(evaluate(s, facts({ housed: 50 })).events.length, 0);
});
ok('HUD progress follows the next level, includes population progress, and keeps earned credit after demolition', () => {
  const s = fresh(); evaluate(s, facts({ drawnConnected: 2, homesConnected: 1 }));
  let p = nextLevelProgress(s, facts({ drawnConnected: 2, homesConnected: 1 }));
  assert.equal(p.next, 3); assert.equal(p.done, 0); assert.equal(p.total, 1);
  evaluate(s, facts({ housed: 1, shopsDone: 1, worksDone: 1 }));
  p = nextLevelProgress(s, facts({ housed: 8, shopsDone: 1, worksDone: 1 }));
  assert.equal(p.next, 4); assert.equal(p.done, 2); assert.ok(p.fraction > 0.9 && p.fraction < 1);
  p = nextLevelProgress(s, facts({ housed: 8 })); assert.equal(p.done, 2); assert.ok(p.fraction > 0.9);
  evaluate(s, facts({ housed: 10 })); p = nextLevelProgress(s, facts());
  assert.equal(p.next, null); assert.equal(p.fraction, 1);
});
ok('first-customer terrace reward persists without opening other locked buildings', () => {
  const s = fresh(); s.entitlements.push('poki-first-customer-terrace');
  const restored = normalise(JSON.parse(JSON.stringify(s)));
  assert.ok(available(restored, 'res', 'terrace'));
  assert.equal(available(restored, 'res', 'apartment'), false);
  assert.equal(levelOf(restored), 1);
});
console.log(`progression core: ${n} checks passed`);
