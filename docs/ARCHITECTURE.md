# Architecture

Komachi is a single-page Three.js app with no framework. Modules under `src/` import each
other in one direction; the only shared mutable values live in `state.js`.

```
palette ─┐
utils ───┼─► geometry ─► scene ─► buildings ─► world ─► sim ─► daynight
state ───┘                                        │        │        │
                                                  └────────┴─► ui ─► input ─► main
toast (standalone, used by sim, input, main)
```

## Core concepts

**Cell.** The island is an `N × N` grid (N = 34) of cells. Each cell is `empty`, `road` or
`lot`. World coordinates are cell-centred: cell `(i, j)` sits at `(i − N/2 + 0.5, 0, j − N/2 + 0.5)`.

**Block.** One drag places one block: 1–3 touching cells that share a zone type, a palette
(roof, wall, awning), a family name, a construction stage (0–3) and a level (1–3). Roads are
written into every empty cell in the block's 8-neighbourhood, so a block is always ringed by
road and never has a road inside it.

**Unit.** Each cell of a block is a unit: it owns a building mesh, its window material, a ground
glow decal and the people currently inside it. Capacities depend on type and level
(`CAP` in `world.js`).

**Station.** A fixed 3×3 block of type `station` placed at the grid centre on start-up
(`placeStation` in `world.js`). The centre cell is the stair entrance; the eight plaza cells hold
benches, vending machines, planters and lamps (`genStation` in `buildings.js`). `STATION` in
`world.js` holds the world-space seat, standing and vending spots. Trips to and from the station
use the south-edge unit as their routing anchor (`STATION.anchor`), since only edge cells touch
the ring road.

**Newcomer.** A resident with `home === null`. `updateStation()` in `sim.js` runs the train
timetable (every 1.5 game hours, 6:00–23:30): passenger count depends on free beds in town and
how many people are already waiting, capped by free seats. Newcomers walk from the entrance to a
seat (a "direct trip" that ignores roads), idle with `waitDecide()`, sometimes visit a vending
machine, and are claimed by `assignHome()` when a finished home has room. Losing a home calls
`returnToStation()`.

**Resident.** Belongs to a home unit, may hold a job at a shop or workspace, and is either
`inside` a unit or on a trip. Decisions are made by `decide()` in `sim.js` when the resident's
`next` time arrives. Trips are lists of world points along road cells with a right-hand offset
(0.34 for walkers on the sidewalk, 0.17 for cars on the asphalt). A trip may instead carry an
`onArrive` callback and two points (`startDirectTrip`) for short walks inside the plaza or a
cross-country move-in when no road connects yet.

**Wanderer.** Ambient cars and cats with no home; they drive or stroll between random road cells
to keep the streets alive.

## Rendering

- Orthographic camera at 38° pitch, yaw in 45° steps, eased toward `cam.tView` / `cam.tYaw`.
- Everything static is merged: roads, vegetation and lamp posts each become one mesh with
  vertex colours (`mergeMesh` in `geometry.js`). Building units are one merged mesh each plus a
  separate window mesh (per-unit emissive material) and a glow plane.
- `mergeGeometries` requires all inputs to be either indexed or non-indexed, so `mergeMesh`
  converts everything to non-indexed first.
- Lighting: hemisphere fill + one shadow-casting directional light that moves along a sun arc by
  day and parks as a moon at night. Materials are matte (`roughness 0.95`).
- "Pixel look" renders at half resolution with `image-rendering: pixelated` on the canvas.
- Night: `daylight()` returns 0–1. Sky, fog and light colours lerp toward cool blues; window and
  lamp emissive intensities and additive glow decals scale with `1 − daylight`.

## Time

`S.T` is game time in hours. One game day is four real minutes at 1×
(`HPS = 0.1` hours per second). Construction takes 3 + 5 + 6 game hours and slows to 35 % at
night. Growth needs about 20 occupied game hours plus a big enough town (`growthAllowed`).

## Routing

Breadth-first search over road cells, multi-source to multi-target, with an `Int32Array`
parent map so it allocates nothing per query. Results are cached per unit pair and the cache is
cleared whenever roads change (`onWorldChange`).

## Dev hooks

`window.MT` exposes `placeBlock`, `removeBlock`, `fastForward(hours)`, `setHour`, `setSpeed`,
`project(i, j)` (cell → screen coordinates) and more. `scripts/smoke.mjs` uses them to drive
the game headlessly. `?demo` in the URL builds a small town and fast-forwards a day.

## Adding things

- **A new building detail:** edit `genResidential`, `genShop` or `genWork` in `buildings.js`.
  Push vertex-coloured geometry into `g` (body) or `wg` (windows, lit at night).
- **A new activity:** add to the `*_ACTS` lists in `sim.js`; `decide()` picks from them.
- **A new colour:** add it to `PAL` in `palette.js` and nowhere else. Keep saturation low.
