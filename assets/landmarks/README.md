# Komachi landmark set

Original low-poly exterior models made to complement the town and its Kenney characters.
Standalone assets only: no game buildings, simulation behaviour or save data were changed.

- `komachi-torii.glb`: separate gate with splayed posts, stone feet, raised end beams and plaque.
- `komachi-shrine.glb`: small shrine hall, tiled roof, lattice doors, offering box, bell rope,
  paper ornaments, stone lanterns, steps and a torii on the approach. Gate is a separate named mesh.
- `komachi-temple.glb`: small Buddhist temple exterior with broad tiled roof, entrance canopy,
  raised veranda, railings, hanging lanterns and crest.
- `komachi-koban.glb`: compact police box with KOBAN sign, red beacon, aerial, glazed door,
  windows, street-map board and bollards.
- `komachi-bathhouse.glb`: public bath with tiled roof, noren curtain and hot-spring emblem,
  bench, boiler annex and tall chimney.

All GLBs use Y-up, +Z-facing entrances and ground at Y=0. They are static exteriors with no
interiors or opening doors. Beacon, lanterns and chimney have no light/smoke effects.
Materials use matte vertex colours, with no external texture dependencies.
Each root includes a local `userData.entrance` point for optional future integration.

Approximate width × height × depth in game units:

| Model | Dimensions |
| --- | --- |
| Torii | 1.20 × 1.09 × 0.16 |
| Shrine set | 1.50 × 1.08 × 1.90 |
| Temple | 1.79 × 1.24 × 1.60 |
| Kōban | 1.29 × 1.02 × 1.02 |
| Public bath | 1.84 × 1.71 × 1.77 |

Source: `src/landmark-kit.js`, exporting `createLandmark(kind)`.
Export with `node scripts/build-landmarks.mjs`.
Check GLBs and render front/rear views with `node scripts/preview-landmarks.mjs`.
Interactive orbit preview: `docs/landmark-preview.html` served by Vite.
