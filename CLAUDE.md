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
npm test           # scripts/smoke.mjs: headless Chromium over dist/, 17 checks + screenshots in scripts/out/
```

Always run lint → build → test after changes, then eyeball `scripts/out/day.png` and `night.png`.
`npm test` needs Edge or Chrome (`BROWSER_PATH` overrides). CI (`.github/workflows/ci.yml`) runs
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
  Cars keep left; walkers pick one sidewalk.
- Time: `S.T` in game hours, `HPS = 0.1` hours per real second. One day ≈ 4 real minutes.
- People are Kenney Mini Characters by default (CC0, `assets/characters/kenney/`, adopted 2026-09-17);
  `?boxes` brings back the original box people. Loaded via `src/characters.js`: atlas baked to vertex
  colours, parts classified and repainted per person. `new THREE.Color(hex)` is already linear; never call
  `convertSRGBToLinear` on it (canvas pixels are sRGB and do need it). The GLBs reference the atlas by a
  relative path, so the loader's URL modifier points them at the bundled copy.
- Vehicles are Kenney Car Kit models via `src/vehicles.js` (same atlas-bake and repaint idea; `attachVehicle`
  fills a +z-forward group; box cars are the fallback). Kinds: kei, hatch, suv, van, truck, taxi, delivery, garbage.
- Cells: `water | hill | empty | road | lot`; roads ring blocks automatically; blocks are 1–3 cells and may be
  zoned over road cells (`placeable` in world.js), never over the station ring, ramp roads (`c.keep`)
  or across two terraces. `hill` cells are the wild wooded ones; terrace plots are plain `empty` with `c.h`.
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
- Two blocks placed two cells apart form a two-lane avenue, not a doubled road. Cables only run along
  streets between poles that share a row/column of road.
- Homes are named after places (Sakura Terrace); shops and workspaces from per-kind pools; all fictional.
- HUD: one slim top bar; view toggles fold behind a sliders button; controls card folds into a help
  icon after 5 s; instant tooltips; progress pills float over sites under construction.
- Docs stay full-length (the user reverted an attempt to compact README/CHANGELOG/ARCHITECTURE).
- Phase 3 model: households (`hh` on every resident), needs 0–1 shown only as words, `decide()` scores
  options at `r.next`, trips carry a `purpose`, save slot `komachi.save` (v1) via `src/save.js`;
  `state.js` reads the saved seed before island.js runs. Name-tags toggle removed; tags follow/pin only.

Open threads the user has not decided:
- Whether people should cross at zebra crossings instead of at trip end (carried to Phase 4).
- Nothing else pending from Phase 3; Phase 3.5 (hill terraces) is done.
- Kenney people: watch performance past ~100 people (each is ~1,400 tris); a LOD swap to box people when far is the likely fix.

Next up is Phase 4 (station commuting, persistent bikes, taxis) when the user says go; its scope is in
docs/ROADMAP.md. Deliver in the same style: build, verify with screenshots and headless traces (see the
scratch scripts pattern in scripts/smoke.mjs), update CHANGELOG (Unreleased), README, docs, ROADMAP.
Any change to what a resident or block carries must be mirrored in `src/save.js` (bump `v` if the
shape changes incompatibly).

## Roadmap (agreed with the user)

Full detail per phase lives in docs/ROADMAP.md; keep both in step when a phase is ticked.


1. ✅ Island, Japanese identity, building kit, street props, ambient life, touch basics
2. ✅ Construction stages, crews by train, deliveries, renovation
3. ✅ Resident depth: households, needs, utility decisions, LOD, follow-camera, save/load
   3.5 ✅ buildable hill terraces with slope roads
4. Station commuting, persistent bikes and taxis (starts with the hill unlock at ~60 residents)
   4.5 (optional) canal with bridges
5. Economy and dynamic business selection (incl. hill plot market: villas, tea house, later ryokan)
   5.5 Civic zone: substation, water works, recycling centre (visible effects only, nothing gated)
6. Weather, gentle events, festivals, tourism
7. Farming and fishing
8. Mobile quality levels, PWA
9. Menus, saves UI, photo album
