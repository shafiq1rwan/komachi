import { mkdir, writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createDog, dogClips } from '../src/dogs.js';
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }); }
};
const dog = createDog(), binary = await new GLTFExporter().parseAsync(dog, { binary: true, animations: dogClips() });
const out = new URL('../assets/characters/dog/', import.meta.url); await mkdir(out, { recursive: true });
await writeFile(new URL('komachi-shiba.glb', out), Buffer.from(binary));
let triangles = 0; dog.traverse(o => { if (o.isMesh) triangles += o.geometry.attributes.position.count / 3; });
console.log(`Shiba exported: ${triangles} triangles, ${binary.byteLength} bytes, walk + idle + sit + sniff clips.`);
