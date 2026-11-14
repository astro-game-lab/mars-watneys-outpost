// The Oxygen Plant: oxygen from the atmosphere's carbon dioxide, using power
// and no water. docs/PHYSICS.md § Claims, "Oxygen Plant".

import test from "node:test";
import assert from "node:assert/strict";
import { loadSim } from "./load-sim.mjs";

function outpostWith(types, { power = 100, water = 100, mission = "the-outpost" } = {}) {
  const sim = loadSim();
  sim.createState(sim.missionById(mission), 1, "normal");
  const { state } = sim;
  state.resources.materials = state.resources.credits = 1e6;
  for (const type of types) {
    const t = state.tiles.find((t) => !sim.buildBlocker(type, t));
    assert.ok(t, `no room for a ${type}`);
    sim.build(type, t);
  }
  state.time = 0.5 * sim.SOL_SECONDS;
  state.resources.power = power;
  state.resources.water = water;
  return sim;
}

test("an Oxygen Plant adds oxygen and draws power, and no water", () => {
  const without = outpostWith(["nuclear"]).computeFlows();
  const sim = outpostWith(["nuclear", "moxie"]);
  const withPlant = sim.computeFlows();
  const b = sim.BUILDINGS.moxie;
  assert.equal(withPlant.rates.oxygen - without.rates.oxygen, b.produces.oxygen);
  assert.equal(without.rates.power - withPlant.rates.power, b.consumes.power);
  assert.equal(withPlant.rates.water, without.rates.water);
});

test("an Oxygen Plant keeps making oxygen with no water at all", () => {
  // Water empty and no extractor: Habitats stop, the Oxygen Plant doesn't.
  const sim = outpostWith(["nuclear", "moxie"], { water: 0 });
  sim.state.crew = 3;   // more than the stored water can be topped up for
  sim.computeFlows();
  const plant = sim.state.tiles.find((t) => t.building && t.building.type === "moxie");
  const habitats = sim.state.tiles.filter((t) => t.building && t.building.type === "habitat");
  assert.equal(plant.building.level, 1);
  for (const h of habitats) assert.equal(h.building.level, 0);
});

test("per unit of power, a Habitat makes more oxygen than an Oxygen Plant", () => {
  // The plant earns its place when water is short, not by out-producing Habitats.
  const { BUILDINGS } = loadSim();
  const perPower = (b) => b.produces.oxygen / (b.consumes.power + (b.heat || 0));
  assert.ok(perPower(BUILDINGS.habitat) > perPower(BUILDINGS.moxie));
});

test("the Oxygen Plant is life support: critical by default", () => {
  const sim = outpostWith(["moxie"]);
  const plant = sim.state.tiles.find((t) => t.building && t.building.type === "moxie");
  assert.equal(plant.building.priority, "critical");
});

test("the Oxygen Plant is available only where a mission allows every building", () => {
  const sim = loadSim();
  for (const m of sim.MISSIONS) {
    sim.createState(m, m.seed ?? 1, "normal");
    assert.equal(sim.buildingUnlocked("moxie"), m.buildings === null, m.id);
  }
});
