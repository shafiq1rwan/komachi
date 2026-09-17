import assert from 'node:assert/strict';
import { AnimationMixer, Box3, LoopOnce } from 'three';
import { createDog, dogClips, updateDog } from '../src/dogs.js';

const names = ['Body', 'Head', 'Tail', 'Leg_0', 'Leg_1', 'Leg_2', 'Leg_3'];
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
