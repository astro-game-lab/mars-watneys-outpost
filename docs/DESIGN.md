# Design — Mars: Watney's Outpost

## Pitch

Keep a Mars outpost alive long enough to make it worth the trip. A short, readable base-builder where every building exists for a real reason, and the planet keeps trying to take your power, your water and your crew's health.

## The fantasy

You're the stranded engineer turned colony founder: improvising, rationing, and doing the arithmetic on whether the batteries will last the night. The game is in the voice of Mark Watney from *The Martian*, and it's an unofficial fan work. See the [README](../README.md#fan-work-notice).

## What the player actually does

1. **Read the outpost.** The HUD shows each resource with its net rate and time to empty, plus crew, exposure, health and the clock.
2. **Expand.** Click a dashed tile next to the outpost to build. Terrain matters: Water Extractors do double on ice, and Mines do 1.5× on rock and 2× on high-resource tiles.
3. **Balance the loop.** Power runs everything, water feeds the Habitats and Greenhouses, Habitats make oxygen and house crew, and Labs earn the credits that pay for more.
4. **Survive the sol.** Night kills solar. Events hit at random. Shortages throttle whatever depends on them.
5. **Grow.** New crew land every two sols if there's a bed and supplies are healthy. More crew means more science and more mouths.
6. **Win** the mission's objectives before the outpost fails. The campaign builds up one hazard at a time. It ends with *The Outpost*: reach Sol 8 with 1 000 credits earned in total, which takes about 16 minutes at 1× (eight 120 s sols).

## The science

The concept isn't orbital mechanics. It's a closed life-support economy on a planet that isn't trying to help.

- **Concept:** on Mars, power is the resource every other resource depends on, and the Sun is an unreliable supplier.
- **How the mechanic makes you feel it:** the first night after an all-solar build drains the batteries, power-hungry buildings throttle, water stops, and oxygen starts falling. Then you learn about Battery Banks and Nuclear Generators.
- **What the player should be able to do afterwards:** explain why a Mars base needs storage or nuclear power, why water is mined rather than shipped, and why habitats get buried.

## Fidelity boundary

Each departure here also appears in [`PHYSICS.md`](PHYSICS.md#gameplay-departures).

| The game is honest about | The game deliberately simplifies |
| --- | --- |
| Solar depends on daylight and dust, and storage and nuclear power are the answers | Every quantity: rates are balance values, not hardware figures |
| Water and materials come from the ground | A 120 s sol, crew every 2 sols, random resupply |
| Shielding and regolith reduce exposure | Exposure is a 0–100 score, and its damage heals |
| Habitats make oxygen from water and power | No thermal load, no recycling, no seasons |

## Difficulty and onboarding

- **First visit:** an intro screen in Watney's voice tells the story, explains the power → water → air and food → credits loop in four cards, and lists the controls. It reopens with `H`.
- **The campaign is the tutorial.** Each mission isolates one lesson, with a briefing that gives the science, the objectives, how you can lose, the buildings available, and three first moves.
  1. *First Night*: storage. Survive two nights without a blackout, using Solar, Battery, Water and Greenhouse only.
  2. *Ice Line*: water from the ground. Bank 2 000 water before Sol 4 on a handmade map whose ice sits past a ridge. Regolith alone falls short.
  3. *Dust Season*: nuclear power. Earn 3 000 credits before Sol 6 through near-constant 90 s storms. Solar alone falls short.
  4. *Flare Watch*: shielding. Reach Sol 5 with exposure at 10% or less, through frequent flares and one scripted flare.
  5. *Crew Rotation*: life support for a growing crew. A lander arrives every sol. Reach a crew of six before Sol 9.
  6. *The Outpost*: everything at once, on a fresh random map each run.
- **Assumed knowledge:** none. Every building explains why it exists, and Watney comments on each warning as it fires.
- **Assists:** live objective progress in the HUD, time-to-empty on every resource, warn and crit colouring, and a reason given whenever a build, demolish or crew arrival is blocked.
- **Failure:** health reaches zero, or the mission's own condition (a blackout or a deadline). The debrief names the cause, such as the need that did the most harm and when it first ran out, or the objectives still missing, and gives a hint.
- **Difficulty:** *Hard* and *Martian* unlock after the campaign. They scale crew consumption, starting water, food and oxygen, and how often events come. Every mission stays winnable at every tier.

## Presentation

- **Visual approach:** a NASA Mars surface image under a translucent hex grid, SVG building sprites, small crew figures wandering between buildings, and a night overlay.
- **Audio:** none yet.
- **Accessibility:** **not yet addressed.** Resource status is shown mainly by colour. Play needs a mouse. The canvas has no text alternative.

## Scope

- **In the prototype:** a six-mission campaign, three difficulty tiers, one map size, nine buildings, five events, and progress saved in the browser.
- **Explicitly out of scope:** orbital logistics. That's the roadmap's *Mars Colony Logistics*.
- **Deferred:** saving a mission in progress, settings, sound, touch, full keyboard play, Watney prompts at teachable moments, and input replays.
