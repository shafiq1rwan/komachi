# Changelog

All notable changes to Komachi are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Rigged people from Kenney's Mini Characters (CC0) behind `?rigged`: eleven chibi variants, each person
  recoloured from their look by baking the colour atlas into vertex colours and repainting skin, hair,
  shirt and trousers with shading kept; idle, walk and sit animations; hard hats for builders. The box
  people remain the default until the user decides
- Building on the hill: the hill is now three cell-aligned terraces with retaining walls along cell
  edges. Every terrace cell is a flat plot at its own height, except wild wooded cells and the shrine
  summit. One slope road per terrace lip on the town side joins the terraces to the streets below and
  is permanent; a block must sit on a single terrace. Roads, lamps, cables, buildings, walkers, cars,
  builders, trucks, cats and butterflies all follow the ground height, and walkers climb the slopes
- Buildings can be turned: hover one and press R, or press Rotate on its card, and the door swings to
  the next side that faces a street. Buildings with a street on one side only stay as they are
- Households: people who live together arrive on the same train, sit together on the plaza and move
  in together. Couples and families share a surname; flatmates keep their own. A household that waits
  too long for a home big enough splits up. Home cards group residents by household
- Needs: energy, food, fun, company and groceries drain through the day and refill through what people
  do. Decisions are scored against needs, the hour and distance at scheduled moments, never per frame:
  meals at home or out (breakfast, lunch, dinner), lunch breaks from work, grocery runs, strolls, visits
  to friends' homes, and sleep when tired. The card shows how someone feels in words, never numbers
- Follow camera: the resident card has a Follow button; the camera tracks that person until you pan,
  zoom, press a key or choose another tool. A name tag floats over the followed and pinned resident
- Save and load: the town saves itself to the browser every half game hour and when the page is left,
  and comes back on the next visit (same island, same time of day, everyone at home or on the plaza).
  A "start a new island" button sits behind the view-options sliders; `?new` ignores the save
- Simulation level of detail: walkers off screen or seen from far away move in larger, less frequent
  steps without the walking bob
- Resident cards show household, who they live with, how they feel and what they are heading to do
- A wooded hill opposite the pier: three grassy terraces with pines and broadleaf trees, a small
  shrine with a torii on the summit facing the town, stone lanterns and steps. Hill cells are left wild
  and cannot be built on
- Optional rigged resident character (`assets/characters/komachi-resident.glb`, enable with `?rigged`): loaded
  once, cloned per person with jacket, trousers, hair, skin and bag recoloured from the resident's
  look, Idle/Walk clips blended from movement, legs bent at hip and knee when seated on a bench,
  a hard hat on the head bone for builders. The box people stay the default look
- Station bins moved behind the benches so nobody walks through them
- Builders do real jobs: per stage they measure with a level and check a clipboard, drive stakes,
  dig with shovels and push a wheelbarrow, carry planks from the pallet, saw at a sawhorse, hammer
  beams, climb the scaffold to drill and fix the roof frame, mix cement, and paint with rollers or
  fetch buckets at the finish. Each tool is a little mesh in the hand with its own motion

- Blender human resident asset and GLB export with a 16-bone skeleton, idle/walk clips,
  preview renders and a reproducible Blender build script (runtime integration pending).
- Revised resident proportions, swept hair, connected clothing and studio lighting to
  more closely match the generated character reference.

- Construction crews: three builders in vests and helmets ride the next train after a block is
  zoned, walk to the site, work until 18:00, go home down the stairs and return on the first
  morning train. A site only progresses while builders are on it; more builders build faster
- Five visible construction stages: survey stakes and sign → foundation slab with a mini digger and
  a pallet of blocks → timber frame → full scaffolding with roof frame, tarp and cement mixer →
  finishing touches on the real building with one scaffold still up and a wet-paint sign
- Kei trucks deliver materials from the station at the start of each stage and drive back
- Growing to the next level puts scaffolding and paint pots on the building for a couple of hours
- Inspect cards show the stage name, crew status, and builders can be hovered like residents
- Instant tooltips on the HUD stat chips, speed buttons and view toggles
- View toggles (pixel look, name tags, centre) fold behind a sliders button in the clock card
- Small floating progress pills above buildings under construction or being extended

- Organic island: seeded coastline with beaches, rocky stretches and grassy cliffs, a pier and a
  boat; cells outside the coast are water and cannot be built on; `?seed=` fixes the shape
- Biomes as data (`?biome=suburban|sakura|coastal`): colours, tree mix, blossom, pines, shore bias
- Modular building kit: detached houses with tile or metal roofs, narrow two-storey houses with
  exterior stairs and balconies, small apartment blocks; seven shop kinds (café, bakery, ramen,
  grocery, convenience store, florist, bookshop) and three workspace kinds (office, workshop,
  studio), each with its own signage, props and door position; rear and side windows everywhere
- Street props: utility poles with sagging cables and perching birds, convex traffic mirrors at
  junctions, neighbourhood notice boards, bike racks with parked bicycles, potted plants, fences
- Vehicles: kei cars, hatchbacks, delivery vans, kei trucks and taxis
- Ambient life: bird flocks over town, gulls over the shore, butterflies around flowers; trees,
  reeds and shrubs sway in the wind
- Touch: pinch to zoom, two-finger twist to rotate, tap to inspect
- Controls card folds into a round help icon after five seconds; click to unfold (Font Awesome, bundled)
- Streets: raised sidewalk bands with a kerb lip, asphalt sunk below them, dashed centre lines on
  straight two-way stretches, zebra crossings only at real junctions; two blocks placed two cells apart
  now form a tidy two-lane avenue instead of a doubled road covered in crossings
- Pedestrian routing: trips start and end on the road cell in front of the door, walkers keep to one
  sidewalk with mitred corners and cross the street perpendicularly at the end; cars keep left
- People have a hip joint and actually sit on the station benches; some carry bags
- Top HUD redesigned: one slim bar with icon stat chips on the left and clock, speed and view
  toggles on the right
- Birds fly nose-first with wings hinged at the shoulder; gulls are larger
- Stronger wind sway with slow gusts; two drifting ripple layers on the water

- Komachi Station: an underground entrance with benches, vending machines, planters and lamps at
  the centre of the island, placed at the start and ringed by road
- Newcomers arrive by train (every 1½ game hours, 6:00–23:30), wait on the plaza, buy drinks from
  the vending machines, and move in when a finished home has room
- Residents who lose their home return to the station and wait for a new one
- Station inspect card with next train time and the waiting list; "waiting" counter in the stats strip

### Changed

- Fixed: the start-over button reloaded into the same town because the leave-page autosave wrote it back
- HUD: the jobs chip now counts open positions rather than all positions, and a new chip shows how
  many residents are looking for work; the help card mentions rotating buildings and following people
- Fixed: newcomers with cars drove out of the station, and strollers found their car on a street corner.
  A car now lives somewhere (it arrives with the household at their home) and can only be driven from
  where it was last parked
- Vehicles are a fifth smaller
- Resident cards are more compact: household and housemates share a row, wake time and transport
  sit in the small print, narrower card and slimmer Follow button
- Fixed: tooltips on the view-option buttons were clipped by the folding panel; the pixel-look choice is
  now remembered between visits
- Easier to pick people: hovering snaps to the nearest walker within a few pixels and prefers people
  over buildings; every name on a building or station card can be clicked to pin and follow that person
- Night lighting reworked: the station plaza is lit by its lamps instead of a glow per cell (it used
  to blow out to white), glows are softer, the night ambient is warmer and darker, and street lamps
  are now poles with an arm over the road, a housing lit from underneath, a faint beam and a pool of
  light on the asphalt
- The "Name tags" toggle is gone; tags now mark only the followed or pinned resident
- Hovering the station highlights all nine plaza cells, not just three
- Plaza walks (entrance to bench, bench to the street, vending machines) detour around the stair house
  instead of passing through it; vending machines are a head taller than a person, as they should be
- Station benches shrunk to hip height so people actually sit on them, and the pair in front of the
  stairs removed to keep the entrance clear (four seats on the north edge plus standing spots)
- Buildings can now be zoned on top of a street, so a two-cell gap between blocks can be filled in;
  the road reforms around the new block. The station's ring road stays clear and every building must
  keep a street on one side
- Two-lane avenues (blocks placed two cells apart) now show a proper dashed centre line and use one
  asphalt shade across both halves; the line was previously drawn too thin to see
- Trains bring a household when its home enters the final construction stage, so newcomers wait an hour or so and watch the builders finish; free beds in finished homes still draw arrivals, and only the very first train carries a hopeful with nowhere to go
- Nobody sleeps on a bench: anyone still waiting at 22:00 takes the last train to the city and comes back on the 06:00 train
- Homes now take about one working day to build (2 + 3 + 4 daylight hours); shops and workspaces keep the longer schedule
- People leave and enter buildings through the front door: doorstep, then kerb, then the sidewalk
- People are 30 % smaller (a storey is now about one and a half people tall); cats 20 % smaller
- Residents no longer spawn inside homes; population growth now depends on the train timetable
- Residential blocks are named after places (Sakura Terrace) instead of the first family, since
  residents keep their own surnames
- Demo town rebuilt around the station

## [0.1.0] - 2026-09-15

### Added

- Empty island with automatic roads around every placed block
- Residential, Shop and Workspace zones; drag to make blocks of one to three buildings
- Three visible construction stages and three growth levels per building
- Simulated residents with homes, jobs, shops, schedules, cars and activities
- Ambient cars and cats
- Hover and click inspection of buildings and people
- Day/night cycle with warm emissive windows and street lamps
- Explore mode, panning, zooming and 45° rotation
- Pixel look toggle, name tags, speed controls
- `?demo` pre-built town and `window.MT` dev hooks
- Headless smoke test, ESLint config, Vite build, GitHub Pages deploy workflow
