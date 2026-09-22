import { mkdir, writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Box3, Vector3 } from 'three';
import { TOWN_SERVICE_KINDS, createTownService } from '../src/town-services-kit.js';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }); }
};
const out = new URL('../assets/town-services/', import.meta.url);
await mkdir(out, { recursive: true });
const manifest = [];
for (const kind of TOWN_SERVICE_KINDS) {
  const model = createTownService(kind), bounds = new Box3().setFromObject(model);
  const binary = await new GLTFExporter().parseAsync(model, { binary: true });
  await writeFile(new URL(`komachi-${kind}.glb`, out), Buffer.from(binary));
  let triangles = 0, meshes = 0;
  model.traverse(o => { if (o.isMesh) { meshes++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; } });
  manifest.push({ kind, file: `komachi-${kind}.glb`, size: bounds.getSize(new Vector3()).toArray(), minY: bounds.min.y, triangles, meshes, bytes: binary.byteLength, ...model.userData });
}
await writeFile(new URL('manifest.json', out), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
