// Small things a seated person takes out, from the modelled props: a phone (src/phone.js) and a folded newspaper
// (src/newspaper.js). Both are game-unit Groups with a grip point; holdItem/holdTool place the grip in the hand.
import { createPhone as phoneModel } from './phone.js';
import { createNewspaper as newspaperModel } from './newspaper.js';

function asHandItem(root) {
  root.userData.handItem = true; root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } }); return root;
}
export function createPhone(color) { return asHandItem(phoneModel(color)); }
export function createNewspaper() { return asHandItem(newspaperModel()); }
