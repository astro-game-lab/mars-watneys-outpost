# Mars: Watney's Outpost

Keep a Mars outpost alive. A browser base-building game about power, water, air and radiation on the Red Planet.

An [astro-game-lab](https://github.com/astro-game-lab) game.

## Play

**<https://astro-game-lab.github.io/mars-watneys-outpost/>** — no install, no account.

To run it locally, see [Development](#development) below.

## Status

**A playable prototype.** One mission, start to finish: an 11 × 8 hex map, nine buildings, crew arrivals, a day/night cycle, five random events, and a win and a lose condition.

| | |
| --- | --- |
| **The outpost** | Start with two Habitats, a Science Lab and a Solar Array on a randomly generated hex map. Build outward from it onto regolith, rock, ice and high-resource tiles; impassable tiles block you. Every building has to connect to the outpost, Science Labs have to touch a Habitat, and you can't demolish a building if that would split the outpost in two or leave the crew without beds. You can bury any building under regolith for passive shielding. |
| **Resources** | Water, food, oxygen, power, materials and credits. Each building produces and consumes them at fixed per-second rates. Power and water shortages cut the output of whatever depends on them, in a fixed order. Power is capped by battery capacity. |
| **The crew** | They drink, eat and breathe. NASA lands one more astronaut every two sols, but only if there's a free bed and supplies are healthy. Each extra crew member adds 25% to Science Lab output. |
| **The environment** | A 120-second sol with night, morning, midday and evening, and solar output following it. Background radiation sits at 35% and shielding brings it down. Crew health falls when water, food or oxygen runs out or radiation tops 50%, and recovers otherwise. |
| **Events** | Every 40–70 seconds: a dust storm (solar −70%), a solar flare (radiation +40%), a micrometeorite (one building out for 30 s), a pump failure (water −50%), or a NASA supply drop. |
| **Winning** | Reach sol 8 having earned 1 000 credits. Lose if crew health hits zero. |

What isn't here yet: saving, settings, sound, keyboard-only play, touch input, or a tutorial beyond the HUD hint and the in-game explanation each building shows. The code is plain browser JavaScript with no build step, no tests and no CI. It doesn't yet meet the org's determinism rules — see [`docs/PHYSICS.md`](docs/PHYSICS.md#conventions).

## The science

This isn't an orbital-mechanics game. It's about the other half of living in space: a closed loop of power, water, air and food, with a sun that sets and a sky that doesn't stop radiation. Solar power stops at night and in dust storms. Water comes out of the ground, not from Earth. Radiation needs walls. Every building's info panel explains the real reason it exists.

The numbers are a game economy, not a life-support model. [`docs/PHYSICS.md`](docs/PHYSICS.md) says what the game claims about Mars and what it deliberately makes up. If a claim is wrong, please [report it](https://github.com/astro-game-lab/mars-watneys-outpost/issues/new/choose) using the physics discrepancy template.

## Controls

| Input | Action |
| --- | --- |
| Click a dashed tile | Open the build menu for it |
| Click a building | Info, reinforce, demolish |
| Right-click / `Esc` | Close the panel |
| `Space` | Pause |
| `1` / `2` / `3` | Speed 1× / 2× / 4× |

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
js/data.js        every balance number, terrain, buildings, Watney's lines
js/hexmap.js      odd-r hex grid, neighbours, connectivity, picking
js/state.js       game state, build / reinforce / demolish rules
js/events.js      random events and timed effects
js/simulation.js  resource flows, shortages, day/night, radiation, health, win/lose
js/render.js      canvas drawing, cached static layer, night overlay, crew
js/ui.js          HUD, build panel, messages, end screen
js/main.js        entry point, frame loop, input
sprites/          building sprites (SVG)
assets/           map background
```

The scripts are classic `<script>` tags that share one global scope. **The order in `index.html` matters.** Tune the game in `js/data.js`; the rest of the code shouldn't contain balance numbers.

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
