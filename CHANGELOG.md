# Changelog

All notable changes to Komachi are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).


## [Unreleased] - 2026-09-17

Phases 4 and 4.5 plus the polish that went with them.

### Added

- Quay now shares the island waterfront's cool stone and paving palette, course heights and
  coping level. Deck slabs no longer overlap at the T-head; water steps have solid supports,
  and stone colour indexing handles both sides consistently. Shore plants clear the quay's
  footprint across seeds. The moored boat now uses the
  existing Kenney fishing GLB and atlas, sharing one cached load with the offshore boat.

- Procedural layout grammar for rich detached homes and villas: independently seeded footprints,
  finishes, roof proportions and details; aligned facade bays and entrance paths; one-storey homes
  grow to two storeys without moving their entrance. Hip-roof courses follow the slopes using
  bounded surface ribbons instead of boxes. Added `test:architecture` (384 deterministic geometry
  cases) and `preview:architecture` (a seed/level contact sheet).

- Standalone folded newspaper prop with layered cream paper, KOMACHI masthead, front-page
  town illustration and printed back columns; includes GLB and front/rear previews.

- Standalone handheld smartphone GLB with rounded sage case, camera lenses, geometry-only
  home screen and independent screen material; includes front/rear previews.

- Standalone subway pavilion within a 0.9-by-0.9 footprint and 0.7 ridge height: open descending
  stairs with no pit floor, tiled hip-and-gable roof, clock and independent Window_Band,
  Name_Board, Lamp_L and Lamp_R materials. Includes GLB, night/cutaway previews and clearance checks.

- Standalone civic model kit: substation frame, elevated water tank, four-bin recycling row,
  shrine-path torii, roofed community notice board, fire hydrant and hinged hose cabinet.
  Includes seven GLBs, placement metadata and front/rear previews.

- Standalone neighbourhood model kits: three utility pieces, eight shop facade pieces and
  eight home yard pieces (including the existing city bicycle). Includes 19 GLBs, placement
  metadata, a gate hinge pivot, separate laundry, and front/rear previews.

- Standalone street-furniture model kit: vending machine, bench, bus shelter, horizontal traffic
  light, directional signs, flower planter and bike rack. Includes GLBs and front/rear previews.

- Trees in the town now come from the nature kit (src/nature-kit.js): matsu, bamboo, pine, broadleaf (cherry in
  the sakura biome) and shore rocks, one deterministic model per cell, scaled 0.85 to 1.25 and tinted from the biome.
- The summit shrine is now the landmark kit's shrine set (src/landmark-kit.js: hall with lattice doors, offering box, bell
  rope, paper ornaments, stone lanterns and its own torii), facing the town as before, with the kit's larger torii gate at
  the foot of the lantern path on the terrace below. The lit path lanterns are unchanged.
- Slipway: the ferry's slip is chosen on a straight stretch of coast road with a clean shore (no rocky stretch, no canal
  mouth and waterfall nearby), the lane leaves the road at right angles along the grid instead of on a ray from the
  island's centre, and the ground it crosses is cleared of rocks and reserved. Stop signs stand on the kerb strip, never on
  the slipway or in the yard.
- Car park tool (key 7): the player drags one or two cells beside a street and gets a small car park with four bays a
  cell, a sign and hedges. Homes and workplaces within six cells park their cars there nose-in before falling back to the
  kerb, so the stack of cars in front of a block of flats or an office goes once a car park stands nearby. When a kerb
  fills up a notice says so once, and the building's card shows "Cars line the kerb outside" until a car park takes them.
  The Remove tool clears a car park (its cars go back to the kerb). The taxis wait in their own car park across the ring
  road from the station entrance. Car park cells (`c.park`) are neither zonable nor drawable. Saves are v3 (car parks).
- The Car park tool is labelled Parking in the tool bar, help card and notices.
- Clouds are no longer drawn as shapes; what shows is their shade. Each cloud is an invisible cloud-shaped shadow caster,
  so soft patches of shade drift over the town with the wind, more of them under a heavy sky.
- The slipway is a proper street: the lane from the coast road to the shore is real road cells on the grid (kept, not
  zonable), drawn like any street, ending in a concrete slope down to the beach; no slanted lanes. The berth notice says
  cars are rolling off only once one has. The smoke summary names any failed checks.
- The sea is calm bay water (src/water.js), in both looks: a muted blue-teal, lighter over the shallows along the coast (the
  shader evaluates the island's own coastline), with a slow broad colour drift; three broad, slow swells in different directions,
  warped by noise, and a faint fine ripple bend its normals for soft diffuse light; sparse short glints on the crests fade at
  night; a faint hint of the sky colour, no Fresnel and no mirror. Matte and opaque, it keeps the sun, the cloud shade and the fog.
  The two tiled ripple layers over the sea are gone (the canal keeps its drifting ripples).
- Settings (src/quality.js; the gear in the top-left card): quality presets Auto, Low, Medium and High, and every setting on its
  own, applied live and remembered: render resolution, a frame-rate cap (30, 45, 60; paused never runs above 30), shadows (off, low
  redrawn a few times a second, high), real lamp light, and the rich look's soft contact shadows (half resolution below High),
  miniature blur and smoothed edges. Auto picks Low on phones, Medium on small machines and High elsewhere, and steps the
  resolution down while the frame rate cannot keep up. An optional frame-rate readout helps tune it on the device. The rich
  look, pixel look, centre-camera and new-island buttons moved from the top bar into the card.
- Work trucks (src/work-trucks-kit.js, models in assets/work-trucks): builders' materials come on a peach flatbed with a folding
  crane and strapped timber (the crane swings round over the kerb to unload, and the truck leaves with an empty bed); the farm's
  produce round is a mint keitora with slatted crates of vegetables; the catch goes round on a cream refrigerated fish van with
  a blue stripe. Their wheels roll, their own head and tail lights come on after dark, and round trucks come back empty.
- Phase 7, farming: a Farm zone (Farms tool, key 9). One cell makes a vegetable field or a greenhouse, two a bigger field, three
  rice paddies. The first cell of a field or paddy has a small kawara-roofed farmhouse; a scarecrow stands in the rows. What grows
  follows the season: seedlings on bare ridges in spring, full green rows with tomatoes in summer, pumpkins and gold in autumn,
  bare earth under snow in winter; paddies are flooded with seedlings in spring, green in summer, gold with rice drying on racks
  in autumn and stubble in winter, and a paddy cell beside the canal turns a water wheel. Farmers keep early hours and work out in
  the fields in season (planting, hoeing, watering, weeding, bringing in the harvest; indoors in winter and rain). On summer and
  autumn mornings a truck takes the produce round the shops, leaving a crate of vegetables (flowers at the florist, from the
  greenhouse) at each door. The farm card says what is happening in the fields.
- Phase 7, fishing (src/fishing.js): the boat moored at the quay sails at 5:30, works its grounds offshore with slow circles and is
  back alongside at 10:30 with crates on deck (a stormy morning keeps it in). The catch is laid out at a fish market on its own lot by
  the quay (a paved pad and a stall facing the street: posts, a sloping roof, a striped valance, a long table of ice, crates) until 18:30, and residents walk down to buy fish for supper,
  mostly after work, going home with a bag. A van then takes the catch round the grocery, supermarket, ramen shop, restaurant
  and konbini, leaving a crate of fresh fish at each door for the day.
- Homemakers: in about half the couples and families one adult keeps the house instead of taking a job. They do the day's
  shopping, go to the market morning and the quay stall first, and keep the house (washing, sweeping the step, cooking for the
  family); their card says they keep the house. Saved with the resident.
- The ryokan: once visitors have started coming and the hill has its tea house, the hill plot market builds a two-storey timber
  inn on a high terrace plot (plaster ground floor, lattice windows behind a balcony rail, a hip-and-gable kawara roof, a deep
  noren and lanterns, a stone lantern and a pine). Weekend and festival visitors who arrive after midday may stay the night
  (six rooms): they carry an overnight bag, walk up in the evening, the inn stays lit until late, and they check out in the
  morning for one more sight before the train home. Its card shows tonight's guests; it never changes trade.
- The pier is a stone quay: a pale concrete deck just below the town's ground on coursed stone walls, a T-head with steps down to
  the water, bollards and a lamp, the little boat moored alongside. Residents fish from its edges with a rod and float, early in
  the morning and late in the afternoon (a quarter of them are keen anglers); a bike rack on the quay fills with their bicycles,
  and the nearest cell by its land end is kept as a public car park that opens once a town street reaches it. The pale pebbles
  that floated on the water where the beach used to be are gone.
- The town square (a civic kind): a three-cell Civic drag makes one first (then public baths). Open stone paving with a darker
  border, planters with small trees, benches and lamps along the back, the front left open; no staff. Its card says what is on.
- Gentle events on the square (src/events.js), from the calendar alone: a market morning every Sunday 7:00–11:30 (two yatai and
  a produce table; residents drop by and come home with a bag), and the summer festival on the first Saturday of summer
  16:00–21:30: three yatai, lantern strings that glow after dark with a real warm light over the square, the mikoshi on display,
  a taiko, nobori and bunting. Residents crowd in after work (evening arrivals stay for the fireworks), visitors come on the
  afternoon trains, and from 20:00 soft fireworks burst over the sea beyond the square. The first festival gets the milestone card.
- Visitors for the day (src/tourists.js): on fine days tourists come up the station stairs off the morning trains (two to four
  a train at weekends, now and then one on a weekday), walk out to one or two landmarks, step back and take photos with a camera
  raised to the eye (built in code, with a small flash), often look round a shop on the way back (it counts as a customer, and
  they leave with a paper bag) and head home to the station in the afternoon. Hover one for a Visitor card.
- The tourist bus: at weekends it comes over on the 7:00 ferry, runs between a stop on the station ring and a stop by the
  lighthouse (two bus shelters on the pavement, pulling up just past them, squared to the kerb), carries the visitors going
  that way and leaves on the 17:00 ferry.
- The bench lamps give real light: two warm point lights under their heads fade in at dusk, so the benches and whoever
  waits on them are lit at night (the street lamps elsewhere keep their painted pools).
- Two lamps stand behind the station benches, either side of the name board, their arms reaching over the seats, so people
  waiting for a train are not left in the dark (lit head, soft cone and pool of light like the street lamps).
- Puddles are soft, semi-transparent wet patches: a faint sky sheen in the middle fading into darker wet asphalt at the rim,
  lit like the road so they darken at night, instead of flat pale blobs.
- Phones: the tool dock is one compact row of eight with larger icon tiles, darker labels and the chosen tool on a flat pale
  teal tile.
- The rich look is the new standard (2026-09-23; docs/ART_DIRECTION.md rewritten): every new session starts in it, and the classic
  pastel look is one click away (the wand button, remembered, or `?look=classic`). A fresh start is an empty island in either look;
  the dense street-grid showcase moved to `?demo=dense`. The coastal train and its railway are gone: the underground line at
  Komachi Station stays the island's only railway.
- Rich look (src/look.js; the wand button in the sliders menu, remembered; `?look=rich`): the town renders through
  ambient occlusion (GTAO), a tilt-shift blur toward the screen's top and bottom and a display-space grade (deeper midtones, cool
  shadows, warm highlights, fresher greens, more saturation and contrast, a soft vignette), with a warmer, stronger sun, a
  cooler and weaker sky fill, a deeper sea, a little haze and a gentle patchy tone on upward faces. The classic look is unchanged
  and stays the default until the art direction is decided.
- Landmarks on the island (src/landmarks.js, models from the destinations kit), placed from the island once the town has loaded:
  a lighthouse on the rocky headland furthest out to sea (a rocky point or a grassy one where an island has few rocks, clear
  of the hill, the pier, the canal mouths and the slipway) whose lens glows from dusk while one beam sweeps the water at
  night, dimming as it swings over the town; a red arched footbridge over a straight stretch of the canal; and a park
  pavilion beside it, its steps toward the bridge foot, between two cherry trees that turn with the seasons. Their cells
  are kept (`c.landmark`): nothing is zoned there and no street drawn over them, though a street may reach the bridge's
  banks. Residents out on a fine day's stroll sometimes walk out to one: round the lighthouse to look out to sea, up to the
  crown of the bridge to watch the carp, or to a bench in the pavilion for a sit, then back the way they came and home.
- Walkers who stop at the end of a stroll (the notice board, a landmark) stand still instead of walking on the spot.
- Milestone announcements (src/milestone.js): the moments that change the town get a larger cream card under the top bar
  (pictogram, title, one line) that stays about ten seconds or until dismissed, with a "Go and look" button that glides the
  camera to the place, holds while the change plays out and glides back; a drag, wheel or move key ends the glide there.
  The hill opening is the first: the six stone lanterns on the shrine path light one by one from its foot up to the shrine
  (own materials, back to the street lamps' level afterwards), and the road crew that opened it stands at the top of the slope
  road a moment, looking down over the town, before walking to the station and leaving on the train.
- Residents on the station benches sit on the seat: the seat places moved to the kit bench's own (±0.115), 0.04 forward of the
  bench centre, and up to the seat top (a seated Kenney person's underside is 0.025 above the group, not 0.09), so their feet no
  longer sink into the front slats and their backs rest against the backrest.
- Snow reaches the kit buildings too: civic props, town services, the bath house, notice boards, the station pavilion (its lit panels
  stay clear), the summit shrine and the torii (`snowKit` in geometry.js; kit greys whiten with a higher floor than the town's asphalt).
- Speech bubbles (src/bubbles.js): when two residents talk, a small cream bubble with pulsing dots shows over whoever is
  speaking, the two alternating, with a pictogram for the topic half the time (rice bowl at mealtimes, cloud in the
  rain, house for a new household, shop front, train, heart); never text; hidden when zoomed far out. Bench chats and
  visits get them, and walkers who know each other (same household, home or workplace) now stop on the pavement, turn
  to each other for a word, and carry on.
- Puddles: pale pools on flat street cells fill while it rains and dry over about an hour after; none in winter.
- Winter looks like winter: snow settles on every upward face drawn with the town's materials (ground, roofs, bushes,
  tree crowns; dark asphalt takes less), building over a couple of hours at the turn and melting in spring; rain spells
  fall as slow, wandering snowflakes; the sky pales and cools under snow; the clock card says snow.
- Seasons (src/seasons.js): a 24-day year of spring, summer, autumn and winter. Broadleaf and cherry canopies take the
  season's colour at the turn (fresh in spring, full in summer, turning orange and red in autumn, bare brown-grey in
  winter; pines, matsu and bamboo stay green), a notice and a chronicle line mark each turn, and leaves drift down from
  the trees with the wind: petals under the sakura in spring, a few leaves in summer, a steady fall in autumn, nothing
  in winter.
- Cyclists ride like cyclists: seated on the saddle with a lean over the bars, hands on the grips, legs pedalling with
  the cranks, and a helmet in their hat colour that appears for the ride and is put away on dismounting.
- Phase 6 begins, weather (src/weather.js): a weather clock runs spells of clear, overcast, light rain and rain in game
  hours, easing between them. Clouds drift over the island with the wind and cast moving shade, more and greyer the
  heavier the sky; overcast greys the sky and softens the sun; rain falls as streaks that follow the camera, darkens the
  streets, and walkers open umbrellas for the trip. The clock card notes the spell. Weather is saved with the town.
- Houses grow like houses: a detached home's second storey is lower than its ground floor (0.4 against 0.5) instead
  of a second full floor, so it no longer towers like a block of flats; detached, narrow and terrace homes stop at two
  storeys and a two-storey house holds a family of three rather than two households; apartments and the manshon still
  grow to three. The card's growth row hides once a home is at its cap.
- Fixed: on some islands the ferry berthed under the sand beside the waterfall and the pier. The slip now keeps clear of
  the pier and every canal mouth on every path, and the landing, berth and horizon are measured from the beach edge, so
  the hull floats off wide beaches too. The ferry now backs off the berth, turns about and sails away bow first, fading
  into the haze, and fades in on the way back.
- Phase 5.5 closed: on collection morning a resident steps out with the bags, sets them at the kerb and goes back in
  (unclaimed bags appear by 7:15); a finished substation strings cables to its two nearest poles; shop lanterns glow at
  night again; and the town keeps a chronicle (src/chronicle.js) of milestones (first home, shop and workplace, the hill
  opening, the ferry's first call, registrations, civic openings, a block growing to three storeys), shown in the
  community centre's display case on its card and saved with the town.
- The ferry is the Komachi Maru (小町丸, src/island-ferry-model.js): a small island ro-ro with an open single-lane car
  deck, stern wheelhouse, banded funnel and name boards, in place of the Kenney cargo ship. Its hinged bow ramp lowers
  onto the beach at the berth and rises before sailing; cars stand on its deck.
- Waterfalls splash at the foot: foam puffs pulse on the water where each fall lands and a fine mist rises and fades.
- A pod of two or three dolphins swims round the island offshore, surfacing in arcs and diving with a splash (the Komachi
  dolphin model, first use).
- Tool bar: tighter gaps and side padding, a little more room above and below the icons, on desktop and small screens.
- The ferry leaves a wake: foam puffs drop astern while it sails and spread and fade behind it, with a bow wash either
  side of the stem; both follow its speed, so the water is still at the berth.
- Phase 5.5 slice 3, town services from the new kit (src/town-services-kit.js): the Civic tool's one-cell pool gains a
  clinic, a fire station and a community centre, and two cells make the town hall (the town picks it before a second
  bath). A newly moved-in household sends one member to register at the town hall, who comes out with a folder and
  walks home with the papers; the card marks the household "registered" and a notice says so. Until a town hall stands
  the kōban takes the registration. Tired residents visit the clinic by day (energy restored). The fire station's kei
  truck leaves its bay at 8:30 for a check round of a few corners and returns (the parked truck in the bay disappears
  while it is out). The community centre's chronicle case draws readers. Saves carry the registered flag.
- Tool bar labels: Homes, Shops, Work, Streets, Clear (Explore, Civic and Parking unchanged); notices say Streets tool and Clear.
- Phase 5.5 slice 2, what the utilities do: windows within six cells of a substation glow steady and a shade warmer;
  homes within six cells of a water works fill out with greener corners and flowers, and residents coming home in the
  morning or evening sometimes water the garden with a watering can before going in; with a recycling centre, every
  third day the homes put bags at the kerb at 6:00 and the centre's kei truck does a nearest-first round from 7:30,
  clearing each kerb as it stops; the public bath draws evening bathers (fun and energy restored, one visit a day) whose
  activities show on the card; strollers sometimes walk to a civic corner to read the notice board and stand there a
  moment before turning for home.
- Phase 5.5 begins: a Civic zone (tool, key 8). One cell makes a substation, water works or recycling centre from the civic
  kit (a kind the town lacks comes first), two or three cells a public bath from the landmark kit. Civic blocks employ two
  workers with their own activities, never level up, and carry a community notice board on the pavement corner. Their
  visible effects (steady warm light, watered gardens, collection day, evening bathers) follow in the next slice.
- Tool bar: each tool has a proper icon on a tinted chip (magnifier, house, store, briefcase, road, P sign, eraser)
  instead of an abstract swatch.
- Inspect card: household heading, its divider and its people sit closer together.
- Fixed: a seated head could spin like a rotor (the gaze and nod turned a bone the clip never reset; head and arms now
  return to rest before each animation step), and someone leaving a bench by an ordinary trip carried the phone or paper
  off with them, reading as a cane at walking pose.
- Neighbourhood kits wired in (src/neighbourhood-kits.js): the kit's concrete utility pole with transformer and lamp on
  every pole corner (cables hang from its crossarm), the kit street lamp everywhere a lamp stood (town lens, beam and
  pool of light kept), shop fronts use the kit noren, chōchin, tate-kanban, awning and hanging sign recoloured to each
  shop's colours, homes get the kit air-con unit and potted plants, the café's A-board and the restaurant's menu stand are the kit pieces and the café's pavement table set fits the strip in front of the shop instead of running into the wall and off the plinth, and detached homes gain yard props from the seed:
  mailbox by the gate, garden tap, kerosene tank and a laundry pole whose washing goes out by day.
- Bench life: people waiting on the plaza benches no longer sit like statues. They shift their weight, follow passers-by
  with their eyes, watch the stairs when a train is due, take out a phone or a folded newspaper (the modelled props, src/phone.js and src/newspaper.js, via src/hand-items.js), chat
  with a neighbour on the same bench (one nods), and now and then stand up to stretch their legs. The card shows what
  they are doing.
- Zoom goes in more than twice as close as before (wheel and pinch), enough to watch one doorstep.
- Plaza: the cream paving squares are gone and two flower planters stand at the kerb in front of the station, either side
  of the way in. Toolbar order: Car park sits beside Road, Remove last. The ferry is a size up (1.3×) from the
  pier's boat and berths a little further out.
- The station pavilion is the subway station model (src/subway-station.js): open descending stairs, four pillars, back
  wall with window band, kawara hip-and-gable roof, name board, clock and two paper lamps. Its window band, name board and
  lamps take the unit's window glow at night. The plaza furniture around it is unchanged.
- Fixed: builders walked from the train to the ferry yard before heading to the site (the crew routes shared the trucks' yard start since Phase 5). Crews now route from the station roads; only trucks start at the yard.
- Phase 5 leftovers: a new shop's kind (and a trade change) is the kind of its tier the neighbourhood lacks
  (`chooseKind`); busy shops put up a striped awning and stack crates of stock by the door, quiet shops go dark at
  19:00 and customers stop calling; half the konbini shoppers walk home holding a can of tea; passing cars and vans
  sometimes pull up at a home's kerb and wait, as a delivery would.
- Street furniture from the kit (src/street-furniture.js): the station plaza's benches, vending machines (header strip
  lit after dark), flower planters and small kit trees in the corner planters; hoop bike racks with bicycles in the bays;
  horizontal Japanese signal heads on two corners of every signalled crossing, lenses toggled by the town phase; an
  inverted-triangle stop sign on the left kerb before every T-junction. The bus shelter waits for a bus line.
- Standalone landmark models: torii gate and shrine set, small Buddhist temple, kōban and
  public bath with chimney. Includes self-contained GLBs and front/rear orbit previews.

- Standalone original nature model kit: layered and Japanese pines, bamboo grove, flowering cherry,
  broadleaf tree, rock cluster and flooded rice-paddy tile. Includes GLBs and an orbit preview;
  the game's existing scenery remains unchanged.

- Broom, fishing rod and watering can models with Kenney character carrying poses, standalone
  GLBs and an outdoor-props preview. The rod includes a separate line/float; the watering can
  has an open fill opening and perforated rose, ready for future activity effects.

- People carry a paper shopping bag home from the grocery, supermarket, konbini, arcade or bakery, using the
  new hand props (assets/props); it goes indoors with them
- Phase 5, last slice: the car ferry. A ro-ro ferry (Kenney Watercraft cargo ship) calls at a slipway beside the
  pier at 07:00, 12:00 and 17:00, waits about half an hour with its ramp down and sails again. Visiting cars now
  arrive on it and drive into town, and drive back to the slipway to leave when the town has more than enough;
  a resident who owns a car gets it off the next sailing after moving in, and it drives to their kerb. A builders'
  yard by the slipway, fenced, with a container and a sign, holds stacked timber, sacks and crates that grow with
  the number of sites under way, and delivery trucks load there. Purely visual: construction time is unchanged,
  taxis stay island-based, and if no street joins the slipway to town the cars wait aboard and a notice says so
- Phase 5, third slice: the hill plot market. Once the hill is open and a street reaches it, the town takes up
  terrace plots on its own. If the hill has no street of its own the town lays one short lane along a terrace
  from the top of an island slope. A settled household, everyone employed or commuting and two days in town,
  has a villa built on the highest free plot: a wide single storey under a hip-and-gable kawara roof with a deep
  engawa, lattice windows, a walled garden, stone lantern and pruned pine. When it is finished the household moves
  up and their old home is let again. Once people are walking up the hill, a tea house opens on the plot nearest
  the shrine path: kawara roof, shōji front, cushions on the veranda, a noren and a lantern. The player can still
  zone terrace plots as before
- Phase 5, second slice: a light economy, shown never counted. Shops count their customers each day (the card
  shows today and yesterday), bigger shops draw people from further away (a supermarket or arcade reaches most of
  the town, a corner bakery its own streets), a busy shop hangs nobori banners at its door (a supermarket flies sale
  flags along its roof), and a shop nobody visits for three days, in a town with at least three shops, closes and
  reopens as another trade of its size: shutters down and a "coming soon" board while the fit-out happens, then a
  notice when the new shop opens. The town's last shops never close
- Phase 5, first slice: size tiers. The number of cells you drag decides what a block becomes, and a label under the
  tool bar says so while you drag. Homes: one cell is a detached or narrow house, two a pair of terrace houses or
  low apartments, three an apartment building (manshon) with a lobby, balconies, stair core and rooftop tank, the
  only home that adds a fourth floor at level 2. Shops: one cell is a konbini, bakery, florist, bookshop or ramen
  counter; two a café, restaurant (shokudō with noren, lanterns and a menu stand) or grocery; three a supermarket
  with a long lit fascia and trolleys, or a shotengai arcade of stalls under one glazed canopy. Workspaces: one
  cell a studio or small office, two a workshop or office, three a factory with a saw-tooth roof and chimney, or
  an office block. Capacities follow the tier, and all units of a block share one look
- Phase 4.95, building variety. Detached homes come in three looks chosen from the seed: the cottage, a machiya
  townhouse with slatted timber walls, a lattice window, an engawa step and a pent roof over the ground floor,
  and a modern render box with a second light volume, a flat parapet roof in the block's roof colour, a corner window and a balcony on the side
  the seed picks. Shops get a wall finish (timber slats, a glazed tile band or plain render), one of three awning
  shapes (cloth, striped cloth or a box canopy), sometimes a round hanging sign at the corner and shutters
  upstairs. Offices come with a glass, punched-window or louvred facade. Satellite dishes, corrugated cladding on
  some narrow houses and other small props also follow the seed
- Phase 4.9, streets first. Buildings no longer bring a square ring of road with them: the player draws streets
  with the new Road tool (key 5), dragging an L-shaped run over land on one level or straight across the canal
  for a bridge, and zones buildings beside them (only beside a street that reaches the station, so nobody is ever cut off). A building's door faces the street it was placed against, and
  the station's ring is the first street. The Remove tool (now key 6) takes a drawn street cell away unless a
  building still opens onto it. The town lays nothing on the flat by itself; on the hill it still builds a slope
  for a terrace street with no way down. Traffic lights stand only where two through-streets cross, every arm
  running straight for two cells; other crossroads get painted stop lines. Walkers wait at the kerb of a
  signalled crossing while the cars have the green and cross when it turns. The demo town draws its own side
  streets. Saves are v2 and carry drawn streets; v1 saves still load, their blocks finding the streets beside them
- A sage-green tea can with a curved cream TEA sticker, leaf emblem, silver rims and pull tab.
  Vending-machine drinks use the new can and a mouth-aligned sipping pose; includes a standalone GLB.

- Four original Kenney-sized carry props: shopping bag, briefcase, folding umbrella and registration
  folder. Standalone GLBs, character attachment/disposal helpers, walking preview and open/close
  umbrella animations are ready for later trip and weather triggers.

- Original city bicycle model with a step-through frame, open basket, mudguards, rear rack,
  lamp and bell. Resident bikes now use the model with distance-based wheel/crank rotation,
  level pedals and a dedicated rigid-limb riding pose. Includes an animated GLB and colour preview.

- People drink from a can at the vending machines: they press the buttons, turn away with a small pastel can
  in hand and tip their head back for sips before dropping it in the bin and heading back to the bench
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

- Roadmap: a Phase 4.95 building variety pass before the economy (several generators per size and zone,
  details from the seed)
- Roadmap: Phase 5 opens with size tiers by drag length, where 1, 2 or 3 cells decide a building's shape and
  role (house, apartments, manshon; konbini, café, supermarket; studio, workshop, factory)
- Roadmap: residents register at the town hall after moving in (Phase 5.5, kōban as the stand-in), and a list of
  hand props to model (can, bag, briefcase, umbrella, folder)
- Shops come in three silhouettes by roof style: a tiled machiya gable with a lattice band, a mono-pitch metal
  roof with a tall fascia, or the flat roof with a parapet, so a shop street is no longer a row of identical boxes
- Roadmap: a Phase 4.9 before the economy, in which buildings get a front street stub auto-connected to the
  nearest street and the player gains a Road tool, replacing the automatic ring around every block
- The station plaza lost its tall corner lamps; one ordinary street lamp stands mid-way along each side of its ring road, and
  the pavilion's paper lamps light the entrance
- Street lamps cast a much fainter, narrower beam and a smaller warm pool, so the light sits in the scene
  instead of reading as pale triangles across the streets
- CI retries the smoke test once, since a timing check can miss on the slow software-GL runner
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

- Removing a street now clears its traffic: cars and animals travelling over it leave at once and residents on
  it find another way (or step indoors if no street is left under them); the Remove tool highlights the street
  cell under the pointer, rose when it can go and grey when a building still opens onto it, and dragging along
  a street removes the whole run at once
- Residents no longer turn up in builder gear: the old cap flag on some residents was selecting the builder
  model; only construction crews use it now
- A ground-level street beside a terrace street no longer draws an opening into the terrace wall: roads only
  join at the same height or along a slope road's axis, matching how traffic is routed
- A ring road running beside the island's slope road or a town-built link is no longer mistaken for a two-lane
  avenue (it lost its pavement and grew guard rails); those cells render as ordinary streets
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
