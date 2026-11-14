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

### Changed
- The simulation no longer touches the page. It queues messages on
  `state.outbox` for the UI and ends a mission by setting `state.over`, so it
  runs headless under Node. Hex layout, pixel picking and sprite loading moved
  to `js/render.js`. No change for players. See `docs/PHYSICS.md` § Conventions.

### Physics
- When power and water ran short at the same time, buildings could draw more
  water than was left after the crew's share: the water factor was a fraction
  of power-limited demand, but it was applied to full demand. Buildings now
  share exactly what's left. Found by the new shortage tests. See
  `docs/PHYSICS.md` § What is modelled and § Validation.
- *Dust Season* now asks for 3 000 credits instead of 1 000, and its storms last
  90 s instead of 45 s, so they run into each other. Before, a solar-only
  build won on *Normal* and *Hard*, and the mission didn't teach its lesson.
  Now the best solar-only build tested reaches about 79% of the target by the
  deadline, and a build with a Nuclear Generator wins on Sol 3. See
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
