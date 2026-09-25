# Procedural harbor island

Updated 2026-09-25 (second pass, matching the reference picture more closely): the bay is now a straight stone quay (`QUAY_Z` in
src/island-profile.js) rather than a rounded cove, with the jetty square to it, fishing boats moored along the wall, the waterfront
street running its full length, the breakwater arms reaching further out, the hill a cliff ridge with a broad plateau and rock
faces, and boulders round the lighthouse. The captures below are from the first pass and are older than that change; scripts/out
holds fresh renders (harbor-fresh-*.png) and scripts/capture-readme.mjs retakes the README set.

New islands use the Harbor Town direction: an asymmetric coastline with a recessed working bay, a broad wooded rear ridge, two small coves, rocky outer shores and a limited built waterfront. The central plain remains available for player zoning. The island, cliffs, beaches, waterfront and breakwaters are all generated geometry; no island GLB is loaded.

The harbor has two protective arms with an entrance aligned to the actual ferry berth. Coastal roads connect to the station and the hill approach. A fallback straight canal handles seeds where the wider ridge leaves no room for the original meander. Hill access retains clear adjacent building plots. Ambient boats and dolphins go around the outside of the breakwaters.

## Save compatibility

New towns and fresh demos use `terrainVersion: 2`. The version is stored in each save. Existing saves with no terrain version use the original coastline and hill, so their buildings are not moved into water or removed on reload. The developer option `?new&seed=7&terrain=1` makes an original-layout scratch island for regression checks; normal new towns need no option.

## Source

- `src/island-profile.js`: coastline equation, bay dimensions and shoreline zones.
- `src/island.js`: generated land, coves, rock cliffs, terraces, quay and connected coastal streets.
- `src/water.js`: the same bay equation in the shallow-water shader.
- `src/harbor.js`: breakwaters, coping, bollards and navigation beacons.
- `src/ferry.js`: harbor berth selection and entrance placement.
- `src/sea.js`: offshore routes clear of the harbor.
- `src/state.js` / `src/save.js`: per-save terrain version.

## Preview and validation

Start Vite on port 4412, then run:

```sh
node scripts/check-harbor.mjs
node scripts/preview-harbor.mjs
```

The checker covers six seeds (7, 1, 42, 123, 2026, 98765): ferry access and passage clearance, connected coastal streets, flat plots, hill plots, shore landmarks, and deterministic terrain/save restoration. It also reloads an old-format save without a terrain version. `npm test` retains the original coordinate-based layout fixture with `terrain=1`.

The PNGs are actual in-game captures of a populated demo, not the generated concept illustration. New playable towns start with the normal station and player-built development. `island-7.png` shows the whole island; `harbor-7.png` shows the port. JSON reports record the measured layout checks.
