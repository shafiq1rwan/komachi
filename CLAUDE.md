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
npm test           # scripts/smoke.mjs: headless Chromium over dist/, 14 checks + screenshots in scripts/out/
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
- Heights: asphalt top 0.08, sidewalk 0.10, plinth 0.12. Cars keep left; walkers pick one sidewalk.
- Time: `S.T` in game hours, `HPS = 0.1` hours per real second. One day ≈ 4 real minutes.
- People are the box figures by default (user preference). The rigged GLB in `assets/characters/` is
  opt-in with `?rigged` via `src/characters.js`. `new THREE.Color(hex)` is already linear; never call
  `convertSRGBToLinear` on it. GLTFLoader renames `thigh.L` → `thighL`.
- Cells: `water | hill | empty | road | lot`; roads ring blocks automatically; blocks are 1–3 cells and may be
  zoned over road cells (`placeable` in world.js), never over the station ring.
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

Version 0.2 work, not yet committed (no git repo initialised as of 2026-09-15). Phases 1 and 2 are
complete and verified (lint, build, `npm test`, screenshots). The user's original brief is long;
its essence: observation-first cosy god game set in a Japanese suburb, and every system must show
its effect through residents, buildings, vehicles or light, never only through numbers.
"Everything is optional. Everything creates consequences you can see."

Decisions already made (do not reopen without asking):
- Box people are the default; the rigged GLB (`?rigged`, `src/characters.js`) exists but the user
  prefers the boxes. The GLB is 1,632 tris per person with a baked-in bag.
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

Open threads the user has not decided:
- The "Name tags" button is weak. Recommendation given: fold into Phase 3 (tag only pinned or
  followed residents) and drop the button until then. Awaiting the user's choice.
- Whether people should cross at zebra crossings instead of at trip end (Phase 3 routing).
- If the rigged model is ever adopted: needs a low-poly LOD and a no-bag variant.

Phase 3 plan as discussed with the user: households (people who live together), simple needs
(hunger, rest, work, shopping, leisure, social) with utility-scored decisions at scheduled
intervals rather than per frame, simulation LOD (near / visible-far / off-screen update rates;
off-screen residents advance by schedule only), a follow-camera on a resident, richer resident and
household inspect cards, and basic save/load (localStorage first) before the data model grows.
Touch tap-to-inspect already works. Deliver in the same style: build, verify with screenshots,
update CHANGELOG (Unreleased), README, docs.

## Roadmap (agreed with the user)

Full detail per phase lives in docs/ROADMAP.md; keep both in step when a phase is ticked.


1. ✅ Island, Japanese identity, building kit, street props, ambient life, touch basics
2. ✅ Construction stages, crews by train, deliveries, renovation
3. Resident depth: households, needs, utility decisions, LOD, follow-camera, save/load
   3.5 (optional, after save/load) buildable hill terraces; the hill is wild until then
4. Station commuting, persistent bikes and taxis
5. Economy and dynamic business selection
6. Weather, gentle events, festivals, tourism
7. Farming and fishing
8. Mobile quality levels, PWA
9. Menus, saves UI, photo album
