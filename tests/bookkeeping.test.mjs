// Each step, every resource changes by rate × SIM_STEP and is then clamped:
// at zero, and power at the battery capacity. docs/PHYSICS.md § Validation,
// "Resource bookkeeping". Events are switched off, because a supply drop adds
// resources outside the flows.

import test from "node:test";
import assert from "node:assert/strict";
import { play } from "./bot.mjs";
import { loadSim } from "./load-sim.mjs";
import { STRATEGIES } from "./strategies.mjs";

const { MISSIONS, RESOURCES, SIM_STEP } = loadSim();

for (const m of MISSIONS) {
  test(`${m.name}: resources follow the rates`, () => {
    let before, checked = 0;
    play({
      mission: m.id, seed: m.seed ?? 7, moves: STRATEGIES[m.id].win, maxTicks: 6000,
      override: { events: null },
      beforeStep: (sim) => { before = { ...sim.state.resources }; },
      afterStep: (sim) => {
        const { state } = sim;
        for (const { key } of RESOURCES) {
          let expected = Math.max(0, before[key] + state.rates[key] * SIM_STEP);
          if (key === "power") expected = Math.min(state.powerCapacity, expected);
          assert.equal(state.resources[key], expected, `${key} on tick ${state.tick}`);
        }
        checked++;
      },
    });
    assert.ok(checked > 1000, `only ${checked} steps checked`);
  });
}
