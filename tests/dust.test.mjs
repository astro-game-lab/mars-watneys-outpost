// Dust on Solar Arrays: it settles and cuts output, settles faster in storms,
// and is cleared by hand or by a dust devil. docs/PHYSICS.md § What is modelled, "Dust".

import test from "node:test";
import assert from "node:assert/strict";
import { loadSim } from "./load-sim.mjs";

const EPS = 1e-9;

// The Outpost at midday with events off, plus these buildings.
function outpost({ types = [], events = null } = {}) {
  const sim = loadSim();
  sim.createState({ ...sim.missionById("the-outpost"), events }, 1, "normal");
  const { state } = sim;
  state.resources.materials = state.resources.credits = 1e6;
  for (const type of types) sim.build(type, state.tiles.find((t) => !sim.buildBlocker(type, t)));
  return sim;
}
const arrays = (sim) => sim.state.tiles.filter((t) => t.building && t.building.type === "solar");
const steps = (sim, n) => { for (let i = 0; i < n; i++) { sim.updateGame(); sim.state.outbox.length = 0; } };

test("dust settles at DUST_PER_SOL in clear weather", () => {
  const sim = outpost();
  const a = arrays(sim)[0];
  const n = 600;   // 30 game seconds
  steps(sim, n);
  const expected = (sim.DUST_PER_SOL / sim.SOL_SECONDS) * n * sim.SIM_STEP;
  assert.ok(Math.abs(a.building.dust - expected) < EPS, `${a.building.dust}, expected ${expected}`);
});

test("dust settles DUST_STORM_FACTOR times faster during a dust storm", () => {
  const clear = outpost(), storm = outpost();
  storm.addEffect("dust", "storm", 1e6);
  steps(clear, 200); steps(storm, 200);
  const ratio = arrays(storm)[0].building.dust / arrays(clear)[0].building.dust;
  assert.ok(Math.abs(ratio - storm.DUST_STORM_FACTOR) < 1e-6, `ratio ${ratio}`);
});

test("dust never goes past DUST_MAX", () => {
  // Start just under the cap: the crew has no life support here, and a
  // mission that's over stops stepping.
  const sim = outpost();
  const a = arrays(sim)[0];
  a.building.dust = sim.DUST_MAX - 0.001;
  sim.addEffect("dust", "storm", 1e9);
  steps(sim, 200);
  assert.equal(sim.state.over, null);
  assert.equal(a.building.dust, sim.DUST_MAX);
});

test("a dusty array loses exactly its share of output", () => {
  const sim = outpost();
  const a = arrays(sim)[0];
  sim.state.time = 0.5 * sim.SOL_SECONDS;
  const clean = sim.outputMultiplier(a);
  a.building.dust = 0.25;
  assert.ok(Math.abs(sim.outputMultiplier(a) - clean * 0.75) < EPS);
});

test("cleaning takes the array offline for CLEAN_SECONDS, then its dust is gone", () => {
  const sim = outpost();
  const a = arrays(sim)[0];
  a.building.dust = 0.4;
  sim.state.time = 0.5 * sim.SOL_SECONDS;
  assert.ok(sim.clean(a));
  assert.equal(sim.outputMultiplier(a), 0);
  assert.match(sim.cleanBlocker(a), /Already/);
  steps(sim, Math.round(sim.CLEAN_SECONDS / sim.SIM_STEP) - 1);
  assert.ok(a.building.cleaning > 0, "finished early");
  steps(sim, 1);
  assert.equal(a.building.cleaning, 0);
  assert.equal(a.building.dust, 0);
  assert.ok(sim.outputMultiplier(a) > 0);
});

test("only a dusty Solar Array can be cleaned", () => {
  const sim = outpost();
  const a = arrays(sim)[0];
  assert.match(sim.cleanBlocker(a), /Nothing to clean/);
  const habitat = sim.state.tiles.find((t) => t.building && t.building.type === "habitat");
  assert.match(sim.cleanBlocker(habitat), /Only Solar Arrays/);
  assert.equal(sim.clean(habitat), false);
});

test("a dust devil leaves DEVIL.keep of the dust on the arrays it hits, and is deterministic", () => {
  const run = () => {
    const sim = outpost({ types: ["solar", "solar", "solar", "solar"] });
    for (const a of arrays(sim)) a.building.dust = 0.5;
    sim.EVENTS.devil();
    return [...arrays(sim).map((a) => a.building.dust)];   // a local array, not the simulation's
  };
  const dust = run();
  const { DEVIL } = loadSim();
  for (const d of dust) assert.ok(d === 0.5 || Math.abs(d - 0.5 * DEVIL.keep) < EPS, `dust ${d}`);
  assert.ok(dust.some((d) => d < 0.5), "the devil missed every array");
  assert.deepEqual(run(), dust);
});
