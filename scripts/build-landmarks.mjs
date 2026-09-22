import {mkdir,writeFile} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {LANDMARK_KINDS,createLandmark} from '../src/landmark-kit.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}};
const out=new URL('../assets/landmarks/',import.meta.url);await mkdir(out,{recursive:true});
for(const kind of LANDMARK_KINDS){const model=createLandmark(kind),binary=await new GLTFExporter().parseAsync(model,{binary:true});await writeFile(new URL(`komachi-${kind}.glb`,out),Buffer.from(binary));let triangles=0;model.traverse(o=>{if(o.isMesh)triangles+=o.geometry.attributes.position.count/3;});console.log(`${kind}: ${triangles} triangles, ${binary.byteLength} bytes`);}
