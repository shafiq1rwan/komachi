# Komachi — itch.io media

## Updated gallery — v0.4.0

Upload the **captioned images in `upload/`**, in this order. Each is a 1920 × 1080 capture of the current game with
promotional wording added for the store. The matching files in this folder are clean captures without the captions.
The first image leads with the town; the next two explain the new guided goals and building unlocks.

| Order | File | Headline | Supporting wording |
| --- | --- | --- | --- |
| 1 | `komachi-day.png` | A little town. A life of its own. | Draw streets, build homes, and watch your neighbourhood grow. |
| 2 | `komachi-goals.png` | Start small. Build something yours. | Follow clear goals and give your first neighbours a place to call home. |
| 3 | `komachi-unlocks.png` | New level. New possibilities. | Complete goals to unlock new buildings for your growing town. |
| 4 | `komachi-construction.png` | Watch your town take shape. | Construction crews turn your plans into places to live and work. |
| 5 | `komachi-night.png` | When the lights come on. | Watch the streets glow as day turns into night. |
| 6 | `komachi-station.png` | Welcome to the neighbourhood. | New neighbours arrive by train and make themselves at home. |
| 7 | `komachi-harbour.png` | Life by the water. | Take a moment to watch the ferry come into harbour. |
| 8 | `komachi-island.png` | Your island, your pace. | Create a cosy corner of the world, one street at a time. |

The guided screenshot shows the real HUD and goal card. The unlock screenshot is earned by connecting a street and
placing a home in a fresh guided town; it does not fake a level or a reward. Scenic images use the game's camera with
the HUD hidden. The screenshot captions are capture-only overlays and do not change the in-game interface.

Current store-page wording is in `docs/STORE.md`. Regenerate with `npm run build`, then `node scripts/capture-itch.mjs`.

## Cover and clean captures

- `komachi-cover.png`: generated promotional cover artwork, with narrow single-cell-style roads. Use as the itch.io cover. This is illustrated promotional art, not a gameplay screenshot.
- `komachi-day.png`: daytime neighborhood.
- `komachi-night.png`: neighborhood after dark.
- `komachi-station.png`: close view of the station plaza.
- `komachi-island.png`: whole-island view.
- `komachi-harbour.png`: ferry and waterfront.
- `komachi-construction.png`: builders at work.

The eight screenshots are actual 1920 × 1080 game captures. The screenshot script checks for any 2 × 2 road patches, which would indicate streets widened to two cells. Regenerate after building with `node scripts/capture-itch.mjs`.

`credits-desktop.png`, `credits-mobile.png`, `celebration-check.png`, `validation.json` and `validation-guided.json` are verification artifacts, not suggested store screenshots. To retake only the two guided shots, run `node scripts/capture-itch.mjs --guided-only`.

The cover was created with the built-in image_gen tool. Its complete prompt is in `cover-prompt.txt`.

Audio attribution is tracked in `assets/audio/CREDITS.md`: the loops are from Pixabay (Content Licence, commercial use allowed); track links can be added when convenient.
