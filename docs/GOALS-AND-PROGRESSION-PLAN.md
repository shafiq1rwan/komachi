# Komachi: goals, achievements, and building unlocks

Implementation brief for Claude. Prepared 8 October 2026.

## Task and outcome

Implement a town goal system in this repository, following the phases below. This is implementation work, not just a design proposal. Read the existing code before changing it, keep changes scoped, run the relevant checks, and report what shipped and what remains.

The immediate release scope is Phases 1–4: two playable chapters, persistent progress, building unlocks, Free Build, and a useful guide interface. Phase 5 expands the campaign after playtesting; do not implement its content in the first release. Complete the release scope without asking for approval between routine implementation phases.

Players reportedly leave around two minutes. We do not yet know whether confusion, waiting, lack of purpose, performance, or another issue causes this. Treat progression as a testable improvement, not a proven retention fix.

The player should understand:

1. What can I do next?
2. How do I do it?
3. What changed because I did it?
4. What am I working toward?

Preserve the quiet sandbox identity. Guided Town gives direction and a few earned unlocks. Free Build preserves unrestricted catalogue access. Neither mode needs currency, an economy, daily chores, or grinding.

## Product decisions

- New Poki towns default to **Guided Town**. The primary Play button starts immediately; do not add a mandatory mode-selection screen.
- Offer Free Build through the existing new-town flow and a clearly labelled action in town settings. Other builds retain their current free-building default, with Guided Town available in the new-town flow.
- A guided town can permanently switch to Free Build. Keep its town, earned achievements, and save. Explain that building restrictions will be removed; no destructive reset or confirmation dialog is needed.
- Do not support switching an established Free Build town into restricted Guided Town in this release.
- Existing saves without progression data migrate to Free Build. Do not relock buildings or replay the old tutorial.
- Demo and scratch/test URLs retain existing behaviour by default. Provide an explicit development override to test guided progression in a scratch town.
- Basic homes, streets, Explore, and Clear remain available from the beginning. Car parks also remain available; they are not a progression requirement.
- Locked catalogue items are visible, inspectable, and explain their unlock condition. They cannot be selected for placement.
- Unlocks and completed achievements are permanent. Removing a building or losing population never removes an earned reward.
- No XP or spendable currency in the first release. Show chapter progress, town level, and actual population instead. Currency is a possible later phase only after playtests validate the core loop; do not add costs, income, upkeep, or debt now.
- Levels are earned by completed goals: connected placements, finished buildings, real arrivals, and population milestones. Elapsed time alone never grants levels or rewards. Construction time allows consequences to occur, but is not a progression score. Repeated building/removal cannot farm levels.
- Guide objectives never require clicking a person or a celebration to count. Inspecting and following people are encouraged optional interactions.
- Guided Town gates the player fishing minigame until Town Level 3. Free Build and legacy towns retain fishing access. Ambient anglers, fishing boats, catches, and fish deliveries continue normally; the lock only concerns player participation.
- Keep photo mode, camera controls, pause, settings, and accessibility controls available at every level.
- Preserve the existing hill access condition in both modes. Free Build means unrestricted building catalogue, not a rewrite of terrain progression.

## Existing code to inspect

| File | Relevant responsibility |
| --- | --- |
| `src/guide.js` | Current five-step guide; replace its gameplay responsibility so two tutorial systems do not compete |
| `src/milestone.js` | General milestone announcements and camera glides; keep for world celebrations |
| `src/main.js` | Initialisation, simulation loop, `MT` development hooks, guide wiring |
| `src/state.js` | Shared state and default starting time (`S.T = 7`) |
| `src/world.js` | `TIERS`, `KIND_LABEL`, `chooseKind`, `placeBlock`, road connectivity, `DONE`, `HILL_UNLOCK = 60` |
| `src/picker.js` | Explicit kinds, Auto selection, thumbnails, allowed drag sizes, strip layout |
| `src/input.js` | Tools, keyboard shortcuts, selection, previews, placement feedback |
| `src/sim.js` | Residents, households, jobs, construction stages, actual visits, automatic trade changes |
| `src/construction.js` | Crew booking, train arrival, construction queue, work hours |
| `src/save.js` | Snapshot/restore; currently accepts save versions 1–3 and restores buildings through `placeBlock` |
| `src/slots.js` | Town creation, slot summaries, per-town storage, scratch behaviour |
| `src/title.js` | Poki Play/Continue, new towns, settings, pause menu |
| `src/chronicle.js` | Permanent record of town events |
| `src/styles.css`, `index.html` | HUD, picker, dock, inspection panel, tutorial UI |
| `src/poki.js` | Loading/gameplay SDK lifecycle; preserve it |
| `scripts/smoke.mjs`, `scripts/check-poki.mjs` | Existing browser verification patterns |

These are pointers, not permission to rewrite every module. Reuse existing behaviour and assets. There is no need for a new framework, backend, analytics service, or image generation.

## First-release campaign

### Chapter 1: First Neighbours — Town Level 1

Opening copy: **Build your first neighbourhood. Connect a street, build a home, and welcome your first neighbours.**

| ID | Quest | Actual completion predicate | Reward |
| --- | --- | --- | --- |
| `first-street` | A street to somewhere | At least two player-drawn road cells belong to the station-connected road network | Permanent quest completion and brief connection feedback |
| `first-home` | A place to call home | A valid connected residential unit has been placed | Town Level 2: Foundations; unlock the starter shop and workplace groups immediately |
| `first-household` | Welcome your neighbours | An actual resident has moved into a home; verify arrival semantics, not just a preassigned future home | Complete Chapter 1; Town Level 3: First Neighbours; unlock player fishing, cafes, and groceries; record the achievement |

Count road connectivity, not simply `drawnCount > 0`. Count actual residential units, not two separate block gestures. Placing several houses in one valid drag must receive correct credit.

Unlock shops/workplaces on home placement rather than waiting for move-in. This is a deliberate pacing decision: the player can build while construction continues. During the arrival objective, present optional buttons to build a shop or workplace; do not turn them into extra mandatory Chapter 1 tasks.

### Chapter 2: A Living Street — Town Level 3

Chapter copy: **Give your neighbours somewhere to shop and work.**

| ID | Quest | Actual completion predicate | Reward |
| --- | --- | --- | --- |
| `first-shop` | The corner shop | A connected shop reaches `stage >= DONE` | Quest completion; offer to view the building |
| `first-workplace` | Room to work | A connected workplace reaches `stage >= DONE` | Quest completion; explain the next step toward local jobs |
| `ten-neighbours` | A growing neighbourhood | At least 10 residents living in local homes | Quest completion; population feedback |

All three may progress concurrently. Completion of all three grants **Town Level 4: A Living Street**, unlocks terrace homes and the community centre, and records a chapter achievement.

Ten residents is an initial tuning value, not a proven ideal. Put it in content configuration. Do not require first customer visits or a particular commute to unlock buildings: schedules and randomness can create unnecessary waiting. Highlight such events when they actually occur, without pretending they happened at placement time.

The two-chapter release has six goals total and reaches Level 4. Before later chapters ship, Level 4 also receives a permanent `release-catalogue-access` entitlement granting remaining building access, so the initial release has no unreachable locks. Do not show inaccessible Level 5–10 rewards in its UI. Phase 5 replaces this bridge for newly created guided towns only; existing towns keep their entitlement. After Chapter 2, display **Your town is yours to grow** and let players collapse the completed chapter book. Keep the existing 60-resident hill opportunity discoverable.

## Complete level and reward map

Plan ten meaningful levels, rather than stopping at six. Every level has an explicit capability reward. Level 1 provides the starting kit; all later levels add something. Levels are milestone-based, not an XP grind. The initial release implements Levels 1–4; Levels 5–10 are defined here for later content planning. Later levels require the previous level plus their own goals; early or out-of-order actions still receive credit when their level becomes active. No reward is granted twice.

| Level | Title | Earned by | Newly available capability |
| --- | --- | --- | --- |
| 1 | A New Beginning | Start a guided town | Streets, basic detached/narrow homes, car parks; Explore/Clear and essential controls |
| 2 | Foundations | Complete `first-street` and `first-home` | Konbini, bakery, ramen; studio, office, workshop |
| 3 | First Neighbours | Complete Chapter 1, including an actual first move-in | Player fishing, cafe, grocery |
| 4 | A Living Street | Complete Chapter 2: operating shop/workplace and 10 local residents | Terrace housing; community centre |
| 5 | Caring for Neighbours | Finished community centre and 15 local residents | Clinic, recycling, substation, waterworks |
| 6 | Local Produce | Finished clinic OR recycling centre, and 20 local residents | All farm kinds; florist, books, restaurant |
| 7 | A Busy Neighbourhood | Finished farm OR two distinct finished shop kinds, and 30 local residents | Apartment housing, supermarket, shopping arcade |
| 8 | A Place to Gather | An occupied apartment unit OR a finished supermarket/arcade, and 40 local residents | Town square, bathhouse |
| 9 | A Growing Town | Finished square OR bathhouse, and 50 local residents | Townhall, firestation, factory |
| 10 | Beyond the Station | Finished townhall OR firestation OR factory, and 60 local residents | Existing hill opportunity; manshon housing; remaining player catalogue kinds |

Thresholds 15/20/30/40/50 are initial tuning values; store them in content configuration. The 60-resident hill threshold already exists. Evaluate alternatives exactly as written: building option A OR option B, together with the population requirement. Use actual `DONE` stages and actual housed residents. Never use block names, wall-clock waits, or ambiguous subjective criteria as predicates.

Use stable later goal IDs such as `level-5-community`, `level-5-population`, through `level-10-service` and `level-10-population`; specify them in content definitions before implementation. Alternative building branches satisfy a single goal, not two mandatory goals. Population can progress in the background. No quests depend on festivals, rare random events, a specific shop visit, or successful fishing.

The starter office kind supports multiple sizes in current `TIERS`. This is acceptable: do not invent an office-size gate unless testing establishes a reason. Level 4's larger residential reward remains distinct.

Goals that require newly unlocked buildings belong to the next level, never the level that unlocks them. None requires a successful fish catch. Fishing is a recreational reward, not mandatory progression. Reaching 60 residents still opens the hill through existing simulation behaviour; if chapter prerequisites are unfinished, credit this terrain milestone without delaying or relocking the hill.

Every level-up presentation names the new capabilities and offers one contextual action, such as **View shops**, **Go to the jetty**, or **View community buildings**. Add an unlock overview showing earned levels and the next reachable reward; do not show six competing active objectives.

## Building availability for the first release

Use the existing kind identifiers. Residential kinds are represented by variants; other types use kinds. Check size compatibility through `TIERS`, never through invented dimensions.

| Availability | Residential | Shops | Work | Civic / Farms |
| --- | --- | --- | --- | --- |
| Start | `detached`, `narrow` | Locked | Locked | Locked |
| Level 2 | Same basic homes | `konbini`, `bakery`, `ramen` | `studio`, `office`, `workshop` | Locked |
| Level 3 | Same basic homes | Add `cafe`, `grocery` | Same starter work kinds | Locked |
| Level 4 | Add `terrace` | Same Level 3 kinds | Same starter work kinds | `community` |
| Initial-release bridge after Chapter 2 | All existing catalogue variants | All existing catalogue kinds | All existing catalogue kinds | All existing catalogue kinds |
| Free Build | Existing unrestricted behaviour | Existing unrestricted behaviour | Existing unrestricted behaviour | Existing unrestricted behaviour |

Do not accidentally block growth beyond 10 people: basic housing must remain repeatable and capable of reaching the target. There is no building quota or cap tied to chapter progress.

Auto must use only unlocked kinds compatible with the selected drag size. At the start, two- or three-cell residential Auto placements have no allowed kind; explain **Larger homes unlock after A Living Street. Place a one-cell home for now.** Do not silently change a multi-cell drag into a different footprint.

If a selected size has no unlocked kind, reject before mutation with a useful reason. Preview and tier labels must agree with the allowed pool. Auto must never fall back to a locked kind. Clear stale picks when availability changes.

Locks concern player construction. Keep the simulation's existing upgrades, trade changes, scripted landmarks, and restored buildings working. Do not remove existing buildings or introduce gates on normal simulation evolution. Audit these paths so they cannot crash or accidentally use the player-facing rejection path.

## Achievement presentation

### Fishing lock and reward

- Include `src/minigame-fishing.js` and its `startFishing` entry point in the availability integration. The existing contextual control is `#fish-near` in `index.html`; it currently appears near the jetty when an angler is present and the camera is close enough.
- At a fishing opportunity before Level 3, show an inspectable locked control: **Fishing · Unlocks at Town Level 3**, with **Welcome your first neighbours** as the requirement. An `aria-disabled` control may explain its lock but must not start the activity.
- Enforce the capability at the activity entry point as well as the button. Other player-facing entry paths must not bypass it. Keep development/test overrides explicit.
- Level 3 removes the progression lock; existing spatial/angler prerequisites still apply. Distinguish **Unlocked** from **An angler must be at the jetty**. Do not promise that pressing a reward button can start fishing when there is no valid spot/angler.
- **Go to the jetty** focuses the real jetty and explains the normal participation condition. If schedules make the reward inaccessible for a long time, improve a supported invitation/opportunity through existing mechanics; do not silently teleport a resident or rewrite ambient fishing.
- Unlock feedback and the overview should make fishing discoverable without adding a permanently disabled toolbar full of unavailable activities.
- Save fishing capability through level/goal state; preserve the release bridge entitlement separately. Free Build grants player fishing immediately.

The reward loop is **act → visible consequence → acknowledgement → new possibility**.

- Individual quest: subtle checkmark animation, short sound respecting audio settings, one sentence about what changed. No full-screen interruption.
- Chapter: a slightly stronger celebration, new town title, unlocked building thumbnails, **View new buildings** action, and chronicle entry.
- Rewards grant automatically. Never require a Claim button to receive an unlock.
- Queue celebrations so concurrent completions do not overwrite each other. Use one chapter summary instead of a burst of six notifications on catch-up.
- Do not reward repeated placement/removal. Each goal and chapter pays out only once per town.
- Do not invent a surname or waiting family until a real household exists. Use actual simulation data where available; otherwise say **Your first neighbours**.
- Population animation represents actual arrivals. Do not inflate numbers or imply a customer visit before it happens.

## Guide interface and world cues

Create a dedicated objective component and revise the gameplay HUD as specified below. This layout supersedes the earlier lower-left goal-card mockup. Milestone notifications no longer occupy the top centre; that location belongs to persistent level progress.

### Top-left statistics HUD

- Remove the Komachi wordmark and decorative brand icon from the gameplay HUD only. Preserve main-menu branding.
- Use readable text labels and tabular numbers instead of stat pictograms: **Population 10**, **Homes 4**, **Shops 1** as the primary compact row.
- An expandable **More stats** control reveals **Open jobs**, **Seeking work**, and **Waiting at station**. Keep all six existing metrics accessible, with their actual meanings. `s-jobs` is open jobs, not employed residents; `s-wait` is people waiting, not train count.
- Retain the existing stat IDs/data wiring where practical. Tooltips supplement visible labels rather than replace them.
- Keep the card compact enough for the central level card and right-hand clock to fit without overlap. Group related numbers with spacing rather than a separate large tile for each stat.

### Top-centre level HUD

- Use a compact single-line level control centred in the viewport: **Level 3 — progress line — 2/3**. Width approximately 244px desktop / 164px mobile; height 48px / 28px. Match the other HUD panels: cream surface, dark green text, teal progress fill, 16px corners on desktop / 10px on mobile, and the same restrained border/shadow as the statistics panel. The earlier bare text was hard to see; the dark evergreen/gold pill did not match the HUD. Preserve an opaque surface and an 8px desktop / 5px mobile track for legibility. Keep the full title and reward details in the expanded view, not a large permanent card.
- This is the authoritative persistent level display. The goal card shows the selected goal, not another duplicate level bar.
- The count represents completed goals for the next level, never the current chapter or elapsed time. The thin line may include real partial requirement progress, such as population 8/10; the goal card states the actual count. Construction has its own explicitly labelled progress meter, not fake XP.
- Clicking/tapping opens the chapter and unlock overview. Keep the upcoming reward visible there.
- At the final implemented level show **Lv. N · Complete**, with no fake next-level progress. Show the full title and achievement list when expanded. When all ten levels ship, N is 10.
- Free Build shows **Free Build** in this location and may open optional goals/earned achievements; do not imply gated progression applies to it.
- Keep clock, speed, camera/photo and menu access at the top right. Essential controls remain usable at every level.

### Goal card beneath statistics

- Anchor the goal card directly beneath the top-left statistics card with approximately 10–12px gap and matching left alignment; desktop target width about 300–340px.
- Calculate placement from actual HUD bounds or a shared layout container. Expanded statistics push the goal card down. Do not hardcode a top offset that conflicts with rich/classic HUD variants.
- Keep the default instructions concise. Collapse leaves a small **Current goal** row under statistics that can always reopen.
- Do not overlap the central level card, right-hand inspection panel, or build picker. Keep the main town view clear.

### Notification location

- Move both milestone announcements and ordinary toasts to a shared **lower-left notification area**, separate from the top-left goal card. On desktop, position above the dock/picker exclusion area with safe margins.
- Limit this area to one major card plus at most one compact message; queue/coalesce excess notifications rather than stacking across the town view.
- Validation feedback must appear promptly even while a milestone is shown. Do not bury a failed-placement reason behind queued celebrations.
- Keep existing milestone focus actions, but ordinary notification dismissal never changes goal state.
- Ordinary notices stay in the lower-left area. Level-up is a separate, temporary central reward reveal: fill/shine the small HUD line before updating its number, then a brief local confetti burst and distinct original fanfare. Feature a large preview of the actual unlocked model, explain what the player achieved and what the reward enables, and show the other rewards as selectable model thumbnails. Offer **Build this** and **Keep building**; **Build this** selects that exact unlocked kind rather than Auto. Fishing gets its own illustration and a truthful quay action. The reveal stays until dismissed and never steals ongoing input or pauses the simulation. Queue it while menus/activities hide gameplay. Respect muted audio and reduced motion.
- New building chips receive a **NEW** marker after a live unlock, cleared when selected. The first-release marker is session-local; permanent availability is saved. Do not replay celebrations when reloading or reconciling a save.
- Position using the actual dock/picker bounds, and avoid the controls hint or fishing UI. Relocate/collapse legacy hints if necessary. Do not draw the card behind a picker.

### Responsive behaviour

- When all three top HUD cards cannot fit, use a first row for compact statistics and essential clock/menu controls, then a centred level row. Keep the goal card immediately below the statistics/level area, initially collapsed on narrow or short screens.
- Mobile revision: keep the 164×28px level control at the very top centre. A 40px row beneath it holds population/home/shop icons and counts (compact notation for large values) on the left and clock controls on the right. The goal summary below is no wider than 244px and keeps the goal title, progress and one short instruction visible; its chevron expands the full instructions and unlock information. Free Build omits the level row. The same compact treatment applies to short landscape screens, where the level control fits between the statistics and clock in the first row at widths above 720px.
- Expanded mobile goals are bounded in height and collapse easily; do not cover the toolbar. Expanded stat details use a bounded popover rather than an unbounded vertical stack.
- Limit expanded goal details to 34% of the viewport height and the remaining space above the picker/dock, with scrolling. A new active goal returns to the compact summary. Keep full statistic labels and exact counts available to assistive technology.
- Hide the three goal-card action buttons on mobile, including in expanded details. The top-centre level control still opens the level/unlock overview.
- Mobile notifications use one compact bottom card above the toolbar/picker. Only one major celebration is visible at a time.
- Use safe-area insets and measured layout; no overlaps at 390px portrait or short landscape widths. Verify both rich and classic presentation modes.

Expanded contents:

```text
FIRST NEIGHBOURS · 1 OF 3
Connect a street to the station
Choose Streets, then drag from the highlighted exit.
Streets help people reach your town.
[Show me where]                         [Collapse]
```

- Update instructions based on selected tool and actual state.
- **Show me where** focuses the target without hiding the objective. Player input can cancel the camera move.
- Collapse preserves a visible Current goal control. Do not let dismissing a notification permanently lose the objective.
- During construction, show real status: waiting for crew, crew travelling, construction underway, or work resumes in daylight.
- Offer the existing speed control or a contextual **Speed up** action when useful. Respect pause; never override user speed silently.
- Show remaining requirements in the goal card; keep persistent town-level progress in the top-centre HUD.
- In Chapter 2, allow the player to choose the displayed active goal. Other goals still track in the background.
- New unlocks open the relevant catalogue and highlight new items through an explicit button.
- Locked chips use a lock icon, name, and readable reason. Support touch and keyboard, not hover alone. Retain existing one-of-a-kind built-state rules separately.
- Pulse only the relevant tool; softly highlight the station exit and eligible cells. Cues are suggestions, not compulsory plots.
- Use existing placement/network rules to identify eligible land. Never highlight water, disconnected plots, or occupied cells as valid.
- Do not obscure the central station, picker, tier label, or inspect card. Handle short viewports and safe-area insets.
- Hide guide UI in opening, full menus, photo, fishing, trailer, and demo end states, following current UI conventions. Restore it afterward without losing progress.
- Respect reduced motion and audio preferences. Dispose/reuse cue meshes; avoid per-frame allocations or rebuilding the DOM every frame.

## Data and architecture

Prefer a small DOM-independent progression core plus content definitions and a thin world/UI adapter. Suggested modules: `progression.js`, `goal-content.js`, `goal-ui.js`. Use equivalent names if the repository structure warrants it.

Suggested per-town persisted data:

```js
progression: {
  version: 1,
  mode: 'guided', // or 'free'
  completedGoalIds: [],
  completedChapterIds: [],
  activeGoalId: 'first-street',
  collapsed: false
}
```

Derive level and availability from completed chapters/goals and mode. Avoid storing redundant mutable counters that can disagree. Progress fractions use real world facts; completed goals remain latched permanently. Add an `entitlements` array for exceptional permanent grants such as `release-catalogue-access`; do not use it as a second copy of every derived unlock. Persist additional one-time onboarding/tuning state only when needed and document it.

Provide one availability API used by catalogue, Auto, previews, and player placement. Keep it free of DOM/world import cycles. Inject world facts into the progression evaluator, rather than importing simulation/UI dependencies into the pure core.

Player placement needs a consistent guard before IDs, meshes, cells, or blocks mutate. Distinguish player construction from save restoration and internal simulation actions explicitly. Do not blanket-reject `placeBlock`: restore currently calls it and assumes a valid result. Check null/error handling at all modified callers.

Evaluate at relevant events or a lightweight bounded cadence. Do not scan the entire world and rerender the entire UI every animation frame. Pause completion/celebration processing during restoration, then reconcile once the world is fully loaded.

Reconciliation credits valid existing actions regardless of order. A player who builds a shop during Chapter 1 receives Chapter 2 credit later. Completed goals never regress; incomplete goals use current world facts. If an in-progress target is removed, retarget to a suitable existing site or show how to replace it.

Save after reward changes using existing save handling, without hiding save errors or disrupting the game. Add progression metadata to slot summaries only if required by the menu. Do not add a global progression key shared across towns.

## Phased implementation

### Phase 1 — Core, content, and persistence

Implement the pure progression model, six goals, two chapters, availability definitions, world-fact adapter, snapshot/restore migration, and development inspection hooks.

Acceptance:

- Fresh guided state has only starter availability.
- Out-of-order actions receive correct credit; rewards are idempotent.
- Reload preserves progress and unlocks; town slots are isolated.
- Versions 1–3 without progression load as Free Build with no surprise locks.
- Unknown/malformed progression fields normalise safely; stable IDs and content versioning are documented.
- No competing old guide is started in a town using the new system. Preserve compatibility hooks if existing checks depend on them.

### Phase 2 — Player-facing goals and world guidance

Implement the text-labelled top-left statistics, top-centre level HUD, goal card beneath statistics, lower-left notification area, collapse/reopen, chapter book, tool pulse, legal placement cues, real construction status, camera focus, and completion presentation.

Acceptance:

- Player can find the current goal after any close/collapse action.
- Street goal cannot complete from a disconnected road or unrelated building.
- Completed home placement advances once, regardless of drag/block count.
- Focus does not remove the instruction or steal ongoing pointer input.
- UI fits desktop and mobile with picker/inspect panels open.
- No gameplay Komachi logo/stat pictograms remain in the top-left card; labels preserve the existing metric meanings.
- Top-centre level progress reflects real goals, and notifications no longer occupy that position.
- Expanding stats, goals, picker, or inspect panels never hides essential controls or causes card overlap.
- Chapter rewards are visible, accurate, and not repeated on reload.

### Phase 3 — Unlock enforcement and mode entry

Wire availability into picker, Auto, preview/tier labels, keyboard tools, and the player placement boundary. Add new-town mode selection outside the immediate Poki Play path and the one-way switch to Free Build in settings.

Acceptance:

- Explicit selection, Auto, and shortcuts cannot construct locked kinds.
- Fishing remains locked before Level 3 at both UI and activity entry point; ambient fishing continues. It unlocks permanently at Level 3 and is immediately available by progression rules in Free Build.
- Invalid locked placement has no world/save side effects.
- Locked chips explain the exact goal needed on mouse, touch, and keyboard.
- Guided Poki Play enters immediately; Continue respects saved mode.
- Free Build and legacy towns keep catalogue behaviour; restore/internal simulation is unaffected.
- Switching to Free Build preserves everything and refreshes current picks/availability immediately.

### Phase 4 — Pacing, verification, and first release

Measure the real fresh-town sequence at 1× before changing timings. The simulation currently starts at 07:00, uses `HPS = 0.1`, has staged construction, crew queues, train arrivals, and daylight limits. Do not assume building placement guarantees a quick move-in.

Targets for a player following prompts, measured in active play time rather than time spent paused:

- First successful action in roughly 20–30 seconds.
- First unlock shortly after home placement, ideally within the first minute.
- First occupied home around 90–120 seconds.
- No mandatory idle stretch longer than roughly 15–20 seconds without another useful action or clear status.

These are tuning targets, not test assertions tied to exact seconds. If measured timing misses them, apply narrowly scoped, saved, one-time assistance to the first guided home/crew sequence. Preserve actual construction stages, routing, train arrival, and occupancy rules. Do not teleport a finished house/population into existence or globally accelerate every town. Exclude Free Build and legacy saves from onboarding assistance. Report the measured before/after timings and any compromises.

Add an opt-in local development session log, with events for Play, first valid street, home placement, first crew work, first move-in, shop/work completion, quest/chapter completion, mode switch, and last meaningful action. Use a monotonic session clock, exclude pauses/hidden-tab time from active-time metrics, and avoid counting reload catch-up as new live play. Keep logs bounded and local; no external analytics dependency or tracking endpoint.

Run relevant checks using the repository scripts. At minimum: `npm run lint`, `npm run build`, `npm run build:poki`, and the applicable browser checks (`npm test`, `npm run check:poki`). Inspect their server/browser prerequisites before running; do not claim a pass if the environment prevents execution.

Add meaningful core tests and browser cases for connected/disconnected roads, permanent rewards, out-of-order construction, save/reload, migration, slot isolation, Auto lock enforcement, invalid-placement side effects, and mode switch. Follow existing browser tooling patterns. Do not add tests that merely duplicate a constant table.

Visually inspect desktop around 1440×900, tablet around 768×1024, mobile around 390×844, and a short landscape viewport. Include picker open, inspect open, collapsed task, locked chip details, and chapter celebration.

First-release acceptance: a fresh Poki player can finish both chapters, earn actual building unlocks, inspect their achievements, continue after reload, and choose Free Build without losing the town. Existing towns still load and play normally.

### Phase 5 — Campaign expansion after playtesting

Do not implement in the first release. Review observed drop-off and goal completion before adding more restrictions.

Implement Levels 5–10 using the complete reward map above, replacing the first-release bridge only for new guided towns. Each level has its stated building goal and population goal. Branching building requirements offer a choice without adding hidden prerequisites. Connect Level 10 presentation to the existing hill event without duplicating, delaying, or relocking terrain access. Treat each level as a small content chapter after the two introductory chapters.

Beyond Level 10, add more levels only when there are real new rewards: districts, building styles, activities, or special projects. Do not promise unavailable content or add empty population-only levels merely to grow the number.

Any later rebalance must preserve already-earned catalogue access. Never relock first-release towns when adding more chapters. Keep campaign content data-driven and migrations explicit.

## Playtest decision rules

- Players fail before placing a home: improve controls/cues, not the number of quests.
- Players place a home then leave waiting: improve construction pacing and concurrent tasks.
- Players reach the first reward but do not continue: improve the next ambition and its visible benefit.
- Players repeatedly seek locked buildings or switch to Free Build: reduce restrictions and preserve creative freedom.
- Evaluate session duration alongside goal completion and observed understanding. Longer waiting is not better engagement.

Use a small initial round of observed sessions to find obvious friction, then broader testing before claiming a retention improvement. Ask players what they thought they were supposed to do next; avoid coaching during the session.

## Implementation handoff checklist

- [x] Phases 1–4 implemented, with Phase 5 clearly deferred.
- [x] No old tutorial/new objective UI conflict (guide.js stands down in guided towns).
- [x] Six stable goal IDs, two chapters, accurate town levels.
- [x] Levels 1–4 each provide the planned capabilities; fishing is a real Level 3 reward.
- [x] Release bridge prevents unreachable locks and survives future campaign expansion (an entitlement kept per town).
- [x] Locks explain themselves and cannot be bypassed through Auto/player shortcuts.
- [x] Free Build, old saves, and internal simulation remain functional.
- [x] One-time rewards and onboarding state survive reload without duplicate celebrations.
- [x] Task UI and legal world highlights work on desktop/mobile.
- [x] Timing measured, not guessed; assistance scoped to fresh guided towns (none was needed).
- [x] Checks and visual QA reported honestly, including any blockers.
- [x] Final report lists changed files, behaviour, validation, limitations, and remaining work.

## Shipped 2026-10-08: report

**Changed files.** New: src/progression.js (pure core), src/progress.js (adapter, availability API, cues, session log), src/goal-ui.js
(goal card, chapter book, levels, level-up cards, world cues), scripts/test-progression.mjs. Changed: src/world.js (chooseKind takes an
`allowed` list), src/input.js (placement guard, Auto preset, drag cap, tier line, pokes), src/picker.js (locked chips, Auto note,
re-render on events), src/minigame-fishing.js (entry gate and the relabelled invitation), src/save.js (snapshot), src/slots.js
(the New town page's mode through the reload), src/main.js (init, update, dev hooks, the old guide stood down), src/title.js (mode
choice), index.html (Settings row), src/styles.css, scripts/smoke.mjs, package.json, docs.

**Behaviour.** New towns in every build start guided (the user's decision on 2026-10-08, wider than the Poki-only default above);
scratch/test tabs are Free Build unless `?guided`; saves without progression are Free Build. Everything else as specified in
Phases 1–4. The one deviation: the New town page's choice is a two-card selector rather than a settings default, and Poki's Play
button never shows it.

**Validation.** `node scripts/test-progression.mjs` (10 core checks), the smoke suite (63 checks including three for Guided Town:
starter kit, refused locked shop with no side effects, connected street and home → Level 2, fishing locked, reload persistence,
Free Build switch; scratch tabs Free Build), `npm run check:poki`, `npm run check:demo`. Visual QA headless at 1280×800, 390×844,
844×390 and 768×1024 with the picker open and the level-up card shown.

**Pacing (seed 7, 1×, measured headless by game clock).** First train 0.04 h after the start; the crew at work 1.44 h (14 s) after
the home was placed; the household moved in 9.3 h later (93 s). Within the targets, so no one-time assistance was added.

**Limitations and remaining work.** Level-up thumbnails are names with icons, not pictures. The street-exit and plot cues cap at
40 cells. "Show me where" moves the camera at once rather than gliding. Levels 5–10 (Phase 5) are not built. The old guide.js still
serves a fresh Free Build town.
