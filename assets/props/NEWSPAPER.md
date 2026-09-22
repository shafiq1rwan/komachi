# Komachi folded newspaper

Original standalone handheld newspaper: cream paper folded across the bottom, four visible
inner layers, KOMACHI masthead, abstract headline and columns, and a small town illustration.
Back page has three printed columns. Printing is geometry, with no external texture dependency.

`komachi-newspaper.glb`: 476 triangles, three meshes, one matte vertex-colour material.
Size: 0.118 wide × 0.092 high × 0.0083 deep. Centre origin, +Y masthead, +Z front page.
Suggested local grip point: `[0, -0.024, 0]`.

Meshes: `Folded_Paper_And_Edges`, `Front_Page_Print`, `Back_Page_Print`.
The folded shape is static; no unfolding, reading animation or character attachment is added.
Source: `src/newspaper.js`, exporting `createNewspaper()`.
Export: `node scripts/build-newspaper.mjs`. GLB checks and front/rear renders:
`node scripts/preview-newspaper.mjs`. Viewer: `docs/newspaper-preview.html` through Vite.
