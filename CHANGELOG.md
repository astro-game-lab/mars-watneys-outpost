# Changelog

All notable changes to Mars: Watney's Outpost are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Changes to the simulation model get their own note under **Physics**, with a pointer to
the `docs/PHYSICS.md` revision. Players and contributors need to know when a number
they relied on has moved.

## [Unreleased]

Everything below is measured against the imported prototype: an 11 × 8 hex map, nine
buildings, regolith reinforcement, crew arrivals, a day/night cycle, five random
events, and one mission with a win and a lose condition.

### Added
- An eight-mission campaign, each mission teaching one piece of Mars science:
  *First Night*, *Ice Line*, *Thin Air*, *Dust Season*, *Long Night*, *Flare Watch*,
  *Crew Rotation* and *The Outpost* (the original mission). Each has its own map,
  supplies, buildings, events, climate, objectives and ways to lose. Mission select
  (`M`) shows a briefing for each, and the HUD tracks objectives live. Progress is
  saved in the browser.
- Difficulty tiers, *Hard* and *Martian*, unlocked by finishing the campaign.
- An intro screen in Watney's voice, shown on the first visit and reopened with `H`.
- A debrief on the end screen: what ended the mission, what to try, and the seed,
  which *Retry* replays. `?seed=N` in the URL replays a map and its events in
  *The Outpost*.
- Shortage priorities. Every building that draws power or water is *critical*,
  *normal* or *low*, set from its panel, and all but Habitats can be switched off.
- The Oxygen Plant, a tenth building, which makes oxygen from the air's carbon
  dioxide using only power, like NASA's MOXIE.
- A crew roster in the HUD, with each member's health and radiation dose.
- Construction and crew labour: the crew put up buildings, repair damage, clean
  Solar Arrays and reinforce, one job each at a time. A site can be cancelled for a
  full refund.
- Watney's tips at teachable moments, which can be turned off in mission select.
- Dust devils, a sixth event, which sweep dust off some Solar Arrays.
- A favicon.
- A fan-work notice on the intro screen, so players who only see the game, not the
  README, know it's unofficial.
- A link preview: a page description, Open Graph and Twitter Card tags, and a
  1280 × 640 screenshot, `media/screenshot.png`.
- Automated tests of the simulation (`npm test`), including a balance bot that plays
  every mission at every difficulty from the build orders in `tests/strategies.mjs`.
  CI runs them on every pull request and before every deploy.
- Deployment to GitHub Pages on every push to `main`.
- A 30-second demo video, `media/demo.mp4`, published with the site and linked from
  the README, and an animated GIF of it, `media/demo.gif`, at the top of the README.

### Changed
- *The Outpost* asks for 4 000 credits instead of 1 000. With every mechanic in play,
  a sound outpost earned five to seven times the old target.
- The simulation no longer touches the page, so it runs headless under Node. See
  `docs/PHYSICS.md` § Conventions.

### Fixed
- At 1280 × 720 the two top-right tiles were under the clock box and couldn't be
  clicked.

### Physics
- The simulation is deterministic: all randomness comes from a seeded generator
  (`js/rng.js`), and it advances in fixed 0.05 s steps rather than by frame time.
  Timers end on the step they're due, and a purchase no longer waits a step for a
  rounding error. See `docs/PHYSICS.md` § Conventions and § Numerical notes.
- Water shortages feed the crew first, and water, food and oxygen hurt health only
  when the stock is empty *and* production can't cover the crew.
- When power and water ran short together, buildings could draw more water than was
  left after the crew. They now share exactly what's left. See `docs/PHYSICS.md`
  § Validation.
- Power and water shortages are shared out by priority tier instead of evenly. With
  every building in one tier, the result is unchanged.
- Buildings take 6 to 18 seconds of crew work to build, and damage stays until
  someone repairs it.
- Health is per crew member, and radiation dose accumulates: it lowers maximum
  health, and at the career limit a member goes home.
- Habitats, Greenhouses and Science Labs are heated against an outside temperature
  that runs from −89 °C before dawn to −31 °C in the afternoon (Viking 1). A building
  short of power cools; a frozen Greenhouse loses its crop, a cold Lab stops, and a
  cold Habitat hurts its sleepers.
- Dust settles on Solar Arrays and cuts their output, up to 60%, about 20 times the
  real rate so it shows within a mission.

New rules, rates and simplifications are listed in `docs/PHYSICS.md` § What is
modelled and § Gameplay departures.
