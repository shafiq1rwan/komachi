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
![The whole island](docs/screenshot-island.png)
![A shop going up](docs/screenshot-construction.png)

## Quick start

```bash
npm install
npm run dev        # opens http://localhost:5173
```

URL options: `?demo` starts with a small pre-built town, `?seed=123` fixes the island shape,
`?biome=sakura` or `?biome=coastal` picks an island theme (default `suburban`).

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
| Tools | 1 Explore · 2 Residential · 3 Shop · 4 Workspace · 5 Road · 6 Remove · 7 Car park |
| Car park | Drag one or two cells beside a street. Homes and workplaces within six cells park there instead of lining the kerb; a full kerb is called out on the building's card |
| Remove | Click a building, or click or drag along a street (a street a building opens onto stays) |
| Draw a street | Road tool, then click and drag: an L-shaped run over land on one level, or straight across the canal for a bridge. The station ring is the first street |
| Zone a block | Pick a zone, then click and drag across one to three touching cells beside a street. The doors face it. One, two or three cells decide what it becomes: house, terrace pair or apartment building; konbini, café or supermarket; studio, workshop or factory. A label says so while you drag |
| Inspect | Hover any building or person. In Explore mode, click to pin the card |
| Follow | Press Follow on a resident card, or click any name on a building card. Pan, zoom, a key or another tool lets go |
| Rotate a building | Hover it and press R, or use the Rotate button on its card. The door turns to the next side that faces a street |
| Time | Speed buttons behind the sliders button in the clock card, or Space to pause |
| Look | "Pixel look" (off by default) switches to the half-resolution chunky render and is remembered; the sliders button also holds Centre and Start over. `?boxes` in the URL brings back the original box people |

Some things worth knowing:

- **Cars come by sea.** A ferry calls at the slipway beside the pier three times a day. Visiting cars roll off
  it and drive back to it to leave, a household's car comes off the next sailing after they move in, and the
  builders' yard by the slipway fills with timber and sacks while sites are under way. Draw a street from town
  to the coast road so the cars can reach you.
- **Everyone arrives by train.** Komachi Station sits at the centre of the island and cannot be
  removed. A quarter of households commute to the city by train and come home in the evening rush;
  households moving to a distant home take a taxi from the rank on the plaza. A train pulls in every hour and a half between 6:00 and 23:30. When a home is close to
  finished, its future household rides the next train, waits on the plaza, and walks in when the
  builders are done. Anyone still waiting at 22:00 takes the last train to the city and is back at
  06:00. Hover the station to see who is waiting and when the next train is due.
- If a house loses its residents (you removed it), they walk back to the station and wait again.
- **The island is the world.** An organic coastline with beaches, rocky stretches and grassy
  cliffs, a pier and a boat, a terraced hill with a shrine on the far side from the pier, a canal with a
  heron on the pier's side, and a coast road running round the island just inside the beach. Zone on both
  banks of the canal and a bridge appears between the facing streets. The canal ends in a waterfall off the
  land edge onto the beach. Waves lap
  the beaches, fish leap and a fishing boat circles offshore. Zoom out to see all of it; nothing can be
  built in the water.
- **The hill fills on its own.** Once a street reaches the open hill, a settled household has a villa built on
  the highest free plot and moves up, freeing their old home, and once people are walking up there a tea house
  opens near the shrine path. You can still zone the terraces yourself.
- **Build up the hill.** The hill stays wild until 60 people live in town; then its slope roads open and
  the shrine path is lit. The hill rises in three terraces. Each terrace cell is a plot at its own
  height, except the wooded ones and the shrine on top, and a block has to sit on one terrace. A hill
  block gets one street in front, facing the town, and the town builds whatever slope roads and links
  are needed to join it to the streets below; residents walk and drive up to hillside homes with a view.
- **Streets are streets.** Raised sidewalks with kerbs, dashed centre lines, zebra crossings at
  junctions. People walk on the pavement and cross at the end of their trip; cars keep left.
  Zone two blocks two cells apart and the shared gap becomes a two-lane avenue.
- **It reads as Japan.** Grey kawara tile roofs with ridge caps, hip-and-gable roofs on larger houses,
  block walls with sliding gates and a genkan step, laundry and futons on the balconies by day, vertical
  signboards, noren and red chōchin lanterns on the shop street, a glowing konbini, painted stop marks
  and white kerb lines on the streets, a red post box, a kōban by the station, a hokora on a quiet bend,
  pruned pines, bamboo groves and pocket parks with swings.
- **Buildings vary.** Detached homes are cottages, timber machiya townhouses or modern render boxes; homes also come as narrow two-storey
  houses with exterior stairs, or small apartment blocks with balconies. Shops take one of three shapes, a
  tiled machiya gable, a mono-pitch metal roof with a tall fascia, or a flat roof with a parapet, and become cafés,
  bakeries, ramen shops, groceries, convenience stores, florists or bookshops. Workspaces are
  offices, workshops or studios. Streets get utility poles with cables, traffic mirrors, notice
  boards and bike racks.
- **Streets first.** Draw them with the Road tool, out from the station ring, and zone buildings
  beside them. Everything placed in one drag becomes **one block** and its doors face the street it
  was placed against. A street a building opens onto cannot be removed until the building goes. The
  town lays no streets of its own on the flat; on the hill it still builds a slope for a terrace
  street that has no way down.
- **Small things in hand.** People drink from a can at the vending machines and carry a paper bag home from
  the grocer, supermarket, konbini, arcade or bakery.
- **Shops live and die by their customers.** Each shop counts who comes in every day. Busy ones hang nobori
  banners by the door; a shop nobody visits for three days closes and reopens as another kind of its size, with
  shutters down while the new place is fitted out. Bigger shops draw people from further away.
- **Builders come by train.** Zone a block and a crew rides in on the next train, walks to the
  site and works until 18:00. Nothing is built without them. Buildings pass through five visible
  stages (survey, foundations with a digger, frame, scaffolding, finishing) while kei trucks bring
  materials from the station. A home takes about one working day; shops and workspaces a little
  more. Growing a level puts the scaffolding back up for a while.
- **People live in households.** Couples, small families and flatmates arrive on the same train,
  wait together and move in together. Each person has needs (energy, food, fun, company, groceries)
  that drain through the day; at scheduled moments they weigh what would help most against the hour
  and the distance, so you see breakfast at home, a lunch break at the ramen shop, a grocery run, a
  stroll, a visit to a friend, and bed when tired. Hover anyone to read how they feel, in words.
- Residents look for work at shops and workspaces they can reach by road, and follow a daily
  schedule with personal wake and finish times. About a third own cars and many of the rest ride
  bicycles; vehicles park on the plot beside the building while their owner is inside. Crossroads
  have traffic lights, and traffic queues and stops at red. A home that is not
  connected to the station by road still gets residents (they cut across the grass to move in),
  but they cannot commute until a road links it up.
- Buildings **grow to level 3** once they stay occupied and the town is big enough: three or
  more blocks with both homes and jobs for level 2, six or more blocks of every kind for level 3.
- Removing a block sends its residents back to the station and clears roads that no longer touch any block.
- **The town saves itself** in your browser every half game hour and when you leave, and is back on
  your next visit. The rotate-left button behind the sliders starts a new island; `?new` in the URL
  ignores the save for one session.

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
  buildings.js        procedural buildings per zone type, variant, level and construction stage
  kit.js              shared building parts: balconies, stairs, AC units, bikes, awnings, signs
  island.js           organic coastline, beach terrace, rocks, pier; land/water test
  biome.js            island themes (colours, vegetation mix, shoreline character)
  ambient.js          bird flocks, gulls, butterflies
  cats.js             original low-poly cats, coat colours and walk/idle motion
  character-props.js  shopping bag, briefcase, folding umbrella and registration folder
  outdoor-props.js    broom, fishing rod and watering can with Kenney carry grips
  nature-kit.js       pines, matsu, bamboo, cherry/broadleaf trees, rocks and rice paddy; the town's decor draws from it
  landmark-kit.js     standalone torii/shrine, Buddhist temple, koban and public bath
  street-furniture.js standalone vending machine, bench, bus stop, signals, signs, planter and bike rack
  neighbourhood-kits.js standalone utility, shop facade and home yard kits (19 GLBs, including the city bicycle)
  civic-kit.js        standalone substation, water tower, recycling row, path torii, notice board, hydrant and hose box
  subway-station.js   one-cell open stair pavilion, hip-and-gable kawara roof, clock and four independent light materials
  tea-can.js          labelled tea can and mouth-aligned drinking pose
  bikes.js            original city bicycle, basket, rotating wheels and resident riding pose
  dogs.js             original low-poly Shiba Inu, four poses and ambient street behaviour
  dolphins.js         standalone low-poly dolphin asset and swim animation
  construction.js     builders, crews riding the trains, material deliveries
  characters.js       rigged people (Kenney Mini Characters): loading, per-person recolour, animation
  builder-model.js    editable Kenney builder derivative: fitted hard hat and reflective workwear
  vehicles.js         Kenney Car Kit models: loading, per-car repaint, box-car fallback
  sea.js              waves, jumping fish, a school near the shore, the fishing boat
assets/characters/    Kenney Mini Characters (CC0) under kenney/
assets/vehicle/       Kenney Car Kit models (CC0) and their atlas
assets/watercraft/    Kenney Watercraft models (CC0): the fishing boat and a few kept for later
  sim.js              time, road routing, residents and schedules, ambient traffic, growth
  daynight.js         sky, lights and emissive glow over the day
  ui.js               inspect card and stats strip
  input.js            pointer/keyboard, tools, drag selection, preview, hover picking
  save.js             one-slot localStorage save and restore
  toast.js            the message pill
  styles.css          all UI styling
scripts/smoke.mjs     headless browser test
docs/                 art direction, architecture notes, reference image, screenshots
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit together,
[docs/ART_DIRECTION.md](docs/ART_DIRECTION.md) for the visual rules and [docs/ROADMAP.md](docs/ROADMAP.md)
for what is done and what comes next.

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

Vanilla JavaScript, [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/), with
[Font Awesome](https://fontawesome.com/) for UI icons. No framework. Buildings, trees, vehicles and props are generated from boxes, prisms and dodecahedra
at runtime. People are [Kenney's Mini Characters](https://kenney.nl) (CC0) and vehicles come from
Kenney's Car Kit (CC0), both recoloured per owner;
`?boxes` brings back the original generated box people.

## License

[MIT](LICENSE)
