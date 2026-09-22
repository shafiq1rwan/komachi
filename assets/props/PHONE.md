# Komachi phone

Original low-poly smartphone, sized for the town's Kenney characters. Sage case, rounded
corners, front camera/earpiece, twin rear lenses, flash, side buttons, charging port and speaker
marks. Home-screen icons are geometry; no external textures are required.

`komachi-phone.glb`: 1,464 triangles, three meshes, two materials. Approximately 0.050 wide,
0.088 tall and 0.014 deep including buttons and camera bumps. Origin at the body centre,
+Y toward the top and +Z toward the screen. Suggested local grip point: `[0, -0.016, 0]`.

- `Phone_Case_And_Cameras`: merged case and physical details.
- `Phone_Screen`: independent `Phone_Screen_Material`, ready for emissive night lighting.
- `Phone_Screen_Icons`: separate icon geometry; hide it when supplying a custom display.

Static standalone asset; no character attachment, phone activities or animation added.
Source: `src/phone.js`, `createPhone(optionalCaseColor)`.
Export: `node scripts/build-phone.mjs`. Validation/front/rear renders:
`node scripts/preview-phone.mjs`. Interactive viewer: `docs/phone-preview.html` through Vite.
