# Komachi neighbourhood kits

19 standalone low-poly GLBs in the town's muted palette. Original Komachi models designed to
complement the Kenney characters; these are not official Kenney assets. The bicycle reuses the
existing Komachi city bicycle. This delivery adds models only, with no changes to game placement.

## Utility — 3 models

- `utility/komachi-utility-pole.glb`: tapered concrete pole, braced crossarm, porcelain insulators,
  transformer drum with bushings and short leads, mounting bands, steps, identification plate,
  and attached street lamp. Three wire anchors are recorded in the root's extras.
- `utility/komachi-street-lamp.glb`: complete metal pole, angled arm and bevelled lamp housing.
- `utility/komachi-street-lamp-head.glb`: separate housing, underside lens and mounting stub.

## Shop facade — 8 models

- `shop-facade/komachi-noren.glb`: five split cloth panels, shallow folds, rod and cream crest.
- `shop-facade/komachi-chochin.glb`: faceted paper lantern with raised ribs, caps and hanging loop.
- `shop-facade/komachi-tate-kanban.glb`: tall timber standing sign with a steaming-bowl motif.
- `shop-facade/komachi-awning.glb`: sloping striped canopy, valance and supporting brackets.
- `shop-facade/komachi-a-board.glb`: braced timber A-frame with menu marks and hinge bar.
- `shop-facade/komachi-hanging-sign.glb`: metal wall bracket, hanging rings and framed sign.
- `shop-facade/komachi-drink-crates.glb`: three lattice crates with eighteen capped bottles.
- `shop-facade/komachi-menu-stand.glb`: tilted menu board on a weighted metal pedestal.

Sign graphics are geometric symbols and abstract menu lines, not readable Japanese text.

## Home yard — 8 models

- `home-yard/komachi-wall-gate.glb`: block wall sections, coping, decorative recesses and a
  metal gate. `Gate` is a separate mesh with its origin at the left hinge; rotate its local Y
  to open it. The clear opening is 0.229 game units. No animation clip is supplied.
- `home-yard/komachi-mailbox.glb`: post-mounted mailbox, rain cap, slot, nameplate and lock.
- `home-yard/komachi-potted-plants.glb`: three pots with soil, layered leaves and pink flowers.
- `home-yard/komachi-laundry-pole.glb`: twin poles, concrete feet, two rails, three towels and
  six pegs. `Laundry_Cloth_And_Pegs` is separate from `Laundry_Frame` for visibility control.
- `home-yard/komachi-air-con.glb`: outdoor compressor unit with concentric fan grille,
  vent slats, service label, feet and side pipes.
- `home-yard/komachi-bicycle.glb`: existing city bicycle, including basket, mudguards and rack.
  Wheel and crank nodes are preserved; this copy is a static export without animation clips.
- `home-yard/komachi-kerosene-tank.glb`: raised domestic tank, filler, vent, gauge and outlet.
- `home-yard/komachi-garden-tap.glb`: standpipe, tap handle, downturned spout and drained basin.

## Placement and rendering

Y-up, +Z front, bottom at Y=0, dimensions in the game's existing scale. The bicycle's +Z is
its travel direction. The preview enlarges models individually; the GLBs retain their real
relative sizes. Pole height is about 1.16, street lamp 0.87, mailbox 0.28 and bicycle 0.25.
Exact sizes and triangle counts are in `manifest.json`.

Facade pieces are bottom-aligned like the ground props. Position them at the desired height
on a building. `mountPoint` in root extras identifies attachment points where supplied.
The hanging sign's wall plate is at its left end; rotate the whole model for the chosen facade.
Utility `wireAnchors` are local positions for later street-span cables. No long cables are
included because their length depends on placement. `lightPoint` and `waterPoint` are supplied
on the full street lamp and garden tap respectively.

GLBs contain geometry and matte vertex-colour materials with no external textures. Static parts
are merged except the gate, laundry and existing bicycle mechanisms. Lamps and lanterns have no
active light or emissive behaviour. No physics, interactions, cloth motion or sound are supplied.

Source: `src/neighbourhood-kits.js` (`NEIGHBOURHOOD_KITS`, `createNeighbourhoodProp(kind)`).
Export: `node scripts/build-neighbourhood-kits.mjs`.
GLB validation and front/rear renders: `node scripts/preview-neighbourhood-kits.mjs`.
Interactive viewer: `docs/neighbourhood-preview.html`, served through Vite.
