# Mars: Watney's Outpost

Keep a Mars outpost alive. A browser base-building game about power, water, air and radiation on the Red Planet.

An [astro-game-lab](https://github.com/astro-game-lab) game.

## Play

**<https://astro-game-lab.github.io/mars-watneys-outpost/>** — no install, no account.

To run it locally, see [Development](#development) below.

## Status

**A playable prototype.** A six-mission campaign on an 11 × 8 hex map, with nine buildings, crew arrivals, a day/night cycle and five kinds of event. Each mission teaches one piece of Mars science. Difficulty tiers unlock once you finish it.

| | |
| --- | --- |
| **The campaign** | *First Night* (storage), *Ice Line* (water from the ground), *Dust Season* (nuclear power), *Flare Watch* (radiation shielding), *Crew Rotation* (life support for a growing crew), and *The Outpost*, which combines all five on a fresh random map each run. Each mission opens with a briefing in Watney's voice and ends with a debrief. A loss names its cause and suggests what to try. The intro screen tells the story and explains the loop. Progress is saved in the browser. |
| **Difficulty** | *Normal*, *Hard* and *Martian*, unlocked once *The Outpost* is won. They raise crew consumption, cut starting water, food and oxygen, and bring events more often. |
| **The outpost** | Most missions start with two Habitats, a Science Lab and a Solar Array, on a handmade map or one generated from the mission's seed. Build outward from it onto regolith, rock, ice and high-resource tiles; impassable tiles block you. Every building has to connect to the outpost, Science Labs have to touch a Habitat, and you can't demolish a building if that would split the outpost in two or leave the crew without beds. You can bury any building under regolith for passive shielding. |
| **Resources** | Water, food, oxygen, power, materials and credits. Each building produces and consumes them at fixed per-second rates. Power and water shortages cut the output of whatever depends on them, in a fixed order. Power is capped by battery capacity. |
| **The crew** | They drink, eat and breathe. NASA lands one more astronaut every two sols, but only if there's a free bed and supplies are healthy. Each extra crew member adds 25% to Science Lab output. |
| **The environment** | A 120-second sol with night, morning, midday and evening, and solar output following it. Background radiation sits at 35% and shielding brings it down. Crew health falls when water, food or oxygen runs out or radiation tops 50%, and recovers otherwise. |
| **Events** | By default every 40–70 seconds: a dust storm (solar −70%), a solar flare (radiation +40%), a micrometeorite (one building out for 30 s), a pump failure (water −50%), or a NASA supply drop. Missions change the mix, and some script events for a set time. |
| **Winning** | Each mission has its own objectives: reach a sol, earn credits, grow the crew, store water, or bring radiation down. Every mission is lost if crew health hits zero, and some also end on a blackout or a deadline. |

What isn't here yet: saving a mission in progress, settings, sound, keyboard-only play, touch input, or an in-game tutorial beyond the intro, the briefings and each building's explanation. The code is plain browser JavaScript with no build step, no tests and no CI.

The simulation is deterministic. A seeded generator drives all randomness, and the simulation runs on a fixed timestep. So the same seed plus the same moves replays the same mission. The seed is shown on the end screen, and `?seed=N` in the URL replays a map in *The Outpost*. The simulation still calls the UI directly and uses abstract units. See [`docs/PHYSICS.md`](docs/PHYSICS.md#conventions).

## The science

This isn't an orbital-mechanics game. It's about the other half of living in space: a closed loop of power, water, air and food, with a sun that sets and a sky that doesn't stop radiation. Solar power stops at night and in dust storms. Water comes out of the ground, not from Earth. Radiation needs walls. Every building's info panel explains the real reason it exists.

The numbers are a game economy, not a life-support model. [`docs/PHYSICS.md`](docs/PHYSICS.md) says what the game claims about Mars and what it deliberately makes up. If a claim is wrong, please [report it](https://github.com/astro-game-lab/mars-watneys-outpost/issues/new/choose) using the physics discrepancy template.

## Controls

| Input | Action |
| --- | --- |
| Click a dashed tile | Open the build menu for it |
| Click a building | Info, reinforce, demolish |
| Right-click / `Esc` | Close the panel, or go back to the outpost from an overlay |
| `Space` | Pause |
| `1` / `2` / `3` | Speed 1× / 2× / 4× |
| `H` | How to play |
| `M` | Missions |

## Development

### Requirements

A browser, and any static file server. There is no build step and nothing to install.

### Setup

```bash
git clone https://github.com/astro-game-lab/mars-watneys-outpost.git
cd mars-watneys-outpost
python3 -m http.server 8000     # or: npx serve
```

Then open <http://localhost:8000/>. Opening `index.html` straight from disk mostly works, but browsers restrict `file://` pages, so serve it.

### Common tasks

| Task | Command |
| --- | --- |
| Run locally | `python3 -m http.server 8000` |
| Test | _none yet_ |
| Lint | _none yet_ |
| Build | _none — the repository is the site_ |

### Layout

```
index.html        page shell, HUD markup, script order
style.css         HUD and panel styling
js/data.js        every balance number, terrain, buildings, events, difficulty, Watney's lines
js/missions.js    the campaign: maps, objectives, briefings, and the intro story
js/rng.js         the seeded random number generator
js/hexmap.js      odd-r hex grid, neighbours, connectivity, picking
js/state.js       game state, build / reinforce / demolish rules
js/events.js      random events and timed effects
js/simulation.js  resource flows, shortages, day/night, radiation, health, win/lose
js/render.js      canvas drawing, cached static layer, night overlay, crew
js/ui.js          HUD, objectives, build panel, messages
js/screens.js     intro, mission select and briefing, end screen and debrief, saved progress
js/main.js        entry point, fixed-step frame loop, input, seeds
sprites/          building sprites (SVG)
assets/           map background
```

The scripts are classic `<script>` tags that share one global scope. **The order in `index.html` matters.** Tune the game in `js/data.js` and the missions in `js/missions.js`. The rest of the code shouldn't contain balance numbers.

### Deployment

Every push to `main` deploys to GitHub Pages through [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). The workflow publishes only the files the game loads, not the docs.

## Documentation

- [`docs/PHYSICS.md`](docs/PHYSICS.md) — what the simulation claims, and where it's a game.
- [`docs/DESIGN.md`](docs/DESIGN.md) — what the game is and who it's for.
- [`CHANGELOG.md`](CHANGELOG.md) — notable changes, including changes to the model.
- [`CLAUDE.md`](CLAUDE.md) — conventions, for humans and for Claude Code.

## Contributing

Contributions are welcome. Code, playtest feedback, art, balance and bug reports all count. See the org [contributing guide](https://github.com/astro-game-lab/.github/blob/main/CONTRIBUTING.md).

## Fan work notice

*Mars: Watney's Outpost* is an unofficial, non-commercial fan work inspired by *The Martian* by Andy Weir. It isn't affiliated with, endorsed by or sponsored by Andy Weir, his publishers, or the makers of the film. Mark Watney and *The Martian* belong to their respective owners. The licences below cover only the code and art made for this project.

## Licence

Code is [MIT](LICENSE). Game assets are [CC BY 4.0](LICENSE-ASSETS.md). Third-party material and its terms are listed in [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md).
