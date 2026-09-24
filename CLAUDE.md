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
npm test           # scripts/smoke.mjs: headless Chromium over dist/, 59 checks + screenshots in scripts/out/
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

- The standard look is the rich one (decided 2026-09-23; see docs/ART_DIRECTION.md): muted fresh colours, AO, light tilt-shift, calm bay water,
  stone waterfront; classic (pastel, flat) stays one click away. Colours come from `PAL` in `src/palette.js`; the rich overrides still sit
  beside their code (geometry.js `colorize`, rich-buildings.js, rich-streets.js, water.js, daynight.js `RICH`) and belong in PAL when next touched.
  No surface train or railway anywhere: the underground line at Komachi Station is the only railway (the user removed a coastal one 2026-09-23).
- Static geometry is merged (`mergeMesh`) with vertex colours; per-unit only the window mesh and glow.
  `mergeGeometries` needs all-indexed or all-non-indexed; `mergeMesh` converts to non-indexed.
- Building generators must set `u.door` so trips start on the doorstep. Front is local +z.
- `DONE` (5) in world.js is the finished stage; never compare against a literal stage number.
- Towns and menus (Phase 9 slice 1, 2026-09-24): src/slots.js (imports nothing; state.js reads `activeIsland()` before the island is
  built): `komachi.slots` index (name, seed, biome, day, pop, savedAt), `komachi.slot.<id>` snapshots, `komachi.active`; `scratch` slot
  for tabs opened with ?demo/?new/?seed (sessionStorage `komachi.scratch`); the old `komachi.save` migrates into the first town.
  save.js writes `writeSlot(activeId())`; `holdSaves()` before any town switch (else the pagehide autosave writes this town into the
  next one's slot). src/title.js: the full-screen #menu (background assets/backgrounds/komachi-menu.jpg, a JPEG of docs/backgrounds' PNG; the wordmark
  assets/brand/komachi-wordmark.png; #btn-options is hidden, the Settings card opens only as the menu's Settings page), pages
  main | towns | new | settings | help in `.mm-page`; mode 'title' or 'pause' (pause shows only Resume, Settings, Save and quit);
  the Settings page moves the #options card in (class in-menu) and back; `initMenus` from main.js (title on a plain visit,
  skipped after sessionStorage `komachi.enter` or in scratch tabs), `openMenu`/`closeMenu`/`menuOpen` (input.js Esc), `openNew`.
  body.menu-full hides the HUD and main.js skips drawing (one frame for `captureThumb` when `thumbDue`); slot summaries carry the
  thumbnail, time, season, homes, jobs, trains. Switching town or raising another island reloads the page.
- Kitsune (2026-09-24, src/kitsune.js): the fox GLB (assets/characters/fox, only the .glb tracked) at SCALE 0.4 (about 0.12 tall);
  `buildFox(stone)` regroups the flat mesh list into Fox_Head / Fox_Tail / leg pivots, `poseFox(root, walk|sit|stand, dt)`; `route()` follows
  hillCentre (summit, stairs as a straight slope from `edge` over 0.44, the torii foot), `ground()` adds the asphalt on road cells;
  `updateKitsune(dt, simDt)` in the main loop and fastForward: 70 % of dawn (5.2–6.3) and dusk (17.4–18.5) slots once `hill.open`;
  the first visit records "A fox was seen at the shrine on the hill" and announces; `placeStatues` once that chronicle line exists.
  Dev hooks `MT.callKitsune()` (forces a visit now), `MT.kitsune()`.
- Service vehicles (2026-09-24, src/service-vehicles.js): GLBs from assets/service-vehicles (game scale already, +Z forward, root
  scale 0.2), `createService(kind)` kinds postal-van | ambulance | scooter | delivery-scooter | postal-bike | police-bike, userData
  wheels/wheelRadius, seat {y,z}, grip [x,y,z], lights/tail, beacons; `serviceReady()`. vehicles.js attachVehicle takes the vans;
  bikes.js poseBikeRider reads `userData.grip` and pedals only with `bikeParts` or `userData.pedals`. sim.js `serviceRounds()`
  (from updateCollection): post (9–10.5, not Sunday), mail (13.5–15), patrolAM/PM, lunch/supper food, clinic; `twoWheelRound`
  (wanderer kind 'moto', `side` 0.315, `speed`, `stopPause`, `w.rider`), `makeRider` (owner in `userData.rider`, read by
  characters.js, ignored by hover), `seatRider`, `dropRider`; the ambulance persists (`keepMesh`, `onDone` re-parks it).
  Residents: `r.bikeKind` 'scooter' | 'bike' (saved), makeBike uses the scooter when ready. Two-wheelers register in `lampLit`
  (service-vehicles.js), which daynight.js lights at night (they are not in carMeshes). Only the GLBs in assets/service-vehicles are tracked. Dev hooks `MT.stageService(kind, x, z, ry)`,
  `MT.serviceReady()`.
- Street scale (2026-09-24): pavement `PW` 0.16 (world.js; kerb at 0.34, rich-streets `KERB`), lanes 0.34; people and bikes at
  `PEOPLE` 0.85 (sim.js makePerson/makeBike scale the whole group, so held items, helmets and sitting heights follow), kit rack
  bikes 0.85, vehicles `SCALE` 0.2 (vehicles.js; sedan 0.51 long), work trucks `TRUCK_K` 0.85, bus `BS` 0.51. Car lane offset 0.17,
  bikes 0.315, walkers 0.35–0.43. New people or vehicle models (the town-life kit) must come in at this scale. Pets: dogs.js
  scale .115 (about 0.13 tall), cats.js .085 (about 0.09); a fox for the hill would be about 0.12 tall, 0.28 nose to tail.
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
  `signalCells` in world.js, each crossing on its own cycle (`signalState(c, axis)` green | amber | red, SIGNAL_PERIOD 1.2 game h =
  12 real s, phase offset by `hash` of the cell, per-crossing lamp materials in `signalLamps`); `trafficFactor(obj, tr)` in sim.js does
  red/amber, junction claims (`claims`, `isJunction`), pull-out gaps (`ud.pullingOut`), stopped-vehicle and close-range guards,
  the same-spot tie-break (younger `obj.id` waits), queueing and give-way; only `driving(v)` vehicles (traffic check ran this step)
  hold claims or win tie-breaks; `heldSince` > 1 game h lets a held car edge on. Trips take `routeVaried(srcs, dsts, drive)`
  (Dijkstra, Float64 costs: jitter per trip, turn 0.35, busy cells and signals for drivers); `routeCells` stays the cached BFS for
  reachability and distances. Test motion with `MT.fastForward(h, 0.00167)`: the default 0.04 h step moves a car ~1 unit per step.
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
  Riding: characters.js treats `owner.trip.ride` as seated (sit clip), leans the root 0.22 rad, calls `poseBikeRider` (bikes.js aims the arms at the grips
  and swings the legs with the crank phase on top of the seated pose) and shows a `makeHelmet` group on the head bone only while riding.
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
- Build queue (2026-09-24, instead of currency): construction.js marks `b.waiting` (stage 0, no stageT, no crew working) and `b.queuePos`
  (1-based among unbooked waiting sites, blocks order) each update, rebuilding the units when `waiting` flips; genConstruction draws
  the roped grass plot; the pill says "waiting", the card "Waiting for a crew" / "waiting · nth in line". Notice boards: rebuildUnitMesh
  adds `u.notice` (res units; unit 0 of shop/work, not the ryokan), daynight.js shows it while `u.residents` is empty (res) or the block
  has no staff; an unstaffed shop is not lit.
- Working hours (2026-09-24): `HOURS` in world.js per kind ({ open, close, shifts }), `hoursOf(b)`, `isOpen(b, h)`, `hoursLabel(b)`;
  sim.js `takeShift(r, u, path)` on hiring (next shift in turn, flexitime waves for one-shift work/civic, `r.commuteH` ≈ 0.1 h a
  cell, saved; wake moved earlier), decide() uses `setOff = workStart - commuteH` for leaving and `workHours`, `free` gates long
  outings within 1.8 h of the shift, `keepShift(r)` cuts any pre-work activity short; pickShop, tourists and daynight's shop
  light follow `isOpen`.
- Size tiers: `TIERS[type][cells]` in world.js is the pool a new block's kind/variant is drawn from (res variants
  detached | narrow | terrace | apartment | manshon; shop kinds add restaurant | supermarket | arcade; work adds factory);
  `CAP_BONUS` per kind/variant; every unit of a block shares the block's variant; multi-cell generators read
  `b.units.indexOf(u)`. The tier label (`#tier`) shows under the tool bar while dragging.
- Shop storefronts: `OWN_FRONTS` in buildings.js (bakery | florist | books | ramen) skip the shared window/door/finish and draw their own
  front in genShop (bakery bow window + chimney, florist set-back ground floor, books painted front with centre door `doorX` 0, ramen timber
  front + hisashi + exhaust stack); café, grocery, restaurant and konbini keep the shared body.
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
- Speech bubbles: src/bubbles.js (`talks`, `startTalk(a, b, topic, until)`, `endTalk`, `updateBubbles(realT)` into #bubbles, icons inline SVG, no text,
  hidden when cam.view > 20). sim.js starts talks for bench chats and passers-by (`meetPasser`: `knows()` = same hh/home block/job block,
  `r.meetUntil` holds both walkers, 3 h cooldown `r.metAt`); `pickTopic` chooses weather/food/home/etc. Puddles: world.js fills `puddleSpots`
  in rebuildRoads (`puddleVersionOf`), weather.js pools them with `W.wet` (fills in rain, dries ~1 h, none in winter).
- Rich look buildings (2026-09-23): src/rich-buildings.js `genRichBuilding` (slate hip-roof house) is used only for one-cell detached homes and
  villas; shops, workspaces and every other home keep their own generators in the rich look too, so 1/2/3-cell tiers, kinds, finishes and
  facades still read. The rich HUD reskin in styles.css sits under `body.rich-hud` (never set): the rich look uses the standard HUD.
- Sea (2026-09-23, src/water.js): `makeSeaMaterial(harm, R0, SX, SZ)` patches a MeshStandardMaterial (roughness 0.9) on island.js's sea plane;
  `waterUniforms` (uTime from updateWater, uSky/uDay from daynight.js, uDeep #487c8b, uShallow #7aa7ad, coastline harmonics). Waves only bend normals.
- Picker (2026-09-24, src/picker.js): KINDS per zone tool, `sizesOf(type, kind)` from TIERS, SINGLE (townhall/firestation/community greyed
  when built); `pickerForTool(t)` from input.js setTool; `currentPick()` caps the drag and sets placeBlock's preset ({ kind | variant, picked });
  placeBlock honours `preset.kind`/`preset.variant` before naming; `layout()` sizes #picker to #tools' rect (width, gap above it) and
  sets `--picker-top` for #tier; `wrap()` adds .pk-arrow buttons (shown with .overflow), the row's wheel scrolls sideways; reckonShops skips `b.picked`; thumbnails via a throwaway WebGLRenderer on
  fake units (rebuildUnitMesh, then removed from townGroup).
- Shrine approach (2026-09-24): island.js `shrineAxis` = the hill centre moved sideways onto its cell column + `edge` (summit extent, by
  cell via `cellLevel`); shrine, stairs (drop from the summit to the cell level beyond the edge), torii at the stairs' foot and the
  lanterns (world.js openHill, spaced up to `hillCentre.edge`, y from terrainY) all use it. world.js reserves axis cells below the summit
  (not keep/ramp) as `c.landmark = 'shrine-path'` with a flagstone sandō in rebuildDecor; `hillPlots` and `layTerraceLane` skip landmarks.
- PWA (2026-09-24): public/manifest.webmanifest + public/icons (made from assets/brand/komachi-icon.png); vite.config.js `offline()`
  writes dist/sw.js from scripts/sw-template.js (every bundle + public file, version = hash of the names); main.js registers it in
  PROD only; network-first page, cache-first files, fonts in `komachi-fonts`. Settings shows #opt-install on beforeinstallprompt.
- Busy details: `Q.busy` (false in low): characters.js animates `owner.far` people every 4th frame, weather.js halves rain, seasons.js
  caps the leaf pool at 100, ambient.js hides flock 1 and butterflies past 3.
- Quality (2026-09-24, src/quality.js): `S.quality` = Q { preset auto|low|medium|high|custom, res, fps, ao, aoHalf, blur, msaa, shadows off|low|high,
  lights, showFps } (`komachi.quality`); PRESETS; `frameDue(now)` gates main.js's frame loop (cap, meter, auto resolution step-down, low
  shadow redraw); scene.js resize uses `Q.res`; look.js `setPasses(q)` toggles GTAO/tilt-shift/MSAA; point lights follow `Q.lights`.
  The Settings card (#options, gear #btn-options in the brand card) replaced #btn-look/#btn-pixel/#btn-center/#btn-reset.
- Look (src/look.js): `S.look` rich (default) | classic (`komachi.lookStyle`, `?look=classic`, #btn-look on = rich); `?demo=dense` is the dense
  street-grid showcase (scripts/capture-rich.mjs), plain `?demo` the normal demo town, and a fresh start is always an empty island; `renderFrame()` replaces
  renderer.render in main.js (composer only built in rich: RenderPass → GTAO (see-through meshes hidden from its depth) → tilt-shift H/V →
  OutputPass → GRADE); `lookK()` drives daynight.js light/sea/fog and `lookUniform` in geometry.js (patchy tone on upward faces, in the
  withSnow injection, cache keys snow2). Rich is the default since 2026-09-23; smoke runs in it.
- Landmarks (Phase 6, src/landmarks.js): `placeLandmarks()` in main.js after restore/demo (deterministic from the island, so the same
  cells each session): lighthouse (`c.landmark = 'lighthouse'`, tiers rock stretch → rock point → not beach, ≥2 cells from hill/terraces,
  ≥3 from slip/yard; lens material cloned, one additive `beam` that dims over land), arched bridge on a straight canal cell ('bridge',
  banks 'bridge-end' which may take a street), park pavilion ('pavilion', scale 0.66, entrance toward the bridge bank, cherries via
  world.js `landmarkTrees` drawn in rebuildDecor). `placeable` refuses any `c.landmark`; `drawable` allows only 'bridge-end'.
  `landmarks` entries carry `anchor`, `walk(road)`, `hold`, `activity`, `face`, pavilion `seats`; `landmarkRoads()` pairs each with the
  nearest flat street within 4.5. sim.js `visitLandmark` (30 % of dry strolls) / `atLandmark` (hold with `r.paused`, sit on a free seat,
  walk the points back, home). `updateLandmarks(dt, night)` in the main loop.
- Work trucks (2026-09-23): src/work-trucks-kit.js `createTruck(kind)` kinds kei-farm | builder | fish-van, built in code; vehicles.js
  `attachVehicle` handles them (`userData.lights/tail` = the kit's Headlights/Taillights, `wheels` + `wheelRadius` rolled in moveAlong,
  `cargo` meshes, `crane` = Crane_Arm). construction.js `sendTruck` uses 'builder' (crane swings while unloading, timber hidden);
  sim.js produceRound uses 'kei-farm', the fish round 'fish-van'; `wanderPick` hides cargo on the way back.
- Farming (Phase 7, 2026-09-23): type `farm` (tool 'farm', key 9, TYPE_COLOR #7f9b5a), `TIERS.farm` field|greenhouse / field / paddy, `CAP.farm` 2,
  maxLevel 1, FARM_NAMES. buildings.js `genFarm` (season from `seasonOf()`; farmhouse on unit 0 of fields and paddies; scarecrow;
  `waterWheel` on a paddy unit beside the canal, `u.wheel` spun in main.js), rebuilt on the season turn (main `onSeasonTurn`). sim.js:
  farm jobs get farmers' hours in findJob; `fieldWork` puts a farmer in the field with `r.outside` + `ch.pose` / a prop (FIELD_WORK);
  `produceRound` (summer/autumn 8.5–11) sends a truck wanderer that sets `b.produceDay` on VEG_SHOPS (crate drawn in buildings.js).
- Fishing (Phase 7 slice 1, 2026-09-23): src/fishing.js moves the 'quay-boat' group (OUT 5.5, AT 6.4, BACK 9.7, HOME 10.5; skips W.rain > 0.6),
  `onCatch` listeners (sim.js: fish van, a truck wanderer with `fishVan` + `onStop` setting `b.fishDay` on FISH_SHOPS; buildings.js draws the crate
  while `b.fishDay` is today; reckonShops clears it), `catchToday()` until 18.5. landmarks.js: the fish market on its own reserved lot (`c.landmark = 'fish-market'`, street-side cell nearest the quay's land end), landmark kind
  'fishmarket' with `available()`, `setFishStall(on)`; strolls and tourists skip it; decide() adds a fish-buying option 10.5–18.2.
  Homemakers: `r.homemaker` (saved), chosen once per couple/family in findJob (hash(hh.id, 7) < 0.55); daytime errands, KEEP_ACTS, market and stall first.
- Ryokan (2026-09-23): shop kind 'ryokan' (`genRyokan`, SHOP_NAMES.ryokan), placed by `hillMarket` when a tea house exists and the chronicle
  has 'first visitors'; never changes trade; lit 6–23.5 in daynight.js. tourists.js: visitors spawned after 11 on weekends/festival days
  may get `t.staying` (INN_ROOMS 6, briefcase as luggage), plan ends with 'inn' → state 'atInn' until 8.4–9.8 next morning, then a last
  sight and home; the midnight clean-up spares guests. `innGuests()` feeds the ryokan card.
- Quay (2026-09-23): island.js builds the stone quay and exports `pierFrame()` ({ ang, len, deckY, width, at(a, s), spots }); landmarks.js
  `placePier` adds landmark kind 'pier' (`fish`, `visit()` hands out a free spot; `landmarkRoads()` calls it), a reserved lot (`c.landmark
  = 'pier-park'`, a street-side cell first) turned into a public car park by `updateLandmarks` once a town street touches it, and a bike rack
  whose bikes show while anglers are out. `roadNear` only takes streets joined to the town. sim.js: fishing option at 5.5–8.5 and 15.5–18.5
  (`r.fishDay`, keen when `r.id % 4 === 0`), rod prop on hold. Tourists skip the quay.
- Town square + events (Phase 6, 2026-09-23): civic kind `square` in `TIERS.civic[3]` (chooseKind returns it first for three cells),
  `CAP_BONUS.square` -2 (no staff), `genSquare` in buildings.js. src/events.js (imports world/buildings/seasons/island/weather only; sim.js,
  tourists.js, ui.js and main.js read it): `scheduled()` from the calendar (market: day % 7 === 0, 7–11.5; festival: `festivalDay(d)`,
  first Saturday of summer or its third day, 16–21.5), `setUp`/`tearDown` of kit props on the first finished square, `eventVisit()` →
  { road, spot, l } in the landmark-visit shape (sim `visitLandmark(r, from, given)` and tourists' 'event' step), spots `taken` counts,
  fireworks (Points with a soft sprite, one PointLight flash) 20–21.3, `onEventStart` (main: milestone card for the first festival).
  Dev hooks `MT.setDay(d, h)`, `MT.festivalDay`, `MT.eventOn`, `MT.routeCells`.
- Tourism (Phase 6, src/tourists.js): `tourists` (not residents, not saved; `userData.tourist` on the mesh, picked in input.js,
  Visitor card in ui.js; characters.js treats them as owners and poses `fidget` 'photo' | 'camera' with a hand-item camera). Arrivals
  from `onTrain` 8.5–13 when dry (weekend 2–4, weekday 30 % of one); plan = landmarks (`landmarkRoads`, photo spot about a cell back
  from `l.target` on dry ground) → shop (visitsToday/visitScore) → station; after 14.5 only home. `bus`: `findStops` (ring cell by the
  stairs ↔ the lighthouse's road, clear pavement both ends, retried until found), `shipVehicle` in ferry.js delivers it at weekends,
  dwell 0.3 h (held for visitors walking to the stop), service ends at 14.6 to catch the 17:00 ferry (`boardCar`). Dev hooks:
  `MT.tourism.forceWeekend`, `MT.spawnTourist()`, `MT.bus`, `MT.tourists`.
- Milestones: src/milestone.js (`announce({ title, line, icon, at, view, onLook })`, `updateMilestone()` in the main loop, `cancelGlide`,
  `gliding`, `milestoneShown`); a cream card under the top bar, ~10 s, "Go and look" glides `cam.target`/`tView` in, holds, back; input ends it.
  The hill opening: `openHill` records and calls `onHillOpened` listeners (main.js: `sendHillCrew(top, down)` in construction.js at the top of the
  ramp chain nearest the station, list `hillCrew`; `lightLanterns()` in world.js, `lanterns` have their own materials, `updateLanterns()` each frame).
  Later milestones (first festival, hundredth resident, ferry's first call) reuse `announce`.
- Sea life lives in src/sea.js: fish leaps and splashes, the pier boat's wake, a dolphin pod (`pod`, src/dolphins.js) and the waterfall splash
  (`fallFeet` exported by island.js; puffs and mist in `updateSplash`). The ferry's own wake is in ferry.js (`updateWake`).
- Snow: `snowUniform`/`setSnow` in geometry.js; `withSnow(material)` injects a fragment whitening of upward faces into `mat()`, `vcMat`, `vcMatFlat`
  and `swayMat` (cache keys differ); kit Groups with their own materials go through `snowKit(group, skip)` (in place, once per material; the civic and
  town-service props, notice board, bath house, station pavilion minus its lit panels, summit shrine and torii). weather.js eases `W.snow` toward 0.9 while `W.winter`
  (set each frame by main.js from `seasonOf`), draws flakes instead of streaks, and daynight.js cools the sky and skips the wet-road tint.
- Seasons (Phase 6, src/seasons.js): `seasonOf(day)` over `SEASON_DAYS` 6 (a 24-day year), `leafColor(hex, season)` used by world.js for broadleaf/cherry
  (and the station's planter trees); `updateSeasons(dt, onTurn)` in the main loop and fastForward rebuilds decor at the turn (main.js `onSeasonTurn`),
  toasts and records it, and runs the leaf pool from `treeSpots` (set by rebuildDecor). Rates: autumn 0.35, sakura spring 0.4 (petals), summer 0.03, winter 0.
- Weather (Phase 6, src/weather.js): `W = { kind, until, cover, rain, wind }`, spells clear | cloudy | drizzle | rain (`SPELLS`, `NEXT`), `setWeather(kind, hours)`
  (also a dev hook), `updateWeather(dt, dh)` in the main loop and fastForward; clouds are a pool of 12 invisible shadow-only planes (cloud alpha masks, colorWrite false) at y 6.5 scaled in/out by cover, so only their shade shows,
  rain a LineSegments field round `cam.target`; daynight.js dims/greys by `W.cover` and calls `setWet` (world.js tints the road mesh); sim.js
  equips an umbrella on `startTrip` while `W.rain > 0.25`. Saved as `weather`.
- Tool labels (2026-09-22): Explore, Homes (res), Shops (shop), Work (work), Civic, Streets (road), Parking (park), Clear (remove).
  Since 2026-09-24 Parking has no dock button: picker.js MODES gives the Streets button a Street | Car park strip (`onPickerMode(setTool)`
  from input.js), key 7 still selects 'park', and setTool lights the road button for both; player strings say "Streets → Car park". Code names are
  unchanged; player-facing strings say "Streets tool" and "Clear".
- Dev hooks on `window.MT` (placeBlock, fastForward, setHour, project, DONE…) drive the tests.
  `?demo` builds a sample town; `?seed=` fixes the island; `?biome=sakura|coastal` themes it.

## Working style

- The user reviews by screenshot. Render with puppeteer-core (see scripts/smoke.mjs for launch
  args) rather than describing what it should look like.
- Never append a `// comment` in the middle of a one-line statement chain in a patch: everything after it on the line becomes comment
  (this broke smoke.mjs, weather.js, input.js and sim.js makeBike). Put comments on their own line or at the true end of the line.
  `npm run lint` now runs scripts/check-comments.mjs after ESLint, which fails on comment text that contains `; <statement>`.
- Never pass text containing backticks to `node -e "..."` in Bash: the shell runs them as commands (on 2026-09-24 that started
  `npm run dev` and tried to run a .js file as a script). Put patch text in a file written with the Write tool.
- Scratch render scripts on Windows: `server.kill()` on a `shell: true` spawn leaves vite running; end it with
  `taskkill /pid <pid> /T /F` (smoke.mjs does), and poll the port instead of sleeping.
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
- Two parallel adjacent road cells form a two-lane avenue, not a doubled road (slope roads and links excepted; the coast road may pair
  with a drawn street, the station ring and slip may not). `dbl[k]` in rebuildRoads also needs the pair to end at c and n, or every
  edge along two side-by-side streets reads as shared (rails and dashes across the road, fixed 2026-09-24).
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
6. ✅ Weather, gentle events, festivals, tourism (complete 2026-09-23; shipped 2026-09-22: weather spells, cloud shade, rain and umbrellas, seasons, snow; agreed next:
   speech bubbles, puddles, tourists with camera prop and bus, landmarks placed, summer festival with fireworks, ryokan)
7. ✅ Farming and fishing (complete 2026-09-23)
8. ✅ Mobile quality levels, PWA, touch dock (complete 2026-09-24)
9. Menus, saves UI, photo album, opening cinematic (train scene + iris wipe onto the island)
10. Electron desktop app: the last phase, after every feature is checked (decided 2026-09-24)
