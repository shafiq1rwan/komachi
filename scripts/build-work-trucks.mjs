import {mkdir,writeFile} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {Box3,Vector3} from 'three';
import {TRUCK_KINDS,createTruck} from '../src/work-trucks-kit.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
const out=new URL('../assets/work-trucks/',import.meta.url);await mkdir(out,{recursive:true});const manifest=[];
for(const kind of TRUCK_KINDS){const model=createTruck(kind),bounds=new Box3().setFromObject(model);let triangles=0;const meshes=[];model.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;meshes.push(o.name);}});const binary=await new GLTFExporter().parseAsync(model,{binary:true});const file=`komachi-${kind}.glb`;await writeFile(new URL(file,out),Buffer.from(binary));manifest.push({kit:'trucks',kind,file,triangles,bytes:binary.byteLength,size:bounds.getSize(new Vector3()).toArray(),minY:bounds.min.y,meshes,...model.userData});}
await writeFile(new URL('manifest.json',out),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest,null,2));
