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
npm test           # scripts/smoke.mjs: headless Chromium over dist/, 12 checks + screenshots in scripts/out/
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
- Cells: `water | empty | road | lot`; roads ring blocks automatically; blocks are 1–3 cells.
- Dev hooks on `window.MT` (placeBlock, fastForward, setHour, project, DONE…) drive the tests.
  `?demo` builds a sample town; `?seed=` fixes the island; `?biome=sakura|coastal` themes it.

## Working style

- The user reviews by screenshot. Render with puppeteer-core (see scripts/smoke.mjs for launch
  args) rather than describing what it should look like.
- Multi-line code edits: write a small Node patch script with the Write tool and run it. Bash
  heredocs in this environment have mangled backslashes and quotes more than once.
- Keep CHANGELOG.md (Unreleased section), README.md and docs/ in step with features.
- Fictional names only (shops, station, people). Nothing punitive: no failure states.

## Roadmap (agreed with the user)

1. ✅ Island, Japanese identity, building kit, street props, ambient life, touch basics
2. ✅ Construction stages, crews by train, deliveries, renovation
3. Resident depth: households, needs, utility decisions, LOD, follow-camera, save/load
4. Station commuting, persistent bikes and taxis
5. Economy and dynamic business selection
6. Weather, gentle events, festivals, tourism
7. Farming and fishing
8. Mobile quality levels, PWA
9. Menus, saves UI, photo album
