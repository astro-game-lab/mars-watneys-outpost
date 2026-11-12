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

### Known gaps
- The simulation isn't deterministic. It uses `Math.random` and steps by
  frame time rather than on a fixed timestep. See `docs/PHYSICS.md` § Conventions.
- No tests, lint or CI.
