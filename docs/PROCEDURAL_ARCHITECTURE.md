# Procedural architecture

`src/architecture.js` provides a pure layout grammar for the rich look's one-cell detached
homes and villas. `housePlan(unitSeed, level, variant)` fixes the footprint, facade bays,
entrance, wall palette, cladding and roof proportions before geometry is emitted. Levels
change the storey count, preserving the footprint and entrance; villas remain single-storey.
The existing shop, workspace and multi-cell residential generators retain their identities.

Choices use integer hashing with separate, stable channel numbers. Add new channels for new
details rather than reusing thresholds or advancing a shared random stream. No rule depends
on a particular town seed. Material swatches are in `PAL.richArchitecture`.

Openings derive from wall dimensions, the garden path follows the entrance, and roof courses
interpolate between the eaves and ridge. Courses are surface ribbons with upward normals,
merged into the body mesh. A size-based cap of six courses gives smaller porch roofs fewer
details. Each course uses eight triangles instead of 48 for four boxes; there are no new
materials, draw calls or per-frame updates.

Run `npm run test:architecture` to exercise 64 unit seeds at three levels and two variants.
It compares geometry buffers across rebuilds and different global random streams, checks
finite attributes, opening clearances, footprint bounds, variation and a triangle budget,
and exercises the town's body/window mesh merger. Three.js UUIDs use randomness and are
excluded from geometry comparisons. This does not claim whole-simulation determinism.

Run `npm run preview:architecture` for `scripts/out/architecture-seeds.png`, showing matching
seed columns across level-one homes, level-two homes and villas. Use `npm run build` and
`npm test` for town integration; `node scripts/capture-rich.mjs` also checks look switching.
