# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Mars: Watney's Outpost** — Keep a Mars outpost alive. A browser base-building game about power, water, air and radiation on the Red Planet.

An [astro-game-lab](https://github.com/astro-game-lab) game, and an unofficial fan work inspired by *The Martian*. Unlike the org's other games it has no orbital mechanics. Its science is life support: power, water, oxygen, food and radiation on the Martian surface.

**Status: playable prototype.** A six-mission campaign with difficulty tiers, nine buildings, five events. No build step, no tests, no CI. `README.md` describes what exists and is kept honest. Trust it over assumptions.

## The documents

| Document | What it is | When it binds you |
| --- | --- | --- |
| [`docs/PHYSICS.md`](docs/PHYSICS.md) | What the model claims, every gameplay departure, the scientific claims in the building texts and their sources, and where the repo deviates from org conventions | **Any change to a rate, rule, event or `why` text updates it in the same commit.** A new departure gets a row. A new claim to the player gets a row with a source. |
| [`docs/DESIGN.md`](docs/DESIGN.md) | What the game is, the loop, the campaign and scope | Game-design and UI work |
| [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md) | Provenance of every third-party asset and the *Martian* material | Adding any asset, image or borrowed code |

## Architecture

Plain browser JavaScript. Classic `<script>` tags in `index.html` share **one global scope**, and **load order matters**: `data → missions → rng → hexmap → state → events → simulation → render → ui → screens → main`. A function defined in a later file can be called from an earlier one only at runtime, not at load time.

| File | Owns |
| --- | --- |
| `js/data.js` | Every balance number and shared content: terrain, buildings, `why` texts, event defaults, difficulty tiers, `SIM_STEP`, Watney's lines. **Tune here, nowhere else** (missions aside). |
| `js/missions.js` | The campaign and the intro story. Each mission overrides the defaults in `data.js`. Its header comment documents every field. Briefing text makes claims to the player, so it's bound by `docs/PHYSICS.md` like the `why` texts. |
| `js/rng.js` | The seeded generator (mulberry32). `rand()` is the simulation's only source of randomness. |
| `js/hexmap.js` | Odd-r offset hex grid, terrain from a seed or a handmade map, neighbours, connectivity, pixel picking, layout |
| `js/state.js` | The single `state` object, built by `createState(mission, seed, difficulty)`, plus build, reinforce and demolish rules, each paired with a `*Blocker()` function that returns the reason it's refused, or `null` |
| `js/events.js` | Random and scripted events, and timed effects |
| `js/simulation.js` | `computeFlows()` (shortage resolution), `updateGame()` (one fixed `SIM_STEP`: integrate, radiation, health, crew), objectives and `checkEnd()` |
| `js/render.js` | Canvas 2-D. The terrain, sprites and outlines are cached in an off-screen static layer, keyed by `staticSignature()`. The crew figures are cosmetic only. |
| `js/ui.js` | HUD and objectives, build panel, message log |
| `js/screens.js` | Intro, mission select and briefing, end screen and debrief, saved progress in `localStorage`. The simulation doesn't run while one is open. |
| `js/main.js` | `newGame()`, seeds, the 30 fps frame loop with its fixed-step accumulator, input |

The `*Blocker()` pattern is how the UI explains a refusal. Keep it: any new action that can be refused gets a blocker that returns a player-facing reason.

## Where this departs from the org conventions

The org's rules assume a deterministic, SI-unit physics core. `docs/PHYSICS.md` § Conventions lists where this repo stands. In short:

- **Deterministic.** All simulation randomness goes through `rand()` / `state.rng`, and `updateGame()` advances a fixed `SIM_STEP`. Keep it that way: never call `Math.random` or read the clock in simulation code, and never pass a frame delta into it. Cosmetic randomness gets its own generator, like `crewRng` in `js/render.js`.
- **Not separated.** `js/simulation.js` and `js/events.js` call `say()` and `endGame()` from the UI.
- **Abstract units.** Resources are balance units, not SI.

Don't add to these gaps. If a task touches these areas, ask whether to fix the underlying issue first rather than building on it.

## The honesty rule

The numbers are a game economy. The **relationships** are claims about Mars. When asked to make something "feel better", change a balance value in `js/data.js` (or a mission in `js/missions.js`) and update the departures table. Never make a `why` text or briefing claim something that isn't true. If a mechanic contradicts reality, say so in `docs/PHYSICS.md`.

## Running and checking

```bash
python3 -m http.server 8000    # then open http://localhost:8000/
```

There are no tests or lint. Verify changes by playing through in a browser. The Playwright MCP server works well for this. Check the browser console for errors, because a broken global or a script-order mistake fails silently until it's called. `python3 -m http.server` lets the browser cache scripts, so after editing JS, hard-reload or use a no-cache server, or you'll test stale code.

Because the simulation is deterministic, balance can be checked headlessly from the page: `newGame(id, seed)`, call `build(type, tile)` as a bot would, then loop `updateGame()` until `state.over`. A balance change to a mission should keep it winnable at every difficulty, and should keep the strategy it warns against losing.

Pushes to `main` deploy to GitHub Pages through `.github/workflows/deploy.yml`, which publishes only `index.html`, `style.css`, `js/`, `sprites/` and `assets/`. **A new top-level file the game loads must be added to that workflow's staging step**, or the deployed game won't find it.

## Conventions

- Commit messages in the imperative mood, subject under 72 characters.
- Keep the diff minimal and focused.
- Third-party assets go in `ATTRIBUTIONS.md` in the same commit that adds them.
- Large binaries: `assets/mars3.png` (2.8 MB) is committed raw. If more art arrives, enable the Git LFS patterns in `.gitattributes` instead of adding more raw images.

## Attribution — DO NOT ADD

**Never add Claude attribution to any commit message, PR title, PR description, or issue/PR comment.** No `Co-Authored-By: Claude` trailers, no "Generated with Claude Code" footers, no `Claude-Session:` lines, no mention of Claude, Anthropic, an AI assistant, or an LLM as author or generator.

Commits and PRs should read as if authored entirely by the human user. No exceptions — if the user wants attribution, they will add it themselves.
