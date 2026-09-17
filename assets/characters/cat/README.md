# Komachi cat

Original low-poly cat inspired by the simple shapes and matte colours of Kenney-style
game assets. This is a custom Komachi model, not an asset from a Kenney pack.

- `komachi-cat.glb`: self-contained vertex colours, 1,866 triangles, seven rigid mesh parts.
- Coordinates: Y up, +Z forward, paws at Y=0. Height is approximately 0.217 town units.
- Clips: `idle` (tail sway) and `walk` (four alternating legs); no skin or external textures.
- The town builds the same geometry from `src/cats.js`, with five palette-based coat colours.
  Its procedural gait also adds a small body bob and an idle head turn.
- Regenerate: `node scripts/build-cat.mjs`.
- Preview: run `npm run dev` and open `/docs/cat-preview.html`; drag to orbit, toggle walking,
  or download the GLB. `node scripts/preview-cat.mjs` renders the review PNG and verifies
  that the exported GLB loads and animates.

The JavaScript generator is the editable source; no Blender installation is required.
