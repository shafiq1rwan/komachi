# Komachi city bicycle

Original low-poly step-through city bike for the town's residents. Includes an open front basket,
front lamp, bell, swept handlebars, mudguards, rear luggage rack, chain guard and spoke reflectors.

- `komachi-city-bicycle.glb`: self-contained vertex colours, six meshes, 3,300 triangles, about 440 KiB.
- Dimensions: 0.1375 wide × 0.2525 high × 0.405 long in game units. +Z forward; tyre contacts at Y=0.
- `cycle` animation: two wheel turns per crank turn; pedals stay horizontal. Two-second loop.
- Frame, front/rear wheels, crank and two pedals are separate named meshes. No textures or external files.
- Source: `src/bikes.js`; export with `node scripts/build-bike.mjs`.
- Interactive study: serve `docs/bike-preview.html` with Vite; orbit, recolour, animate and download.
- Check the exported animation and renders with `node scripts/preview-bike.mjs`.

Resident bikes use this same source at native scale. Rotation follows distance actually travelled,
including batched simulation updates; parked wheels stop. The Kenney rider uses a simple rigid-limb
cycling pose, with hands aimed at the grips and alternating legs. It is not a full knee/ankle IK rig.
Small decorative bikes at building racks keep their cheaper static geometry.
