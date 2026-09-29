# Known bugs

Bugs noticed in play and not fixed yet. Newest first. When one is fixed, move it to the CHANGELOG and delete it here.

## Open

- scripts/check-harbor.mjs fails its `hillPlots > 0` assertion on seed 2026 (seen 2026-09-29 while checking the harbour arms; the other
  five seeds pass and the arm fix does not touch the hill). Cause not yet found: probably that island's ridge leaves no terrace plot.
