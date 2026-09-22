# Komachi nature kit

Seven original low-poly models, designed to complement the town's Kenney characters.
This is a standalone asset kit: the game scenery, biome generation and saves are unchanged.
These are original Komachi models, not files from Kenney's Nature Kit.

| File | Model | Triangles |
| --- | --- | ---: |
| `komachi-pine.glb` | Four-tier evergreen with exposed trunk and branches | 456 |
| `komachi-matsu.glb` | Leaning Japanese pine with five needle pads | 408 |
| `komachi-bamboo.glb` | Five culms, raised nodes, branches and pointed leaves | 1,440 |
| `komachi-cherry.glb` | Branching cherry tree, pink canopy, five-petal flowers and fallen petals | 1,342 |
| `komachi-broadleaf.glb` | Branching deciduous tree with an irregular multi-lobed canopy | 528 |
| `komachi-rock.glb` | Three angular boulders with flat ground contact | 60 |
| `komachi-paddy.glb` | Flooded rice tile, raised earth bunds and 25 seedling clumps | 384 |

All GLBs are static, self-contained, one mesh and one matte vertex-colour material each.
No external textures are needed. Y-up; ground at Y=0. Models use the game's units:
pines are 1.27 high, cherry 0.945 high, bamboo up to 1.205 high; paddy footprint is 0.94 × 0.94.
Paddy water is a simple opaque surface; crop growth, water motion and seasonal changes are not included.

`src/nature-kit.js` exports `createNature(kind, seed, color)`, `natureGeometry(kind, seed, color)`
and `addNature(...)` for optional future integration. Seeds produce repeatable variations.
No runtime game module imports this kit yet.

- Export: `node scripts/build-nature.mjs`
- Check GLBs, ground contact, deterministic geometry and rendered previews: `node scripts/preview-nature.mjs`
- Interactive preview: serve `docs/nature-preview.html` with Vite.
- Screenshots: `docs/nature/`.
