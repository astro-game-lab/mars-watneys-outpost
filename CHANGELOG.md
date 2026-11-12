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

### Physics
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
- The simulation still calls the UI directly (`say()`, `endGame()`), so it
  can't run headless. See `docs/PHYSICS.md` § Conventions.
- Mission balance was checked with scripted build orders, not with players.
- No tests, lint or CI.
