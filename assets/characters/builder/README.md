# Komachi builder

A separate derivative of Kenney Mini Characters (CC0), based on the file
`../kenney/character-male-b.glb` (its internal character name is `character-male-a`).
The original Kenney asset remains unchanged; `kenney-source.glb` is the retained copy.

`komachi-builder.glb` includes a fitted yellow hard hat with a domed shell, projecting
brim, centre ridge, lower rim and side vents. The upper hair is tucked under the shell;
the fringe remains visible. Workwear has a warm orange vest, pale reflective strips,
navy sleeves/trousers and compact tan work gloves with separate thumbs and darker cuffs.
The glove palms retain the original skin weights; cuffs and thumbs follow the arm bones.
Helmet parts follow the head bone; reflective strips
follow the torso bone.

- 2,559 triangles, approximately 372 KB, self-contained vertex colours and materials.
- Both original skinned meshes and all 32 Kenney animation clips are preserved.
- Y up, +Z forward; uses the same 0.46 scale as residents in the town.
- Construction crews automatically select this builder. Ordinary residents retain the
  original character pool. The builder has a fixed face and workwear palette.
- Existing hand-held construction tools remain attached to `arm-right`.

Editable modeling source: `src/builder-model.js`.
Rebuild/export and render the model in working poses: `node scripts/build-builder.mjs`.
Verify construction crew selection and tool attachment: `node scripts/check-builder.mjs`.
Interactive preview: run `npm run dev`, then open `/docs/builder-preview.html`.
The saved source copy resolves its texture through the workshop's atlas URL mapping;
the finished GLB requires no external texture.
