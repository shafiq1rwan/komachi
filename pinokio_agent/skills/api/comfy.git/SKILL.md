---
name: api-comfy-git
description: Render images through the Pinokio-managed ComfyUI's HTTP API with the installed Flux Schnell checkpoint, for concept mockups and theme tests.
---

# ComfyUI API

## Clients

- `clients/render.mjs`: text to image on the installed checkpoint. `node clients/render.mjs --base <ready_url> --prompt "..." --out <file.png> [--w 1024 --h 768 --steps 4 --cfg 1 --seed N --ckpt <name>]`. Picks the first checkpoint from `/object_info/CheckpointLoaderSimple` when `--ckpt` is omitted.

## Operations

- `POST /prompt` with `{ prompt: <graph>, client_id }` queues a graph; the reply carries `prompt_id`.
- `GET /history/<prompt_id>` until `status.completed`; `status.status_str === 'error'` carries `messages`.
- `GET /view?filename=&subfolder=&type=` fetches an output image named in `outputs[*].images`.
- `GET /system_stats` (version, GPU, free VRAM) and `GET /object_info/<Node>` (what models each loader sees) for discovery.

## Runtime Inputs

- The base URL from the app's status, a prompt, size, steps and seed. Flux Schnell wants cfg 1 and 4 steps; a standard SD checkpoint wants about 20 steps and cfg 5.

## Outputs

- A PNG saved where `--out` says; the client prints the queue id and the elapsed time.

## Notes

- The installed model is a Flux Schnell fp8 all-in-one checkpoint (CheckpointLoaderSimple gives model, clip and vae); no separate UNET, CLIP, LoRA, ControlNet or upscaler models are present, so graphs needing them will fail at queue time.
- About 40 s for 1024×640 at 4 steps on an 8 GB card; larger sizes offload and slow down.
