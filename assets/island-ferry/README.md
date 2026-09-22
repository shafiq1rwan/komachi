# Komachi Maru — small island ro-ro

Original standalone model: `komachi-island-ferry.glb`. No game replacement or simulation changes.

- Hull: 2.10 long along Z, 0.95 wide along X, hull top at Y=0.22.
- Waterline: Y=0; shallow keel reaches Y=-0.12. Deck surface: Y=0.24.
- Bow: +Z. Root translation/rotation are zero, scale is 1; no 1.3 scale baked in.
- Open single-lane deck; first car centre `[0, 0.24, 0.72]`, then Z=0.30 and Z=-0.12.
- Compact two-storey stern wheelhouse, cream walls, sage roof, banded funnel, mast, life ring and 小町丸 name boards.
- Matte palette vertex colours, no textures. 2,708 triangles total, including the ramp.
- Full closed bounds including fenders and ramp stiffeners: approximately 0.970 wide × 1.160 high × 2.147 long. Hull itself retains the requested 0.95 × 2.10 plan.

## Root extras

The named root node `Komachi_Island_Ferry` contains glTF extras (Three.js `userData`):

```json
{
  "deck": [0, 0.24, 0.72],
  "rampPivot": [0, 0.24, 1.05],
  "wakePoint": [0, 0, -1.05]
}
```

With `GLTFLoader`, find this named node beneath `gltf.scene` to read its extras.
Car spacing is 0.42 along -Z. The deck coordinate is the wheel contact plane; allow for the vehicle model's own origin.

## Ramp hinge

`Ramp` is a separate mesh, directly under the named root. Its origin is on the bow hinge at `[0, 0.24, 1.05]`.
The platform is 0.50 wide × 0.80 long, extending along local +Z before rotation.

- Exported closed: `Ramp.rotation.x = -Math.PI / 2`.
- Lowered level: `Ramp.rotation.x = 0`.
- Lowered tip: `[0, 0.24, 1.85]` in root space.
- Positive X angles lower the outer end below the deck. Match the berth slope as needed.

No animation clips, vehicles, wake geometry, water plane or driving logic are baked in.
The existing game ferry uses +X-forward and different ramp rotation conventions; later integration must adapt those to this asset's requested +Z convention.

## Rebuild and inspect

- Source: `src/island-ferry-model.js`, exporting `createIslandFerry()`.
- Export: `node scripts/build-island-ferry.mjs`.
- Validate and render: `node scripts/preview-island-ferry.mjs`.
- Interactive viewer: `npm run dev`, then `/docs/island-ferry-preview.html`.
- Renders and validation: `docs/island-ferry/`.

The viewer can lower the ramp, show the keel, and display three preview-only kei silhouettes (0.20 wide × 0.36 long) to inspect lane fit. These cars are not exported.
