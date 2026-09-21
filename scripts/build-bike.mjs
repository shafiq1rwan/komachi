import { mkdir, writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createBike, bikeClips } from '../src/bikes.js';
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }); }
};
const bike = createBike(), binary = await new GLTFExporter().parseAsync(bike, { binary: true, animations: bikeClips() });
const out = new URL('../assets/vehicles/bicycle/', import.meta.url); await mkdir(out, { recursive: true });
await writeFile(new URL('komachi-city-bicycle.glb', out), Buffer.from(binary));
let triangles = 0; bike.traverse(o => { if (o.isMesh) triangles += o.geometry.attributes.position.count / 3; });
console.log(`Bicycle exported: ${triangles} triangles, ${binary.byteLength} bytes.`);
