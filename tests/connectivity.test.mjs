// The outpost never splits: every building stays connected to the rest.
// docs/PHYSICS.md § Validation, "Connectivity".

import test from "node:test";
import assert from "node:assert/strict";
import { loadSim } from "./load-sim.mjs";
import { hexDistance } from "./bot.mjs";

// An independent check: flood-fill over hex distance 1, not the game's neighbors().
function connected(tiles) {
  const built = tiles.filter((t) => t.building);
  const seen = new Set([built[0]]);
  const stack = [built[0]];
  while (stack.length) {
    const t = stack.pop();
    for (const n of built) if (!seen.has(n) && hexDistance(t, n) === 1) { seen.add(n); stack.push(n); }
  }
  return seen.size === built.length;
}

for (const seed of [1, 2, 3, 4, 5]) {
  test(`random building and demolition never splits the outpost (seed ${seed})`, () => {
    const sim = loadSim();
    sim.createState(sim.missionById("the-outpost"), seed, "normal");
    const { state, BUILD_ORDER } = sim;
    const rng = sim.createRng(seed * 7919);
    const pick = (list) => list[Math.floor(sim.rngNext(rng) * list.length)];
    let demolished = 0, refused = 0;
    for (let i = 0; i < 400; i++) {
      state.resources.materials = state.resources.credits = 1e6;
      const built = state.tiles.filter((t) => t.building);
      if (sim.rngNext(rng) < 0.6 || built.length < 3) {
        const type = pick(BUILD_ORDER);
        const free = state.tiles.filter((t) => !sim.buildBlocker(type, t));
        if (free.length) sim.build(type, pick(free));
      } else {
        const t = pick(built);
        if (sim.demolish(t)) demolished++;
        else refused++;
      }
      assert.ok(state.tiles.some((t) => t.building), "the last building was demolished");
      assert.ok(connected(state.tiles), `split after move ${i}`);
    }
    assert.ok(demolished > 20 && refused > 0, `demolished ${demolished}, refused ${refused}`);
  });
}

test("a building whose removal would split the outpost can't be demolished", () => {
  const sim = loadSim();
  sim.createState(sim.missionById("first-night"), 1101, "normal");
  const { state } = sim;
  state.resources.materials = state.resources.credits = 1e6;
  // Grow a line east from the outpost, then try to remove its middle.
  const line = [];
  for (let i = 0; i < 3; i++) {
    const tip = line.length ? line[line.length - 1] : state.tiles.find((t) => t.building && t.building.type === "solar");
    const next = sim.neighbors(tip).find((n) => !n.building && n.col > tip.col && !sim.buildBlocker("battery", n));
    assert.ok(next, "no room to grow east");
    sim.build("battery", next);
    line.push(next);
  }
  assert.equal(sim.demolishBlocker(line[1]), "Would disconnect the outpost");
  assert.equal(sim.demolish(line[1]), false);
  assert.equal(sim.demolishBlocker(line[2]), null);
});
