// Shortage priorities: supply goes to critical buildings first, then normal,
// then low; buildings in a tier share alike; "off" draws and makes nothing.
// docs/PHYSICS.md § What is modelled, "Shortages".

import test from "node:test";
import assert from "node:assert/strict";
import { loadSim } from "./load-sim.mjs";

const EPS = 1e-9;

// The Outpost at night with empty stores, plus these buildings.
function outpostWith(types, { power = 0, water = 0 } = {}) {
  const sim = loadSim();
  sim.createState(sim.missionById("the-outpost"), 1, "normal");
  const { state } = sim;
  state.resources.materials = state.resources.credits = 1e6;
  for (const type of types) {
    const t = state.tiles.find((t) => !sim.buildBlocker(type, t));
    assert.ok(t, `no room for a ${type}`);
    sim.build(type, t);
  }
  state.time = 0.1 * sim.SOL_SECONDS;   // night: solar makes nothing
  state.resources.power = power;
  state.resources.water = water;
  return sim;
}
const built = (sim, type) => sim.state.tiles.filter((t) => t.building && (!type || t.building.type === type));

test("allocate() serves the tiers in order and never hands out more than the supply", () => {
  const { allocate } = loadSim();
  const share = (supply, demand) => ({ ...allocate(supply, demand) });
  assert.deepEqual(share(10, { critical: 4, normal: 4, low: 4 }), { critical: 1, normal: 1, low: 0.5 });
  assert.deepEqual(share(6, { critical: 4, normal: 4, low: 4 }), { critical: 1, normal: 0.5, low: 0 });
  assert.deepEqual(share(2, { critical: 4, normal: 4 }), { critical: 0.5, normal: 0, low: 1 });
  assert.deepEqual(share(0, { low: 3 }), { critical: 1, normal: 1, low: 0 });
  assert.deepEqual(share(5, {}), { critical: 1, normal: 1, low: 1 });
});

test("in a power shortage, each tier runs at its share, and higher tiers are served first", () => {
  // 12 power from a Nuclear Generator against more demand than that.
  const sim = outpostWith(["nuclear", "water", "greenhouse", "greenhouse", "mine", "mine", "shield"], { water: 1000 });
  const flows = sim.computeFlows();
  const { shares, demand } = flows;
  assert.ok(sim.SUPPLY_TIERS.some((tier) => shares.power[tier] < 1), "expected a power shortage");
  // Independent check of the tier arithmetic.
  let left = 12;
  for (const tier of sim.SUPPLY_TIERS) {
    const d = demand.power[tier] || 0;
    const expected = d > 0 ? Math.min(1, left / d) : 1;
    assert.ok(Math.abs(shares.power[tier] - expected) < EPS, `${tier}: ${shares.power[tier]}, expected ${expected}`);
    left = Math.max(0, left - d);
  }
  assert.ok(shares.power.critical >= shares.power.normal && shares.power.normal >= shares.power.low);
  for (const t of built(sim)) {
    if (sim.powerDemand(t) > 0) assert.ok(Math.abs(t.building.level - shares.power[t.building.priority]) < EPS, t.building.type);
  }
});

test("raising a building's priority moves it ahead of the others", () => {
  const sim = outpostWith(["nuclear", "water", "greenhouse", "greenhouse", "mine", "mine", "shield"], { water: 1000 });
  sim.computeFlows();
  const lab = built(sim, "lab")[0];
  const before = lab.building.level;
  assert.ok(sim.setPriority(lab, "critical"));
  sim.computeFlows();
  assert.ok(lab.building.level > before, `Lab ran at ${before}, then ${lab.building.level}`);
});

test("a building that's switched off draws nothing, makes nothing and shields nothing", () => {
  const sim = outpostWith(["nuclear", "shield", "mine"], { power: 100, water: 1000 });
  const shieldOn = sim.computeFlows().shielding;
  const mine = built(sim, "mine")[0], shield = built(sim, "shield")[0];
  assert.ok(sim.setPriority(mine, "off") && sim.setPriority(shield, "off"));
  const flows = sim.computeFlows();
  assert.equal(mine.building.level, 0);
  assert.equal(shield.building.level, 0);
  assert.equal(flows.shielding, shieldOn - sim.BUILDINGS.shield.radiation);
  assert.equal(flows.prod.materials || 0, 0);
});

test("an off building that's reinforced keeps its regolith shielding", () => {
  const sim = outpostWith(["nuclear", "mine"], { power: 100, water: 1000 });
  const mine = built(sim, "mine")[0];
  assert.ok(sim.reinforce(mine));
  const before = sim.computeFlows().shielding;
  sim.setPriority(mine, "off");
  assert.equal(sim.computeFlows().shielding, before);
});

test("in a water shortage, the crew drinks first, then the tiers in order", () => {
  // Plenty of power, one regolith extractor: Habitats (critical) before Greenhouses (normal).
  const sim = outpostWith(["nuclear", "nuclear", "water", "greenhouse", "greenhouse", "greenhouse"], { power: 100 });
  const flows = sim.computeFlows();
  const { shares } = flows;
  assert.ok(shares.water.normal < 1, "expected the Greenhouses to be short");
  assert.ok(shares.water.critical >= shares.water.normal);
  let draw = 0, made = 0;
  for (const t of built(sim)) {
    const b = sim.BUILDINGS[t.building.type];
    draw += (b.consumes.water || 0) * t.building.level;
    made += (b.produces.water || 0) * sim.outputMultiplier(t) * t.building.level;
  }
  assert.ok(draw <= Math.max(0, made - sim.crewNeed("water")) + EPS, `buildings drew ${draw}`);
});

test("buildings start at their default priority", () => {
  const sim = outpostWith(["water", "greenhouse", "mine", "shield", "solar", "battery"]);
  for (const t of built(sim)) {
    assert.equal(t.building.priority, sim.BUILDINGS[t.building.type].priority || null, t.building.type);
  }
});

test("Habitats can't be switched off, and buildings that draw nothing have no priority", () => {
  const sim = outpostWith(["solar"]);
  const habitat = built(sim, "habitat")[0];
  assert.match(sim.priorityBlocker(habitat, "off"), /life support/);
  assert.equal(sim.setPriority(habitat, "off"), false);
  assert.equal(sim.setPriority(habitat, "low"), true);
  const solar = built(sim, "solar")[0];
  assert.match(sim.priorityBlocker(solar, "critical"), /no priority/);
});

test("First Night doesn't allow priorities, so the Lab can't dodge the storage lesson", () => {
  const sim = loadSim();
  sim.createState(sim.missionById("first-night"), 1101, "normal");
  const lab = built(sim, "lab")[0];
  assert.match(sim.priorityBlocker(lab, "off"), /aren't available/);
  assert.equal(sim.setPriority(lab, "off"), false);
  assert.equal(lab.building.priority, "low");
});
