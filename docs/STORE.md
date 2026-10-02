# Store page material

Text and shot lists for an itch.io or Steam page. Names and places in the game are fictional.

## One line

Draw a street. Zone a few homes. Watch a small Japanese town live its days.

## Short description (under 300 characters)

Komachi is a cosy town diorama on a small island. Draw streets, zone homes, shops and workplaces, and watch the
residents arrive by train, find work, shop, fish, chat on benches and go home at night. Nothing can go wrong. Everything
you do shows up in the town, never in a number.

## Long description

**A town you watch more than you manage.** Komachi (小町, "small town") is an observational city builder. You draw
streets and zone the plots beside them. Builders arrive by train, and everything else happens on its own: families move
in, shops open and change trade with their custom, commuters catch the morning train, a car ferry brings the cars over,
and the kōban light stays on all night.

**Every system is visible.** Water works mean watered gardens. A substation means steadier light. A quiet shop puts up
its shutters. A busy one gets a striped awning and crates outside. There are no bars to fill and no failure states.

**Days, seasons and weather.** A day takes about four minutes. Rain brings umbrellas and puddles, snow settles on the
roofs in winter, cherry petals fall in spring, and the summer festival ends with fireworks over the sea.

**Small ceremonies.** The hill opens with a lantern-lit path to the shrine. A fox visits at dusk. The town keeps a
chronicle of its own firsts, and you keep an album of the photos you take.

**Features**

- Streets-first building on a procedurally generated island (pick a seed and a theme)
- Homes, shops, workplaces, civic buildings and farms in one-, two- and three-cell sizes
- Residents with households, jobs, shifts, errands and bench chats
- Trains, bikes, taxis, a car ferry, a tourist bus and service rounds
- Weather, seasons, a market morning, a summer festival with fireworks
- Landmarks: lighthouse, bridge, pavilion, shrine on the hill, fish market, stone jetty
- Photo mode with a per-town album
- Named saves, an opening scene, background music
- Desktop app for Windows and Linux, and a browser version that installs as an app on a phone

## Screenshots (docs/, retaken by `node scripts/capture-readme.mjs`)

1. screenshot-day.png: the station neighbourhood on a clear morning
2. screenshot-night.png: the same streets after dark, windows and lamps lit
3. screenshot-station.png: the station plaza at night, close
4. screenshot-island.png: the whole island from above
5. screenshot-harbour.png: the ferry berthed in the harbour at five o'clock
6. screenshot-construction.png: a crew at work on a new shop

For the store, retake them from a grown town (a day or two of play, thirty or more homes) rather than the demo, and add
one in rain and one in snow with `MT.setWeather('rain', 4)` / a winter day.

## Trailer (thirty seconds, no voice, the menu loop as music)

`node scripts/make-trailer.mjs` (after `npm run build`) records raw footage of the storyboard below into
output/trailer/komachi-trailer.mp4 (a Chrome window opens for about forty seconds). The finished cuts are made from that footage
by scripts/edit-promo-trailer.py (Pillow + imageio-ffmpeg): output/trailer/promo/komachi-promo-30s.mp4 and
komachi-teaser-15s.mp4 with captions, an end card and the menu loop; their poster JPEGs sit beside them. Upload the promo to
YouTube and link it on the itch page (itch embeds YouTube or Vimeo, not files); the teaser suits Reddit and social posts. To record by hand instead, use a screen recorder over the trailer camera, `MT.trailer({ view, rate, speed })` in the browser console,
which hides the HUD and turns the camera slowly (Esc or `MT.trailer.stop()` ends it). Keep every shot to three or four
seconds; cut on the beat.

| s | Shot | How |
| --- | --- | --- |
| 0–3 | Empty island, the sea moving | `MT.trailer({ view: 34, rate: 0.03 })` on a fresh island |
| 3–6 | A street drawn, a first block zoned | HUD on, real cursor |
| 6–10 | Builders arriving by train, a frame going up | `MT.trailer({ view: 6, at: site, speed: 4 })` |
| 10–14 | Morning: commuters to the station, bikes, the ferry arriving | view 10 over the plaza, 7:00 |
| 14–18 | Afternoon: shoppers, the market square, the tourist bus | view 9, weekend |
| 18–21 | Rain: umbrellas, puddles, the rain loop swelling | `MT.setWeather('rain', 4)` |
| 21–24 | Dusk: lanterns up the shrine path, the fox | `MT.callKitsune()` |
| 24–27 | Festival fireworks over the sea | `MT.setDay(festivalDay, 20.2)` |
| 27–30 | Snow over the roofs, pull back to the whole island, wordmark | winter day, view 34 |

Title card at the end: the wordmark on the menu picture and the one line above.

## Poki

A separate build for Poki's portal: `npm run build:poki && npm run check:poki && npm run pack:poki`, then upload
output/poki/komachi-poki.zip in the Poki developer dashboard. Poki reviews for: loads inside their iframe, their SDK events
(loading finished, gameplay start/stop, commercial breaks at menu pauses), no outbound links, no third-party requests, mobile
support. The music loops stream on demand (6.6 MB of the 16.8 MB build), so the first load is small.

## Poki dashboard

- Privacy notice URL: https://shafiq1rwan.github.io/komachi/privacy.html (public/privacy.html, deployed with the web build; the
  game collects nothing, the page says so and points at Poki's own policy for the page around the game)
- Categories: Simulation, City Building, Casual, Relaxing (first two matter most)
- Tags: city builder, building, town, simulation, cozy, relaxing, sandbox, isometric, low poly, japan
- Description: the short description above; Poki prefers one plain paragraph, present tense, no feature lists

## Tags

city builder, cosy, sandbox, relaxing, simulation, Japan, isometric, low poly, no failure, browser, PWA
