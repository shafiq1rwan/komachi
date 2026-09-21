import {mkdir,writeFile} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createTeaCan} from '../src/tea-can.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}};
const can=createTeaCan(),binary=await new GLTFExporter().parseAsync(can,{binary:true});
await mkdir(new URL('../assets/props/',import.meta.url),{recursive:true});await writeFile(new URL('../assets/props/komachi-tea-can.glb',import.meta.url),Buffer.from(binary));
console.log(`Tea can: ${can.geometry.attributes.position.count/3} triangles, ${binary.byteLength} bytes`);
