# Komachi — Art Direction

Derived from [`reference.png`](reference.png). The reference is a pastel, low-poly Japanese
miniature town on a floating cream island. Komachi borrows its *characteristics*, not
its content.

## What the reference does

| Trait | Observation | Komachi rule |
|---|---|---|
| Palette | Cream stone, peach/dusty-orange trees, sage and mint greens, muted teal roof, powder-blue roof, dusty-rose roof, pale mint water | Fixed 24-swatch palette (`PAL` in index.html). Nothing outside it. |
| Saturation | Everything ~25–45% saturation, no pure hues | All colours pre-desaturated; night tint shifts toward cool blue, never black |
| Geometry | Chunky boxes with slightly rounded/bevelled silhouettes, thick roofs, oversized details (lamps, signs, awnings) | Buildings are stacked boxes + prism roofs; details are 1.5–2× "real" scale |
| Proportion | Buildings ~1 cell wide, ~1–2 cells tall; people are ~1/4 building height | Cell = 1 unit; house 0.55 u per floor; person about 0.3 u tall (0.7 × the base model) |
| Camera | Clean 3/4 orthographic view, ~35–40° elevation, 45° azimuth | Orthographic camera, pitch 38°, yaw 45°, smooth rotate/zoom |
| Lighting | Soft top-left key, gentle warm shadows, no speculars | Matte materials (roughness 0.95, metalness 0), soft PCF shadows, hemisphere fill |
| Ground | Cream sidewalk everywhere, grey asphalt inset, bushes filling gaps | Every road cell is a cream slab with an inset asphalt cross; empty cells grow bushes/trees |
| Vegetation | Round peach "lollipop" trees, blob hedges, flower boxes | Flat-shaded dodecahedron canopies in peach/orange/sage; hedges as squashed spheres |
| Details | Lamp posts, striped awnings, hanging signs, vending machine, benches, planters | Lamp posts at block corners, awnings on shops, rooftop units on offices, planters on plinths |
| Setting | Island diorama on soft mint water | Rounded-rectangle land slab, cream sides, floating on mint |
| Landmark | Sunken subway entrance with a curved sage roof, railings, bench, vending machine | Komachi Station: stairwell with arched sage roof, dark-green railings, two round lamps, benches facing the stairs, pastel vending machines |
| Mood | Cosy, quiet, suburban Japan | Slow pacing, no failure states, ambient walkers, cats |

## Night

Environment shifts to soft cool blues (`#2a3654` sky, `#3b4c74` fill) while windows,
shop fronts, lamp heads, and occupied buildings emit warm diffuse light (`#ffb86b`)
through emissive materials plus additive ground-glow decals. Contrast is kept low so
the town stays readable.

## Retro / pixel flavour

Rendering happens at half resolution and is upscaled with nearest-neighbour filtering
("Pixel look" toggle). Combined with flat-shaded low-poly forms this gives a
pixel-art-flavoured 3D diorama without dithering or a hard palette snap.

## UI

Clean, modern, rounded cards in warm cream with charcoal text and a muted teal accent.
Nunito typeface. UI never covers the town centre.

## Avoid

Photorealistic textures, saturated primaries, realistic architectural detail,
neon/cyberpunk, default grey Three.js look, hard black shadows.
