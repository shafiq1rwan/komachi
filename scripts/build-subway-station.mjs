import { mkdir, writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Box3, Vector3 } from 'three';
import { createSubwayStation } from '../src/subway-station.js';
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }); }
};
const model=createSubwayStation(), bounds=new Box3().setFromObject(model);
const binary=await new GLTFExporter().parseAsync(model,{binary:true});
const out=new URL('../assets/subway-station/',import.meta.url);await mkdir(out,{recursive:true});
await writeFile(new URL('komachi-subway-station.glb',out),Buffer.from(binary));
let triangles=0;const meshes=[];model.traverse(o=>{if(o.isMesh){triangles+=o.geometry.attributes.position.count/3;meshes.push({name:o.name,material:o.material.name});}});
const manifest={size:bounds.getSize(new Vector3()).toArray(),min:bounds.min.toArray(),max:bounds.max.toArray(),triangles,bytes:binary.byteLength,meshes,...model.userData};
await writeFile(new URL('manifest.json',out),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest,null,2));
