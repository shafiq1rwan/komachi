import assert from 'node:assert/strict';
import { AnimationMixer, Box3, Color, LoopOnce } from 'three';
import { createDog, dogClips, updateDog } from '../src/dogs.js';

const names = ['Body', 'Head', 'Tail', 'Leg_0', 'Leg_1', 'Leg_2', 'Leg_3'];
const headGeometry = createDog().dogParts.head.geometry, pink = new Color('#e9b7b0');
for (let i = 0; i < headGeometry.attributes.position.count; i++) {
  const col = headGeometry.attributes.color;
  if (Math.abs(col.getX(i) - pink.r) > 1e-5 || Math.abs(col.getY(i) - pink.g) > 1e-5 || Math.abs(col.getZ(i) - pink.b) > 1e-5) continue;
  const pos = headGeometry.attributes.position, x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), side = Math.sign(x), f = (y - .105) / .195;
  assert.ok(Math.abs(z - (.13 - f * .055 + .001)) < 1e-6, 'Ear inset must sit on front face');
  assert.ok(Math.abs(x - (side * .155 + side * .025 * f)) < .075 * (1 - f), 'Ear inset must stay inside ear outline');
}
for (const mode of ['walk', 'idle', 'sit', 'sniff']) {
  const fine = createDog(), coarse = createDog(), reference = createDog();
  const args = [mode === 'walk', mode === 'sit', mode === 'sniff'];
  for (let i = 0; i < 240; i++) updateDog(fine, 1 / 60, ...args);
  for (let i = 0; i < 10; i++) updateDog(coarse, .4, ...args);
  const mixer = new AnimationMixer(reference), action = mixer.clipAction(dogClips().find(c => c.name === mode));
  if (mode === 'sit') { action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; }
  action.play(); mixer.update(4);
  for (const name of names) {
    const a = fine.getObjectByName(name), b = coarse.getObjectByName(name), c = reference.getObjectByName(name);
    assert.ok(a.position.distanceTo(b.position) < 1e-5 && a.quaternion.angleTo(b.quaternion) < 1e-3, `${mode}/${name}: timestep mismatch`);
    assert.ok(a.position.distanceTo(c.position) < 1e-5 && a.quaternion.angleTo(c.quaternion) < 1e-3, `${mode}/${name}: clip mismatch`);
  }
  if (mode === 'walk') for (const leg of fine.dogParts.legs) assert.ok(Math.abs(leg.rotation.x) > .1, 'Every leg must swing, including rear legs');
  if (mode === 'sit') {
    assert.ok(fine.dogParts.body.rotation.x < -.6, 'Torso must lower over haunches');
    for (const leg of fine.dogParts.legs) {
      const bottom = new Box3().setFromObject(leg).min.y;
      assert.ok(bottom > -.001 && bottom < .008, `Sitting paw must meet ground: ${bottom}`);
    }
    updateDog(fine, .3, true);
    assert.ok(fine.dogParts.legs.every(l => Math.abs(l.scale.y - 1) < .001), 'Walking must restore sitting leg scale');
  }
}
console.log('All four clips match game playback at 60 fps and fast-forward; rear gait, seated ground contact and sit-to-walk reset passed.');
