# Changelog

All notable changes to Komachi are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).


## [Unreleased] - 2026-09-17

Phases 4 and 4.5 plus the polish that went with them.

### Added

- Shiba animation corrections: fitted inner ears, seated haunches and grounded paws,
  working rear-leg gait at every simulation speed, and shared game/GLB animation clips.
  Dogs now sniff during short pauses and hold their seated pose during longer pauses.

- Original low-poly Shiba Inu with pointed ears, cream markings, four coat colours and
  a curled wagging tail. The reusable GLB includes walk, idle, sit and sniff clips;
  growing towns now gain one or two occasional neighbourhood dogs on pedestrian routes.

- Builder work gloves now have compact tan palms, visible thumbs and darker cuffs,
  making the hands distinct from the navy sleeves while retaining their animation weights.

- Dedicated construction builder derived from a separate copy of a Kenney Mini Character:
  fitted hard hat with dome, brim, ridge and vents, plus reflective workwear. Preserves all
  32 source animations and the construction tool attachment; includes an editable model
  generator, self-contained GLB and pose preview.

- Phase 4.8, the Japanese identity pass. Roofs: a third of homes get grey kawara tile roofs, and every tile roof
  now carries tile courses, a ridge cap with end tiles and deep eaves; two-storey detached houses have a
  hip-and-gable (irimoya) roof. Houses get a concrete-block wall with the gate slid open in front of the
  door, a genkan step and a nameplate. Shops hang vertical signboards off the front corner (lit at night on
  the konbini and the ramen shop), the ramen shop and some cafés hang a noren over the door, the ramen shop a
  row of red chōchin lanterns that glow after dark, and the konbini fascia lights up as a whole. Level 2+
  shops carry a rooftop water tank. Laundry and futons hang on balconies between 08:00 and 17:00.
- Streets: white kerb lines along straight stretches, painted 止まれ stop marks in the near lane on the
  approaches to T-junctions, white guard rails along avenues, transformer drums and striped guards on the
  utility poles, a red post box outside some shops, a hokora (wayside shrine) with a red bib on some quiet
  bends, and a kōban (police box) on the station plaza
- Greenery: pruned pines (matsu) and bamboo groves among the round trees; pocket parks with a swing, a
  slide, a bench and a hedge appear on some empty cells beside a street near homes
- Phase 4.5, water and the coast:
  - A canal from shore to shore on the pier's side of the island, laid in straight runs with right-angle
    bends, stone banks with copings, reeds and a grey heron. Nothing is built in it; zone on both banks and
    a bridge spans the water where the two streets face each other, with pavements, red railings and stone
    piers. A bridge nobody needs goes back to water when its blocks are removed
  - A coast road just inside the beach, laid as a rounded rectangle around the island; it breaks at the hill
    and crosses the canal on bridges. It is permanent, ambient traffic uses it, and blocks zoned beside it
    join the town through it
- Phase 4, the station and the streets:
  - The hill opens once 60 people live in town: the island's slope roads appear, stone lanterns light the
    shrine path at night, and terrace plots become zonable. Until then the hill is wild and the toast says so
  - Commuters: a quarter of new households keep a job in the city, and anyone who finds no work in town may
    start commuting too. They walk to the station in the morning, are away for the day and come home on the
    first train after their shift, so the evening trains bring a rush of people through the plaza and shops
  - Parked vehicles: a resident's car now waits on the plot beside their home or workplace while they are
    inside, and drives off from there; nothing vanishes into a building any more
  - Bicycles: almost half of the residents without a car own a bike, ride it to work and the shops keeping
    left along the kerb, and park it beside the building
  - Taxis: two wait at a rank on the plaza's south edge; a household moving to a home far from the station
    rides together, is dropped at the kerb and the taxi returns to the rank
  - Traffic lights at every crossroads, Japanese-style horizontal three-lamp heads on a corner pole, one per
    axis, cycling on game time; cars, trucks and taxis stop at the line on red
- A living sea: foam bands lap the beaches in turn, fish leap out of the water with a splash ring where
  they leave and land, a school of fish drifts along the shore just under the surface, and a small fishing
  boat (Kenney Watercraft kit, CC0) bobs on a slow circuit offshore, trailing a wake
- Standalone low-poly dolphin model with a pale belly, swept fins and animated horizontal
  tail flukes; reusable GLB with a swim clip, editable generator and interactive preview.

- Original low-poly neighbourhood cats with bevelled bodies, pointed ears, cream paws,
  curved tails and five coat colours. Cats animate their legs while walking and glance
  around while idle. Includes an animated GLB export and an interactive model preview.
  Ears have compact proportions with pink insets fitted to their sloping front faces.

### Changed

- Roadmap: building materials arrive on the ferry into a builders' yard by the pier (visual only, no effect on
  construction time)
- Roadmap: Phase 5 gains a car ferry at the pier, so owned cars and visiting traffic arrive and leave by sea
  instead of appearing on the island; the taxis are delivered once and stay at the station rank
- Roadmap: landmarks noted per phase (observation deck, civic buildings, lighthouse and arched bridge, fish
  market and paddies) and a cross-cutting note on sense of achievement (world-changing milestones, a town
  chronicle, residents who remember, visible growth, small ceremonies)
- Roadmap: Phase 9 gains an opening cinematic (newcomers on the train, then an iris wipe onto the island)
- Notices (a train pulling in, a crew arriving, the hill opening) now appear as a small cream card with a bell that
  slides in under the town figures at the top left and stays a little longer, instead of a dark pill over the town centre
- Komachi Station is remodelled in a Japanese style: an open pavilion with a hipped kawara roof and deep eaves over
  the stairwell, cream pillars and side screens, a lit window band on the back wall, the station name board on the
  front eave with a sage band, a clock and two square paper lamps; a 駅名標 name board stands behind the benches and
  a lit line-mark pillar by the vending machines (the arched sage roof is gone)
- The canal mouth flows straight to the sea: the fall lands in a walled channel that runs across the beach and
  steps into the water, with no plunge pool. Canal walls are pale stone and a little lower (the shaded face of
  the old rock colour read as a green outline), and the water surface no longer shows seams between cells
- The canal only meets the coast at its two ends, so there is one waterfall per end instead of one at every
  cell that ran near the beach; canal ripples are mapped in world units at the sea's scale and run continuously
  along the flow, so canal and sea carry the same pattern
- The fishing boat now heads bow-first (the model was turned round), and its shadow and matte finish are back
- While the hill is closed, its slope roads stay clear of woods and a striped barrier with a no-entry sign stands
  at the foot of each; the barriers go when the hill opens
- Sea and canal ripples are finer and much fainter, so the water reads as a calm colour from far out rather
  than a blotchy pattern; bamboo never grows beside a street (the tall culms looked as if they stood on it)
- Water is pastel blue now (sea, canal, foam) instead of mint and grey-teal, and the canal has stone walls on
  every closed side; the grass bank that read as a green stripe along one edge is gone
- The canal now ends in a waterfall: the channel runs to the land edge and pours down the cliff face in an
  animated sheet onto a plunge pool in the sand, with foam and wet rocks, then a pebble-lined stream carries it
  over the beach and down a last step into the sea. Where the coast road lies between the canal end and the
  shore, the water leaves through a culvert under the road and falls from an outlet in the cliff. The old
  stepped slabs at the mouth are gone
- Pixel look is off by default; the toggle is still remembered once you use it
- Roadmap: a Phase 4.8 Japanese identity pass (roofs and walls, signage, street details, greenery,
  balcony life) now comes before the economy phase
- Vehicles are a third larger (a sedan is about two people long); traffic keeps a longer gap to match
- The station plaza stays alive: a hopeful still steps off now and then when every bed is taken, commuters wait
  on the plaza when their train is due, and most pause on a bench or by the planters when they get back
- Inspect cards no longer scroll: long activity text wraps under the name, the station list shows eight
  people with an "and N more" line, and on phones the card is a compact panel under the clock at the top right
- HUD cards have equal padding on both sides; a folded panel no longer leaves a gap on the right
- Canal: the ripples now run along each stretch in the direction of flow, from one shore to the other,
  and the vertical stone walls became sloped grass banks with a low stone kerb
- Bridges have no centre line, and their railings sit only on the sides without a street, so a bridge on a
  bend stays open where the road turns; the canal mouth is a stepped cascade onto the beach and into the sea
- Small screens keep the two HUD cards side by side with smaller chips, buttons and clock, the town figures
  folded to start, and a compact tool bar without key hints
- Fixed: bridge railings sometimes ran across the deck. Bridges now orient by where the canal is, and the
  canal may no longer run along the coast road (which produced bridges with water on both sides)
- HUD: the speed buttons moved inside the folding options panel (Space still pauses), and the town figures
  on the left fold behind a chart button
- Streets: one asphalt shade instead of the two-tone patchwork, and centre dashes run through corners and
  junctions as well as straights (the zebra-crossing arm stays clear)
- Canal: ripples drift along the water so it reads as flowing, the mouth spills down the beach into the
  sea, and bridges are a thin deck on piers with the canal running visibly underneath
- Hill terraces are less boxy: where a terrace drops to a lower level the wall gets a sloped earth skirt, and bushes and rocks are scattered along the base
- The hover highlight fades with the daylight instead of glowing at night; no street lamps on the ring road
  around the station (the plaza has its own); the plaza bins moved from the edges to two corners by the lamps
- Fixed: routing let cars and walkers step between neighbouring roads on different terraces, so they drove
  off retaining walls and floated over the street below. Roads now connect only at the same height, or
  along a slope road's own axis; cables no longer span a terrace wall
- Sea: the ripple texture tiles seamlessly (streaks drawn with wrap-around) so the water no longer shows
  square patches; the fishing boat has a real wake, two foam lines fanning from the stern and rings that
  spread in its trail, and sails bow-first
- Hill blocks get a single street in front, on the side facing the town, instead of a full ring. Town-built
  slopes and links are recomputed whenever blocks change: a slope never sits inside a block's ring or alongside
  a street (so it cannot cut one), a slope down to the flat must be able to reach the town, and ground-level
  links always end at a real street rather than at another slope's foot
- Vehicles are now Kenney Car Kit models (CC0): sedans, hatchbacks, SUVs, vans, flatbed kei trucks and
  taxis, each recoloured to its owner's colour with shading kept; the box cars remain the fallback. A sedan
  is about one and a half people long
- Traffic: cars and trucks slow down and queue behind a vehicle close ahead in their lane instead of
  driving through it
- Removed unused assets: the earlier custom character model and its Blender sources and previews, the
  Kenney accessories and wheelchairs, stray atlas copies and an unreferenced doc screenshot
- Kenney Mini Characters are now the default people; `?boxes` brings back the box figures (they also
  remain the fallback if the models fail to load)

### Fixed

- Street lamps stand along every street: on most cells that pass a building and every third cell elsewhere,
  so ring roads, avenues, the coast road and hill streets are lit at night (they used to be dark)
- Parked cars no longer overlap their homes: a car waits at the kerb of the street in front, half on the
  pavement with the home on the driver's left, two bays per street cell; bikes still park on the plot
- Every hill now has both island slope roads: when the middle terrace was only one cell deep, the lower ramp
  landed on the upper ramp's foot and was lost, leaving the bottom terrace with no slope of its own
- Queued vehicles leave about a quarter of a car length between bumpers instead of touching
- The shrine faces along the slope roads' axis toward the town, so the torii and path square up with the
  road that climbs to the summit (it used to face the island centre diagonally); nothing grows over the canal:
  trees beside it become bushes set back from the bank, and shoreline reeds and bushes keep out of the mouth
- Dusk and dawn no longer flash: the sun slides over to the moon's position as the light fades instead of
  snapping there at 19:30 and 05:30 (shadows used to flip and the scene got brighter for a frame)

## [0.2.0] - 2026-09-16

Phases 1, 2, 3 and 3.5, built between 15 and 16 September.

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

- Hill streets: a block's ring road now forms only on its own terrace, so a house against a retaining wall
  gets its street in front and nothing on the terraces above or below. A terrace street with no way down
  gets a slope road built by the town at the nearest edge toward the station (walking through the woods
  to reach one if it must), and every slope's ends link to the nearest street. Town-built slopes dissolve
  with the block that needed them. Hill woods are now drawn per wild cell, so a cell that becomes a road
  loses its trees
- Hill: roads on a terrace now find their own way to the slope road, and the slope's foot links to the
  nearest street below, so a hillside home is never cut off (links are cleared and rebuilt when blocks
  go); the summit shrine is a proper hall with a stepped roof, red pillars, a torii with upturned beam
  ends, lanterns and a flagged path; cars and trucks pitch nose-up when climbing a slope
- Rigged builders (Kenney people) hold their tools in the right hand and use the pack's own poses
  (swing, hold, pick up, crouch) instead of the box-people motions; smaller helmets that perch on the head
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
