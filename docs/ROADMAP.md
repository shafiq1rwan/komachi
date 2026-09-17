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

## ⬜ Phase 4 — Station commuting, bikes and taxis

- **Hill unlock** (small, first): the hill stays wild until the town reaches about 60 residents (tune
  after play). The unlock is an event to watch, not a message: a crew builds the two slope roads over a
  day, lanterns light along the torii path, a toast says the hill is open. Manual terrace zoning from
  Phase 3.5 remains available after the unlock until the plot market (Phase 5) replaces it
- Some residents commute to the city by train each morning and return in the evening
- Persistent bicycles: owned by residents, parked at racks, ridden to work and shops
- Taxis that wait at the station rank and carry arrivals with luggage to their new home
- Persistent cars: a resident's car stays parked at the kerb or in a small carpark while they are
  indoors instead of vanishing; carpark as a zone or kerbside bays
- Station busier at rush hour: platform sounds implied by movement, crowds on the plaza

## ⬜ Phase 4.5 (optional) — Canal

A seeded canal from shore to shore, stone-edged, with reeds and a heron. Canal cells are water;
roads that cross become bridge cells with railings so the town never splits in two. Footbridges for
walkers. Sets up fishing in Phase 7.

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
