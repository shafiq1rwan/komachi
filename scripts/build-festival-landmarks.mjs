import {mkdir,writeFile} from 'node:fs/promises';import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';import {Box3,Vector3} from 'three';import {FESTIVAL_KINDS,DESTINATION_KINDS,createFestivalLandmark} from '../src/festival-landmark-kit.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
const manifest=[];
for(const [kit,kinds]of Object.entries({festival:FESTIVAL_KINDS,destinations:DESTINATION_KINDS})){
const out=new URL(`../assets/${kit}/`,import.meta.url);await mkdir(out,{recursive:true});
for(const kind of kinds){const model=createFestivalLandmark(kind),bounds=new Box3().setFromObject(model);let triangles=0;model.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});const bin=await new GLTFExporter().parseAsync(model,{binary:true});await writeFile(new URL(`komachi-${kind}.glb`,out),Buffer.from(bin));manifest.push({kit,kind,file:`komachi-${kind}.glb`,triangles,bytes:bin.byteLength,size:bounds.getSize(new Vector3()).toArray(),minY:bounds.min.y,...model.userData});}
await writeFile(new URL('manifest.json',out),JSON.stringify(manifest.filter(o=>o.kit===kit),null,2)+'\n');}
console.log(JSON.stringify(manifest.map(({kind,triangles,size,minY})=>({kind,triangles,size,minY})),null,2));
