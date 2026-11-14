// Every mission is winnable at every difficulty, and the strategy its
// briefing warns against loses. docs/PHYSICS.md § Validation, "Mission balance".

import test from "node:test";
import assert from "node:assert/strict";
import { play } from "./bot.mjs";
import { STRATEGIES, OUTPOST_SEEDS } from "./strategies.mjs";
import { loadSim } from "./load-sim.mjs";

const { MISSIONS, DIFFICULTY_ORDER } = loadSim();

// The seeds a mission is checked on: its own, or a spread of them.
const seedsFor = (m) => (m.seed === null ? OUTPOST_SEEDS : [m.seed]);

// A mission with no deadline never ends without a win or a death, so cap
// every run a couple of sols past the last objective or deadline.
function horizon(m) {
  const sols = [...m.objectives.filter((o) => o.type === "sol").map((o) => o.value),
    ...m.failures.filter((f) => f.type === "deadline").map((f) => f.sol), 4];
  return (Math.max(...sols) + 2) * 120 / 0.05;
}

test("every mission has a strategy", () => {
  // MISSIONS lives in the simulation's realm, so copy its ids into a local array.
  assert.deepEqual(Object.keys(STRATEGIES).sort(), [...MISSIONS.map((m) => m.id)].sort());
});

for (const m of MISSIONS) {
  const s = STRATEGIES[m.id];
  if (!s) continue;
  for (const difficulty of DIFFICULTY_ORDER) {
    for (const seed of seedsFor(m)) {
      const label = `${m.name}, ${difficulty}${m.seed === null ? `, seed ${seed}` : ""}`;

      test(`${label}: the winning strategy wins`, () => {
        const { state } = play({ mission: m.id, seed, difficulty, moves: s.win, maxTicks: horizon(m) });
        assert.equal(state.over, "win", `ended ${state.over ?? "unfinished"} (${state.endCause}) on Sol ${state.sol}`);
      });

      const lossTest = () => {
        const { state } = play({ mission: m.id, seed, difficulty, moves: s.warned.moves, maxTicks: horizon(m) });
        assert.notEqual(state.over, "win", `won on Sol ${state.sol}`);
      };
      const name = `${label}: ${s.warned.why} doesn't win`;
      if (s.warned.knownGap) test(name, { todo: s.warned.knownGap }, lossTest);
      else test(name, lossTest);
    }
  }
}
