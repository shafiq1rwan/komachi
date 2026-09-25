// Keep the phone's lower side against the animated Kenney palm, including seated sway.
import * as THREE from 'three';
import { aimArm } from './tea-can.js';

const palm = new THREE.Vector3(-0.155, -0.01, 0.035);
const target = new THREE.Vector3(), grip = new THREE.Vector3();
export function posePhone(char) {
  const phone = char.item;
  if (!phone || !char.armR) return;
  phone.rotation.set(0.65, Math.PI, 0);
  char.grp.updateWorldMatrix(true, true);
  char.armR.getWorldPosition(target);
  char.grp.worldToLocal(target);
  target.add(new THREE.Vector3(0.02, -0.025, 0.08));
  aimArm(char, char.armR, target);
  char.armR.updateWorldMatrix(true, false);
  target.copy(palm).applyMatrix4(char.armR.matrixWorld);
  char.grp.worldToLocal(target);
  grip.set(0.022, -0.019, 0).multiply(phone.scale).applyQuaternion(phone.quaternion);
  phone.position.copy(target).sub(grip);
}
