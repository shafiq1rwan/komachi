# Komachi — itch.io media

- `komachi-cover.png`: generated promotional cover artwork, with narrow single-cell-style roads. Use as the itch.io cover. This is illustrated promotional art, not a gameplay screenshot.
- `komachi-day.png`: daytime neighborhood.
- `komachi-night.png`: neighborhood after dark.
- `komachi-station.png`: close view of the station plaza.
- `komachi-island.png`: whole-island view.
- `komachi-harbour.png`: ferry and waterfront.
- `komachi-construction.png`: builders at work.

The six screenshots are actual 1920 × 1080 game captures. The screenshot script checks for any 2 × 2 road patches, which would indicate streets widened to two cells. Regenerate after building with `node scripts/capture-itch.mjs`.

`credits-desktop.png`, `credits-mobile.png`, `celebration-check.png` and `validation.json` are verification artifacts, not suggested store screenshots.

The cover was created with the built-in image_gen tool. Its complete prompt is in `cover-prompt.txt`.

Audio attribution is tracked in `assets/audio/CREDITS.md`: the loops are from Pixabay (Content Licence, commercial use allowed); track links can be added when convenient.
