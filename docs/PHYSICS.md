# Physics model — Mars: Watney's Outpost

This document says what the simulation claims and how far to trust it. Update it in the same change as any edit to the model: a rate, a rule, an event, or a building's explanatory text.

## Status

| | |
| --- | --- |
| **Model** | A discrete-time resource economy on a hex grid. Fixed production and consumption rates, gated by power and water shortages, with a stepped day/night solar curve, an additive radiation budget and a crew-health integrator. |
| **Fidelity claim** | **Qualitative only.** The game claims that the *relationships* it shows are real: solar stops at night and in dust storms, water and building materials come from local resources, shielding reduces dose, crew need water, food and oxygen. It claims **no** real quantities. Every number in `js/data.js` is a balance value in made-up units. |
| **Last validated** | 2026-11-12, by a read-through of the building, story and mission-briefing texts against the references below. Since 2026-11-14 the model is checked by the automated tests in `tests/` on every pull request and before every deploy. See [Validation](#validation). |

## Conventions

The org defaults assume a physics core in SI units with a deterministic, fixed-step integrator. This repository meets the determinism rules but not the others, and says so here rather than leaving it to be discovered.

| | Org default | This repository |
| --- | --- | --- |
| **Units** | SI throughout the core | **Deviation.** Resources are abstract "units". Rates are units per game second. Radiation is a 0–100 "% exposure" score, not a dose. Health is 0–100. None of these map to physical quantities. |
| **Time** | Scalar offset from a defined epoch, in a stated scale | **Deviation.** `state.time` is game seconds since the start of Sol 1, computed as `startTime + tick × SIM_STEP` so it never accumulates rounding. One sol is `SOL_SECONDS` = 120 game seconds. There is no calendar or epoch. |
| **Timestep** | Fixed, with an accumulator, decoupled from rendering | **Compliant.** `updateGame()` always advances exactly `SIM_STEP` = 0.05 game seconds. `js/main.js` banks each frame's wall-clock delta (capped at 0.1 s, times the 1×/2×/4× speed) and runs as many whole steps as it has banked. Frame rate changes how many steps run per frame, never what a step does. |
| **Randomness** | One explicitly seeded generator | **Compliant.** All simulation randomness comes from `state.rng`, a mulberry32 generator (`js/rng.js`) seeded per mission: terrain, event timing and choice, and the micrometeorite target. Campaign missions have fixed seeds. *The Outpost* takes a fresh seed per run, from `crypto.getRandomValues` at the UI boundary, or `?seed=N` from the URL. The seed is shown on the end screen. The cosmetic crew walk has its own generator, so it can't shift the simulation's draws. There is no `Math.random` anywhere. |
| **Separation** | The core has no DOM and no UI calls | **Compliant.** The simulation files (`data`, `missions`, `rng`, `hexmap`, `state`, `events`, `simulation`) touch no DOM and call no UI. They queue messages on `state.outbox`, which the UI drains each frame, and they end a mission by setting `state.over` and `state.endCause`, which the frame loop turns into the end screen. The tests load these files into an empty JavaScript context and run them headless. All the scripts still share one global scope, as classic `<script>` tags do, so the boundary is enforced by tests (`tests/purity.test.mjs`), not by modules. |
| **Precision** | Float64 for state | Float64 (JavaScript numbers). Resources are clamped to `≥ 0`, and power to `≤` battery capacity, after each step. |

The remaining deviations, abstract units and an epoch-free clock, are deliberate for a game of this scale.

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
- **Shortages.** These are resolved in order: power first, then water. If stored power is empty and demand exceeds supply, every power consumer runs at the fraction `supply / demand`. Water works the same way, after power has been applied to the extractors, except that the crew drinks first: water consumers share only what production leaves after the crew's needs. Food and oxygen can run out, but they don't throttle anything. They only damage health.
- **Storage.** Power is capped at 200 plus 150 per Battery Bank. Other resources have no cap.
- **Day/night.** Solar output follows a step function over the sol: 0 at night, 0.4 in the morning, 1.0 at midday, 0.3 in the evening.
- **Radiation.** Exposure = 35 + 40 during a flare − shielding, clamped to 0–100. Shielding is 5 per working Habitat, 15 per working Radiation Shield (scaled by its power level), and 5 per reinforced building, which works even while the building is damaged.
- **Health.** Health falls by 2 per second for each of water or food, and by 4 per second for oxygen, when its stock is at zero and current production doesn't cover the crew's needs. It also falls by 0.08 per point of exposure above 50. Otherwise it regenerates at 0.5 per second, up to 100.
- **Events.** Weighted random draws from the seeded generator, every 40–70 game seconds by default, plus scripted events at fixed times. Each mission can change the weights, gaps and durations, or turn events off. See `EVENT_DEFAULTS` in `js/data.js`, the missions in `js/missions.js`, and `js/events.js`.
- **Missions and difficulty.** These belong to the game layer, not the model. A mission sets the map, starting supplies, unlocked buildings, event settings, objectives and any extra ways to lose. A difficulty tier scales crew consumption, starting water, food and oxygen, and the gap between random events (`DIFFICULTIES` in `js/data.js`).

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

**Every place the game knowingly departs from reality goes here.** Simplifying is allowed. Hiding it isn't. These all live in `js/data.js`, `js/missions.js`, `js/simulation.js` and `js/events.js`. The simulation is now separate from the UI, but the game rules and the model still share those files.

| Departure | Where it lives | Why | Player-visible? |
| --- | --- | --- | --- |
| A sol lasts 120 s, about 740× faster than reality | `SOL_SECONDS` | A mission fits in about 16 minutes | Yes, on the clock |
| Daylight is four flat steps, not a smooth curve | `daylight()` | Readable phases. The HUD names each one. | Yes |
| Crew arrive every 2 sols, with no transfer windows | `CREW_ARRIVAL_SOLS` | Growth pressure inside one session | Yes |
| Dust storms last 30 s (90 s in *Dust Season*) and cut solar by 70% | `EVENT_DEFAULTS`, `dust-season` | Real storms last weeks to months. A short one teaches the lesson without ending the run. In *Dust Season* they overlap into a near-continuous storm season, which is closer to reality. | Yes |
| Solar flares add a flat +40% exposure for 20 s | `FLARE_RADIATION`, `EVENT_DEFAULTS` | Makes shielding matter in a short session | Yes |
| Micrometeorite strikes disable a random building every few minutes | `EVENTS` | Far more often than reality. It's there for variety. | Yes |
| NASA supply drops of materials and credits arrive at random | `EVENT_DEFAULTS` | Catch-up mechanic. Real resupply follows launch windows. | Yes |
| Some missions make one kind of event far more frequent: storms every 30–45 s in *Dust Season*, mostly flares in *Flare Watch* | `MISSIONS` | Each mission isolates one hazard so its lesson is unmistakable | Yes, in the briefing |
| In *Crew Rotation*, a crew member lands every sol | `crew-rotation` | Growth pressure in a short mission. The briefing says outright that real crews wait about 26 months for a launch window. | Yes, in the briefing |
| Water Extractors on ice yield exactly twice what they do on regolith | `bonus` on `water` in `BUILDINGS` | A readable reward for reaching ice. Real ice-rich ground holds far more water than typical regolith, which carries only a few percent, so the real advantage is larger. | Yes |
| In *First Night*, a flat battery ends the mission | `failures` on `first-night` | Makes the lesson about storage unmissable. A real outpost would have emergency reserves and load shedding. | Yes, in the briefing and HUD |
| Harder difficulty tiers make the crew consume 1.2× or 1.4× as much | `DIFFICULTIES` | A difficulty knob, not a claim that people need more on Mars | Yes, in mission select |
| Buildings appear instantly, and demolition refunds 50% | `build()`, `demolish()` in `js/state.js` | No construction phase in the prototype | Yes |
| Science is paid for with credits, and Labs scale with crew | `lab` in `BUILDINGS` | Gives the economy a currency | Yes |
| Health regenerates whenever nothing is harming it | `updateGame()` | Forgiving. Real radiation dose doesn't heal. | Partly. The health bar recovers. |
| Habitats make oxygen by electrolysis from water and power | `habitat` in `BUILDINGS` | Real, but folded into one building, with no separate life-support system | Yes, in the building's info |

## Claims the game makes to the player

Each building's `why` text in `js/data.js` makes a factual claim, and so do the story and mission briefings in `js/missions.js`. These are the game's scientific content, so each one is listed here with its basis.

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
| Story | The nearest hardware store is about 225 million kilometres away | The mean Earth–Mars distance is about 225 million km. It ranges from about 55 to 400 million km over the synodic cycle. NASA Mars facts. | Agrees, as an average |
| *First Night* | Mars gets well under half the sunlight Earth does, and none of it at night | ≈ 43% of Earth's irradiance (see [Constants](#constants)) | Agrees |
| *Ice Line* | Shipping water from Earth costs thousands of dollars a kilogram | Launch to low Earth orbit costs roughly $1 500–10 000 per kg on current vehicles. Delivery to the Martian surface costs far more. | Agrees. It understates the cost to Mars. |
| *Ice Line* | Orbiters have mapped water ice in the ground, and Phoenix dug some up in 2008 | Mars Odyssey neutron spectrometer and MRO SHARAD mapping. Phoenix exposed subsurface ice in its trench in 2008. | Agrees |
| *Dust Season* | A storm can grow until it wraps the whole planet, and the 2018 one blotted out the Sun for months and ended Opportunity | The 2018 planet-encircling dust storm. Opportunity went silent in June 2018 and its mission was declared over in February 2019. | Agrees |
| *Dust Season* | Nuclear power runs day and night, storm or no storm | NASA/DOE Kilopower and KRUSTY, as for the Nuclear Generator | Agrees |
| *Flare Watch* | Curiosity measured a steady background dose at the surface, with spikes when the Sun flares up | Hassler et al. (2014). RAD measured the galactic cosmic ray background and recorded a solar particle event. | Agrees |
| *Crew Rotation* | Launch windows come round about every 26 months | The 780-day synodic period, ≈ 25.6 months (see [Constants](#constants)) | Agrees |
| *The Outpost* | Mars' surface pressure is about 0.6% of Earth's | Mean surface pressure ≈ 610 Pa against Earth's 101 325 Pa. NASA Mars Fact Sheet (NSSDCA). | Agrees. It varies with altitude and season. |

## Validation

The tests in `tests/` run with `npm test` (Node's built-in runner, nothing to install), in CI on every pull request, and before every deploy. They load the simulation into an empty context, with no DOM, and play it with a scripted bot (`tests/bot.mjs`).

| Property | Method | Test |
| --- | --- | --- |
| Determinism | Same seed and same inputs give an identical state after N steps | `tests/determinism.test.mjs`: every mission run twice from the same seed and moves for 3 000 steps on *Martian*, with events on, gives an identical full state. A different seed gives a different state. A second mission in the same context replays the first exactly, so nothing leaks between missions. |
| Resource bookkeeping | Each step, the change in every resource is `rates × dt`, then clamped | `tests/bookkeeping.test.mjs`: every step of every mission, with events off. Exact, not within a tolerance. |
| Shortage resolution | Throttled consumers never draw more than is supplied, and the power-before-water ordering holds | `tests/shortages.test.mjs`: power draw equals generation, extractors run no faster than power allows, the crew drinks first, and buildings never draw more water than is left after the crew, including when power and water are both short. That last case was broken until 2026-11-14. See the changelog. |
| Connectivity | Demolition never splits the outpost | `tests/connectivity.test.mjs`: 400 seeded random builds and demolitions on each of five maps, checked by an independent flood fill, plus a direct case. |
| Step-size independence | Mission outcome doesn't depend on frame rate | Holds by construction: the simulation only advances in fixed `SIM_STEP` steps |
| Mission balance | Every mission is winnable at every difficulty, and the strategy it warns against loses | `tests/balance.test.mjs`, with the build orders in `tests/strategies.mjs`: every mission at every difficulty, and *The Outpost* on eight seeds. The closest margins: *Dust Season*'s best solar-only build reaches about 79% of its target by the deadline, and *Ice Line*'s regolith-only build loses on *Normal* by a margin of about 1% of the target. |

## Numerical notes

- **Integrator:** explicit Euler on a fixed step.
- **Timestep:** `SIM_STEP` = 0.05 game seconds. The frame loop is capped at 30 fps, so it runs about 0.7 steps per frame at 1× and about 2.7 at 4×. A slow frame is capped at 0.1 s of wall time, so at most 8 steps run in one frame.
- **Known drift:** shortages are detected only once a stock reaches about zero (`≤ 0.01`), so one step of over-draw is clamped away. With the fixed step this is the same at every speed.
- **Known drift:** power is shared out before water. If a building is also starved of water, the power it was allotted goes unused for that step. Stored power then rises above zero, and the next step has no power shortage. The effect lasts one step at a time.
