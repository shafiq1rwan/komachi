import { mkdir, writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Box3, Vector3 } from 'three';
import { NEIGHBOURHOOD_KITS, createNeighbourhoodProp } from '../src/neighbourhood-kits.js';
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }); }
};
const manifest = [];
for (const [kit, kinds] of Object.entries(NEIGHBOURHOOD_KITS)) {
  const out = new URL(`../assets/neighbourhood/${kit}/`, import.meta.url); await mkdir(out, { recursive: true });
  for (const kind of kinds) {
    const model = createNeighbourhoodProp(kind), bounds = new Box3().setFromObject(model);
    const binary = await new GLTFExporter().parseAsync(model, { binary: true });
    await writeFile(new URL(`komachi-${kind}.glb`, out), Buffer.from(binary));
    let triangles = 0, meshes = 0;
    model.traverse(o => { if (o.isMesh) { meshes++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; } });
    manifest.push({ kit, kind, triangles, meshes, bytes: binary.byteLength, size: bounds.getSize(new Vector3()).toArray(), minY: bounds.min.y });
  }
}
await writeFile(new URL('../assets/neighbourhood/manifest.json', import.meta.url), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
