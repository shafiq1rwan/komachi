import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createFishProp, animateFishProp, FISH_PROP_KINDS } from '../src/fish-prop.js';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }); }
};
const out = new URL('../assets/props/fish/', import.meta.url); await mkdir(out, { recursive: true });
for (const kind of FISH_PROP_KINDS) {
  const fish = createFishProp(kind); let triangles = 0, meshes = 0;
  fish.traverse(o => {
    if (!o.isMesh) return; meshes++;
    const p = o.geometry.attributes.position; triangles += p.count / 3;
    for (const attr of Object.values(o.geometry.attributes)) assert.ok(attr.array.every(Number.isFinite), `${kind}: invalid geometry`);
  });
  assert.equal(meshes, 2); assert.ok(triangles < 1400);
  const size = new THREE.Box3().setFromObject(fish).getSize(new THREE.Vector3());
  assert.ok(size.z > 0.1 && size.z < 0.25, `${kind}: hand-held scale`);
  for (let i = 0; i < 30; i++) { animateFishProp(fish, i / 30); assert.ok(new THREE.Box3().setFromObject(fish).min.toArray().every(Number.isFinite)); }
  animateFishProp(fish, 0);
  const times = [], values = [], axis = new THREE.Vector3(kind === 'flounder' ? 1 : 0, kind === 'flounder' ? 0 : 1, 0);
  for (let i = 0; i <= 16; i++) { times.push(i / 16 * Math.PI / 6); new THREE.Quaternion().setFromAxisAngle(axis, Math.sin(i / 16 * Math.PI * 2) * 0.28).toArray(values, i * 4); }
  const clip = new THREE.AnimationClip('wriggle', Math.PI / 6, [new THREE.QuaternionKeyframeTrack('Fish_Tail.quaternion', times, values)]);
  const binary = await new GLTFExporter().parseAsync(fish, { binary: true, animations: [clip] });
  await writeFile(new URL(`komachi-${kind}.glb`, out), Buffer.from(binary));
  console.log(`${kind}: ${triangles} triangles, ${meshes} meshes, ${(binary.byteLength / 1024).toFixed(1)} KB, wriggle animation`);
}
