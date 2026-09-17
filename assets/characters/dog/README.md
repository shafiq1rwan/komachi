# Komachi Shiba Inu

Original low-poly Shiba Inu made for Komachi's neighbourhood streets. It uses chunky
bevelled geometry, vertex colours and the town's muted palette, with pointed ears,
cream muzzle, chest and paws, and a curled tail.

- `komachi-shiba.glb`: self-contained, 2,058 triangles, approximately 354 KB.
- Coordinates: Y up, +Z forward, paws at Y=0; game height approximately 0.28 units.
- Clips: `walk`, `idle`, `sit` and `sniff`; rigid animated parts with no skeletal skin.
- Four coat colours are available through `createDog(coat, scale)` in `src/dogs.js`.
- The town spawns one after roughly 50 road cells and at most two in a large town.
  Dogs use pedestrian routes, sit during long pauses and sniff during short pauses.
  The town plays the same clips exported in the GLB, with short crossfades. Play `sit`
  once and hold its last frame; the other three clips loop.
- Regenerate: `node scripts/build-dog.mjs`.
- Preview and download: run `npm run dev`, then open `/docs/dog-preview.html`.
- Render and verify all clips: `node scripts/preview-dog.mjs`.
- Verify frame-rate independence, all four walking legs and seated ground contact:
  `node scripts/check-dog-animation.mjs`. The preview check also compares every animated
  part of the loaded GLB with the game over three seconds per clip.

This is custom Komachi artwork, not an asset from a Kenney pack.
