# Everyday carry props

## Outdoor set

Three additional original props fit the same Kenney hand attachment helper:

| Asset | Detail | Triangles |
| --- | --- | ---: |
| `komachi-broom.glb` | Wooden shaft, sage binding, flared straw bundles and hanging loop | 316 |
| `komachi-fishing-rod.glb` | Tapered rod, cork grip, reel, guides, line and float | 1,200 |
| `komachi-watering-can.glb` | Open container, carry arch, rear handle and perforated rose | 674 |

Use `equipCharacterProp(char, 'broom' | 'fishing-rod' | 'watering-can', optionalColor)`.
The existing character update places them at the palm in carrying poses. The source is
`src/outdoor-props.js`, exposed through `src/character-props.js`. All assets use game units,
Y-up, vertex colours and a grip at the origin. No external textures are required.

`Fishing_Line` is a separate mesh so a future casting system can replace or hide it.
The watering can provides `userData.pourPoint` in local coordinates for a future water effect.
These are static carry props; sweeping, casting and watering activities are not implemented here.

Export with `node scripts/build-props.mjs`. View `docs/outdoor-props-preview.html` through Vite,
or run `node scripts/preview-outdoor-props.mjs` for export and walking-clearance checks plus images.

Four original, matte low-poly accessories sized for the game's Kenney Mini Characters at scale 0.46.
Each GLB is standalone with vertex colours and no external textures. +Y is up; the origin is the grip.

| Asset | Detail | Triangles |
| --- | --- | ---: |
| `komachi-shopping-bag.glb` | Open paper bag, double handles, folded rim, simple emblem | 252 |
| `komachi-briefcase.glb` | Carry handle, lid seam, twin clasps, reinforced corners | 144 |
| `komachi-umbrella.glb` | Alternating panels, underside ribs, shaft and J handle; open/close clips | 948 |
| `komachi-folder.glb` | Folder tab, exposed papers, document marks and label | 96 |
| `komachi-tea-can.glb` | Curved TEA sticker, leaf emblem, silver rims and pull tab | 1,250 |

The tea can is 0.048 wide and 0.0732 high, centred at its body. `src/tea-can.js` exports
`createTeaCan()`; pass the result to the existing `holdItem(char, can)` helper and set
`char.pose = 'drink'`. The character update aligns the top rim to the animated mouth during sips,
then lowers the can. `dropItem` removes and disposes it. Station vending-machine drinks already
use it. The can GLB is a static prop; the drinking motion belongs to the character.
Build with `node scripts/build-tea-can.mjs`; verify/render with `node scripts/preview-tea-can.mjs`.
The sticker and lettering are geometry with vertex colours, so no external image is required.

## Game attachment

`src/character-props.js` provides `createCharacterProp(kind, color)`, `equipCharacterProp(char, kind, color)`,
`clearCharacterProp(char)`, `setUmbrellaOpen(prop, boolean)`, and `umbrellaClips()`.
The supported kinds are `shopping-bag`, `briefcase`, `umbrella`, and `folder`.

Call `equipCharacterProp` after `attachCharacter` has returned a loaded Kenney character. The existing
character update loop follows the right palm, keeps the prop upright and poses the arm for the folder
or umbrella. Clearing/replacing a prop disposes its resources; character removal clears it too.
Use one accessory per character. Clear accessories before cycling, construction, or another hand action.
These helpers use the actual palm position, independently of the older tool/can attachment helper.

The assets and attachment support are ready; automatic shopping/work assignment, weather decisions
and registration-trip triggers are left to their respective gameplay phases. No save format changes.

## Umbrella

The canopy opens and closes over 0.6 seconds using the `open` and `close` GLB clips. Play these once
and clamp at the end. Shaft and handle remain fixed; the panel/rib group folds into a narrow bundle.
This is a stylized folding animation, not a mechanical umbrella simulation.

## Build and preview

- `node scripts/build-props.mjs` exports all four assets.
- `node scripts/preview-props.mjs` loads the exports, checks folding, attachment, walking clearance,
  and disposal, then writes screenshots under `docs/props/`.
- Serve `docs/props-preview.html` with Vite to orbit the models, switch between character/prop views,
  walk, and open/close the umbrella.
