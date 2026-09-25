# Station opening

The opening reuses the game's Kenney characters. The underground platform and sandy track bed are procedural geometry in `src/opening.js`. `src/opening-train.js` builds the closed, rounded roof, cab ends, headlights, bogies, sliding doors, transparent window panes and interior bench seats.

- 0–5.7 seconds: two newcomers sit together and chat; three pedestrians pass along the platform and leave the frame. The train arrives from 3 seconds and stops at 5.7.
- 5.8–6.5 seconds: the doors slide open while the pair remain seated.
- 6.5–7.2 seconds: they stand and step clear of the bench.
- 7.3–10.45 seconds: they walk from the train-facing bench and hop aboard one at a time.
- 10.9–11.7 seconds: the doors close after both are inside.
- 11.9 seconds onward: the train leaves, followed by the island reveal.


The timeline follows rendered animation time, so a slow frame rate cannot cut boarding short. Skip and replay remain available. The previous simulation speed and scene fog/background are restored on exit.

`src/phone-pose.js` aims the right arm forward from its shoulder and attaches the phone's lower side to the transformed palm. This follows seated sway and the different character proportions.

Run `node scripts/check-opening.mjs` with the development server on port 4412 to capture the conversation, arrival, doors, boarding and phone pose, and check the full seated-to-boarding sequence, pedestrian exits, replay and skip. Images in this folder are actual game renders.

`node scripts/preview-opening-train.mjs http://127.0.0.1:4412 after` captures three inspection angles of the carriage. The roof uses a continuous shallow curved profile, with aligned cab pillars, front window frames and a cab partition.
