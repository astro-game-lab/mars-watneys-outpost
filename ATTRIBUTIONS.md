# Attributions

Third-party material bundled with or used by Mars: Watney's Outpost, and the terms it comes under.

Every asset, dataset and piece of borrowed code that this repository ships is listed here. If you add one, add its row in the same commit. An unattributed asset is a licensing bug, and no tool will catch it for us.

## Assets

Art, audio, models, fonts, and other authored media.

| File / directory | Source | Author | Licence | Notes |
| --- | --- | --- | --- | --- |
| `assets/mars3.png` | NASA. **Source URL not yet recorded.** | NASA | Public domain. NASA imagery is generally not subject to copyright in the US. NASA's [media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) ask for credit, and they don't allow use that implies NASA endorses the project. | The map background, 1254 × 1254 px. **To do:** record the exact source page and image ID here, and check that the image isn't a third-party contribution hosted by NASA. Those can carry their own copyright. |
| `sprites/*.svg` | This repository | Mars: Watney's Outpost contributors | [CC BY 4.0](LICENSE-ASSETS.md) | The nine building sprites, drawn as SVG for this game. Listed so every asset has a row, not because anything here is borrowed. |
| UI icons | The viewer's system emoji font | — | — | The HUD and messages use Unicode emoji, drawn with whatever font the viewer's system has. No font or image is bundled. |

## Characters and names

| What | Owner | Use here |
| --- | --- | --- |
| Mark Watney, *The Martian* | Andy Weir and the rights holders of the novel and film | The game's name and the narrator's voice: `WATNEY_LINES` in `js/data.js`, which includes paraphrased lines from the book and film, and the intro story and mission briefings in `js/missions.js`, which are original text written in the character's voice. This is an unofficial fan work. See the [fan work notice](README.md#fan-work-notice). Neither licence in this repository grants any rights in this material. |

## Data

Ephemerides, SPICE kernels, TLE sets, planetary constants, imagery, and other datasets.

| File / directory | Source | Provider | Licence / terms | Retrieved |
| --- | --- | --- | --- | --- |
| _none_ | | | | |

## Physical constants

Values baked into the simulation, with their source. Keep this in sync with `docs/PHYSICS.md`.

| Constant | Value | Source |
| --- | --- | --- |
| _none_ | | The simulation has no physical constants yet. Every number in `js/data.js` is a game-balance value, not a physical one. See [`docs/PHYSICS.md`](docs/PHYSICS.md#gameplay-departures). |

## Software dependencies

There are no runtime or build dependencies. Vendored or adapted third-party source goes in this table.

| Path | Upstream | Licence | Why vendored |
| --- | --- | --- | --- |
| _none_ | | | The hex-grid and tile-drawing code in `js/hexmap.js` and `js/render.js` was adapted from the author's own earlier project, `tile-game-demo`, so nothing third-party is involved. |

## Algorithms

| Where | Algorithm | Source |
| --- | --- | --- |
| `js/hexmap.js` | Odd-r offset hex layout, pixel → axial → cube rounding | Amit Patel, *Hexagonal Grids*, Red Blob Games, <https://www.redblobgames.com/grids/hexagons/>. A description of the technique; no code was copied. |
