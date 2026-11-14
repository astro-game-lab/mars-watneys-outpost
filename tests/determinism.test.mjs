// The same seed and the same inputs give the same mission, step for step.
// docs/PHYSICS.md § Validation, "Determinism".

import test from "node:test";
import assert from "node:assert/strict";
import { play } from "./bot.mjs";
import { loadSim, snapshot } from "./load-sim.mjs";
import { STRATEGIES } from "./strategies.mjs";

const { MISSIONS } = loadSim();
const STEPS = 3000;

// The whole state, as JSON. The mission object is static data, so leave it out.
const stateOf = (state) => snapshot({ ...state, mission: state.mission.id });

for (const m of MISSIONS) {
  const moves = STRATEGIES[m.id].win;
  const seed = m.seed ?? 4242;

  test(`${m.name}: the same seed and moves give an identical state after ${STEPS} steps`, () => {
    const a = play({ mission: m.id, seed, difficulty: "martian", moves, maxTicks: STEPS });
    const b = play({ mission: m.id, seed, difficulty: "martian", moves, maxTicks: STEPS });
    assert.equal(a.state.tick, b.state.tick);
    assert.equal(stateOf(a.state), stateOf(b.state));
  });

  test(`${m.name}: a different seed gives a different state`, () => {
    const a = play({ mission: m.id, seed, moves, maxTicks: STEPS });
    const b = play({ mission: m.id, seed: seed + 1, moves, maxTicks: STEPS });
    assert.notEqual(stateOf(a.state), stateOf(b.state));
  });
}

test("a second mission in the same context replays the first exactly", () => {
  // Catches state that leaks between missions outside `state`.
  const sim = loadSim();
  const args = { mission: "the-outpost", seed: 99, moves: STRATEGIES["the-outpost"].win, maxTicks: STEPS };
  const first = stateOf(play({ ...args, sim }).state);
  play({ mission: "flare-watch", maxTicks: 500, sim });
  const again = stateOf(play({ ...args, sim }).state);
  assert.equal(again, first);
});
