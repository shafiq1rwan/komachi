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

## ⬜ Phase 5 — Economy and dynamic businesses

- Gentle economy shown through behaviour: a shop with customers gets a new awning and stock, one
  without goes quiet, shutters early, and eventually changes what it sells
- Shop kind chosen from what the neighbourhood lacks rather than at random
- Household spending seen as shopping bags, deliveries and small purchases
- No bankruptcies or fail states; a business that struggles simply becomes something else
- **Hill plot market**: terrace plots are not zoned by the player but taken up by the town on demand:
  a well-off household builds a villa with a view, a tea house or lookout café appears once enough
  people stroll up, and later a ryokan or small hotel (Phase 6 tourism). Starts as demand-driven
  auto-build; money attaches once the economy exists

## ⬜ Phase 5.5 — Civic zone: utilities

A fourth zone. Nothing is gated on it (no blackouts, no failure states); each facility shows its
effect through the town instead.

- **Power substation**: transformers behind a fence, cables joining the utility poles; nearby lamps
  and windows glow a little warmer and steadier
- **Water works**: a tank and pipes; nearby homes keep greener gardens and residents water them
- **Recycling centre**: sorting bins and a kei truck that does a morning round; residents carry
  bags to the bins outside their homes on collection day

## ⬜ Phase 6 — Weather, events, festivals, tourism

- Weather: soft rain with umbrellas and puddles, overcast light, snow that whitens roofs
- Seasons for the trees and the sakura biome
- Gentle events: a market morning, fireworks, a summer festival on the plaza with stalls and lanterns
- Tourists arriving by train for festivals and the shore, staying a day
- A ryokan or small hotel on the hill terraces for visitors (from the Phase 5 plot market)

## ⬜ Phase 7 — Farming and fishing

- Farm plots as a zone: fields that change with the season, a farmhouse, a small truck to market
- Fishing from the pier and small boats; the catch appears at the grocery and ramen shop

## ⬜ Phase 8 — Mobile quality and PWA

- Quality levels (shadows, pixel look, ambient density) chosen automatically on phones
- Installable PWA with offline play
- Touch-first tool bar layout at phone width

## ⬜ Phase 9 — Menus, saves UI, photo album

- Title screen and pause menu, multiple named saves, island seed and biome pickers
- Photo mode: hide the HUD, frame a shot, save to an in-game album

---

## How a phase is delivered

1. Agree the scope from this file (or trim it) before starting.
2. Build, then verify with headless Edge screenshots and `npm run lint && npm run build && npm test`.
3. Update CHANGELOG.md (Unreleased), README.md, docs/ARCHITECTURE.md and this file.
4. Tick the phase here and refresh the handoff section in CLAUDE.md.
