// A minimal ComfyUI client: queue a text-to-image prompt on the installed checkpoint, wait for it, save the PNG.
//   node render.mjs --base <ready_url> --prompt "..." [--out <file.png>] [--w 1024] [--h 768] [--steps 4] [--seed 7] [--ckpt <name>]
//   --init <image.png> --denoise 0.65   repaints an existing picture instead (image to image): the init is uploaded, scaled to w×h
//   and encoded; lower denoise keeps more of it (0.5 keeps the layout and light, 0.8 keeps little but the composition)
// Flux Schnell defaults (cfg 1, 4 steps, euler/simple); any other checkpoint takes --steps 20 --cfg 5 or so.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const base = (arg('base', 'http://localhost:8188')).replace(/\/$/, ''), prompt = arg('prompt', 'a small town');
const w = +arg('w', 1024), h = +arg('h', 768), steps = +arg('steps', 4), cfg = +arg('cfg', 1), seed = +arg('seed', Date.now() % 1e9), out = arg('out', 'out.png');
let ckpt = arg('ckpt', ''); const init = arg('init', ''), denoise = +arg('denoise', 0.65);
if (!ckpt) { const info = await (await fetch(base + '/object_info/CheckpointLoaderSimple')).json(); ckpt = info.CheckpointLoaderSimple.input.required.ckpt_name[0][0]; }
let initName = null;
if (init) {   // upload the init picture to ComfyUI's input folder
  const { readFileSync } = await import('node:fs'); const { basename } = await import('node:path');
  const form = new FormData(); form.append('image', new Blob([readFileSync(init)], { type: 'image/png' }), basename(init)); form.append('overwrite', 'true');
  const up = await (await fetch(base + '/upload/image', { method: 'POST', body: form })).json(); initName = up.name; if (!initName) { console.error('upload failed', JSON.stringify(up)); process.exit(1); }
}
const graph = {
  1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
  2: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['1', 1] } },
  3: { class_type: 'CLIPTextEncode', inputs: { text: '', clip: ['1', 1] } },
  ...(initName ? { 8: { class_type: 'LoadImage', inputs: { image: initName } }, 9: { class_type: 'ImageScale', inputs: { image: ['8', 0], upscale_method: 'lanczos', width: w, height: h, crop: 'center' } }, 4: { class_type: 'VAEEncode', inputs: { pixels: ['9', 0], vae: ['1', 2] } } }
    : { 4: { class_type: 'EmptyLatentImage', inputs: { width: w, height: h, batch_size: 1 } } }),
  5: { class_type: 'KSampler', inputs: { seed, steps, cfg, sampler_name: 'euler', scheduler: 'simple', denoise: initName ? denoise : 1, model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0] } },
  6: { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
  7: { class_type: 'SaveImage', inputs: { filename_prefix: 'komachi', images: ['6', 0] } },
};
const q = await (await fetch(base + '/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: graph, client_id: 'komachi-cli' }) })).json();
if (!q.prompt_id) { console.error('queue refused:', JSON.stringify(q).slice(0, 600)); process.exit(1); }
console.log('queued', q.prompt_id, 'on', ckpt, `${w}x${h}`, steps, 'steps');
const t0 = Date.now(); let item = null;
while (Date.now() - t0 < 15 * 60 * 1000) {
  const hist = await (await fetch(base + '/history/' + q.prompt_id)).json(); item = hist[q.prompt_id];
  if (item && item.status && item.status.completed) break;
  if (item && item.status && item.status.status_str === 'error') { console.error('failed:', JSON.stringify(item.status.messages).slice(0, 800)); process.exit(1); }
  await new Promise(r => setTimeout(r, 2000));
}
if (!item || !item.outputs) { console.error('timed out'); process.exit(1); }
const img = Object.values(item.outputs).flatMap(o => o.images || [])[0];
const buf = Buffer.from(await (await fetch(`${base}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || '')}&type=${img.type}`)).arrayBuffer());
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, buf);
console.log(`saved ${out} (${(buf.length / 1024).toFixed(0)} KB) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
