import { mkdir, writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createDolphin, dolphinClips } from '../src/dolphins.js';
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }); }
};
const dolphin = createDolphin(), binary = await new GLTFExporter().parseAsync(dolphin, { binary: true, animations: dolphinClips() });
const out = new URL('../assets/characters/dolphin/', import.meta.url); await mkdir(out, { recursive: true });
await writeFile(new URL('komachi-dolphin.glb', out), Buffer.from(binary));
let triangles = 0; dolphin.traverse(o => { if (o.isMesh) triangles += o.geometry.attributes.position.count / 3; });
console.log(`Dolphin exported: ${triangles} triangles, ${binary.byteLength} bytes, swim clip.`);
