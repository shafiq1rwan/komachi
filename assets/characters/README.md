# Komachi resident

Blender-built character based on `docs/characters/human-resident-reference.png`.

- `komachi-resident.blend`: editable mesh, 16-bone skeleton, packed reference, studio and turnaround scenes.
- `komachi-resident.glb`: skinned glTF binary, one mesh/material, vertex colors, 1,632 triangles. No external textures.
- `komachi-resident.stats.json`: geometry and coordinate summary.
- Preview renders: `docs/characters/komachi-resident-preview.png` and `komachi-resident-turnaround.png`.

## Animation and scale

The rest pose is an A-pose. `Idle` and `Walk` are in-place animation clips; translation along the street belongs to the game simulation. In Blender, select the armature and choose the action in the Action Editor to preview; the stored NLA tracks are muted to keep the rest pose visible on opening.

The exported character is 0.35 game units tall, feet at the origin, +Y up and +Z forward. Blender source uses +Z up and -Y forward. Vertex groups named `region_*` retain editable palette regions in the source mesh. Continuous sleeves and trousers blend weights at the elbows and knees; the face and accessories use rigid weights.

The revised design follows the generated reference's wider face, swept hair, sloped shoulders, continuous clothing, smaller collar, and broad satchel strap. It is a hand-built interpretation of the image, not an exact reconstruction. The first model and its original generator are retained in `v1/` for comparison; run the current generator from `scripts/` to rebuild the revised model.

The game loads this GLB in `src/characters.js`: GLTFLoader once, `SkeletonUtils.clone` per person, a cloned geometry with the palette regions recoloured from the resident's look, an AnimationMixer blending Idle and Walk from movement state, and a sitting pose made by rotating the thigh and shin bones. Note that GLTFLoader strips the dots from node names (`thigh.L` becomes `thighL`). If the file fails to load the game falls back to its original box people.

## Rebuild

Run Blender in background mode from the project root:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python scripts/build-resident.py
```

The builder regenerates the files and preview renders. Verified with Blender 5.2.1 and the project's Three.js GLTFLoader; both animation clips load and sample with finite skeleton transforms.
