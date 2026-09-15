# Contributing

Thanks for wanting to help make the little town cosier.

## Setup

```bash
git clone <your fork>
cd komachi
npm install
npm run dev
```

## Before opening a pull request

1. `npm run lint` passes.
2. `npm run build` succeeds.
3. `npm test` passes if you have Chrome or Edge installed (set `BROWSER_PATH` otherwise).
4. If you changed anything visual, attach a day and a night screenshot. The smoke test writes
   both to `scripts/out/`.

## Ground rules

- **Stay inside the palette.** New colours go into `PAL` in `src/palette.js`, desaturated,
  and are read from there. See [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md).
- **Keep it observational.** Komachi has no money, no failure states and no timers to beat.
  Features that add pressure are out of scope; features that add life are welcome.
- **Merge geometry.** Static things should end up in as few draw calls as possible. Follow the
  pattern in `src/geometry.js` and `src/buildings.js`.
- **No new dependencies without a conversation.** Open an issue first.
- Plain JavaScript, ES modules, two-space indentation, single quotes.

## Reporting bugs

Open an issue with your browser and OS, what you did, what you expected, and a screenshot if it
is visual. `?demo` in the URL is a quick way to reproduce on a populated town.

## Ideas that would fit

- Weather (soft rain, snow that whitens roofs)
- Seasons for the trees
- Parks as a fourth zone
- Festivals in the evening
- Sound
