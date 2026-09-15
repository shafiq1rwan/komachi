# Komachi 小町

*Komachi* (小町) means "small town". It is a cosy, retro-flavoured city diorama that plays more like a god game than a management sim.
An empty island with a single underground station in the middle. Trains bring newcomers who
sit on the benches, buy a can of tea from the vending machine, and wait for you to zone a
home. Roads grow around each block on their own, buildings rise through visible construction
stages, residents move in, find jobs, walk to work, pop out for lunch and shop in the evening.
At night the town turns soft blue while windows and street lamps glow warm.

There is nothing to lose and nothing to optimise. The pleasure is in watching.

![Komachi by day](docs/screenshot-day.png)
![Komachi by night](docs/screenshot-night.png)
![Komachi Station at night](docs/screenshot-station.png)

## Quick start

```bash
npm install
npm run dev        # opens http://localhost:5173
```

Add `?demo` to the URL to start with a small pre-built town.

Other scripts:

| Script | What it does |
|---|---|
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint over `src/` |
| `npm test` | Headless smoke test of the built game (needs Chrome or Edge, see below) |

## How to play

| Action | Input |
|---|---|
| Pan | Drag (any button in Explore mode, right or middle button in any mode), or WASD / arrow keys |
| Zoom | Mouse wheel |
| Rotate | Q / E in 45° steps |
| Tools | 1 Explore · 2 Residential · 3 Shop · 4 Workspace · 5 Remove |
| Zone a block | Pick a zone, then click and drag across one to three touching cells |
| Inspect | Hover any building or person. In Explore mode, click to pin the card |
| Time | Speed buttons in the clock card, or Space to pause |
| Look | "Pixel look" toggles the half-resolution chunky render. "Name tags" labels walkers |

Some things worth knowing:

- **Everyone arrives by train.** Komachi Station sits at the centre of the island and cannot be
  removed. A train pulls in every hour and a half between 6:00 and 23:30. Passengers wait on the
  plaza until a finished home has a free bed, then walk there. Hover the station to see who is
  waiting and when the next train is due.
- If a house loses its residents (you removed it), they walk back to the station and wait again.

- Everything placed in one drag becomes **one block**. Roads form around the outside of the
  block and never between the buildings inside it. Blocks are always separated by a road.
- Buildings pass through **three construction stages** (plot, foundation, frame) before they
  finish. Builders work faster in daylight.
- Residents look for work at shops and workspaces they can reach by road, and follow a daily
  schedule with personal wake and finish times. About a third own cars. A home that is not
  connected to the station by road still gets residents (they cut across the grass to move in),
  but they cannot commute until a road links it up.
- Buildings **grow to level 3** once they stay occupied and the town is big enough: three or
  more blocks with both homes and jobs for level 2, six or more blocks of every kind for level 3.
- Removing a block sends its residents back to the station and clears roads that no longer touch any block.

## Project layout

```
index.html            page shell (UI markup)
src/
  main.js             entry point: frame loop, dev hooks, ?demo town
  state.js            shared mutable state (time, speed, id counter, pixel look)
  palette.js          the fixed pastel palette and name pools
  utils.js            math helpers
  geometry.js         vertex-coloured primitives merged into few draw calls
  scene.js            renderer, orthographic camera, lights, the island
  world.js            grid cells, automatic roads, vegetation, lamps, block/unit records
  buildings.js        procedural buildings per zone type, level and construction stage
  sim.js              time, road routing, residents and schedules, ambient traffic, growth
  daynight.js         sky, lights and emissive glow over the day
  ui.js               inspect card and stats strip
  input.js            pointer/keyboard, tools, drag selection, preview, hover picking
  toast.js            the message pill
  styles.css          all UI styling
scripts/smoke.mjs     headless browser test
docs/                 art direction, architecture notes, reference image, screenshots
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit together and
[docs/ART_DIRECTION.md](docs/ART_DIRECTION.md) for the visual rules.

## Testing

`npm test` builds nothing itself. Run `npm run build` first, then the script serves `dist/`
with `vite preview`, drives the game through the `window.MT` dev hooks in a headless
Chromium, checks zoning rules, construction, move-in, hiring, the inspect card and removal,
and saves day and night screenshots to `scripts/out/`. It looks for Edge or Chrome in the usual
places. Point `BROWSER_PATH` at a Chromium binary if yours is elsewhere.

## Deploying

A GitHub Actions workflow in `.github/workflows/deploy.yml` builds the site and publishes it to
GitHub Pages on every push to `main`. Enable Pages in the repository settings with
"GitHub Actions" as the source. The Vite config uses a relative base path, so the build also
works from any static host or sub-folder.

## Tech

Vanilla JavaScript, [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/). No
framework, no assets: every building, tree, person, car and cat is generated from boxes,
prisms and dodecahedra at runtime.

## License

[MIT](LICENSE)
