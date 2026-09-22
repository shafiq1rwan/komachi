// Komachi — the town chronicle: a short dated record of what happened here, kept for the community centre's case and
// the card. Milestones only, never numbers for their own sake. Saved with the town.
import { S } from './state.js';
export const chronicle = [];   // { day, h, text }
const MAX = 60;
export function record(text) {
  const day = Math.floor(S.T / 24) + 1, h = S.T % 24;
  if (chronicle.some(e => e.text === text)) return;   // one line per event
  chronicle.push({ day, h, text }); if (chronicle.length > MAX) chronicle.shift();
}
export function restoreChronicle(list) { chronicle.length = 0; for (const e of list || []) chronicle.push(e); }
