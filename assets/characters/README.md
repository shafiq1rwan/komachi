# Characters

## Kenney Mini Characters (`kenney/`)

The rigged people used with `?rigged` come from Kenney's **Mini Characters** pack (https://kenney.nl,
licence CC0 1.0, no attribution required). The folder holds the character GLBs
(`character-<sex>-<letter>.glb`), the shared colour atlas `Textures/colormap.png`, and the pack's
accessories, which the game ignores.

`src/characters.js` loads every `character-*.glb` once, skips any file without a skin and a `walk`
clip, bakes the atlas into vertex colours and classifies each vertex as skin, hair, shirt or trousers
(by colour ramp, bone weight and height). Each person gets a `SkeletonUtils.clone` of one variant,
chosen by name hash, with those parts repainted from their look while the shading ramp is kept.
Animations used: `idle`, `walk`, `sit` (blended by state). Builders get a hard hat on the `head` bone.
Model height is ~0.67 units; the game scales it to 0.5.

Note: in the copy checked in here the file names are shifted by one against their contents (for
example `character-female-a.glb` holds a hearing-aid accessory and `wheelchair-power-deluxe.glb` is
a PNG). The loader goes by contents, so this does no harm; re-extracting the pack would tidy it.

## Earlier custom model (`komachi-resident.glb`, `v1/`, `v2/`)

A Blender-built character from before the Kenney pack, kept for reference and no longer loaded.
`build-resident.py` in `v1/` and `v2/` rebuilds the GLB from the .blend files.
