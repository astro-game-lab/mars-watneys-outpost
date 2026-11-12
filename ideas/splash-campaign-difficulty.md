# Plan: splash screen, campaign and difficulty

Status: **implemented** (2026-11-12).

## Goal

Turn the single mission into a short campaign that teaches one piece of Mars science per mission, with a story-and-instructions screen up front, a briefing before every mission, a debrief after it, and difficulty settings for players who finish the campaign.

## Decisions

| Question | Decision |
| --- | --- |
| Story voice | Keep Mark Watney as narrator. All text is original. It doesn't quote or closely paraphrase the book or film. |
| Levels | A campaign of missions. Difficulty tiers come after the campaign: they unlock once the last mission (*The Outpost*) has been won. |
| Determinism | Fix it first. Missions with handmade maps, scripted events and fair tuning need a seeded generator and a fixed timestep. |

## Stages

Each stage leaves the game playable.

1. **Determinism.** A seeded generator, `js/rng.js` (mulberry32), owns all simulation randomness: terrain, event timing and choice, and micrometeorite targets. The cosmetic crew walk gets its own separately seeded generator, so it can't disturb the simulation. The frame loop accumulates game time and runs whole `SIM_STEP` steps of 0.05 game seconds. `state.time` is computed from a tick counter, not summed, so sol boundaries land exactly. One seed plus the same inputs at the same ticks gives the same mission.
2. **Missions as data.** `js/missions.js` holds `MISSIONS`. Each mission sets its map (handmade or from a seed), starting outpost and resources, unlocked buildings, event settings (weights, interval, durations, scripted events), crew arrivals, objectives, extra failure conditions, and its briefing. Anything left out falls back to the defaults in `js/data.js`. Today's mission becomes `MISSIONS[5]`, *The Outpost*, with unchanged behaviour apart from the fixed step.
3. **Objectives and failures.** Objectives are small typed checks: `sol`, `credits`, `crew`, `stock` (a stored resource) and `radiation` (exposure at or below a value). A mission is won when all of them hold at once. Failures beyond crew health are `blackout` (stored power hits zero) and `deadline` (a sol is reached with objectives unmet). The HUD lists each objective with live progress and a ✓.
4. **Screens.**
   - **Intro.** It's shown on the first visit and reopened with `H` or the HUD's *How to play* button. It has a short story in Watney's voice, four cards on the core loop (power, water, oxygen, credits), a note that the Sun sets, and the controls.
   - **Mission select and briefing.** It opens after the intro, on later visits, from the end screen, or with `M`. It lists the campaign with lock and ✓ states. Selecting a mission shows its briefing: the story, the science lesson, objectives, failure conditions, available buildings and first moves. *Begin mission* (or `Enter`) starts it. Browsing doesn't touch the running game, and closing the screen resumes it.
   - **End screen with debrief.** It says why the mission ended. For a loss, that's the main cause of health damage and when that resource first ran out, or when the batteries died, or which objectives were missing at the deadline. Each cause comes with a hint. It also shows the seed. Buttons: *Retry* (same seed), *Next mission*, *Missions*.
   - The simulation never runs while a screen is open.
5. **Campaign.** Five teaching missions plus the original. Their balance is a first pass and needs playtesting.
6. **Difficulty.** *Normal*, *Hard* and *Martian*, selectable in mission select once *The Outpost* has been won. They scale crew consumption, starting supplies and the gap between random events. Progress records the best difficulty each mission was won at.

Progress (intro seen, missions won, chosen difficulty, last mission) is stored in `localStorage` and survives without it. A blocked storage just means the intro shows again.

## The campaign

| # | Mission | Lesson | Setup | Win | Lose (besides health) |
| --- | --- | --- | --- | --- | --- |
| 1 | **First Night** | Solar stops at sunset, so you need storage | Solar, Battery, Water and Greenhouse only. No events, no crew arrivals. | Reach Sol 3 | Blackout |
| 2 | **Ice Line** | Water comes from the ground, and ice yields double | Handmade map with ice a few tiles away and a ridge in the way. Little starting water. Pump failures and supply drops. | Store 2 000 water | Deadline: Sol 4 |
| 3 | **Dust Season** | Solar is unreliable, and nuclear runs through storms | Frequent 45 s dust storms. Nuclear available. | Earn 1 000 credits | Deadline: Sol 6 |
| 4 | **Flare Watch** | No magnetic field, so radiation needs walls | Frequent flares, one scripted for Sol 2 midday | Reach Sol 5 with exposure ≤ 10% | — |
| 5 | **Crew Rotation** | Every new crew member needs a bed, water, food and air | A crew landing every sol | Crew of 6 | Deadline: Sol 9 |
| 6 | **The Outpost** | Everything at once | Today's mission, with a fresh random map each time (or `?seed=N`) | Reach Sol 8 and earn 1 000 credits | — |

## Difficulty

| | Crew consumption | Starting supplies | Gap between random events |
| --- | --- | --- | --- |
| Normal | ×1 | ×1 | ×1 |
| Hard | ×1.2 | ×0.9 | ×0.8 |
| Martian | ×1.4 | ×0.8 | ×0.6 |

"Starting supplies" means water, food and oxygen only. Scaling materials and credits as well made *First Night* on Martian unwinnable: you couldn't afford enough power before the first sunset. The values were chosen so that every mission keeps at least one winning build order at every tier.

## Honesty

Every new claim made to the player, in the story, briefings or debrief hints, gets a sourced row in `docs/PHYSICS.md`. The new game rules also get rows in the departures table: blackout failure, mission event rates, crew every sol, and difficulty scaling. The determinism rows in § Conventions move from deviation to compliant. The remaining deviations, abstract units and the simulation calling the UI, stay listed.

## Not in this plan

- Splitting the simulation from `say()`/`endGame()` so it runs headless. That's the remaining org-convention gap, and the next step after this.
- Input recording and replay. Determinism makes it possible, but nothing records inputs yet.
- Watney prompts at teachable moments, as an in-game tutorial.
- Scores or stars beyond the best difficulty won.
- Sound and touch input.

## Verification

There's no test suite, so each stage was checked in a browser through Playwright:
- **Determinism:** the same seed run twice for thousands of steps, with events on, gives identical state.
- **Winnability:** each mission was won by a scripted build order.
- **Flow:** intro → mission select → briefing → play → end → next mission, with a clean console.
