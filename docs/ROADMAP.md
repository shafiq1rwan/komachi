# Komachi roadmap

The plan agreed between the author and Claude, kept here so both can refer to it. Phases are
delivered one at a time; a phase is done when it is built, verified by screenshot and `npm test`,
and recorded in CHANGELOG.md. Everything follows the one design rule: **a system may only show its
effect through residents, buildings, vehicles or light, never through a number alone.** Nothing is
punitive: no money to run out of, no failure states, no timers to beat.

Legend: ✅ done · 🔧 in progress · ⬜ not started

---

## ✅ Phase 1 — Island, identity, kit, props, ambient life, touch

- Organic seeded island with beaches, rocks, cliffs, pier and boat; water is unbuildable; `?seed=`
- Biomes as data: `suburban`, `sakura`, `coastal`
- Modular building kit: detached / narrow / apartment homes, seven shop kinds, three workspace kinds,
  each with signage, props and door position
- Street props: utility poles with cables along streets, traffic mirrors, notice boards, bike racks,
  potted plants, fences
- Streets: raised sidewalks with kerbs, dashed centre lines, zebra crossings at junctions, two-lane
  avenues when blocks sit two cells apart
- Pedestrian routing on one sidewalk, mitred corners, crossing at the end of the trip; cars keep left
- Komachi Station at the centre: everyone arrives by train, waits on benches, uses vending machines
- Vehicles: kei cars, hatchbacks, vans, kei trucks, taxis
- Ambient life: bird flocks, gulls, butterflies, swaying trees, rippling water
- Touch: pinch to zoom, twist to rotate, tap to inspect
- HUD redesign: slim top bar, clock and speed card, folding view toggles, tooltips, folding help card

## ✅ Phase 2 — Construction

- Five visible stages: survey → foundations with digger → frame → scaffolding → finishing
- Crews of three ride in by train, work 06:00–18:00, go home at night; nothing builds without a crew
- Builders do real tasks per stage (measure, dig, carry planks, saw, hammer, drill, mix, paint)
- Kei trucks deliver materials from the station at each stage
- Households are booked when their home enters the finishing stage; nobody sleeps on a bench
  (last train 22:00, back 06:00)
- Renovation scaffolding when a building grows a level
- Inspect cards for sites, crews and the station; progress pills over sites

## ✅ Polish delivered between phases

- Zoning over existing streets (except the station ring) so gaps between blocks can be filled
- Avenue centre lines visible and seamless
- Benches at hip height, entrance side of the plaza kept clear, plaza walks detour round the stairs
- Vending machines a head taller than a person
- People are Kenney Mini Characters (CC0), recoloured per person, with the pack's idle, walk, sit and
  work poses; the original box people stay behind `?boxes` and as the load fallback
- A terraced, wooded hill with a shrine opposite the pier (unbuildable)

---

## ✅ Phase 3 — Resident depth

- Households: couples, families and flatmates booked per home, arriving and moving in together;
  long waits split a household to fit smaller homes
- Needs (energy, food, fun, company, groceries) with utility-scored decisions at scheduled moments:
  meals at home and out, lunch breaks, grocery runs, strolls, visits, sleep
- Simulation LOD: off-screen and far walkers move in banked steps every sixth frame (the stronger
  "advance by schedule only" form was not needed at this town size; revisit if towns grow past ~200 people)
- Follow camera with a name tag; the Name-tags toggle was dropped in its favour
- Resident cards: household, who they live with, feeling in words, plan; home cards grouped by household
- Save/load: one localStorage slot, autosaved, versioned (`v: 1`); start-over button; `?new`
- Still open, carried to Phase 4: walkers crossing at zebra crossings instead of at trip end

## ✅ Phase 3.5 — Building on the hill

- Cell-aligned terraces: every hill cell is flat at its terrace height; retaining walls on cell edges
- Terrace cells are plots (a block sits on one terrace); wild wooded cells and the shrine summit stay
- Two permanent slope roads on the town side join the terraces to the town; walkers and vehicles use them
- Ground height is a cell property (`c.h`) plus a continuous `terrainY`; all movement follows it
- Chosen over the earlier "stone steps" idea: slope roads let cars and trucks reach the terraces too

## ✅ Phase 4 — Station commuting, bikes, taxis, traffic lights

- Hill unlock at 60 housed residents: slope roads appear, lanterns light the shrine path, plots open.
  Simplified from the "crew builds it over a day" idea to an instant opening with a toast
- Commuters (a quarter of households, plus anyone without local work): away by day, home on the evening
  trains, so the plaza and shops have a rush hour
- Persistent cars and bicycles parked on the plot beside the building (no carpark zone; plots have room)
- Two taxis at a plaza rank carry households to distant homes and return (no luggage prop yet)
- Traffic lights at every crossroads, one town-wide phase on game time; vehicles stop at red
- Not done, carried forward: pedestrians waiting at the lights and crossing there (walkers still cross at
  the end of the trip); a walk light on the signal heads

## ✅ Phase 4.5 — Canal, coast road, bridges

- Seeded canal in right-angled runs on the pier's side, stone banks, reeds, a heron; bridges appear where
  streets face each other across it and vanish when no longer needed
- Coast road as a rounded rectangle just inside the beach, permanent, broken at the hill, bridging the canal
- Not done: footbridges for walkers, a median on the coast road, and the **overpass / tunnel** (a cell
  holding two roads at two heights). Still optional; revisit if a player town ever needs a crossing

## ✅ Phase 4.8 — Japanese identity pass

Shipped 2026-09-17. The town read as generic pastel-European from a distance: plain gable boxes and
bare streets. This pass added the details that say "Japanese suburb" before the economy work begins.
All of it is set dressing and ambient behaviour; nothing is gated or scored.

- ✅ **Roofs and walls**: kawara tile roofs with courses, ridge caps and deep eaves, hip-and-gable
  (irimoya) on two-storey houses, block walls with the gate slid open, a genkan step and nameplate
- ✅ **Signage**: vertical signboards on shops (lit on the konbini and ramen shop), noren on the ramen
  shop and some cafés, a row of chōchin lanterns, the konbini fascia lit as a whole
- ✅ **Street details**: 止まれ stop marks before T-junctions, white kerb lines, a red post box by shops,
  a kōban on the station plaza, transformer drums and striped guards on the poles, guard rails on avenues
  (manhole covers already existed)
- ✅ **Greenery**: pruned pines and bamboo groves among the round trees, pocket parks with a swing,
  slide, bench and hedge near homes, a hokora with a red bib on quiet bends
- ✅ **Homes**: laundry and futons on balconies from 08:00 to 17:00, rooftop water tanks on level 2+
  shops (apartments already had one), bicycles and pots by the door
- Still open: kanji lettering itself (signs carry glyph blocks, not text), a level crossing (the line is
  underground), and laundry that reacts to weather (Phase 6)

## ✅ Phase 4.9 — Streets the player can shape

Agreed 2026-09-17, shipped 2026-09-21. The automatic square ring around every block makes the town read as a grid of identical
islands and produces the odd roads that keep showing up. Streets become the player's second verb, without
ever letting the town break.

- ✅ **Streets first, no ring**: the player draws streets and zones buildings beside them; doors face the
  street they were placed against and the station ring is the first street. A front-stub-plus-connector
  version was built first and dropped the same day: the town-laid joins between side-by-side blocks looked
  wrong, and guessing the player's intent always misfires somewhere (decided 2026-09-21)
- ✅ **Road tool** (key 5): click-drag draws an L-shaped run over land on one level or straight across the
  canal for a bridge; Remove (key 6) takes a cell away unless a building still opens onto it. Works with the
  same touch drag as zoning
- **Visible reasons**: not needed, since a building can only be zoned beside a street it is already joined to
- ✅ **Traffic lights**: a light only where two through-streets cross (every arm straight for two cells);
  other crossroads get painted stop lines. Walkers wait at the kerb of a signalled crossing while the cars
  have the green and cross when it turns
- ✅ **Keeps working**: routing, avenues, bridges, coast road, hill slopes, parking and lamps follow the new
  streets; the ring-road smoke checks were rewritten and two new ones cover the Road tool and lights
- Done before Phase 5 so the ferry slipway, builders' yard and plot market build on the final road model

## ✅ Phase 4.95 — Building variety pass

Agreed and shipped 2026-09-21. Visual variety does not need the economy, and it is what the player sees first. Each zone
gets several distinct generators per size, and every building varies its details from its seed.

- ✅ **Several looks per zone**: detached homes are cottage, machiya or modern box (plus the narrow house and
  apartments); shops keep their seven kinds and gain three wall finishes, three awning shapes and hanging
  signs; offices come as glass, punched-window or louvred (plus workshop and studio)
- ✅ **Details from the seed**: balcony side, corner windows, shutters, dishes, corrugated cladding, slats, tile
  bands, sign positions, lattice windows, engawa steps
- ✅ **Roofs multiply it**: with the kawara / tile / metal split, a home has 3 × 3 × 3 silhouettes before colours
- Size-based generators (terrace pair, manshon, restaurant, supermarket, shotengai, factory, warehouse) wait
  for Phase 5, where the size tiers give them their roles
- Stays procedural in the current kit style; no building pack
- Phase 5 then reuses these generators when its size tiers decide role and capacity

## ✅ Phase 5 — Economy and dynamic businesses (complete 2026-09-22)

- ✅ **Light economy** (shipped 2026-09-21): shops count customers per day; reach by kind (`REACH` in sim.js);
  busy shops (5 visits per level a day) fly nobori banners; a staffed shop with under one visit per level a day
  for three days, in a town with three or more shops, changes trade to another kind of its tier (`changeTrade`):
  staff let go, shutters and scaffold for three hours, then a reopening notice. Nothing closes for good
- ✅ **Size tiers by drag length** (agreed 2026-09-21, shipped the same day): the number of cells dragged decides
  the building's shape and role, shown on the card before placing ("2 cells: café or restaurant").
  Residential: 1 = detached or narrow two-storey house (1–2 households); 2 = low apartment block or a pair of
  terrace houses (4–6; houses and terraces grow to two storeys at most, a two-storey house holding a family of three); 3 = a three-storey manshon with lobby, bike shelter and rooftop tank (8–10, the only home
  that can grow a fourth floor). Shop: 1 = konbini, bakery, florist, bookshop or ramen counter (quick visits);
  2 = café, kissaten or family restaurant with outside seats, or grocery (people linger); 3 = small supermarket
  or a covered shotengai arcade with three fronts under one canopy (draws people from further, the first
  landmark). Workspace: 1 = studio, small office or clinic; 2 = workshop with a yard and roller shutter, or a
  design office; 3 = small factory, warehouse by the coast road (fed by the ferry's cargo later) or office
  block (most jobs). Kinds within a tier still vary by roof style and colour, but shape and scale are fixed
  by the tier. These tiers are what the economy picks between when a business opens or closes
- ✅ Gentle economy shown through behaviour (2026-09-22): a shop with customers flies banners, puts up a striped awning
  and stacks stock by the door; one without goes quiet, shutters at 19:00, and eventually changes what it sells
- ✅ Shop kind chosen from what the neighbourhood lacks rather than at random (2026-09-22, `chooseKind` in world.js:
  the kind of the tier whose nearest example is furthest away, for new blocks and trade changes)
- ✅ Household spending seen as shopping bags, deliveries and small purchases (2026-09-22): bags from grocer-type
  shops, a can of tea carried home from the konbini, and passing vans that pull up at a home's kerb for a while
- No bankruptcies or fail states; a business that struggles simply becomes something else
- ✅ **Hill plot market** (shipped 2026-09-21): terrace plots are taken up by the town on demand, and the
  player may still zone them too. `hillMarket` runs at the day's turn: a settled household (all employed or
  commuting, two days in town, living on the flat) gets a villa on the highest free plot beside a hill street
  that reaches the town (`hillPlots`), and moves up when it is finished (`moveUp`); once a villa stands and six
  or more trips end up the hill in a day, a tea house opens on the plot nearest the shrine path. If the hill has
  no street the town lays one short lane from the top of an island slope (`layTerraceLane`). A ryokan or small
  hotel waits for Phase 6 tourism. No money changes hands; demand is the trigger

- ✅ **Car ferry** (agreed 2026-09-17, shipped 2026-09-21; `src/ferry.js`): nothing on wheels appears out of thin air any more. A small ro-ro ferry
  (the Komachi Maru, an original island ro-ro since 2026-09-22; a repainted Kenney cargo ship before that) calls at the pier a few times a day and lowers a ramp onto a
  slipway joined to the coast road. Residents order a car once they have a job and have settled in; it rolls
  off the next sailing, drives to their street and parks at the kerb. Visiting cars and delivery vans arrive the
  same way and drive back to the pier to leave. The taxis belong to the island: the first two are delivered by
  the opening ferry and live at the station rank from then on, and a third is delivered when the town grows. A household that moves away takes its car
  with it. The flatbed truck can carry a new car to a home far from the coast road; bikes come from a bike
  shop kind, wheeled home. Replaces the instant spawning of owned cars and ambient traffic.
- ✅ **Building materials by sea** (agreed 2026-09-17, shipped 2026-09-21): the ferry's deck carries visible pallets and a container,
  unloaded into a small fenced builders' yard by the slipway (stacked timber, sacks, a container). The flatbed
  truck loads there and drives to the site, and the yard looks fuller while several sites are under way. Purely
  visual: nothing is counted or gated, and construction time is unchanged, driven only by the stage clock and
  the crew on site.
- **Landmarks**: a summit observation deck beside the shrine once the hill opens; the tea house and ryokan on the
  terraces are landmarks in their own right

## ✅ Phase 5.5 — Civic zone: utilities (complete 2026-09-22)

A fourth zone. Nothing is gated on it (no blackouts, no failure states); each facility shows its
effect through the town instead.

- ✅ Slice 1 (2026-09-22): the Civic tool (key 8); substation, water works and recycling centre on one cell from the civic
  kit, the public bath on two or three cells from the landmark kit; two workers each; a notice board on every civic corner.
  Slice 2 is the effects below.

- ✅ **Power substation** (2026-09-22): transformers behind a fence; windows within six cells glow steady and a
  shade warmer (lamps unchanged; cables run from the frame to the two nearest poles)
- ✅ **Water works** (2026-09-22): a tank and pump house; homes within six cells fill out with greener corners and
  flowers, and residents water the garden with a watering can before going in
- ✅ **Recycling centre** (2026-09-22): sorting bins and a kei truck that does a nearest-first morning round every
  third day; bags stand at each home's kerb from 6:00 until the truck has passed (a resident carries them out
  in the morning, or they appear by 7:15)

- ✅ **Landmarks** (2026-09-22): town hall, community centre with the chronicle case, clinic, fire station with its
  kei truck's morning round, public bath with its chimney; residents visit them, so the effect shows on the street
- ✅ **Registering as a resident** (agreed 2026-09-17, shipped 2026-09-22; the kōban stands in without a town hall): after a household moves in, one member walks to the town
  hall, spends a moment inside and comes out with a small folder ("registering at the town office"); the town
  chronicle logs it. Until the town hall exists the kōban by the station stands in. Never gated: a household
  that skips it is still at home
- **Hand props from the user**: low-poly GLBs, one mesh each, Y up on Y=0, tool scale (about 0.066 tall for the
  can), vertex colours so they can be repainted: drink can (body mesh `can`, optional `label`), shopping bag,
  briefcase, umbrella (Phase 6), registration folder, under `assets/props/` with a README like the dog's

## ✅ Phase 6 — Weather, events, festivals, tourism (complete 2026-09-23)

- ✅ Weather, first slice (2026-09-22): a weather clock of clear, overcast, light rain and rain spells; drifting cloud shade
  (the clouds themselves are not drawn); overcast light; rain streaks that wet the streets; umbrellas on the walk (puddles and snow followed, below)
- ✅ Seasons for the trees and the sakura biome (2026-09-22): a 24-day year; canopies turn with the season, leaves and
  petals fall; winter brings snow on the ground, roofs and crowns, and snowflakes in place of rain
- ✅ Speech bubbles (agreed 2026-09-22, shipped 2026-09-23): a small cream bubble over the head, drawn as a 2D overlay like the name tags, with
  pulsing dots or a small pictogram (rice bowl, house, cloud, shop front), never text; bubbles alternate between two
  speakers. Shown for bench chats, household visits, passers-by who know each other and stop a moment on the pavement,
  and later stall vendors and customers. Hidden when zoomed far out
- ✅ Puddles on the streets after a shower, drying over an hour (2026-09-23)
- ✅ Gentle events (2026-09-23, src/events.js) on a town square the player places (three cells, Civic tool; decided 2026-09-23 over
  an automatic festival ground or the shrine path): a Sunday market morning, and the summer festival on the first Saturday of
  summer with the festival kit's yatai, lanterns, taiko, bunting, nobori and mikoshi, and fireworks over the sea in code
- ✅ Tourist bus (2026-09-23; assets/destinations, src/tourists.js): at weekends it comes over on the morning ferry, loops between a
  stop on the station ring and one by the lighthouse, stopping at bus shelters, and leaves on the 17:00 ferry
- ✅ Tourists (2026-09-23, src/tourists.js): off the morning trains on fine days (more at weekends), out to a landmark or two, a
  photo with a camera prop built in code, often a shop visit and a paper bag, home by train; festivals will bring more
- ✅ A ryokan on the hill terraces for visitors (2026-09-23; built by the Phase 5 plot market once visitors come and the tea house stands):
  weekend and festival visitors stay the night and check out in the morning

- ✅ **Landmarks** (shipped 2026-09-23; src/landmarks.js, models in assets/destinations): a lighthouse on the rocky headland with a
  sweeping beam, a red arched footbridge over the canal that walkers climb to its crown, a park pavilion with benches under
  cherry trees beside it (every biome); the shrine path lanterns came with the hill opening. Residents on a stroll walk out
  to them now; tourists arriving by train will too

## ✅ Phase 7 — Farming and fishing (complete 2026-09-23)

- ✅ Farm plots as a zone (2026-09-23; Farms tool, key 9): fields and paddies that change with the season, a farmhouse, farmers out
  in the fields, a truck taking produce to the shops, a greenhouse; rice paddies turn a water wheel on the canal
- ✅ Fishing (2026-09-23, src/fishing.js): anglers on the stone quay, the boat's dawn run to its grounds, the catch at a fish market on
  its own lot by the quay and a van taking it to the grocery, supermarket, ramen shop, restaurant and konbini (a crate at each door).
  Homemakers came with it: one adult in about half the couples and families keeps the house and does the day's errands

- **Landmarks**: a fish market by the pier, rice paddies with a water wheel on the canal, a greenhouse

## ✅ Phase 8 — Mobile quality and PWA (complete 2026-09-24)

- ✅ Quality levels chosen automatically on phones (2026-09-24): the Settings card (src/quality.js) with Auto, low, medium and high
  presets for resolution, frame cap, the rich look's effects, shadows, lamp light and busy details (fewer birds, leaves and
  raindrops, far people animate less often); Auto steps the resolution down while frames drop
- ✅ Installable PWA with offline play (2026-09-24): manifest and icons in public/, a service worker written by the build
- ✅ Touch-first tool bar layout at phone width (2026-09-24): the phone dock, the building picker strip with arrows and swipe,
  Streets and Car park under one button, compact cards
- The desktop app moved to Phase 10, the last phase (decided 2026-09-24): every feature is checked first

## ⬜ Phase 9 — Menus, saves UI, photo album

- ✅ Title screen and pause menu, multiple named saves, island seed and biome pickers (2026-09-24: src/title.js, src/slots.js)
- Photo mode: hide the HUD, frame a shot, save to an in-game album
- ✅ **Opening cinematic** (shipped 2026-09-25: the carriage scene with seated newcomers, the iris wipe onto the island, skip, replay from the pause menu) (idea from 2026-09-17): a short scene of newcomers chatting on a train, then an iris
  wipe, the picture shrinking to a black circle and reopening from a point over the island. Built from the
  existing Kenney characters and a clip-path overlay; skippable, replayable from the menu

## Mini-games (agreed 2026-09-25, gentle, nothing scored)

- Fishing at the jetty (built 2026-09-25, hidden behind a flag until its bugs are fixed): cast, wait for the bite, strike; catches open the fish stall
- Festival stalls (goldfish scooping, ring toss), a spotting album with photo mode, the postman's round, garden tending,
  lighting the shrine lanterns, piloting the ferry through the harbour entrance

## ⬜ Phase 10 — Desktop app (the last phase)

- **Desktop app with Electron**: the same Vite build wrapped for Windows, macOS and Linux, with a native
  window, saves in the user data folder instead of browser storage, and installers from CI
- Comes last, once every feature has been checked in the browser build (decided 2026-09-24)

---

## Sense of achievement (cross-cutting, agreed 2026-09-17)

Nothing is scored or punitive, so achievement has to be felt through the town itself. Ideas to weave into
the phases above, roughly in order of payoff:

- ✅ **Milestone announcements** (agreed 2026-09-22, shipped 2026-09-23; src/milestone.js): a milestone gets more than the slim notice. A larger cream card slides
  in at the top centre with a title, one line and a pictogram, stays about ten seconds or until dismissed, and offers a
  button to go and look; the camera glides to the place for a few seconds while the change plays out, then returns. The
  hill opening is the first: the lanterns light one by one along the shrine path and the road crew stands at the top a
  moment before walking down. Later milestones (first festival, hundredth resident, ferry's first call) reuse the card.
- **Milestones that change the world**: the hill opening at 60 residents is the model. Add more of them:
  the station gains a second platform canopy and an express service at 100, the coast road gets lamps and
  a promenade at 150, the town name goes up on a plaque at the station once ten households live here.
- ✅ **A town chronicle** (2026-09-22, src/chronicle.js): milestones with the day, shown in the community centre's
  display case on its card and saved with the town. First family, first shop, first festival, the day the hill opened. Photo mode (Phase 9) saves a picture with each entry.
- **Residents who remember**: long-time residents mention how the town used to be, and the first household's
  home gets a small memorial plaque. Children born here (Phase 6) grow up and take jobs.
- **Visible growth on the street**: shops that are popular get bigger signs and queues, homes that have been
  lived in for a long time gain gardens, wind chimes and extra pots. Nothing is unlocked, it accumulates.
- **Small ceremonies**: the first train of the day gets a station announcement toast, a finished landmark gets
  a ribbon-cutting with residents gathered, the New Year festival returns every 12 game days.

## How a phase is delivered

1. Agree the scope from this file (or trim it) before starting.
2. Build, then verify with headless Edge screenshots and `npm run lint && npm run build && npm test`.
3. Update CHANGELOG.md (Unreleased), README.md, docs/ARCHITECTURE.md and this file.
4. Tick the phase here and refresh the handoff section in CLAUDE.md.
