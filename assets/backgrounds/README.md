# Menu background

`komachi-menu-game.jpg` is a direct 1920 × 1080 JPEG screenshot of the running Komachi simulation, captured with the game UI hidden. It is used by both the main menu and loading screen.

Capture: seed 7, dense demo, clear afternoon, camera yaw 0.6 / pitch 0.7 / view 28, target (-7.2, 0, 4.8). The town sits toward the right to leave space for the menu. The capture script rejects any 2 × 2 road patch, keeping showcase streets one cell wide.

Recreate after building with `node scripts/capture-menu.mjs`. Desktop and phone menu previews and validation are saved under `docs/backgrounds/`.

`komachi-menu.jpg` is the previous background, retained for reference.
