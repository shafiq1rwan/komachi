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

**Cell.** The world is an `N × N` grid (N = 40) of cells. Each cell is `water`, `hill`, `empty`, `road` or
`lot`. Which cells are water comes from `island.js`: a seeded radial curve (base radius plus a few
sine harmonics, squashed into a gentle ellipse) defines the coast, and a cell is land only if it
sits at least 0.8 units inside it. The same curve drives the land, beach terrace and foam
extrusions, so geometry and gameplay always agree. `?seed=` fixes the shape.

**Hill and ground height.** `island.js` places a terraced hill opposite the pier. A noisy ellipse
(`hillFrac`, `hillLevel`) assigns each cell a terrace level 0–3 by its centre; terraces are drawn as one
box per cell (earth sides, grass cap) so walls fall on cell edges and every hill cell is flat at
`level × TERRACE` (0.55). `terraceInfo(i, j)` decides what a cell is: a plot (type `empty`, `c.h` set),
wild woods (type `hill`: the summit and about 38 % of cells by hash), or part of a ramp. Ramps are found
along the grid axis from the hill centre toward the town: for each lip, three permanent road cells
(`c.keep`) L → R → H, with `c.ramp = { h0, h1, di, dj }` on R and a wedge under the tilted asphalt.
`ringRoads` gives a hill block one street on its most townward free side (flat blocks keep the full ring). `connectHillRoads` (called from `placeBlock` and
`removeBlock`) then floods each terrace street network; one with no way down gets a town-built slope
(`c.dyn`) at the free edge nearest the station, walking over free or wooded cells of that terrace if the
street itself has no edge, and every slope's ends are linked to the nearest street or slope end on their
level. Town-built slopes and links are ordinary roads and go with the orphans. Hill woods are drawn in
`rebuildDecor` per wild cell (a still mesh, since the sway shader keys on absolute height), so a wild cell
turned road loses its trees.
`terrainY(x, z)` in `world.js` returns the ground under any point (terrace height, or a linear slope
across a ramp). Trip points carry only their height above the ground; `moveAlong` adds `terrainY`
every frame, so walkers, cars, trucks and builders climb the slopes for free. Everything static that a
road cell adds (asphalt, pavements, lamps, poles, cones) is translated by `c.h` after it is built, and
unit groups sit at `c.h`. `placeable` requires one terrace per block and refuses ramp cells.

**Biome.** `biome.js` is data only: grass and sand colours, tree colour set, pine and blossom
ratios, shoreline bias. Everything that draws vegetation or terrain reads from it.

**Block.** One drag places one block: 1–3 touching cells that share a zone type, a palette
(roof, wall, awning), a family name, a construction stage (0–3) and a level (1–3). Roads are
written into every empty cell in the block's 8-neighbourhood, so a block never has a road inside
it. A block may be zoned over existing road cells (`placeable` in `world.js`): the cell becomes a
lot, neighbouring roads stay, and `onWorldChange` clears route caches and ambient traffic on the
lost cells. The station's ring road cannot be built over, and every cell needs a road or empty
4-neighbour outside the selection so its door has a street to face.

**Unit.** Each cell of a block is a unit: it owns a building mesh, its window material, a ground
glow decal and the people currently inside it. Capacities depend on type and level
(`CAP` in `world.js`).

**Station.** A fixed 3×3 block of type `station` placed at the grid centre on start-up
(`placeStation` in `world.js`). The centre cell is the stair entrance; the plaza cells hold two
benches on the north edge (the south, in front of the stairs, is kept clear), vending machines, planters and lamps (`genStation` in `buildings.js`). `STATION` in
`world.js` holds the world-space seat, standing and vending spots. Trips to and from the station
use the south-edge unit as their routing anchor (`STATION.anchor`), since only edge cells touch
the ring road.

**Newcomer.** A resident with `home === null`. `updateStation()` in `sim.js` runs the train
timetable (every 1.5 game hours, 6:00–23:30): passenger count depends on free beds in town and
how many people are already waiting, capped by free seats. Newcomers walk from the entrance to a
seat (a "direct trip" that ignores roads), idle with `waitDecide()`, sometimes visit a vending
machine, and are claimed by `assignHome()` when a finished home has room. Losing a home calls
`returnToStation()`.

**Resident.** Belongs to a household and a home unit, may hold a job at a shop or workspace, and
is either `inside` a unit or on a trip. Decisions are made by `decide()` in `sim.js` when the
resident's `next` time arrives (see Needs and decisions below). Trips are lists of world points along road cells (`buildPoints`): routes begin and end on the road
cell in front of the door (`frontRoad`); walkers pick the sidewalk nearest their start (offset 0.34),
follow it with mitred corners, and cross perpendicularly in the last cell if the destination is on
the other side; cars keep left (offset 0.17, lane −1). Trips to or from a building begin and end at its front door: `unitDoorPoints()` in `buildings.js` returns the doorstep (on the plinth) and the kerb (on the sidewalk), rotated by the unit's facing. Cars stop at the kerb. A trip may instead carry an
`onArrive` callback and two points (`startDirectTrip`) for short walks inside the plaza or a
cross-country move-in when no road connects yet.

**Household.** People who live together (`households` in `sim.js`): `{ kind: solo | couple | family |
flatmates, size, surname, members, home }`. When a home enters its finishing stage, `splitHouseholds`
breaks its beds into households and books them (`bookings`); the next train carries each booked
household whole, and `updateBlocks` moves the household booked for a unit in as one. Singles arriving
for free beds are grouped the same way. A household that has waited more than three hours for a home
big enough may `splitOff` members into a household of their own.

**Needs and decisions.** Each resident has `needs` (energy, food, fun, social, supplies) in 0–1.
`tickNeeds` drains them by elapsed game time and refills them according to `actKind` (sleep, home,
work, eat, shop, visit, stroll, wait). `decide()` runs only when `r.next` arrives: it builds a list of
options (sleep, work, lunch break, meal at home, meal out, groceries, stroll, visit, potter at home),
scores each by how much it answers the strongest need plus how well the hour suits it and a little
noise, sorts, and runs the first that succeeds. Trips carry a `purpose`; `enterUnit` turns it into an
activity with an `until` time. `moodWords` turns needs into words for the cards.

**Simulation LOD.** `updateResidents` projects each walker every twentieth frame; those off screen or
seen from beyond `cam.view` 34 are `far` and bank their distance, moving in one step every sixth frame
with no bob. Decisions were already interval-based, so nothing thinks per frame.

**Save.** `save.js` writes one snapshot to localStorage (`komachi.save`) every half game hour and on
`pagehide`: blocks with palette/stage/level and per-unit variant and facing, households, residents
with needs and references to home and job. `restore()` re-places blocks through `placeBlock(type,
sel, preset)`, then rebuilds households and residents; nobody is restored mid-trip. `state.js` reads
the saved seed and biome before the island is built, unless `?seed=`, `?new` or `?demo` is present.

**Commuting and vehicles (Phase 4).** `r.commuter` residents (a quarter of movers-in, plus anyone who finds
no local job) go to the station at `workStart` with purpose `commute`, become `away` with `returnAt`, and
ride back on the first train after it; `updateStation` lists them among the returners. A resident's car and
bike are meshes that persist: `parkVehicle` places them in one of four plot slots beside the unit
(`carAt` / `bikeAt` say where they are), `startTrip` drives or rides only from where the vehicle is parked
and starts the route at the parking spot, and parked vehicles are ignored by `trafficFactor`. Two taxis
(`taxis` in sim.js) wait at the plaza's south edge; `assignHome` puts a household onto one when the route
is seven cells or more, `updateTaxis` drives it out, drops everyone with `enterUnit`, and brings it back.

**Traffic lights.** `rebuildRoads` marks every crossroads (four open arms, no avenue, no slope) in
`signalCells` and builds a pole with a head per axis; the lamps are four merged meshes sharing four emissive
materials, since every signal in town runs on one phase. `updateSignals` reads game time (period 0.05 h),
so lights keep cycling through fast-forward, and `trafficFactor` stops a vehicle short of a signalled cell
ahead when its axis is red.

**Hill unlock.** Terrace plots are unbuildable (`placeable`) and the island's slope roads are wild `hill`
cells until `openHill()` runs, which `updateBlocks` calls at `HILL_UNLOCK` (60) housed residents: the slope
cells become roads, stone lanterns with lamp-style glows are added along the shrine path, and the save
records `hillOpen`.

**Wanderer.** Ambient cars and cats with no home; they drive or stroll between random road cells
to keep the streets alive.

## Buildings

`buildings.js` picks a generator from the block's type and the unit's `variant` (residential:
detached / narrow / apartment) or the block's `kind` (shops: café, bakery, ramen, grocery,
konbini, florist, books; workspaces: office, workshop, studio). Generators are built from the
shared parts in `kit.js` and must set `u.door` so trips start and end at the right doorstep.
Roof style (tile or metal) and wall colour are chosen per block; small details (bicycles,
pots, signs) vary per unit from its seed.

## Construction

Blocks carry `stage` (0–4 building, `DONE` = 5) and `stageT` crew-hours into the stage. `sim.js`
advances `stageT` by `progressRate(b)` each game hour; `construction.js` installs that rule (0 with
no builders on site, 0.8 with one, 1.2 with three) and owns the builders and trucks. Builders are
not residents: they ride in on `onTrain`, walk to the site and then loop through stage-specific
tasks (`planTask` / `runTask`: steps of walk-to → take tool → do a motion for a while), each
nudged by their crew slot so three builders spread out; they leave at 18:00 and come back on the first morning train; when the site finishes
they walk to the station and are removed. Trucks are plain meshes driven along `buildPoints`
routes from the station road to the site kerb and back. Households are summoned when a home
enters the finishing stage. `renoT` puts a scaffold overlay on a finished building after a level-up.

## Rendering

- Orthographic camera at 38° pitch, yaw in 45° steps, eased toward `cam.tView` / `cam.tYaw`.
- Everything static is merged: roads, vegetation and lamp posts each become one mesh with
  vertex colours (`mergeMesh` in `geometry.js`). Building units are one merged mesh each plus a
  separate window mesh (per-unit emissive material) and a glow plane.
- `mergeGeometries` requires all inputs to be either indexed or non-indexed, so `mergeMesh`
  converts everything to non-indexed first.
- Vegetation and shoreline reeds use `swayMat`, a vertex-colour material whose vertex shader
  offsets points above knee height by a time-based sine, so trees move in the wind for free.
- `sea.js` is pure scenery driven by real time: three foam bands beyond the beach whose opacity cycles in
  turn, a pool of four jumping fish on sine arcs with expanding splash rings, a school of eight dark discs
  wandering along the coast, and the fishing boat model on an elliptical circuit five cells beyond the
  coast with bob, roll and a wake plane.
- Utility cables are one `LineSegments` mesh rebuilt with the roads; each pole links to its two
  nearest neighbours with a sagging 8-segment curve.
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
- **A new activity:** add an option in `decide()` in `sim.js` with a score built from a need, give it an
  `actKind` that `tickNeeds` refills, and labels in the `*_ACTS` lists.
- **A new colour:** add it to `PAL` in `palette.js` and nowhere else. Keep saturation low.
