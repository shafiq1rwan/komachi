# Changelog

All notable changes to Komachi are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Construction crews: three builders in vests and helmets ride the next train after a block is
  zoned, walk to the site, work until 18:00, go home down the stairs and return on the first
  morning train. A site only progresses while builders are on it; more builders build faster
- Five visible construction stages: survey stakes and sign → foundation slab with a mini digger and
  a pallet of blocks → timber frame → full scaffolding with roof frame, tarp and cement mixer →
  finishing touches on the real building with one scaffold still up and a wet-paint sign
- Kei trucks deliver materials from the station at the start of each stage and drive back
- Growing to the next level puts scaffolding and paint pots on the building for a couple of hours
- Inspect cards show the stage name, crew status, and builders can be hovered like residents

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
