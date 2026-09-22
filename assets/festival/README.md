# Komachi summer festival models

Eight original standalone GLBs. Matte palette vertex colours, no textures, Y-up, +Z front, ground at Y=0. No game integration.

| File | Details |
| --- | --- |
| `komachi-yatai-food.glb` | Rose canopy, divided noren, two lanterns, grilled skewers, cooking pot and stock jars |
| `komachi-yatai-games.glb` | Indigo canopy, lanterns, toy-fishing tray, scoop and plush prizes |
| `komachi-yatai-sweets.glb` | Teal canopy, lanterns, cotton candy display and drinks |
| `komachi-lantern-string.glb` | Nine alternating rose/cream ribbed lanterns, sagging cable and two weighted poles |
| `komachi-taiko.glb` | Barrel drum, two cream skins, rim studs, crossed timber stand and two resting drumsticks |
| `komachi-bunting.glb` | Nine coloured triangular flags on a sagging cord between weighted poles |
| `komachi-festival-banner.glb` | Freestanding nobori with geometric festival crest, decorative lines and crossbar |
| `komachi-mikoshi.glb` | Small portable shrine, gold roof and ornament, lattice panels, hanging bells and two carrying poles |

Stalls are approximately 0.855 wide × 0.886 high × 0.696 deep. Lantern and bunting sets span 1.89 units including feet. Banner is 0.94 high; taiko is 0.516 high; mikoshi is 0.775 high with 1.03-long carry poles. `manifest.json` contains exact bounds and triangle counts.

The lantern-string's `Lanterns` mesh is separate from `Poles_And_Cable`; clone its material before applying any glow. All exported materials are matte and unlit effects are not included. No particle lights, fireworks, wind animation, sound, parade actors or interaction code is supplied. Festival graphics are geometric motifs, not Japanese text.

Root extras include `vendorPoint` and `customerPoint` on each stall, `cableEnds` on the string sets, `playerPoint` on the taiko, and four `carryPoints` on the mikoshi. These are local model coordinates. Place the mikoshi higher when carried; its resting feet are at ground level.

Source: `src/festival-landmark-kit.js`, exporting `FESTIVAL_KINDS` and `createFestivalLandmark(kind)`.
Export both sets: `node scripts/build-festival-landmarks.mjs`.
Validate and render both sets: `node scripts/preview-festival-landmarks.mjs`.
Interactive viewer: `/docs/festival-landmarks-preview.html` through Vite (`npm run dev`).
Screenshots and validation report: `docs/festival-landmarks/`.
