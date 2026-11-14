# Changelog

All notable changes to Mars: Watney's Outpost are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Changes to the simulation model get their own note under **Physics**, with a pointer to
the `docs/PHYSICS.md` revision. Players and contributors need to know when a number
they relied on has moved.

## [Unreleased]

### Added
- The playable prototype: an 11 × 8 hex map, nine buildings, regolith reinforcement,
  crew arrivals, a day/night cycle, five random events, and a win and a lose condition.
- Repository scaffolding from the org conventions: `README.md`, `docs/PHYSICS.md`,
  `docs/DESIGN.md`, `CLAUDE.md`, `ATTRIBUTIONS.md`, `LICENSE-ASSETS.md`,
  `.editorconfig`, `.gitattributes` and `.gitignore`.
- Deployment to GitHub Pages on every push to `main`.
- An intro screen in Watney's voice: the story, how the outpost works, and the
  controls. It shows on the first visit and reopens with `H`.
- A six-mission campaign, each mission teaching one piece of Mars science: *First
  Night*, *Ice Line*, *Dust Season*, *Flare Watch*, *Crew Rotation* and *The
  Outpost*. Each has its own map, starting supplies, buildings, events, objectives
  and ways to lose. Mission select (`M`) shows a briefing for each, and the HUD
  tracks objectives live.
- A debrief on the end screen. It names what ended the mission and suggests what
  to try. The seed is shown, and *Retry* replays it.
- Difficulty tiers, *Hard* and *Martian*, unlocked by finishing the campaign.
- Campaign progress saved in the browser.
- `?seed=N` in the URL to replay a map and its events in *The Outpost*.
- Automated tests of the simulation, run with `npm test` (Node's built-in runner,
  nothing to install): determinism, resource bookkeeping, shortage resolution,
  connectivity, simulation purity, and mission balance. The balance tests play
  every mission at every difficulty from scripted build orders
  (`tests/strategies.mjs`), which are now the campaign's balance contract.
- CI runs the tests on every pull request, and the deploy runs them first, so a
  failing test blocks a deploy.
- Shortage priorities. Every building that draws power or water is *critical*,
  *normal* or *low*, set from its panel, and can be switched *off* (except
  Habitats). The HUD's shortage note shows how much each tier is getting, and a
  switched-off building is dimmed on the map. *First Night* turns priorities off.
- The Oxygen Plant, a tenth building. It splits the carbon dioxide in the air
  into oxygen, using power and no water, like NASA's MOXIE on Perseverance.
  It's available wherever a mission allows every building.
- A crew roster in the HUD: one health bar per crew member, with the share of
  maximum health lost to radiation dose hatched at its end. The debrief names
  who died or who went home.
- Dust devils, a sixth kind of event. One sweeps most of the dust off some
  of the Solar Arrays. They're in the default mix and in *Dust Season*.

### Changed
- The simulation no longer touches the page. It queues messages on
  `state.outbox` for the UI and ends a mission by setting `state.over`, so it
  runs headless under Node. Hex layout, pixel picking and sprite loading moved
  to `js/render.js`. No change for players. See `docs/PHYSICS.md` § Conventions.

### Physics
- Health is per crew member, and radiation dose adds up. Everyone takes the
  same harm from shortages and acute radiation, but each member builds up a
  dose that never heals. It lowers their maximum health, and at the career
  limit they go home. If anyone dies, or Watney reaches the limit, the
  mission is lost. Unshielded, the limit arrives around Sol 7 of *The
  Outpost*, so its winning build now shields early. See `docs/PHYSICS.md`
  § What is modelled.
- Dust settles on Solar Arrays and cuts their output: 4% a sol, five times
  faster in a dust storm, up to 60%. That's about 20 times the real rate, so
  it shows within a mission. Clean an array by hand (10 s offline) or let a
  dust devil do it. Solar-only builds now lose ground over a mission. See
  `docs/PHYSICS.md` § What is modelled and § Gameplay departures.
- Heating and building temperature. Habitats, Greenhouses and Science Labs
  have a temperature, held at 20 °C by a thermostat that heats against the
  outside air: a smooth daily curve between −89 °C before dawn and −31 °C in
  the afternoon, the Viking 1 range. A building short of power cools, and
  rewarming it costs power. A frozen Greenhouse loses its crop and regrows it
  over a sol, a cold Lab stops, and crew sleeping in a cold Habitat get hurt.
  The clock box shows the outside temperature, and building panels show their
  temperature. Nights cost more power, so in *First Night* one extra Solar
  Array and one Battery Bank are no longer enough. See `docs/PHYSICS.md`
  § What is modelled.
- Power and water shortages are shared out by priority instead of evenly:
  critical buildings first, then normal, then low. Habitats and Water
  Extractors default to critical, Greenhouses and Radiation Shields to normal,
  and Mines and Science Labs to low. With every building in one tier, the
  result is the same as before. See `docs/PHYSICS.md` § What is modelled.
- When power and water ran short at the same time, buildings could draw more
  water than was left after the crew's share: the water factor was a fraction
  of power-limited demand, but it was applied to full demand. Buildings now
  share exactly what's left. Found by the new shortage tests. See
  `docs/PHYSICS.md` § What is modelled and § Validation.
- *Dust Season* now asks for 3 000 credits instead of 1 000, and its storms last
  90 s instead of 45 s, so they run into each other. Before, a solar-only
  build won on *Normal* and *Hard*, and the mission didn't teach its lesson.
  Now, with heating as well, the best solar-only build tested reaches about a
  quarter of the target by the deadline, and a build that puts up a Nuclear
  Generator first wins on Sol 3. See
  `docs/PHYSICS.md` § Gameplay departures.
- Water shortages now feed the crew first. Buildings share only the water left
  after the crew's needs, and shortage detection counts every crew member's
  water, not just one. Water, food and oxygen hurt health only when the stock is
  empty *and* production can't cover the crew. Previously a shortage could hold
  water at zero and keep damaging the crew even when production covered them.
  See `docs/PHYSICS.md` § What is modelled.
- The simulation is deterministic. All randomness comes from a seeded generator
  (`js/rng.js`), and the simulation advances in fixed 0.05 s steps instead of by
  frame time, so results no longer depend on frame rate. See `docs/PHYSICS.md`
  § Conventions and § Numerical notes.
- New game rules, each listed in `docs/PHYSICS.md` § Gameplay departures: mission
  objectives, blackout and deadline failures, mission-specific event rates, a
  crew landing every sol in *Crew Rotation*, and difficulty scaling of crew
  consumption, starting water, food and oxygen, and event frequency.
- The original mission is now *The Outpost*, the campaign's last. Its rules are
  unchanged.

### Known gaps
- Mission balance is checked with scripted build orders, not with players.
- No lint.
