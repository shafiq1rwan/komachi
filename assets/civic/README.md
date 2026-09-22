# Komachi civic kit

Seven original low-poly models, made to complement the town's Kenney characters and other
Komachi kits. Standalone assets only; no game placement or simulation changes are included.

| GLB | Details |
| --- | --- |
| `komachi-substation.glb` | Braced steel frame, nine ribbed insulators, overhead conductors, transformer with cooling fins, service cabinet and warning pictogram |
| `komachi-water-tower.glb` | Elevated cylindrical tank, conical roof, cross-braced legs, ladder, fill pipe, valve, vent and water emblem |
| `komachi-recycling-row.glb` | Four colour-coded bins for bottles, cans, paper and other recycling; opening marks and pictograms; common concrete pad |
| `komachi-shrine-path-gate.glb` | Small torii-style entrance, swept lintel, stone bases, plaque, sagging rope and four folded paper streamers |
| `komachi-notice-board.glb` | Roofed timber community notice board (掲示板), pinned notices, header strip and concrete feet |
| `komachi-fire-hydrant.glb` | Red standpipe, three capped outlets, top nut, foot flange, bolts and a short cap chain |
| `komachi-hose-box.glb` | Raised red cabinet, separate hinged door, hose pictogram, ventilation marks, internal coiled hose and nozzle |

All GLBs are self-contained, with matte vertex colours and no external textures. Y-up, +Z front,
bottom at Y=0, dimensions in existing game units. `manifest.json` contains exact sizes and
triangle counts. The preview scales each exhibit individually for detail; the exports retain
their proper relative sizes. For reference: tower 0.98 high, gate 0.673, board 0.549, hydrant 0.224.

The `Hose_Box_Door` mesh has its origin at the left hinge; rotate its local Y negatively to open
outward. It is exported closed, with no animation clip. The four bins and concrete pad are named
separate meshes. Other static geometry is merged. No collisions, operational electrical or
water systems, fire effects or interactions are supplied. The recycling openings are dark
surface marks rather than hollow interiors. Notices use abstract geometric lines, not readable
Japanese writing. The torii is a new compact path prop; the existing shrine kit is unchanged.

Root extras supply `wireAnchors` on the substation, `hosePoint` on the hydrant and `doorPivot`
on the hose box. Long utility cables depend on scene placement and are not included.

Source: `src/civic-kit.js`, exporting `CIVIC_KINDS` and `createCivicProp(kind)`.
Export: `node scripts/build-civic-kit.mjs`.
GLB validation and front/rear previews: `node scripts/preview-civic-kit.mjs`.
Interactive viewer: `docs/civic-preview.html` served through Vite. Also includes an open-door
render at `docs/civic/hose-box-open.png`.
