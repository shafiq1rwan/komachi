# Komachi subway station pavilion

Original standalone model for the centre cell of the station's 3-by-3 plaza.

## Dimensions and placement

- Plan envelope: **0.8802 X by 0.8821 Z**, including roof tile rolls and deep eaves.
- Ridge/end-cap maximum: **Y = 0.6995** above local ground.
- **Ground/entrance Y = 0**, front/entrance **+Z**. Add the game's **0.12** plinth offset to
  the model root when placing it. The plinth is not included in the GLB.
- Stairs intentionally extend below zero: last tread **Y = -0.30**, lowest retaining wall
  **Y = -0.33**. Do not bottom-align this model using its bounding box: that would raise the entrance.
- Seven 0.44-wide treads, spaced 0.09 along Z, descending by 0.05 per step toward -Z.
  The first tread is centred at Z = 0.30; the last at Z = -0.24.
- Entrance marker: `[0, 0, 0.38]`; bottom arrival/departure marker: `[0, -0.30, -0.265]`.

The export contains tread and riser surfaces, side retaining walls and rails, four pillars,
a cream back wall, low side screens and the pavilion roof. It has **no solid stair block,
ground slab, landing cap or pit floor beneath the stairs**. Keep the game's plinth and terrain
cutout clear at least from X = -0.235 to +0.235 and Z = -0.34 to +0.36. The existing floor and
old station geometry must not be drawn through this opening when integrating the asset.

## Independent night materials

| Mesh | Material |
| --- | --- |
| `Window_Band` | `Window_Band_Material` |
| `Name_Board` | `Name_Board_Material` |
| `Lamp_L` | `Lamp_L_Material` |
| `Lamp_R` | `Lamp_R_Material` |

Each uses its **own** MeshStandardMaterial, without vertex colours or textures. Their emissive
colour is black by default; set `material.emissive` and `emissiveIntensity`, or replace the
material independently. Frames, lamp ribs, mullions and KOMACHI lettering are separate meshes
and will stay dark. The window band is visible from both inside and behind the pavilion.
Left/right lamp naming is as viewed from the +Z entrance.

The front gable clock has separate `Clock_Hour_Hand` and `Clock_Minute_Hand` meshes with centre
pivots. The default pose is approximately 10:10. Rotate about local Z for later clock behaviour;
the GLB has no animation clips. `Kawara_Hip_And_Gable_Roof` and `Eaves_And_Ceiling` can be hidden
separately for inspection.

## Delivery and checks

`komachi-subway-station.glb` is self-contained: 5,348 triangles, 18 named meshes, five materials,
no external textures. `manifest.json` gives exact bounds, names, placement and stair metadata.
No game replacement, collision setup, commuter routing or night-cycle wiring is included.

Export and validation:

```text
node scripts/build-subway-station.mjs
node scripts/preview-subway-station.mjs
```

The preview script reloads the actual GLB and checks the footprint, ridge height, material
independence, finite geometry, all seven tread levels at three lateral samples, absence of a
floor beneath each sample, at least 0.345 upward clearance at each sample and an uncapped bottom
exit. These are model clearance checks, not a full test of the game's character animation.

Source: `src/subway-station.js` (`createSubwayStation`, `STATION_LIGHT_MESHES`).
Interactive preview: `docs/subway-station-preview.html`, served through Vite.
Day, night, rear and cutaway images: `docs/subway-station/`.
The floor/plinth visible in those renders is preview scenery only and is excluded from the GLB.
