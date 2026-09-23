# Komachi — Art Direction

The standard look since 2026-09-23 is the **rich look**: a cosy miniature diorama of a Japanese coastal suburb, seen
through soft contact shadows and a light tilt-shift focus, with a warm sun, cool shadows, fresh greens and calm bay water.
It was chosen by the user from a reference image (a painted isometric city-builder town) for its *style, colour and
environment*; the reference's own HUD was explicitly not part of it. The earlier pastel look is kept as **classic**: the
same town, flat-lit and lighter, one click away (the wand button in the sliders menu, or `?look=classic`) and the natural
choice for older or low-power devices.

Komachi borrows the reference's characteristics, not its content. Everything is still built in code from boxes, prisms,
dodecahedra and the project's own kit models; nothing is textured or photographic.

## What the standard look does

| Trait | Observation in the reference | Komachi rule |
|---|---|---|
| Mood | A lived-in, quiet coastal town on a bright spring morning; buildings are the focus, the ground and sea support them | Slow pacing, no failure states, ambient walkers, cats and dogs; nothing competes with the buildings for attention |
| Palette | Fresh mid greens, warm stone and cream walls, charcoal slate roofs, mid-grey asphalt, a muted blue-teal sea | Colours are muted but not pastel: grass `#9db68a`, asphalt `#6d7376`, pavement `#c8c7be`, centre lines `#d7c38f`, slate roofs `#424c58` (ridge `#59636d`), sea `#487c8b` deep to `#7aa7ad` shallow. Still no pure hues and no neon |
| Contrast | Clear light and shadow sides, darker roofs anchoring each building, ground that reads as a surface | Deeper midtones (grade gamma 1.14), a little more contrast (1.06) and saturation (1.32) than the classic look |
| Light | Warm key light from the upper left, cool blue in the shadows, soft fill | Sun `#fff0d8` at up to 1.8, a cooler, weaker sky fill (hemisphere `#cadcee` at 0.78, ground bounce `#d9c4a2`), a blue side fill `#9fb9dc`; the grade leans shadows toward blue and sunlit faces toward warm |
| Contact shadows | Every building, car and tree sits in the ground; eaves and corners darken | Ambient occlusion (GTAO, radius 0.72, blend 0.62) on top of the soft PCF sun shadows and the cloud shade. See-through things (clouds, glows, beams, rain) never cast it |
| Focus | A miniature feel: sharp in the middle, softening at the top and bottom | A light tilt-shift blur (strength 0.6) around a band at the screen's middle; the distant town stays legible |
| Atmosphere | Faint haze toward the far edge, a soft vignette | Fog 108–168 for a little haze toward the top of the screen; vignette 0.22 |
| Ground | Grass has soft patches rather than a flat fill | A gentle two-scale tone variation on every upward face (grass, roofs, pavements), from world position, so nothing tiles |
| Water | A calm bay: mostly opaque, matte, gentle broad swells, a few short glints, lighter near the shore | `src/water.js`: muted blue-teal, lighter over the shallows along the real coastline, three broad slow swells warped by noise and a faint fine ripple (normals only), sparse short crest glints that fade at night, a faint hint of sky. No Fresnel, no mirror, no tiled texture, no tropical cyan |
| Coast | Stone sea walls and quays rather than beaches along the town edge | A coursed stone waterfront band round the island in place of the classic beach and foam ring; rocky headlands keep their boulders |
| Vegetation | Dense trees, many conifers, clustered round blocks | Denser wild trees on empty cells than the classic look; canopies turn with the seasons; cherries by the pavilion |
| Streets | Kerbstones, drains, crossings and fine lane marks | Kerbstone courses and drains along road edges, zebra crossings at junctions, slimmer ochre centre lines (`src/rich-streets.js`) |
| Buildings | Varied homes and shops, dark roofs, small gardens | Every size tier keeps its own generator (1, 2 and 3 cells read differently: house or narrow house, terrace or apartments, manshon; konbini/café, restaurant/supermarket, arcade; studio, workshop, factory), with shop finishes and office facades from the seed. One-cell detached homes and hill villas use the slate hip-roof house with a planted front garden (`src/rich-buildings.js`) |
| Geometry | Chunky, readable forms at a distance; oversized details | Buildings are stacked boxes and prism or hip roofs; details are 1.5–2× "real" scale so they read from the default camera |
| Proportion | Buildings about a cell wide, one to five storeys; people about a quarter of a building's height | Cell = 1 unit; floors 0.35–0.55 u; a person about 0.3 u tall |
| Camera | A clean 3/4 view from above | Orthographic, pitch 38°, yaw 45°, smooth rotate and zoom |
| Japanese identity | Tile roofs, block walls, utility poles and cables, vending machines, shrine and torii on the hill | Kept from Phase 4.8: kawara roofs, block walls, genkan, noren, chōchin, tate-kanban, 止まれ marks, post boxes, kōban, laundry on balconies, pines and bamboo |
| Landmarks | A few recognisable places | Komachi Station (the underground line is the only railway: no surface train or track), the shrine and torii, lighthouse, arched footbridge and park pavilion, civic buildings from the kits |

Colours: most swatches still come from `PAL` in `src/palette.js`. The rich overrides currently live next to the code that
uses them (`colorize` in geometry.js for grass, asphalt and pavement; rich-buildings.js; rich-streets.js; water.js;
daynight.js `RICH`); new colours should be added to `PAL` and existing overrides moved there when they are next touched.

## Night

Dusk is the look's best moment: warm windows, shop fronts and lamp heads (`#ffb86b`, emissive plus additive ground-glow
decals) against deep cool blues. The sky goes to `#2a3654`, the sea darkens with it and its glints fade out, the
lighthouse lens glows and its beam sweeps the water, dimming as it swings over the town. Contrast stays low enough that
streets and roofs remain readable.

## Seasons and weather

Spring canopies are fresh, summer deeper, autumn peach and rust, winter bare with snow on every upward face (town
materials and kit buildings alike). Overcast greys and softens the sun; rain brings umbrellas, darker streets and
puddles; winter rain falls as slow snowflakes.

## Classic look

The pastel original: cream island on soft blue water, sandy beaches with a foam ring, flat hemisphere-heavy light, no post
processing, the lighter palette (`PAL` as written, desaturated 25–45 %). It shares all geometry and simulation with the
rich look and stays the fallback where the post chain is too heavy (it roughly doubles the rendering work). Phase 8's
quality levels are expected to choose between the two automatically.

## Retro / pixel flavour

Optional in either look: rendering at half resolution and upscaling with nearest-neighbour filtering ("Pixel look"
toggle). Off by default, remembered once used.

## UI

The same HUD in both looks (the reference's HUD was not adopted): one slim top bar, clean rounded cards in warm cream with
charcoal text and a muted teal accent, Nunito, instant tooltips, a compact tool dock at the bottom. UI never covers the
town centre. (A larger reference-style reskin exists in styles.css under `body.rich-hud`, switched off.)

## Avoid

Photorealistic textures, glassy or mirror water, big ocean waves, bright tropical cyan, saturated primaries, neon or
cyberpunk, realistic architectural detail, hard black shadows, heavy blur that hides the town, the default grey Three.js
look, and any surface train or track across the island.
