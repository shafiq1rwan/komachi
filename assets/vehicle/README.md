# Vehicles

From Kenney's **Car Kit** (https://kenney.nl, CC0 1.0). Only the models the game uses are kept: sedan,
hatchback-sports, suv, van, truck-flat, taxi, delivery and garbage-truck, plus the shared atlas
`Textures/colormap.png`. Wheels are part of each model; the kit's separate wheel files, debris, cones,
karts and emergency vehicles were left out.

`src/vehicles.js` loads each model once, bakes the atlas into vertex colours (flattening the node
transforms), and finds the bodywork paint as the most common mid-lightness colour on the `body` mesh.
Every car built gets a copy with that paint repainted to its owner's colour, shading kept; the taxi
keeps its livery. Kinds map as kei → sedan, hatch → hatchback-sports, suv, van, truck → truck-flat (the
kei trucks that deliver to building sites), taxi, delivery and garbage (reserved for later phases).
Models face +z and are scaled by 0.17 (a sedan is about one and a half people long). The original box cars remain the fallback while models load.
