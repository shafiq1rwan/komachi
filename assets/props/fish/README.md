# Komachi fish props

Original texture-free low-poly fish for the fishing catch and quay market. Each GLB includes its own vertex colours,
two meshes, a named `Fish_Tail` pivot, and a looping `wriggle` animation.

| Asset | Shape | Triangles |
| --- | --- | --- |
| `komachi-sardine.glb` | Slender silver body | 816 |
| `komachi-horse-mackerel.glb` | Blue back, forked tail | 816 |
| `komachi-flounder.glb` | Broad flat body, mottled back | 704 |
| `komachi-rockfish.glb` | Russet body, spiny dorsal fin | 836 |
| `komachi-sea-bream.glb` | Deep rose body, cream belly | 816 |

Game-unit scale; nose along local +Z, belly toward -Y, grip at the body centre. Full lengths range from about 0.14 to 0.24
units. The flounder lies belly-down on the ice; other market fish lie on their sides.

The game builds these same models directly through `src/fish-prop.js`. Catch instances own their geometry and material;
the market merges its display into one mesh. Colours live in `PAL.fish`.

Rebuild assets: `node scripts/build-fish-props.mjs`.
Validate exported tail animations and capture previews: `node scripts/preview-fish-props.mjs`.
Open `docs/fish-props-preview.html` through Vite to inspect the collection.
