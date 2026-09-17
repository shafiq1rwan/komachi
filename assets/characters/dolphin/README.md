# Komachi dolphin

Original low-poly dolphin in the same simple, matte style as the Komachi cat.
Blue upper body, pale underside, rounded forehead, narrow beak, swept dorsal fin,
paired flippers and horizontal tail flukes. No textures or external dependencies.

- Asset: `komachi-dolphin.glb`, 678 triangles, about 81 KB.
- Coordinates: Y up, +Z forward, body centred near the origin; length approximately 3 units.
- Animation: `swim`, a looping 1.6-second up/down tail stroke with gentle flipper motion.
  Four rigid mesh parts; no skeletal skin.
- Editable source: `src/dolphins.js`; `createDolphin(coat, scale)` accepts a coat colour and scale.
- Regenerate: `node scripts/build-dolphin.mjs`.
- Preview: `npm run dev`, then open `/docs/dolphin-preview.html` to orbit, swim or download.
- Verify and render front/side/top review images: `node scripts/preview-dolphin.mjs`.

This is a standalone model asset. It has not been added to the town's ocean simulation.
It is custom Komachi artwork, not an asset from a Kenney pack.
