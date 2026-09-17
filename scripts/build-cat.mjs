// Regenerate the portable cat asset: node scripts/build-cat.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createCat, catClips } from '../src/cats.js';

// GLTFExporter uses the browser FileReader interface to pack buffers.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }); }
};
const cat = createCat();
const binary = await new GLTFExporter().parseAsync(cat, { binary: true, animations: catClips() });
const out = new URL('../assets/characters/cat/', import.meta.url);
await mkdir(out, { recursive: true });
await writeFile(new URL('komachi-cat.glb', out), Buffer.from(binary));
let triangles = 0; cat.traverse(o => { if (o.isMesh) triangles += o.geometry.attributes.position.count / 3; });
console.log(`Cat exported: ${triangles} triangles, ${binary.byteLength} bytes, idle + walk clips.`);
