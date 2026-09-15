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
- Box people kept as the default; rigged GLB available with `?rigged`
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

## ⬜ Phase 3.5 (optional) — Building on the hill

Deferred until save/load exists, since it adds a ground height to the data model.

- Terrace cells become buildable when a whole block sits on one terrace level; the block and its
  ring road are raised to that height
- Cells on a terrace lip stay unbuildable; the summit stays reserved for the shrine
- Walkers use the stone steps between terraces; roads, kerbs, lamps, doorsteps, cars and trucks read
  a per-cell ground height instead of assuming zero

## ⬜ Phase 4 — Station commuting, bikes and taxis

- Some residents commute to the city by train each morning and return in the evening
- Persistent bicycles: owned by residents, parked at racks, ridden to work and shops
- Taxis that wait at the station rank and carry arrivals with luggage to their new home
- Station busier at rush hour: platform sounds implied by movement, crowds on the plaza

## ⬜ Phase 5 — Economy and dynamic businesses

- Gentle economy shown through behaviour: a shop with customers gets a new awning and stock, one
  without goes quiet, shutters early, and eventually changes what it sells
- Shop kind chosen from what the neighbourhood lacks rather than at random
- Household spending seen as shopping bags, deliveries and small purchases
- No bankruptcies or fail states; a business that struggles simply becomes something else

## ⬜ Phase 6 — Weather, events, festivals, tourism

- Weather: soft rain with umbrellas and puddles, overcast light, snow that whitens roofs
- Seasons for the trees and the sakura biome
- Gentle events: a market morning, fireworks, a summer festival on the plaza with stalls and lanterns
- Tourists arriving by train for festivals and the shore, staying a day

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
