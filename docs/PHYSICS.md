# Physics model — Mars: Watney's Outpost

This document says what the simulation claims and how far to trust it. Update it in the same change as any edit to the model: a rate, a rule, an event, or a building's explanatory text.

## Status

| | |
| --- | --- |
| **Model** | A discrete-time resource economy on a hex grid. Fixed production and consumption rates, gated by power and water shortages, with a stepped day/night solar curve, an additive radiation budget and a crew-health integrator. |
| **Fidelity claim** | **Qualitative only.** The game claims that the *relationships* it shows are real: solar stops at night and in dust storms, water and building materials come from local resources, shielding reduces dose, crew need water, food and oxygen. It claims **no** real quantities. Every number in `js/data.js` is a balance value in made-up units. |
| **Last validated** | 2026-11-11, by a read-through of the building texts against the references below. No automated checks exist. |

## Conventions

The org defaults assume a physics core in SI units with a deterministic, fixed-step integrator. This repository doesn't meet them yet, and says so here rather than leaving it to be discovered.

| | Org default | This repository |
| --- | --- | --- |
| **Units** | SI throughout the core | **Deviation.** Resources are abstract "units". Rates are units per game second. Radiation is a 0–100 "% exposure" score, not a dose. Health is 0–100. None of these map to physical quantities. |
| **Time** | Scalar offset from a defined epoch, in a stated scale | **Deviation.** `state.time` is game seconds since mission start. One sol is `SOL_SECONDS` = 120 game seconds. There is no calendar or epoch. |
| **Timestep** | Fixed, with an accumulator, decoupled from rendering | **Deviation.** `js/main.js` passes the frame's wall-clock delta (capped at 0.1 s, then multiplied by the 1×/2×/4× speed) straight to `updateGame`. The integrator is explicit Euler on that variable step, so results depend on frame rate. |
| **Randomness** | One explicitly seeded generator | **Deviation.** `Math.random` is called directly. In the simulation: event timing and choice, and the micrometeorite target (`js/events.js`). In world generation: terrain (`js/hexmap.js`). For cosmetics only: crew wandering (`js/render.js`). Nothing is seeded, so a run can't be replayed. |
| **Separation** | The core has no DOM and no UI calls | **Deviation.** `js/simulation.js` calls `say()` and `endGame()` from `js/ui.js` directly, and every module shares the global scope. |
| **Precision** | Float64 for state | Float64 (JavaScript numbers). Resources are clamped to `≥ 0`, and power to `≤` battery capacity, after each step. |

Fixing the timestep and threading a seeded RNG through the simulation are the first steps toward org compliance.

## Constants

There are no physical constants in the code. These are the real values the game's design compresses. They're listed so the departures below have something concrete to depart from.

| Quantity | Real value | Source | In the game |
| --- | --- | --- | --- |
| Mean solar day (sol) | 88 775.244 s (24 h 39 m 35 s) | Allison & McEwen, *Planet. Space Sci.* 48 (2000) 215–235 | 120 game seconds |
| Solar irradiance at Mars' mean distance, top of atmosphere | ≈ 586 W/m², about 43% of Earth's 1361 W/m² | Earth value: Kopp & Lean, *Geophys. Res. Lett.* 38 (2011) L01706. Scaled by 1/1.524² for Mars' semi-major axis. | Not modelled. A Solar Array makes 6 units/s at midday. |
| Surface radiation dose equivalent, Gale Crater | ≈ 0.64 mSv/day | Hassler et al., *Science* 343 (2014) 1244797, Curiosity RAD | A 35% baseline "exposure" score |
| Earth–Mars launch window period | ≈ 780 days (the synodic period) | Standard. Follows from the two orbital periods. | A crew member every 2 sols, and supply drops at random |

## What is modelled

- **Production and consumption.** Each building has fixed per-second rates (`BUILDINGS` in `js/data.js`), scaled by a terrain bonus and, for Solar Arrays, by daylight. Crew consume water, food and oxygen at a fixed rate each (`CREW_NEEDS`).
- **Shortages.** These are resolved in order: power first, then water. If stored power is empty and demand exceeds supply, every power consumer runs at the fraction `supply / demand`. Water works the same way, after power has been applied to the extractors. Food and oxygen can run out, but they don't throttle anything. They only damage health.
- **Storage.** Power is capped at 200 plus 150 per Battery Bank. Other resources have no cap.
- **Day/night.** Solar output follows a step function over the sol: 0 at night, 0.4 in the morning, 1.0 at midday, 0.3 in the evening.
- **Radiation.** Exposure = 35 + 40 during a flare − shielding, clamped to 0–100. Shielding is 5 per working Habitat, 15 per working Radiation Shield (scaled by its power level), and 5 per reinforced building, which works even while the building is damaged.
- **Health.** Health falls by 2 per second for each of water or food at zero, by 4 per second if oxygen is at zero, and by 0.08 per point of exposure above 50. Otherwise it regenerates at 0.5 per second, up to 100.
- **Events.** Weighted random draws every 40–70 game seconds. See `EVENTS` in `js/events.js`.

## What is neglected

- **Real units and quantities.** None of the rates are derived from real hardware. A Habitat doesn't consume a real mass of water, and a Solar Array doesn't make a real number of kilowatts.
- **Thermal control.** Heating is the largest power load in real Mars habitat designs. It's absent here.
- **Seasons, latitude and atmospheric attenuation.** All of these change how much solar energy reaches the ground. The daylight curve is the same every sol.
- **Battery losses, efficiency and depth of discharge.** Storage is lossless.
- **Recycling.** Real life support recovers most of its water and oxygen. Here, crew consumption is a pure sink.
- **Cumulative dose.** Radiation harms health only while exposure is above 50, and the damage heals completely. Real dose accumulates.
- **Logistics.** Supplies, crew and materials arrive without transfer windows, landing mass or cost.

## Domain of validity

The game's qualitative claims hold for the whole game. Its numbers are valid nowhere outside it. Don't use them to reason about a real outpost.

## Gameplay departures

**Every place the game knowingly departs from reality goes here.** Simplifying is allowed. Hiding it isn't. These all live in `js/data.js`, `js/simulation.js` and `js/events.js`. The repository has no separate core for them to stay out of yet.

| Departure | Where it lives | Why | Player-visible? |
| --- | --- | --- | --- |
| A sol lasts 120 s, about 740× faster than reality | `SOL_SECONDS` | A mission fits in about 16 minutes | Yes, on the clock |
| Daylight is four flat steps, not a smooth curve | `daylight()` | Readable phases. The HUD names each one. | Yes |
| Crew arrive every 2 sols, with no transfer windows | `CREW_ARRIVAL_SOLS` | Growth pressure inside one session | Yes |
| Dust storms last 30 s and cut solar by 70% | `EVENTS` | Real storms last weeks to months. A short one teaches the lesson without ending the run. | Yes |
| Solar flares add a flat +40% exposure for 20 s | `EVENTS` | Makes shielding matter in a short session | Yes |
| Micrometeorite strikes disable a random building every few minutes | `EVENTS` | Far more often than reality. It's there for variety. | Yes |
| NASA supply drops of materials and credits arrive at random | `EVENTS` | Catch-up mechanic. Real resupply follows launch windows. | Yes |
| Buildings appear instantly, and demolition refunds 50% | `build()`, `demolish()` in `js/state.js` | No construction phase in the prototype | Yes |
| Science is paid for with credits, and Labs scale with crew | `lab` in `BUILDINGS` | Gives the economy a currency | Yes |
| Health regenerates whenever nothing is harming it | `updateGame()` | Forgiving. Real radiation dose doesn't heal. | Partly. The health bar recovers. |
| Habitats make oxygen by electrolysis from water and power | `habitat` in `BUILDINGS` | Real, but folded into one building, with no separate life-support system | Yes, in the building's info |

## Claims the game makes to the player

Each building's `why` text in `js/data.js` makes a factual claim. These are the game's scientific content, so each one is listed here with its basis.

| Building | Claim | Basis | Status |
| --- | --- | --- | --- |
| Solar Array | Mars gets less than half of Earth's sunlight, and dust storms can block the Sun for days | ≈ 43% of Earth's irradiance (see [Constants](#constants)). The 2018 global dust storm lasted months and ended the Opportunity rover's mission. | Agrees |
| Water Extractor | Mars has water ice in the ground that heating can release | Subsurface ice mapped by Mars Odyssey and SHARAD, and dug up by Phoenix in 2008 | Agrees |
| Nuclear Generator | Fission power works day and night, like NASA's Kilopower | NASA/DOE KRUSTY ground test, 2018, for 1–10 kWe designs | Agrees |
| Battery Bank | Solar outposts need storage for night and for dust storms | Follows from the two claims above | Agrees |
| Mine | Building materials can come from local rock and regolith | In-situ resource utilisation, a NASA research area | Agrees, as research rather than a demonstrated practice |
| Habitat | Electrolysis turns water and power into oxygen | Standard. The ISS Oxygen Generation System works this way. | Agrees |
| Greenhouse | Photosynthesis adds a little oxygen | Standard | Agrees |
| Radiation Shield, regolith reinforcement | No global magnetic field and a thin atmosphere let radiation reach the surface, and a couple of metres of regolith blocks a large share | Hassler et al. (2014) for surface dose | **Partly.** Regolith blocks solar particle events very well. Against galactic cosmic rays the reduction is real but modest, because secondary particles build up. "A large share" overstates it for cosmic rays. |

## Validation

There's no test suite. These are the checks the model needs, roughly in priority order:

| Property | Method | Test |
| --- | --- | --- |
| Determinism | Same seed and same inputs give an identical state after N steps | _todo_: needs a seeded RNG and a fixed timestep first |
| Resource bookkeeping | Each step, the change in every resource is `rates × dt`, then clamped | _todo_ |
| Shortage resolution | Throttled consumers never draw more than is supplied, and the power-before-water ordering holds | _todo_ |
| Connectivity | Demolition never splits the outpost | _todo_ |
| Step-size independence | Mission outcome doesn't depend on frame rate | _todo_: fails today by construction |

## Numerical notes

- **Integrator:** explicit Euler on a variable step.
- **Timestep:** the wall-clock frame delta, capped at 0.1 s, times the game speed. That's up to 0.4 game seconds per step at 4×. The frame loop is capped at 30 fps.
- **Known drift:** shortages are detected only once a stock reaches about zero (`≤ 0.01`), so one step of over-draw is clamped away. At larger steps (4× speed, slow frames), state changes like a resource running out land later.
