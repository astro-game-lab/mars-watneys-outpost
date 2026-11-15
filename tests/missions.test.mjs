// Per-mission rules: building overrides, climate and sunlight.

import test from "node:test";
import assert from "node:assert/strict";
import { loadSim } from "./load-sim.mjs";

function mission(id) {
  const sim = loadSim();
  const m = sim.missionById(id);
  sim.createState({ ...m, events: null }, m.seed ?? 1, "normal");
  for (const k of Object.keys(sim.state.resources)) sim.state.resources[k] = 1000;
  sim.state.time = 0.5 * sim.SOL_SECONDS;
  return sim;
}

test("Thin Air's Habitats make no oxygen and draw no water, but still give beds and shielding", () => {
  const thin = mission("thin-air"), normal = mission("the-outpost");
  const flows = thin.computeFlows(), base = normal.computeFlows();
  const habitat = thin.state.tiles.find((t) => t.building && t.building.type === "habitat");
  assert.deepEqual({ ...thin.spec("habitat").produces }, {});
  assert.equal(thin.spec("habitat").consumes.water, undefined);
  assert.equal(flows.crewCapacity, base.crewCapacity);
  assert.equal(flows.shielding, base.shielding);
  assert.equal(flows.prod.oxygen || 0, 0);
  assert.equal(habitat.building.level, 1);
});

test("an override changes only its own mission", () => {
  const sim = mission("the-outpost");
  assert.ok(sim.spec("habitat").produces.oxygen > 0);
  assert.ok(sim.BUILDINGS.habitat.produces.oxygen > 0);
});

test("Long Night's outside air is colder than the default, all sol", () => {
  const cold = mission("long-night"), normal = mission("the-outpost");
  for (let i = 0; i < 100; i++) {
    const f = i / 100;
    assert.ok(cold.outsideTempK(f) < normal.outsideTempK(f), `not colder at ${f}`);
  }
  assert.equal(Math.round(Math.min(...[...Array(1000).keys()].map((i) => cold.outsideTempK(i / 1000)))), cold.missionById("long-night").climate.min);
});

test("Long Night's sunlight multiplier scales Solar Array output", () => {
  const cold = mission("long-night"), normal = mission("the-outpost");
  const solar = (sim) => sim.outputMultiplier(sim.state.tiles.find((t) => t.building && t.building.type === "solar"));
  assert.ok(Math.abs(solar(cold) - solar(normal) * cold.missionById("long-night").sunlight) < 1e-9);
});

test("every heater can still hold its setpoint on the coldest night of every mission", () => {
  const sim = loadSim();
  for (const m of sim.MISSIONS) {
    sim.createState(m, m.seed ?? 1, "normal");
    const coldest = { ...sim.OUTSIDE_K, ...m.climate }.min;
    for (const key of sim.BUILD_ORDER) {
      const b = sim.spec(key);
      if (!b.heat) continue;
      const need = sim.heatLoss(b) * (sim.SETPOINT_K - coldest);
      assert.ok(need < b.heat, `${m.id}: a ${b.name} needs ${need.toFixed(3)} of its ${b.heat} at ${coldest} K`);
    }
  }
});
