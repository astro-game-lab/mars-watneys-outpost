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
- **Shortages.** These are resolved in order: power first, then water. If stored power is empty and demand exceeds supply, supply is shared out by priority (`allocate()` in `js/simulation.js`). *Critical* buildings are served first, then *normal*, then *low*, and buildings in the same tier run at the same fraction of their demand. A building switched *off* draws nothing and makes nothing, and that includes its shielding, though regolith reinforcement still works. Water works the same way, after power has been applied to the extractors, except that the crew drinks first: water consumers share only what production leaves after the crew's needs, by the same priorities. A building's operating level is its tier's share of power times its tier's share of water. The water share is a fraction of its power-limited demand, so the two together never draw more than there is. The defaults (`priority` in `BUILDINGS`) are: Habitats and Water Extractors *critical*, Greenhouses and Radiation Shields *normal*, Mines and Science Labs *low*. Habitats can't be switched off. Food and oxygen can run out, but they don't throttle anything. They only damage health.
- **Storage.** Power is capped at 200 plus 150 per Battery Bank. Other resources have no cap.
- **Day/night.** Solar output follows a step function over the sol: 0 at night, 0.4 in the morning, 1.0 at midday, 0.3 in the evening.
- **Dust on Solar Arrays.** Each array carries `dust`, the share of its output lost, from 0 up to `DUST_MAX` = 0.6. Dust settles at `DUST_PER_SOL` = 4% a sol, five times faster during a dust storm. Cleaning by hand takes the array offline for `CLEAN_SECONDS` = 10 s, then clears it. A dust devil event cleans each array with a 60% chance, leaving a fifth of its dust behind (`DEVIL`).
- **Heating and temperature.** Habitats, Greenhouses and Science Labs each have a temperature, `tempK`, held at `SETPOINT_K` = 293 K (20 °C) while their heater keeps up. The outside temperature follows a smooth daily curve between the Viking 1 extremes, 184 K and 242 K (`outsideTempK()`), lowest just before dawn and highest in the early afternoon. Each building loses heat in proportion to the difference from outside. Its heater can deliver up to `heat` (1, 1 and 0.5), which is 25% more than the loss on the coldest night. The thermostat asks for whatever holds the setpoint against the current loss, plus enough to climb back to it, up to the maximum (`heatingDemand()`). Heating is part of the building's power demand, so shortage priorities share it out. The heater gets the building's power share even when a water shortage has slowed the rest of the building. The temperature changes as `dT/dt = (heat delivered ÷ loss − (T − T_outside)) ÷ THERMAL_TAU`, with `THERMAL_TAU` = 600 s, so an unpowered building at night reaches frost in about two minutes. A switched-off or damaged building gets no heat and cools. Below `FROST_K` = 273 K, a Greenhouse's crop dies back at 2% a second, cutting its food and oxygen. It regrows over a sol while it's above frost. Below `COLD_K` = 283 K, a Science Lab stops working, and every crew member sleeping in that Habitat loses 0.1 health a second per kelvin below it. Crew sleep two to a working Habitat, warmest first.
- **Radiation.** Exposure = 35 + 40 during a flare − shielding, clamped to 0–100. Shielding is 5 per working Habitat, 15 per working Radiation Shield (scaled by its power level), and 5 per reinforced building, which works even while the building is damaged.
- **Health.** Each crew member has their own health (`state.crewMembers`). It falls by 2 per second for each of water or food, and by 4 per second for oxygen, when its stock is at zero and current production doesn't cover the crew's needs. It also falls by 0.08 per point of exposure above 50. These harm every member alike, because they share the air and the stores. Otherwise health regenerates at 0.5 per second, up to the member's maximum. If any member's health reaches zero, the mission is lost.
- **Radiation dose.** Every member builds up dose at exposure ÷ 100 per second, and it never heals. A member's maximum health falls linearly with dose, from 100 to `MIN_MAX_HEALTH` = 50 at `DOSE_LIMIT` = 240. Then they go home at once and the crew shrinks by one. If it's Watney, the mission is lost. At the 35% baseline, the limit takes about 686 s, so an unshielded crew starts reaching it around Sol 7 of *The Outpost*.
- **Events.** Weighted random draws from the seeded generator, every 40–70 game seconds by default, plus scripted events at fixed times. Each mission can change the weights, gaps and durations, or turn events off. See `EVENT_DEFAULTS` in `js/data.js`, the missions in `js/missions.js`, and `js/events.js`.
- **Missions and difficulty.** These belong to the game layer, not the model. A mission sets the map, starting supplies, unlocked buildings, event settings, objectives and any extra ways to lose. A difficulty tier scales crew consumption, starting water, food and oxygen, and the gap between random events (`DIFFICULTIES` in `js/data.js`).

## What is neglected

- **Real units and quantities.** None of the rates are derived from real hardware. A Habitat doesn't consume a real mass of water, and a Solar Array doesn't make a real number of kilowatts.
- **Thermal detail.** Heat loss is one number per building type, proportional to the temperature difference. Building size, insulation (including regolith over a building), radiative loss, latitude and season make no difference, and heaters are the only heat source. Dust storms are left out too: they cool the days and warm the nights, narrowing the daily temperature swing.
- **Seasons, latitude and atmospheric attenuation.** All of these change how much solar energy reaches the ground. The daylight curve is the same every sol.
- **Battery losses, efficiency and depth of discharge.** Storage is lossless.
- **Recycling.** Real life support recovers most of its water and oxygen. Here, crew consumption is a pure sink.
- **What dose does to the body.** Real radiation risk is mainly a raised lifetime risk of cancer, plus acute effects at high doses. The game's shrinking maximum health stands in for that cost. It isn't a model of it.
- **Logistics.** Supplies, crew and materials arrive without transfer windows, landing mass or cost.

## Domain of validity

The game's qualitative claims hold for the whole game. Its numbers are valid nowhere outside it. Don't use them to reason about a real outpost.

## Gameplay departures

**Every place the game knowingly departs from reality goes here.** Simplifying is allowed. Hiding it isn't. These all live in `js/data.js`, `js/missions.js`, `js/simulation.js` and `js/events.js`. The simulation is now separate from the UI, but the game rules and the model still share those files.

| Departure | Where it lives | Why | Player-visible? |
| --- | --- | --- | --- |
| A sol lasts 120 s, about 740× faster than reality | `SOL_SECONDS` | A mission fits in about 16 minutes | Yes, on the clock |
| Daylight is four flat steps, not a smooth curve | `daylight()` | Readable phases. The HUD names each one. | Yes |
| The outside temperature follows the same smooth curve every sol | `outsideTempK()`, `OUTSIDE_K` | Readable, and right in shape: lowest just before dawn, highest in the early afternoon. The range is the Viking 1 site's (184–242 K). Real sols vary with weather, season and place. | Yes, in the clock box |
| Buildings cool and rewarm on one compressed time constant, with linear heat loss | `THERMAL_TAU`, `heatLoss()`, `HEATER_HEADROOM` | Chosen so an unpowered building at night reaches frost in about two minutes: fast enough to matter in a 120 s sol, slow enough that a short power cut is survivable. | Yes, in each building's panel |
| Frost damage is a single crop number that regrows over a sol | `crop`, `CROP_FROST_RATE`, `CROP_REGROW_SOLS` | Real frost damages foliage and the plant regrows from the tuber over days or weeks. The game compresses that. | Yes, in the Greenhouse's panel |
| A cold Habitat lowers its sleepers' health, and a cold Lab simply stops | `COLD_K`, `COLD_HARM` | A stand-in for hypothermia risk and for instruments that need a warm room. Neither is modelled physiologically. | Yes, in the roster, on the map and in the panel |
| Crew arrive every 2 sols, with no transfer windows | `CREW_ARRIVAL_SOLS` | Growth pressure inside one session | Yes |
| Dust storms last 30 s (90 s in *Dust Season*) and cut solar by 70% | `EVENT_DEFAULTS`, `dust-season` | Real storms last weeks to months. A short one teaches the lesson without ending the run. In *Dust Season* they overlap into a near-continuous storm season, which is closer to reality. | Yes |
| Solar flares add a flat +40% exposure for 20 s | `FLARE_RADIATION`, `EVENT_DEFAULTS` | Makes shielding matter in a short session | Yes |
| Micrometeorite strikes disable a random building every few minutes | `EVENTS` | Far more often than reality. It's there for variety. | Yes |
| Dust settles on Solar Arrays at 4% a sol, about 20 times the real rate | `DUST_PER_SOL` | A real rate of about 0.2% a sol would barely show in an eight-sol mission. Lorenz et al., "Lander and rover histories of dust accumulation on and removal from solar arrays on Mars", *Planetary and Space Science* (2021), give about 0.2% a sol as typical, with a range of about 0.05–2%. | Yes, in the array's panel and as a film on its sprite |
| Dust devils clean arrays as an occasional random event, and cleaning by hand takes 10 s | `devil` in `EVENTS`, `DEVIL`, `CLEAN_SECONDS` | Real cleaning events were irregular and partial, and no rover could brush its own panels. A crewed outpost could. | Yes |
| NASA supply drops of materials and credits arrive at random | `EVENT_DEFAULTS` | Catch-up mechanic. Real resupply follows launch windows. | Yes |
| Some missions make one kind of event far more frequent: storms every 30–45 s in *Dust Season*, mostly flares in *Flare Watch* | `MISSIONS` | Each mission isolates one hazard so its lesson is unmistakable | Yes, in the briefing |
| In *Crew Rotation*, a crew member lands every sol | `crew-rotation` | Growth pressure in a short mission. The briefing says outright that real crews wait about 26 months for a launch window. | Yes, in the briefing |
| Water Extractors on ice yield exactly twice what they do on regolith | `bonus` on `water` in `BUILDINGS` | A readable reward for reaching ice. Real ice-rich ground holds far more water than typical regolith, which carries only a few percent, so the real advantage is larger. | Yes |
| In *First Night*, a flat battery ends the mission, and shortage priorities are turned off | `failures` and `priorities: false` on `first-night` | Makes the lesson about storage unmissable. A real outpost would have emergency reserves and would shed load. The other missions let the player shed load, but switching the Lab off would get *First Night* through with no storage at all. | Yes, in the briefing and HUD. The panel shows no priority control. |
| Loads are shed in three priority tiers, and buildings in a tier share alike | `PRIORITIES`, `allocate()` | Readable, and close in spirit to real load shedding, which switches individual loads off in a planned order. Real systems also limit current, keep reserve margins and can't run a load at a fraction of its power. | Yes, in each building's panel and the HUD's shortage note |
| Harder difficulty tiers make the crew consume 1.2× or 1.4× as much | `DIFFICULTIES` | A difficulty knob, not a claim that people need more on Mars | Yes, in mission select |
| Buildings appear instantly, and demolition refunds 50% | `build()`, `demolish()` in `js/state.js` | No construction phase in the prototype | Yes |
| Science is paid for with credits, and Labs scale with crew | `lab` in `BUILDINGS` | Gives the economy a currency | Yes |
| Health regenerates whenever nothing is harming it, up to each member's maximum | `updateGame()` | Forgiving for shortages and acute radiation. Dose, the lasting cost, doesn't heal: it lowers the maximum. | Yes. Each bar recovers up to its hatched end. |
| The career dose limit is reached in minutes, and dose is in made-up units | `DOSE_LIMIT` | NASA's career limit is 600 mSv. At the 0.64 mSv a day Curiosity measured at Gale Crater, surface exposure alone would take about 940 days to reach it. The game compresses that so shielding matters within a mission. | Yes, in the crew roster's tooltips |
| Dose lowers maximum health linearly | `maxHealth()` | A readable stand-in for a lifetime cancer risk, which the game can't show in a 16-minute mission | Yes, as the hatched end of each health bar |
| A crew member who reaches the limit leaves at once | `updateCareerLimits()` | No ascent vehicle, launch window or replacement. Watney leaving ends the mission, because Watney is the narrator and the player's stand-in. | Yes |
| Habitats make oxygen by electrolysis from water and power | `habitat` in `BUILDINGS` | Real, but folded into one building, with no separate life-support system | Yes, in the building's info |
| An Oxygen Plant makes oxygen at outpost scale | `moxie` in `BUILDINGS` | MOXIE was a small technology demonstration. A plant big enough to supply a crew hasn't been built, so the rates are balance values, set so a Habitat is the better buy when water is plentiful. The plant needs no heating, which matches MOXIE's hot electrolysis but is a simplification. | Yes, in the building's info |

## Claims the game makes to the player

Each building's `why` text in `js/data.js` makes a factual claim, and so do the story and mission briefings in `js/missions.js`. These are the game's scientific content, so each one is listed here with its basis.

| Building | Claim | Basis | Status |
| --- | --- | --- | --- |
| Solar Array | Mars gets less than half of Earth's sunlight, and dust storms can block the Sun for days | ≈ 43% of Earth's irradiance (see [Constants](#constants)). The 2018 global dust storm lasted months and ended the Opportunity rover's mission. | Agrees |
| Solar Array | Dust settling on the panels ended NASA's InSight lander in 2022 | NASA declared InSight's mission over on 21 December 2022, after dust on its solar panels had cut its power. NASA/JPL, "NASA Retires InSight Mars Lander Mission After Years of Science", December 2022. | Agrees |
| Solar Array | A gust or a dust devil can sweep panels clean, as happened to Spirit more than once | NASA/JPL, "Spirit Gets Energy Boost From Cleaner Solar Panels", February 2009. An earlier cleaning in March 2005 (sol 420) was attributed to a dust devil. | Agrees |
| Water Extractor | Mars has water ice in the ground that heating can release | Subsurface ice mapped by Mars Odyssey and SHARAD, and dug up by Phoenix in 2008 | Agrees |
| Nuclear Generator | Fission power works day and night, like NASA's Kilopower | NASA/DOE KRUSTY ground test, 2018, for 1–10 kWe designs | Agrees |
| Battery Bank | Solar outposts need storage for night and for dust storms | Follows from the two claims above | Agrees |
| Mine | Building materials can come from local rock and regolith | In-situ resource utilisation, a NASA research area | Agrees, as research rather than a demonstrated practice |
| Habitat | Electrolysis turns water and power into oxygen | Standard. The ISS Oxygen Generation System works this way. | Agrees |
| Habitat | Habitats are kept near room temperature (the game's setpoint is 20 °C) | Crewed spacecraft cabins are held around room temperature. SpaceX Crew Dragon's environmental control requirement for nominal operation is 18.3–26.7 °C (ICES-2020-333). | Agrees |
| Habitat | Habitats need heating, hardest at night, because the thin air holds little of the day's warmth and nights are far colder than days | Diurnal temperature range at the Viking 1 landing site: 184 K to 242 K (−89 °C to −31 °C). NASA Mars Fact Sheet (NSSDCA). The thin, dry atmosphere stores and re-radiates little heat. | Agrees |
| Greenhouse | Photosynthesis adds a little oxygen | Standard | Agrees |
| Greenhouse | Frost damages potato plants, and they take time to grow back | Light frost, about −2 to 0 °C, damages potato foliage, and plants send up new growth from the tuber, often in 10 to 14 days (Michigan State, NC State and Iowa State university extension services). Harder or longer freezes kill the top growth. | Agrees |
| Outside temperature | Mars is coldest just before dawn and warmest in the early afternoon | Curiosity's weather station measured about −70 °C just before dawn and highs near 0 to 6 °C in the afternoon. Encyclopaedia Britannica gives about 186 K before dawn and 253 K in the afternoon for the surface. | Agrees |
| Oxygen Plant | Mars' air is about 95% carbon dioxide | 95.1% CO₂ by volume. NASA Mars Fact Sheet (NSSDCA). | Agrees |
| Oxygen Plant | Splitting carbon dioxide yields oxygen and carbon monoxide, with power and no water. NASA's MOXIE did this on Perseverance, making 122 g of oxygen in 16 runs before it finished in 2023 | NASA, "NASA's Oxygen-Generating Experiment MOXIE Completes Mars Mission", 6 September 2023: 122 g in total, 16 runs, oxygen removed from each CO₂ molecule by an electrochemical process. | Agrees |
| Radiation Shield, regolith reinforcement | No global magnetic field and a thin atmosphere let radiation reach the surface, and a couple of metres of regolith blocks a large share | Hassler et al. (2014) for surface dose | **Partly.** Regolith blocks solar particle events very well. Against galactic cosmic rays the reduction is real but modest, because secondary particles build up. "A large share" overstates it for cosmic rays. |
| Story | The nearest hardware store is about 225 million kilometres away | The mean Earth–Mars distance is about 225 million km. It ranges from about 55 to 400 million km over the synodic cycle. NASA Mars facts. | Agrees, as an average |
| *First Night* | Mars gets well under half the sunlight Earth does, and none of it at night | ≈ 43% of Earth's irradiance (see [Constants](#constants)) | Agrees |
| *Ice Line* | Shipping water from Earth costs thousands of dollars a kilogram | Launch to low Earth orbit costs roughly $1 500–10 000 per kg on current vehicles. Delivery to the Martian surface costs far more. | Agrees. It understates the cost to Mars. |
| *Ice Line* | Orbiters have mapped water ice in the ground, and Phoenix dug some up in 2008 | Mars Odyssey neutron spectrometer and MRO SHARAD mapping. Phoenix exposed subsurface ice in its trench in 2008. | Agrees |
| *Dust Season* | A storm can grow until it wraps the whole planet, and the 2018 one blotted out the Sun for months and ended Opportunity | The 2018 planet-encircling dust storm. Opportunity went silent in June 2018 and its mission was declared over in February 2019. | Agrees |
| *Dust Season* | Nuclear power runs day and night, storm or no storm | NASA/DOE Kilopower and KRUSTY, as for the Nuclear Generator | Agrees |
| *Flare Watch* | Curiosity measured a steady background dose at the surface, with spikes when the Sun flares up | Hassler et al. (2014). RAD measured the galactic cosmic ray background and recorded a solar particle event. | Agrees |
| *Flare Watch* | NASA caps how much radiation an astronaut may take over a whole career | NASA-STD-3001, Volume 1, Rev C: a career effective dose from spaceflight radiation below 600 mSv, the same for every age and sex. | Agrees |
| *Crew Rotation* | Launch windows come round about every 26 months | The 780-day synodic period, ≈ 25.6 months (see [Constants](#constants)) | Agrees |
| *The Outpost* | Mars' surface pressure is about 0.6% of Earth's | Mean surface pressure ≈ 610 Pa against Earth's 101 325 Pa. NASA Mars Fact Sheet (NSSDCA). | Agrees. It varies with altitude and season. |

## Validation

The tests in `tests/` run with `npm test` (Node's built-in runner, nothing to install), in CI on every pull request, and before every deploy. They load the simulation into an empty context, with no DOM, and play it with a scripted bot (`tests/bot.mjs`).

| Property | Method | Test |
| --- | --- | --- |
| Determinism | Same seed and same inputs give an identical state after N steps | `tests/determinism.test.mjs`: every mission run twice from the same seed and moves for 3 000 steps on *Martian*, with events on, gives an identical full state. A different seed gives a different state. A second mission in the same context replays the first exactly, so nothing leaks between missions. |
| Resource bookkeeping | Each step, the change in every resource is `rates × dt`, then clamped | `tests/bookkeeping.test.mjs`: every step of every mission, with events off. Exact, not within a tolerance. |
| Shortage resolution | Throttled consumers never draw more than is supplied, and the power-before-water ordering holds | `tests/shortages.test.mjs`: power draw equals generation, extractors run no faster than power allows, the crew drinks first, and buildings never draw more water than is left after the crew, including when power and water are both short. That last case was broken until 2026-11-14. See the changelog. `tests/crew.test.mjs`: the crew count matches the crew list, health never exceeds a member's maximum, the maximum falls with dose, dose builds at its rate, members leave exactly at the limit, Watney leaving ends the mission, one death loses it, and the most-dosed member dies first. `tests/dust.test.mjs`: dust settles at its rate, faster in storms, up to its cap, cuts output by exactly its share, and is cleared by hand or by a dust devil. `tests/temperature.test.mjs`: the outside curve, a powered building holding its setpoint all sol, demand peaking before dawn, cooling toward the outside and growing with the shortfall, rewarming that stops at the setpoint, frost and regrowth, cold hurting only a Habitat's sleepers, cold Labs, and switched-off or damaged buildings getting no heat. `tests/priorities.test.mjs`: tiers are served in order, each building runs at its tier's share, off buildings draw and make nothing, and the rules on who can be switched off hold. |
| Connectivity | Demolition never splits the outpost | `tests/connectivity.test.mjs`: 400 seeded random builds and demolitions on each of five maps, checked by an independent flood fill, plus a direct case. |
| Step-size independence | Mission outcome doesn't depend on frame rate | Holds by construction: the simulation only advances in fixed `SIM_STEP` steps |
| Mission balance | Every mission is winnable at every difficulty, and the strategy it warns against loses | `tests/balance.test.mjs`, with the build orders in `tests/strategies.mjs`: every mission at every difficulty, and *The Outpost* on eight seeds. Margins as of 2026-11-14: *Dust Season*'s best solar-only build reaches about a quarter of its target by the deadline, and its nuclear build wins around Sol 3.1 against a Sol 6 deadline. *Ice Line*'s regolith-only build falls about 9% short on *Normal*, and its ice build wins around Sol 3.5 against a Sol 4 deadline, the tightest winning margin in the campaign. The tests check only win or lose, so recheck margins by hand after a balance change. |

## Numerical notes

- **Integrator:** explicit Euler on a fixed step.
- **Timestep:** `SIM_STEP` = 0.05 game seconds. The frame loop is capped at 30 fps, so it runs about 0.7 steps per frame at 1× and about 2.7 at 4×. A slow frame is capped at 0.1 s of wall time, so at most 8 steps run in one frame.
- **Known drift:** shortages are detected only once a stock reaches about zero (`≤ 0.01`), so one step of over-draw is clamped away. With the fixed step this is the same at every speed.
- **Known drift:** power is shared out before water. If a building is also starved of water, the power it was allotted goes unused for that step. Stored power then rises above zero, and the next step has no power shortage. The effect lasts one step at a time.
