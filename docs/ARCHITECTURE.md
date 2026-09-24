# Architecture

Komachi is a single-page Three.js app with no framework. Modules under `src/` import each
other in one direction; the only shared mutable values live in `state.js`.

```
palette ─┐
utils ───┼─► geometry ─► scene ─► buildings ─► world ─► sim ─► daynight
state ───┘                                        │        │        │
                                                  └────────┴─► ui ─► input ─► main
toast (standalone, used by sim, input, main); milestone (scene only, used by main)
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
(roof, wall, awning), a family name, a construction stage (0–3) and a level (1–3). Streets come
first: the player draws them (`drawRoad`, an L-shaped run of `drawn` cells; `eraseRoad` removes one
unless `roadKeepReason` says a building relies on it) and a block is zoned on empty cells beside a
street (`placeable`: every cell needs a road 4-neighbour on its level). `block.street` lists the
road cells the block touches (`frontRoads`) and doors face them. `rebuildNetwork` then lets the hill
connector add slopes and links for terrace streets and `connectCanal` settle bridges. Roads are never
built over; the station's ring is the first street.

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

**Canal and coast road (Phase 4.5).** `island.js` lays both from the seed as sets of cell keys. The canal is a
bowed curve on the pier's side, sampled every four units and joined by L-shaped runs (grid features cannot
run diagonally without a staircase), rejected and re-tried if it touches the hill or comes within 7.2 of the
station. Canal cells are type `canal` with `c.canal`; the channel (bed, water, walls on sides without a
canal neighbour, reeds, heron) is one static mesh sitting on the solid land mesh, so the water is at y 0.02.
`connectCanal` in world.js (from `placeBlock` and `removeBlock`) turns a canal cell into a road with
`c.bridge` when roads face each other across it along an axis, and back again when they do not; the bridge
deck, pavements, railings and piers are drawn in `rebuildRoads`. The coast road is eight stops just inside
the beach joined by L-runs whose corner is chosen inland; its cells are permanent roads (`c.keep`, `c.coast`),
skipped where the hill is, bridges where the canal is. Old saves skip blocks that would land on either.

**Wanderer.** Ambient cars and cats with no home; they drive or stroll between random road cells
to keep the streets alive.

## Buildings

`buildings.js` picks a generator from the block's type and the unit's `variant` (residential:
detached / narrow / terrace / apartment / manshon) or the block's `kind` (shops: café, bakery, ramen,
grocery, konbini, florist, books, restaurant, supermarket, arcade; workspaces: office, workshop, studio,
factory). `TIERS` in `world.js` maps a block's cell count (1–3) to the pool its kind or variant is drawn
from, `tierLabel` describes a tier for the drag label, and `CAP_BONUS` adds capacity per kind. All
units of a block share one variant; multi-cell generators use the unit's index in the block (lobby on
the middle unit, chimney or stair core on an end). Generators are built from the
shared parts in `kit.js` and must set `u.door` so trips start and end at the right doorstep.
Roof style (kawara, tile or metal) and wall colour are chosen per block; small details (bicycles,
pots, signs) vary per unit from its seed; `sub(seed, k)` derives further independent values from it, which pick a
detached home's style (cottage, machiya, modern), a shop's wall finish, awning shape and sign, and an office's
facade (glass, punched, louvre). The kit's finishes are `slatWall`, `tileBand`, `corrugated`, `boxCanopy`,
`hangingSign`, `dish`, `latticeWindow`, `engawa` and `hisashi`. `kawaraRoof` builds the tiled roofs (courses, ridge cap,
optional irimoya skirt); `blockWall`, `genkan`, `tateKanban`, `noren`, `chochin` and `laundry` are
the Japanese identity parts. Laundry geometry is merged into its own mesh (`u.laundry`) so
`daynight.js` can show it only between 08:00 and 17:00. Street furniture (stop marks, kerb lines,
post boxes, hokora, pole transformers, guard rails) is generated per road cell in `rebuildRoads`;
pocket parks, pruned pines and bamboo in `rebuildDecor` (`parkCells` lists the parks).

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

## Ferry

`ferry.js` owns the slipway (the coast-road cell nearest a point a little round the shore from the pier), the
beach landing, the berth and an offshore point, the builders' yard on the inland neighbour cell (`c.yard`, not
zonable or drawable) and the ferry mesh (the Komachi Maru from `island-ferry-model.js`, an original island ro-ro; bow +Z, turned into the +X hull frame). A state
machine `away → arriving → berthed → leaving` follows the `CALLS` timetable in game hours. `sim.js` asks a
registered vehicle source (`setVehicleSource`) for ambient cars and residents' cars instead of creating them; the
ferry queues those requests and puts one ashore every few minutes while berthed (`launch` → `offPath`: deck,
landing, slip cell, then the road network). Excess ambient cars drive to the slip and board (`boardCar`). The
yard's stock mesh is rebuilt when the count of active sites changes, and `construction.js` starts delivery trucks
from the yard (`setYardStart`), falling back to the station side if the yard is cut off from town.

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

## Milestones

`milestone.js` owns one DOM card (`#milestone`) and a camera glide. `announce({ title, line, icon, at, view, onLook })` fills the
card and shows it for about ten seconds; "Go and look" eases `cam.target` and `cam.tView` to `at`/`view` over 1.4 s, holds 5 s
and eases back to the saved view. `updateMilestone()` runs once a frame from main.js; a pointer-down or wheel on the canvas,
or a move key, ends the glide where it is. The module only imports `scene.js`, so any system can raise a milestone through
a hook that main.js wires up. The hill opening is the first: `openHill` in world.js records it in the chronicle and calls
its `onHillOpened` listeners; main.js finds the top of the ramp chain nearest the station and sends the road crew there
(`sendHillCrew` in construction.js keeps them in `hillCrew`, apart from site crews), starts `lightLanterns()` and announces.
The shrine-path lanterns carry their own materials; `updateLanterns()` lights them one by one during the show and otherwise
copies the street lamps' level that daynight.js sets on `lampHeadMat`/`lampGlowMat`.

## Landmarks

`landmarks.js` places the island's landmarks once, after the town has loaded (restored or fresh), from the island and the cells
alone, so a given island gets the same places every session. It imports world.js, island.js and the kit, and sim.js reads
it (never the other way). The lighthouse takes the most seaward rocky cell (then a rocky point, then any shore that is not sand),
kept clear of the hill, the pier, the canal mouths, the slipway and the yard; its lens material is cloned so it can glow, and a
single additive wedge sweeps round at night, dimmed when it points inland. The arched footbridge sits on a straight canal cell
with plain land on both banks and no street within three cells along the canal; the park pavilion takes a plain cell next to a
bank, preferring one with no street beside it, and two cherries are drawn with the decor from `landmarkTrees`.

Every landmark cell carries `c.landmark`; `placeable` refuses them and `drawable` allows only the bridge's banks. Each entry in
`landmarks` describes a visit: an `anchor`, `walk(road)` giving the points from the street's kerb to the spot (trip points
hold height above the ground, so the bridge's rising deck is just higher points), a `hold` range, an `activity`, a `face`
and, for the pavilion, `seats`. In sim.js a dry-weather stroll sometimes becomes `visitLandmark`: the street route to the
nearest street, then the walk points; `atLandmark` holds the walker still (`r.paused`), seats them if there is a free bench,
then walks the points back to the kerb and routes home.

## Tourism

Offline play: the build's `offline` plugin (vite.config.js) writes `dist/sw.js` from `scripts/sw-template.js` with the list of every
built file and the files in `public/` (manifest, icons); main.js registers it in production builds only. The page is fetched network
first so a new deploy shows on the next launch; the hashed files are served from the cache.

`picker.js` sits beside input.js (which calls `pickerForTool` on each tool change and reads `currentPick` to cap the drag and pass
`placeBlock` a preset). It reads world.js tiers and blocks and draws its thumbnails with buildings.js `rebuildUnitMesh` on fake off-grid
units, rendered by a throwaway WebGLRenderer; nothing else imports it except main.js for the dev hooks.

`tourists.js` sits above sim.js, landmarks.js and ferry.js and is driven from main.js (`updateTourists` in the frame loop and in
fastForward). Visitors are plain objects with a character mesh (`userData.tourist`), not residents: they have no home or needs, are
not saved, and are removed at the station or at midnight. `onTrain` queues arrivals on dry mornings; each visitor gets a plan of
one or two landmarks, maybe a shop, then home, and `walkTo` routes them along the streets with `buildPoints` (trip points hold
height above the ground). At a landmark they stand about a cell back from its `target` on dry ground and alternate the
`'camera'` and `'photo'` fidgets that characters.js poses. A shop visit adds to `visitsToday` and `visitScore`, so tourism
shows up in the economy as busier shops and banners.

The bus is found each morning by `findStops`: a ring cell by the station stairs and the lighthouse's street, each with a clear
pavement on the keep-left side for a shelter. At weekends `shipVehicle` (ferry.js) brings it ashore; it dwells at each stop
(boarding visitors waiting there, holding a little for those walking up), drives the path between them with `trafficFactor`, and
after 14:36 heads for the slipway and `boardCar` for the 17:00 sailing.

## Events on the town square

The town square is a civic kind (three cells; `genSquare` draws it). `events.js` keeps the schedule from the calendar alone, so
nothing is saved: the market on Sundays in the morning, the festival on `festivalDay` in the evening. When one is due and a finished
square exists, `setUp` places the festival kit's models in each square cell's own frame (front toward the street) and lists places
to stand on the front half of each cell. sim.js adds a strong option to `decide()` while an event is on, and the visit reuses the
landmark walk (`visitLandmark(r, from, eventVisit())`, with a bag home from the market); tourists.js gives festival visitors an
'event' step. Lantern emissive, one warm PointLight over the square and the fireworks are driven by `updateEvents(dt, realT, night)`
from the main loop and fastForward; `onEventStart` lets main.js show the milestone card for the first festival.
