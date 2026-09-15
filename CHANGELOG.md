# Changelog

All notable changes to Komachi are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Komachi Station: an underground entrance with benches, vending machines, planters and lamps at
  the centre of the island, placed at the start and ringed by road
- Newcomers arrive by train (every 1½ game hours, 6:00–23:30), wait on the plaza, buy drinks from
  the vending machines, and move in when a finished home has room
- Residents who lose their home return to the station and wait for a new one
- Station inspect card with next train time and the waiting list; "waiting" counter in the stats strip

### Changed

- People leave and enter buildings through the front door: doorstep, then kerb, then the sidewalk
- People are 30 % smaller (a storey is now about one and a half people tall); cats 20 % smaller
- Residents no longer spawn inside homes; population growth now depends on the train timetable
- Residential blocks are named after places (Sakura Terrace) instead of the first family, since
  residents keep their own surnames
- Demo town rebuilt around the station

## [0.1.0] - 2026-09-15

### Added

- Empty island with automatic roads around every placed block
- Residential, Shop and Workspace zones; drag to make blocks of one to three buildings
- Three visible construction stages and three growth levels per building
- Simulated residents with homes, jobs, shops, schedules, cars and activities
- Ambient cars and cats
- Hover and click inspection of buildings and people
- Day/night cycle with warm emissive windows and street lamps
- Explore mode, panning, zooming and 45° rotation
- Pixel look toggle, name tags, speed controls
- `?demo` pre-built town and `window.MT` dev hooks
- Headless smoke test, ESLint config, Vite build, GitHub Pages deploy workflow
