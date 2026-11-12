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
6. **Win** by reaching sol 8 with 1 000 credits earned in total. A mission takes about 16 minutes at 1× (eight 120 s sols).

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

- **First five minutes:** the starting outpost (two Habitats, a Lab and a Solar Array) has power and oxygen in daylight, but it has no food production, and water runs out in about two sols. The first lessons are a Greenhouse and a Water Extractor. The next one is the first night, when a single Solar Array can't carry the load.
- **Assumed knowledge:** none. Every building explains why it exists, and Watney comments on each warning as it fires.
- **Assists:** time-to-empty on every resource, warn and crit colouring, and a reason given whenever a build, demolish or crew arrival is blocked.
- **Failure:** health reaches zero. The end screen gives the sol, buildings, credits earned and exposure, plus a general hint to watch the rates. It doesn't yet explain *what* went wrong.

## Presentation

- **Visual approach:** a NASA Mars surface image under a translucent hex grid, SVG building sprites, small crew figures wandering between buildings, and a night overlay.
- **Audio:** none yet.
- **Accessibility:** **not yet addressed.** Resource status is shown mainly by colour. Play needs a mouse. The canvas has no text alternative.

## Scope

- **In the prototype:** one mission, one map size, nine buildings, five events.
- **Explicitly out of scope:** orbital logistics. That's the roadmap's *Mars Colony Logistics*.
- **Deferred:** saving, settings, sound, touch, keyboard play, a tutorial, and a debrief that explains a loss.

## Open questions

- **Fit with the org.** astro-game-lab builds "real orbital mechanics, playable", and this game has none. Does it stay a standalone surface game? Does it become the surface half of *Mars Colony Logistics*, or that game's prologue? Either way, it needs a place on the [project board](https://github.com/orgs/astro-game-lab/projects/1). The board's **Game** field doesn't have an option for it yet.
- **The name and the voice.** The game is a fan work built on *The Martian*. Before any wider release, decide whether to keep that or move to an original narrator and title.
- **Stack.** Port to the org's TypeScript stack, using `hohmann-heist`'s shape, or keep it as a dependency-free static page? Either way, the simulation should be separated from `say()`/`endGame()` and made to run headless.
- **Determinism.** A fixed timestep with an accumulator, and a seeded RNG for terrain and events. Together they give shareable seeds and replays, and they make the validation table in `PHYSICS.md` testable.
- **Quantities.** Should the rates be rescaled to real units (kW, kg/sol), so the honesty rule can apply to numbers and not only to relationships?
