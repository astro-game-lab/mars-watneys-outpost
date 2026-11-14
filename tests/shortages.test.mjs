// Shortage resolution: power is shared out first, then water; the crew drinks
// before any building; and throttled consumers never draw more than there is.
// docs/PHYSICS.md § What is modelled, "Shortages", and § Validation.

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

// What the buildings actually make and draw, from their operating levels.
function actual(sim) {
  const prod = {}, draw = {};
  for (const t of sim.state.tiles.filter((t) => t.building)) {
    const b = sim.BUILDINGS[t.building.type];
    if (t.building.disabled > 0) continue;
    for (const [k, v] of Object.entries(b.produces)) {
      prod[k] = (prod[k] || 0) + v * sim.outputMultiplier(t) * (k === "power" ? 1 : t.building.level);
    }
    for (const [k, v] of Object.entries(b.consumes)) draw[k] = (draw[k] || 0) + v * t.building.level;
  }
  return { prod, draw };
}

test("with no power stored, consumers draw exactly what is generated", () => {
  // Water in store, so nothing is held back by a water shortage as well.
  const sim = outpostWith(["nuclear", "mine", "mine", "mine", "greenhouse", "greenhouse"], { water: 1000 });
  const flows = sim.computeFlows();
  const { prod, draw } = actual(sim);
  assert.ok(flows.factor.power < 1, "expected a power shortage");
  assert.ok(Math.abs(draw.power - prod.power) < EPS, `draw ${draw.power}, generated ${prod.power}`);
  assert.ok(Math.abs(flows.rates.power) < EPS);
});

test("power is resolved before water: extractors run no faster than power allows", () => {
  const sim = outpostWith(["water", "water", "nuclear", "mine", "mine", "mine"]);
  const flows = sim.computeFlows();
  assert.ok(flows.factor.power < 1, "expected a power shortage");
  for (const t of sim.state.tiles.filter((t) => t.building && t.building.type === "water")) {
    assert.ok(t.building.level <= flows.factor.power + EPS);
  }
});

test("the crew drinks first, and buildings share only what's left", () => {
  // Enough power, too little water: one extractor, three Greenhouses.
  const sim = outpostWith(["nuclear", "nuclear", "water", "greenhouse", "greenhouse", "greenhouse"], { power: 100 });
  const flows = sim.computeFlows();
  const { prod, draw } = actual(sim);
  const crew = sim.crewNeed("water");
  assert.ok(flows.factor.water < 1, "expected a water shortage");
  assert.ok(Math.abs(draw.water - Math.max(0, prod.water - crew)) < EPS, `buildings drew ${draw.water}`);
});

test("with power and water both short, buildings never draw more water than is left", () => {
  // The case that used to overdraw: power-limited extractors and water-limited consumers.
  const sim = outpostWith(["greenhouse", "greenhouse", "water", "mine", "mine", "nuclear"]);
  const flows = sim.computeFlows();
  const { prod, draw } = actual(sim);
  const crew = sim.crewNeed("water");
  assert.ok(flows.factor.power < 1 && flows.factor.water < 1, "expected both shortages");
  assert.ok(draw.water <= Math.max(0, prod.water - crew) + EPS,
    `buildings drew ${draw.water}, only ${Math.max(0, prod.water - crew)} was left after the crew`);
});

test("when production can't even cover the crew, buildings get no water", () => {
  const sim = outpostWith(["greenhouse"]);
  sim.state.crew = 10;
  const flows = sim.computeFlows();
  assert.equal(flows.factor.water, 0);
});
