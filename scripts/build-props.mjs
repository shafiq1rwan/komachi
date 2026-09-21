import { mkdir, writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createCharacterProp, PROP_KINDS, umbrellaClips } from '../src/character-props.js';
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }); }
};
const out = new URL('../assets/props/', import.meta.url); await mkdir(out, { recursive: true });
for (const kind of PROP_KINDS) {
  const prop = createCharacterProp(kind), animations = kind === 'umbrella' ? umbrellaClips() : [];
  const binary = await new GLTFExporter().parseAsync(prop, { binary: true, animations });
  await writeFile(new URL(`komachi-${kind}.glb`, out), Buffer.from(binary));
  let triangles = 0; prop.traverse(o => { if (o.isMesh) triangles += o.geometry.attributes.position.count / 3; });
  console.log(`${kind}: ${triangles} triangles, ${binary.byteLength} bytes`);
}
