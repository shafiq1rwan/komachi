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

---

## ⬜ Phase 3 — Resident depth

Goal: residents feel like people with lives, and the town stays smooth as it grows.

- **Households**: people who live together share a home, a surname or a relationship, and a
  rhythm (leave together, eat together, one stays home)
- **Needs**: hunger, rest, work, shopping, leisure, social. Each decays over the day
- **Utility-scored decisions** at scheduled intervals (not every frame): pick the activity that
  best satisfies the strongest need, given what is reachable by road and open right now
- **Simulation LOD**: near residents animate fully; visible-far residents update less often;
  off-screen residents advance by schedule only and reappear in the right place
- **Follow camera**: pick a resident and the camera tracks them until you move it
- **Richer inspect cards**: household card (members, who is home, what they are doing), resident
  card with needs shown as words and gestures, not bars
- **Save / load**: localStorage first, with a versioned data model, before the model grows further
- Open decisions to settle at the start of this phase:
  - Name tags: fold into "tag the followed or pinned resident only" and drop the toggle
  - Whether walkers cross at zebra crossings instead of at the end of the trip

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
