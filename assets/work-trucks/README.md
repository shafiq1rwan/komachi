# Komachi work trucks

Three standalone models in game units, +Z forward, tyre contact at Y=0. No game replacement or integration.
Matte palette colours, no textures, no lettering or logos. Dimensions include mirrors, lights and bumpers.

| Kind / GLB | Width × height × length | Triangles | Features |
| --- | --- | ---: | --- |
| `kei-farm` / `komachi-kei-farm.glb` | 0.312 × 0.338 × 0.634 | 2,752 | Mint cab-over keitora, open ribbed bed, removable slatted crates with vegetables |
| `builder` / `komachi-builder.glb` | 0.312 × 0.379 × 0.634 | 1,912 | Construction-peach flatbed, folded hydraulic crane, hook, stowed outriggers, removable strapped timber |
| `fish-van` / `komachi-fish-van.glb` | 0.312 × 0.420 × 0.641 | 1,508 | Cream-white insulated box, blue stripe, rear locking bars and front refrigeration pack |

## Source API

`src/work-trucks-kit.js` exports `TRUCK_KINDS` and `createTruck(kind)`.

```js
import { createTruck } from './work-trucks-kit.js';
const truck = createTruck('kei-farm'); // also 'builder' or 'fish-van'
truck.getObjectByName('Cargo_Crates').visible = false;
truck.getObjectByName('Body_Paint').material.color.set('#8fb0c9');
```

The same names survive GLB export and can be found with `gltf.scene.getObjectByName(name)`.

## Named parts

All three contain:

- `Body_Paint`: cab and, on open trucks, bed sides. A dedicated material accepts direct `material.color` changes. It deliberately has no vertex colour attribute to avoid multiplying the chosen colour by baked paint. Other parts use palette vertex colours. Fish-van box and cooling unit stay white when the cab is recoloured.
- `Headlights` and `Taillights`: separate meshes with distinct materials and default emissive intensity zero. Set `material.emissive` and `emissiveIntensity` to illuminate them later. No actual lights are baked in.
- `Wheel_Left_Front`, `Wheel_Right_Front`, `Wheel_Left_Rear`, `Wheel_Right_Rear`: tyre and hub per wheel, local origins on the axles. Left is local -X. Roll around local X. Wheel radius is 0.052; axle centres are Y=0.052, front Z=0.178, rear Z=-0.20.
- `Trim_Glass_And_Chassis`: fixed glass, mirrors, bumpers, grille, bed floor and hardware.

Farm: `Cargo_Crates` includes all four crates and their produce; hide it for a completely empty bed.

Builder: `Cargo_Timber` includes timber and straps. `Crane_Arm` includes the folded boom, hydraulic cylinder and hook, with its swivel origin at `[0.068, 0.177, 0.018]`. It can be hidden or swivelled around local Y. It is a single static folded assembly, not a rig for unfolding individual joints. `Crane_Base_And_Stowed_Outriggers` is separate and remains on the truck when the arm is hidden.

Fish van: `Refrigerated_Box` and `Refrigeration_Unit` are separate. The box is a closed exterior with fixed rear doors; no interior cargo is included.

If you clone a loaded vehicle with `.clone(true)`, clone its paint/light materials before changing them per vehicle, because Three.js shares materials between clones:

```js
for (const name of ['Body_Paint', 'Headlights', 'Taillights']) {
  const mesh = truck.getObjectByName(name);
  mesh.material = mesh.material.clone();
}
```

Root extras contain `kind`, `front`, `units`, `wheelRadius`, `wheelAxis`, `cargoMeshes`, `paintMesh`, `doorPoint` and applicable `cargoPoint` / `cranePivot`. No driving logic, animation clips, collisions or night-light behaviour is included.

## Build and inspect

- Export: `node scripts/build-work-trucks.mjs`.
- Validate GLB dimensions, grounding, mesh names, wheel origins, paint/light material separation and geometry; generate previews: `node scripts/preview-work-trucks.mjs`.
- Interactive viewer: run `npm run dev`, then open `/docs/work-trucks-preview.html`.
- Renders, empty-bed checks, repaint/light check and validation report: `docs/work-trucks/`.
- Exact bounds and mesh inventory: `manifest.json`.
