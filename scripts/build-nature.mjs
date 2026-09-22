import {mkdir,writeFile} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {NATURE_KINDS,createNature} from '../src/nature-kit.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}};
const out=new URL('../assets/nature/',import.meta.url);await mkdir(out,{recursive:true});
for(const kind of NATURE_KINDS){const mesh=createNature(kind),binary=await new GLTFExporter().parseAsync(mesh,{binary:true});await writeFile(new URL(`komachi-${kind}.glb`,out),Buffer.from(binary));console.log(`${kind}: ${mesh.geometry.attributes.position.count/3} triangles, ${binary.byteLength} bytes`);}
