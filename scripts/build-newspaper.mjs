import {mkdir,writeFile} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createNewspaper} from '../src/newspaper.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}};
const newspaper=createNewspaper(),binary=await new GLTFExporter().parseAsync(newspaper,{binary:true});
await mkdir(new URL('../assets/props/',import.meta.url),{recursive:true});await writeFile(new URL('../assets/props/komachi-newspaper.glb',import.meta.url),Buffer.from(binary));
let triangles=0;newspaper.traverse(o=>{if(o.isMesh)triangles+=o.geometry.attributes.position.count/3;});console.log({triangles,bytes:binary.byteLength});
