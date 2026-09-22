# Komachi destinations and tourist bus

Four original standalone GLBs. Matte palette vertex colours, no textures, Y-up, +Z front, ground at Y=0. No game integration.

| File | Width × height × depth | Details |
| --- | --- | --- |
| `komachi-lighthouse.glb` | 0.700 × 1.700 × 0.720 | Tapered cream tower, teal band and roof, gallery railing, glazed lantern room, separate lens, antenna and entrance step |
| `komachi-arched-bridge.glb` | 0.778 × 0.639 × 1.980 | Muted red arched rails, timber deck, capped posts, stone end feet, open canal span |
| `komachi-park-pavilion.glb` | 1.295 × 1.096 × 1.213 | Open timber structure, sage gable roof, braced posts, raised floor, entry step and two benches |
| `komachi-tourist-bus.glb` | 0.546 × 0.586 × 1.078 | Compact cream/teal coach, side windows, luggage hatches, mirrors, grille, lamps, rooftop AC, separate entry door and four wheels |

Dimensions include fittings, mirrors and roof overhangs. `manifest.json` records exact bounds and triangle counts.

## Attachment points

- Lighthouse: `entrance`, `viewPoint`, `lightPoint: [0, 1.28, 0]`. Mesh `Lighthouse_Lens` is separate; clone its material to light it. Lens and windows are opaque stylised geometry. No rotating beam or light is included. Rocks and headland terrain are not baked in.
- Bridge: span runs along Z, deck clear width 0.68, entrance centres at Z=±0.9. Extras `path` contains 13 sample points along the curved walking surface, and `entrances` contains the two endpoints. Raised centre surface is Y=0.305; end surface approximately Y=0.075. The plank surface approximates the smooth path with short segments. No collision mesh or routing code is included.
- Pavilion: `entrance` and four `seats`; seat surface Y=0.25. Cherry trees are not baked in, so this can sit beneath the existing tree models.
- Bus: +Z nose, passenger door on local -X for left-hand traffic. Extras `doorPoint`, `driverPoint`, `wheelRadius: 0.079`, and `wheelAxis: "X"`. Wheels `Wheel_Left_Front`, `Wheel_Right_Front`, `Wheel_Left_Rear`, `Wheel_Right_Rear` have axle-centred origins. `Passenger_Door` has a front-edge pivot; rotate local Y positively (openAngle = 0.45π) to swing it outward. Body behind the door remains a solid exterior; no passenger interior or animations are included.

Source: `src/festival-landmark-kit.js`, exporting `DESTINATION_KINDS` and `createFestivalLandmark(kind)`.
Export: `node scripts/build-festival-landmarks.mjs`.
Validate and render: `node scripts/preview-festival-landmarks.mjs`.
Interactive viewer: `/docs/festival-landmarks-preview.html` through Vite (`npm run dev`).
Screenshots and validation report: `docs/festival-landmarks/`.

