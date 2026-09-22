# Komachi — notes for Claude

Komachi (小町, "small town") is a cosy observational city diorama: vanilla JS + Three.js + Vite,
no framework, no 3D assets. Everything is generated from boxes, prisms and dodecahedra.
The player zones blocks; the simulation does the rest. Design rule for every feature:
**if a system changes something, show it through residents, buildings, vehicles or light, not a number.**

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # required before npm test
npm run lint       # ESLint, must be clean (no-undef is an error)
npm test           # scripts/smoke.mjs: headless Chromium over dist/, 35 checks + screenshots in scripts/out/
```

Always run lint → build → test after changes, then eyeball `scripts/out/day.png` and `night.png`.
`npm test` needs Edge or Chrome (`BROWSER_PATH` overrides; a Playwright Chromium under `%LOCALAPPDATA%/ms-playwright` is picked up too, useful when Edge headless breaks, as it did on 2026-09-17). CI (`.github/workflows/ci.yml`) runs
the same on Ubuntu; it is slow (software GL), so tests must poll, never sleep for a fixed time.

## Layout

`index.html` is the UI shell; `src/styles.css` all styling; modules under `src/` import in one
direction (see docs/ARCHITECTURE.md for the graph). Shared mutable state lives only in
`src/state.js` (`S.T` game hours, `S.speed`, `S.nextId`, `S.pixelLook`, `S.seed`, `S.biome`).

Key modules: `world.js` (grid, roads, blocks, station), `island.js` (coastline, land/water test),
`biome.js` (theme data), `buildings.js` + `kit.js` (procedural buildings), `sim.js` (time, routing,
residents, trains), `construction.js` (crews, trucks), `daynight.js`, `ambient.js`, `ui.js`, `input.js`.

## Conventions

- Colours come from `PAL` in `src/palette.js` only, desaturated. See docs/ART_DIRECTION.md.
- Static geometry is merged (`mergeMesh`) with vertex colours; per-unit only the window mesh and glow.
  `mergeGeometries` needs all-indexed or all-non-indexed; `mergeMesh` converts to non-indexed.
- Building generators must set `u.door` so trips start on the doorstep. Front is local +z.
- `DONE` (5) in world.js is the finished stage; never compare against a literal stage number.
- Heights: asphalt top 0.08, sidewalk 0.10, plinth 0.12, all relative to the cell's ground `c.h`
  (0 on the flat, `level × 0.55` on hill terraces). Trip points hold height above ground; `moveAlong`
  adds `terrainY(x, z)`. Never set a walker's y from a constant without adding `terrainY`.
  Cars keep left; walkers pick one sidewalk. Vehicles persist: `carAt`/`bikeAt` say where a resident's
  vehicle is parked (`parkVehicle`: bikes on the plot, cars at the kerb of the street in front), and
  `userData.parked` vehicles are ignored by traffic.
  Car parks are the player's (Parking tool, key 7, decided 2026-09-22 over an automatic claim): `placeCarPark(sel)` in world.js marks
  `c.park = 'public'` (`c.parkRoad` = entry street, list `carParks`), `parkBay(c, k)` places four nose-in bays, `parkVehicle` in sim.js uses
  the nearest car park within `PARK_REACH` (6) cells before the kerb, `b.kerbFull`/`b.parkHint` drive the card line and the one-off notice,
  `removeCarPark` (sim) re-parks the cars. `STATION.taxiPark` is the taxis' automatic car park across the ring road. Saves v3 carry parks. Signals:
  `signalCells` in world.js, one town-wide phase on `S.T`; `trafficFactor` in sim.js does queueing,
  give-way and red lights.
- Time: `S.T` in game hours, `HPS = 0.1` hours per real second. One day ≈ 4 real minutes.
- People are Kenney Mini Characters by default (CC0, `assets/characters/kenney/`, adopted 2026-09-17);
  `?boxes` brings back the original box people. Loaded via `src/characters.js`: atlas baked to vertex
  colours, parts classified and repainted per person. `new THREE.Color(hex)` is already linear; never call
  `convertSRGBToLinear` on it (canvas pixels are sRGB and do need it). The GLBs reference the atlas by a
  relative path, so the loader's URL modifier points them at the bundled copy.
- Vehicles are Kenney Car Kit models via `src/vehicles.js` (same atlas-bake and repaint idea; `attachVehicle`
  fills a +z-forward group; box cars are the fallback). Kinds: kei, hatch, suv, van, truck, taxi, delivery, garbage.
- Ferry (Phase 5, `src/ferry.js`): the Komachi Maru from src/island-ferry-model.js (bow +Z, wrapped in an inner group turned +PI/2 so the
  sim's +X hull frame still holds; `Ramp` rotation.x between RAMP_UP and RAMP_DOWN; deck from the model's `userData.deck`). Cars arrive/leave by sea. sim.js never creates ambient or resident cars itself when a
  vehicle source is registered (`setVehicleSource`); `r.carOrdered` marks a car awaiting the next sailing. Trucks start at
  the yard (`setYardStart`) with a station fallback. `c.yard` and `c.slip` cells (yard, slip road cell and the lane's ground) are neither zonable nor drawable. The slip is chosen lane-first (`layout` in placeSlip): a straight
  coast-road cell whose grid lane reaches water within 2.5 units, landing on a sand/grass shore (`shoreKind` not rock at ±0.1 rad), clear of the pier
  (0.45 rad) and every canal mouth (0.55 rad), with no `seaRocks` boulder within r+0.9 of the berth or sailing line; landing, berth and horizon are
  measured from the beach edge (`beachExtra`). The lane is real road cells (`c.slip`, `c.keep`, up to six, every cell whose centre is on land) ending at
  `ferry.lane`; `ferry.laneEnd` is its far kerb, a flat strip bridges any gap to the land edge `ferry.edge`, and the concrete slope runs from there to the landing;
  launches, boarding and the trucks' yard start from the lane end. Grid directions only, never radial. Departure: astern, a turn about, away bow first with a fade (`setFade`, transparent only mid-fade). Timetable `CALLS`
  in game hours; `nextCall` re-syncs if the clock jumps (tests use setHour).
- Hand props: `src/character-props.js` (`equipCharacterProp(char, kind, color)` / `clearCharacterProp`, field `char.accessory`,
  kinds shopping-bag | briefcase | umbrella | folder), the tea can via `holdItem`, and `src/hand-items.js` (wraps the modelled src/phone.js and src/newspaper.js as `userData.handItem` Groups; held in the character group like the tea can, placed
  per frame in characters.js with `aimArm` from tea-can.js pointing the arms at them).
  Bench life: `tickSitter` in sim.js runs for seated residents (`r.fidget = {kind, until, base, at, partner}`, kinds phone | paper | stairs |
  stretch | chat); characters.js reads `char.fidget` (phone | paper | nod) and `char.gaze` (radians) on top of the sit clip. `clearFidget` on any move. Shoppers leave grocer-type shops
  (`CARRY_HOME` in sim.js) with a bag (`r.bagPending` set on entering) and drop it indoors.
- Hill plot market (Phase 5): `hillMarket` in sim.js at the day's turn places a `villa` (res variant, `villaFor` = household
  id, `summoned: true`) on `hillPlots()` for a settled household and `moveUp`s them when it finishes; a `teahouse` shop kind
  follows once trips end up the hill (`hillVisits`). `layTerraceLane` draws a 3-cell permanent lane from an island slope top
  when the hill has no plots. The demo town's first shop stands beside its side street (streets-first).
- Economy (Phase 5): `reckonShops` in sim.js runs at the day's turn: `visitsToday` → `lastVisits`, `popular` (banners),
  `quietDays` → `changeTrade` (new kind from the tier, `changing` + `renoT` shows shutters). `REACH` per kind scales
  the distance customers will travel. Never let the town's last shops close (needs ≥ 3 shops).
  `chooseKind(type, sel, skip)` in world.js picks the kind of the tier the neighbourhood lacks (new blocks and `changeTrade`);
  `b.popular` adds a striped awning and stock crates, `b.quietDays` closes the shop at 19:00 (daynight + `pickShop`).
  `r.canPending` (konbini) mirrors `r.bagPending`; wanderer trips flagged `delivery` pause at a home's kerb.
- Civic zone (Phase 5.5, tool key 8, type `civic`): `TIERS.civic` = substation | waterworks | recycling on one cell, bathhouse on two or three;
  `CAP.civic` two workers, no level-ups (the growth code only levels res/work); `chooseKind` picks a civic kind the town lacks first;
  `genCivic` draws pad/fence/shed and rebuildUnitMesh attaches the kit model (civic-kit / landmark-kit Groups) plus a notice board on unit 0;
  `CIVIC_ACTS` per kind in sim.js; names in `CIVIC_NAMES`. Effects (`CIVIC_REACH` 6 cells): `refreshCivicFlags` in world.js sets `b.watered`
  on homes near a water works (`wateredGarden` in buildings.js; `r.outside` keeps a resident at the door watering with the watering-can
  prop); daynight.js keeps a `powered` set near substations (steady, warm emissive); `updateCollection` in sim.js runs collection day
  (`b.bags` at the kerb, a `truck` wanderer with a `plan`, `driveTo`); `bathUnits` + purpose 'bath' for evening visits; strolls may
  target a civic corner and hold (`trip.holdAtEnd`) to read the notice board.
  Chronicle: src/chronicle.js (`record(text)`, one line per event, saved as `chronicle`); the community centre card lists the last six.
  Collection morning: `b.bagsDue`/`b.bagsBy`, `carryBags(r)` walks a resident to the kerb with a pale bag before `putBags`.
  Town services (src/town-services-kit.js, `createTownService`): civic kinds townhall (2 cells) | clinic | firestation | community; `chooseKind`
  picks townhall first and keeps townhall/firestation/community single. Registration: `hh.registered` (saved), purpose 'register' →
  `r.folderPending` → the folder prop on leaving; kōban (STATION.anchor) stands in without a town hall. Purposes 'clinic' (energy) and
  'chronicle'. `updateFireRound` runs the kei truck (`w.fire`) at 8:30 and hides `u.parkedTruck` while `b.truckOut`.
- Growth: `maxLevel(b)` in world.js caps houses (detached | narrow | terrace) at two storeys, apartments/manshon at three, civic at one;
  `unitCap` gives a two-storey house 3. Detached generators use `floorY(f)` (ground 0.5, upper `UPPER` 0.4) from buildings.js.
- Size tiers: `TIERS[type][cells]` in world.js is the pool a new block's kind/variant is drawn from (res variants
  detached | narrow | terrace | apartment | manshon; shop kinds add restaurant | supermarket | arcade; work adds factory);
  `CAP_BONUS` per kind/variant; every unit of a block shares the block's variant; multi-cell generators read
  `b.units.indexOf(u)`. The tier label (`#tier`) shows under the tool bar while dragging.
- Detached homes pick a style from the seed (`u.style`: cottage | machiya | modern), shops a finish (`u.finish`), offices a
  facade (`u.facade`); `sub(seed, k)` in buildings.js gives independent per-unit values for details.
- Roof styles: `kawara` (grey tiles, irimoya from level 2), `tile`, `metal`; the kit's Japanese parts are
  `kawaraRoof, blockWall, genkan, tateKanban, noren, chochin, laundry` (laundry goes to the `LG` list, its own mesh).
- Cells: `water | hill | empty | road | lot`; streets first: the player draws roads (`drawn`, permanent) and
  blocks (1–3 empty cells beside a street, one terrace) face them (`block.street` = adjacent roads, `frontRoads`).
  Road flags: `keep` (island), `drawn` (player), `dyn`/`link` (hill slopes/links the town builds), `bridge`,
  `coast`. Roads are never built over; `eraseRoad` refuses a cell a building opens onto (`roadKeepReason`).
  Signals only where two through-streets cross. `hill` cells are the wild wooded ones; terrace plots are plain `empty` with `c.h`.
- Trees and rocks in rebuildDecor come from src/nature-kit.js (addNature(out, kind, x, y, z, scale, seed, color)); its geometry carries
  position/normal/uv/color so it merges with the kit. Paddy is reserved for Phase 7.
  The station pavilion is `createSubwayStation()` from src/subway-station.js, attached in rebuildUnitMesh at plinth height; its
  `STATION_LIGHT_MESHES` are stored as `u.stationLit` and daynight.js copies the window emissive onto them.
  Landmarks come from src/landmark-kit.js (`createLandmark(kind)`, kinds torii | shrine | temple | koban | bathhouse, front +Z, ground 0,
  `userData.entrance`); island.js places the summit shrine set and a torii gate below it. Temple, kōban and bath house wait for Phase 5.5.
  Neighbourhood kits (src/neighbourhood-kits.js, `neighbourhoodGeometry(kind, {x,y,z,rot,scale,sx,sy,sz})` / `addNeighbourhood`): kit.js's
  acUnit, pots, awnings, tateKanban, noren, chochin, hangingSign wrap the kit pieces (`retint` recolours by source PAL colour, e.g. { indigo: color });
  `yardProps` adds mailbox/tap/tank/laundry pole to detached homes; world.js places 'utility-pole' (1.05×) and 'street-lamp' (1.5×).
  Street furniture likewise comes from src/street-furniture.js: addFurniture(out, kind, x, y, z, rot, color) merges; furnitureGeometry returns named
  pieces (the traffic light's Red_Lens/Green_Lens feed lampGeo in world.js). createStreetFurniture stays the standalone mesh export. Bus stop unused.
- Sea life lives in src/sea.js: fish leaps and splashes, the pier boat's wake, a dolphin pod (`pod`, src/dolphins.js) and the waterfall splash
  (`fallFeet` exported by island.js; puffs and mist in `updateSplash`). The ferry's own wake is in ferry.js (`updateWake`).
- Weather (Phase 6, src/weather.js): `W = { kind, until, cover, rain, wind }`, spells clear | cloudy | drizzle | rain (`SPELLS`, `NEXT`), `setWeather(kind, hours)`
  (also a dev hook), `updateWeather(dt, dh)` in the main loop and fastForward; clouds are a pool of 12 invisible shadow-only planes (cloud alpha masks, colorWrite false) at y 6.5 scaled in/out by cover, so only their shade shows,
  rain a LineSegments field round `cam.target`; daynight.js dims/greys by `W.cover` and calls `setWet` (world.js tints the road mesh); sim.js
  equips an umbrella on `startTrip` while `W.rain > 0.25`. Saved as `weather`.
- Tool labels (2026-09-22): Explore, Homes (res), Shops (shop), Work (work), Civic, Streets (road), Parking (park), Clear (remove). Code names are
  unchanged; player-facing strings say "Streets tool" and "Clear".
- Dev hooks on `window.MT` (placeBlock, fastForward, setHour, project, DONE…) drive the tests.
  `?demo` builds a sample town; `?seed=` fixes the island; `?biome=sakura|coastal` themes it.

## Working style

- The user reviews by screenshot. Render with puppeteer-core (see scripts/smoke.mjs for launch
  args) rather than describing what it should look like.
- Multi-line code edits: write a small Node patch script with the Write tool and run it. Bash
  heredocs in this environment have mangled backslashes and quotes more than once.
- Keep CHANGELOG.md (Unreleased section), README.md and docs/ in step with features.
- Fictional names only (shops, station, people). Nothing punitive: no failure states.

## Where things stand (handoff for a fresh session)

Version 0.2 work; a git repo now exists (initialised by the user around 2026-09-16), commit when asked. Phases 1, 2 and 3 are
complete and verified (lint, build, `npm test`, screenshots). Between phases the user asked for and got:
zoning over streets, visible avenue lines, hip-height benches, a clear station entrance, plaza detours,
taller vending machines, a nine-cell station highlight, and a wooded hill with a shrine (the mountain
range that came with it was removed at the user's request). The user's original brief is long;
its essence: observation-first cosy god game set in a Japanese suburb, and every system must show
its effect through residents, buildings, vehicles or light, never only through numbers.
"Everything is optional. Everything creates consequences you can see."

Decisions already made (do not reopen without asking):
- Kenney Mini Characters are the default people (the user chose them over the box people on 2026-09-17);
  `?boxes` keeps the box look, which also remains the fallback if the GLBs fail to load.
- Japan rules: cars keep left; walkers pick one sidewalk, hug corners (mitred offset) and cross at
  the end of the trip; trucks stop on the road, not the pavement.
- Everyone arrives by train. Nobody sleeps on a bench: last train 22:00, back at 06:00. Households
  are booked when their home enters the finishing stage. Builders also come and go by train and
  nothing is built without a crew on site (06:00–18:00).
- Two parallel adjacent road cells form a two-lane avenue, not a doubled road (slope roads and links excepted).
  Since Phase 4.9 (2026-09-21) streets come first: the player draws them with the Road tool and zones beside
  them; the town lays no streets on the flat (a stub-plus-connector version was tried and dropped the same day
  because side-by-side blocks got odd joins). Only the station has a ring. Cables only run along streets
  between poles that share a row/column of road.
- Homes are named after places (Sakura Terrace); shops and workspaces from per-kind pools; all fictional.
- HUD: one slim top bar; view toggles fold behind a sliders button; controls card folds into a help
  icon after 5 s; instant tooltips; progress pills float over sites under construction; notices slide in as a cream
  card under the brand card (top left), never over the town centre.
- Pixel look is off by default (user request 2026-09-17); `S.pixelLook` reads `komachi.pixelLook === '1'` and the
  toggle is remembered once used. `index.html` ships without the `pixel` body class.
- Docs stay full-length (the user reverted an attempt to compact README/CHANGELOG/ARCHITECTURE).
- Phase 3 model: households (`hh` on every resident), needs 0–1 shown only as words, `decide()` scores
  options at `r.next`, trips carry a `purpose`, save slot `komachi.save` (v1) via `src/save.js`;
  `state.js` reads the saved seed before island.js runs. Name-tags toggle removed; tags follow/pin only.

Open threads the user has not decided:
- Pedestrians do not yet wait at traffic lights or cross there; walkers still cross at trip end.
- Nothing else pending from Phase 3; Phase 3.5 (hill terraces) is done.
- Kenney people: watch performance past ~100 people (each is ~1,400 tris); a LOD swap to box people when far is the likely fix.

Phases 4 and 4.5 shipped 2026-09-17 (commuters, parked cars and bikes, taxis, traffic lights, hill unlock;
canal with bridges, coast road). Phase 4.8 (Japanese identity pass) shipped the same day: roof styles are now `kawara | tile | metal`,
`u.laundry` is a per-unit mesh toggled by the hour in daynight.js, `parkCells` in world.js lists pocket
parks. Phase 4.9 shipped 2026-09-21 (streets first: Road tool, zoning beside streets, signals rule, walkers at lights; saves v2).
Phase 4.95 (building variety) shipped 2026-09-21. Next is Phase 5 (economy, size tiers, hill plot
market, car ferry) when the user says go. Cells now also carry `canal | bridge | coast` flags; canal cells are type `canal`. Deliver in the same style: build, verify with screenshots and headless traces (see the
scratch scripts pattern in scripts/smoke.mjs), update CHANGELOG (Unreleased), README, docs, ROADMAP.
Any change to what a resident or block carries must be mirrored in `src/save.js` (bump `v` if the
shape changes incompatibly).

## Roadmap (agreed with the user)

Full detail per phase lives in docs/ROADMAP.md; keep both in step when a phase is ticked. The roadmap also
carries per-phase landmark notes and a cross-cutting "sense of achievement" note (milestones that change the
world, a town chronicle, residents who remember, visible growth, small ceremonies).


1. ✅ Island, Japanese identity, building kit, street props, ambient life, touch basics
2. ✅ Construction stages, crews by train, deliveries, renovation
3. ✅ Resident depth: households, needs, utility decisions, LOD, follow-camera, save/load
   3.5 ✅ buildable hill terraces with slope roads
4. ✅ Station commuting, bikes, taxis, traffic lights, hill unlock at 60 residents
   4.5 ✅ canal with bridges, coast road (overpass/tunnel still optional, not built)
   4.8 ✅ Japanese identity pass: kawara roofs and block walls, signage (noren, chōchin, konbini), street
       details (tomare marks, post box, kōban, pole transformers), pines and bamboo, laundry on balconies
   4.9 ✅ Streets first: the player draws streets (Road tool, key 5) and zones beside them, lights only at
       through-street crossings, walkers wait at the red
   4.95 ✅ Building variety pass: three detached styles, shop finishes/awnings/signs, three office facades, props from the seed
5. ✅ Economy and dynamic business selection (leftovers closed 2026-09-22: neighbourhood kinds, thriving/quiet visuals, cans and deliveries) (✅ size tiers by drag length shipped 2026-09-21: 1/2/3 cells → house/terrace or
   apartments/manshon, konbini/café or restaurant/supermarket or arcade, studio/workshop/factory; ✅ light economy (customers, banners, trade changes) shipped 2026-09-21; ✅ hill plot market and ✅ car ferry with builders' yard shipped 2026-09-21; Phase 5 complete. Next: Phase 5.5 civic zone: villas, tea house, later ryokan; car ferry at
   the pier so cars and vans arrive and leave by sea instead of spawning; taxis are island-based, delivered once)
   5.5 ✅ Civic zone (2026-09-22): substation, water works, recycling centre, public bath, town hall with registration, clinic, fire station,
       community centre with the town chronicle; visible effects only, nothing gated
6. Weather, gentle events, festivals, tourism (slice 1 weather shipped 2026-09-22: spells, clouds with shade, overcast light, rain, umbrellas)
7. Farming and fishing
8. Mobile quality levels, PWA, Electron desktop app
9. Menus, saves UI, photo album, opening cinematic (train scene + iris wipe onto the island)
