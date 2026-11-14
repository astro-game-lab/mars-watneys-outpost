// Building temperature: thermostat heating against the outside temperature,
// cooling when heating falls short, frost in Greenhouses, cold in Habitats and
// Labs. docs/PHYSICS.md § What is modelled, "Heating and temperature".

import test from "node:test";
import assert from "node:assert/strict";
import { buildNow } from "./helpers.mjs";
import { loadSim } from "./load-sim.mjs";

const EPS = 1e-9;

// The Outpost with events off, at a time of day, plus these buildings.
function outpostAt(fraction, { types = [], power = 1e6 } = {}) {
  const sim = loadSim();
  sim.createState({ ...sim.missionById("the-outpost"), events: null }, 1, "normal");
  const { state } = sim;
  state.resources.materials = state.resources.credits = 1e6;
  for (const type of types) buildNow(sim, type, state.tiles.find((t) => !sim.buildBlocker(type, t)));
  state.time = fraction * sim.SOL_SECONDS;
  state.resources.power = power;
  state.resources.water = state.resources.food = state.resources.oxygen = 1e6;
  return sim;
}
const first = (sim, type) => sim.state.tiles.find((t) => t.building && t.building.type === type);
const step = (sim, n = 1) => { for (let i = 0; i < n; i++) { sim.updateGame(); sim.state.outbox.length = 0; } };

test("the outside temperature runs between the Viking 1 extremes: lowest before dawn, highest in the afternoon", () => {
  const { outsideTempK, OUTSIDE_K } = loadSim();
  let lo = Infinity, hi = -Infinity, loAt, hiAt, prev = outsideTempK(0);
  for (let i = 0; i <= 2000; i++) {
    const t = i / 2000, T = outsideTempK(t);
    if (T < lo) { lo = T; loAt = t; }
    if (T > hi) { hi = T; hiAt = t; }
    assert.ok(Math.abs(T - prev) < 0.5, `jump at ${t}`);   // smooth
    prev = T;
  }
  assert.ok(Math.abs(lo - OUTSIDE_K.min) < 1e-6 && Math.abs(hi - OUTSIDE_K.max) < 1e-6);
  assert.ok(Math.abs(loAt - OUTSIDE_K.minAt) < 1e-3 && Math.abs(hiAt - OUTSIDE_K.maxAt) < 1e-3);
});

test("at the setpoint, heating demand equals the heat loss, so a powered building holds its temperature all sol", () => {
  const sim = outpostAt(0.3);
  const habitat = first(sim, "habitat");
  const { heatLoss, BUILDINGS, outsideTempK, solTime, SETPOINT_K } = sim;
  const expected = heatLoss(BUILDINGS.habitat) * (SETPOINT_K - outsideTempK(solTime()));
  assert.ok(Math.abs(sim.heatingDemand(habitat) - expected) < EPS);
  for (let i = 0; i < 2400; i++) {   // a whole sol
    step(sim);
    sim.state.resources.power = 1e6;
    for (const t of sim.state.tiles) if (t.building && t.building.tempK !== undefined) {
      assert.ok(Math.abs(t.building.tempK - SETPOINT_K) < 1e-6, `${t.building.type} at ${t.building.tempK}`);
    }
  }
});

test("heating demand rises as the outside cools, and is largest before dawn", () => {
  const sim = outpostAt(0);
  const habitat = first(sim, "habitat");
  let maxDemand = -1, maxAt;
  for (let i = 0; i < 1000; i++) {
    sim.state.time = (i / 1000) * sim.SOL_SECONDS;
    const d = sim.heatingDemand(habitat);
    if (d > maxDemand) { maxDemand = d; maxAt = i / 1000; }
  }
  assert.ok(Math.abs(maxAt - sim.OUTSIDE_K.minAt) < 2e-3, `peak at ${maxAt}`);
  assert.ok(maxDemand < sim.BUILDINGS.habitat.heat, "no headroom left for rewarming");
});

test("an unpowered building cools toward the outside and never below it", () => {
  const sim = outpostAt(0.1, { types: ["greenhouse"] });
  const g = first(sim, "greenhouse");
  sim.setPriority(g, "off");
  let last = g.building.tempK;
  for (let i = 0; i < 400; i++) {
    step(sim);
    assert.ok(g.building.tempK < last, "not cooling");
    last = g.building.tempK;
  }
  for (let i = 0; i < 40000; i++) {
    step(sim);
    assert.ok(g.building.tempK >= Math.min(...[0, 0.25, 0.5, 0.75].map((f) => sim.outsideTempK(f))) - 1e-6);
  }
});

test("the bigger the power shortfall, the faster a building cools", () => {
  const cool = (level) => {
    const sim = outpostAt(0.1);
    const habitat = first(sim, "habitat");
    const before = habitat.building.tempK;
    habitat.building.heatDelivered = sim.heatingDemand(habitat) * level;
    sim.updateTemperatures(sim.SIM_STEP);
    return before - habitat.building.tempK;
  };
  assert.ok(Math.abs(cool(1)) < 1e-9);
  assert.ok(cool(0) > cool(0.5) && cool(0.5) > cool(0.9) && cool(0.9) > 0);
});

test("a cold building draws more than the loss, up to its heater's maximum, and stops at the setpoint", () => {
  const sim = outpostAt(0.1);
  const habitat = first(sim, "habitat");
  habitat.building.tempK = 270;
  const loss = sim.heatLoss(sim.BUILDINGS.habitat) * (270 - sim.outsideTempK(sim.solTime()));
  assert.equal(sim.heatingDemand(habitat), sim.BUILDINGS.habitat.heat);
  assert.ok(sim.heatingDemand(habitat) > loss);
  for (let i = 0; i < 20000 && habitat.building.tempK < sim.SETPOINT_K; i++) { step(sim); sim.state.resources.power = 1e6; }
  assert.equal(habitat.building.tempK, sim.SETPOINT_K);
});

test("frost damages a Greenhouse crop, and it regrows only while warm", () => {
  const sim = outpostAt(0.5, { types: ["greenhouse"] });
  const g = first(sim, "greenhouse");
  const full = sim.outputMultiplier(g);
  g.building.tempK = sim.FROST_K - 5;
  sim.setPriority(g, "off");                 // no heat: it stays frozen
  step(sim, 200);
  const damaged = g.building.crop;
  assert.ok(damaged < 1);
  assert.ok(Math.abs(sim.outputMultiplier(g) - full * damaged) < EPS);
  step(sim, 200);
  assert.ok(g.building.crop < damaged, "regrew while frozen");
  sim.setPriority(g, "normal");
  g.building.tempK = sim.SETPOINT_K;
  const before = g.building.crop;
  step(sim, 200);
  assert.ok(g.building.crop > before, "didn't regrow once warm");
});

test("a cold Habitat hurts only the crew sleeping in it", () => {
  const sim = loadSim();
  sim.createState({ ...sim.missionById("the-outpost"), events: null, start: { crew: 4 } }, 1, "normal");
  const { state } = sim;
  state.resources.water = state.resources.food = state.resources.oxygen = state.resources.power = 1e6;
  for (const m of state.crewMembers) m.health = 80;
  const habitats = state.tiles.filter((t) => t.building && t.building.type === "habitat");
  habitats[0].building.tempK = 250;          // the colder one fills last
  sim.setPriority(habitats[0], "low");
  sim.updateGame();
  const inCold = state.crewMembers.filter((m) => m.bed === state.tiles.indexOf(habitats[0]));
  const inWarm = state.crewMembers.filter((m) => m.bed === state.tiles.indexOf(habitats[1]));
  assert.equal(inCold.length, 2);
  assert.equal(inWarm.length, 2);
  for (const m of inCold) assert.ok(m.health < 80, `${m.name} wasn't hurt`);
  for (const m of inWarm) assert.ok(m.health > 80, `${m.name} didn't recover`);
});

test("a Science Lab below the cold threshold stops working, and resumes once warm", () => {
  const sim = outpostAt(0.5);
  const lab = first(sim, "lab");
  assert.ok(sim.outputMultiplier(lab) > 0);
  lab.building.tempK = sim.COLD_K - 1;
  assert.equal(sim.outputMultiplier(lab), 0);
  lab.building.tempK = sim.COLD_K;
  assert.ok(sim.outputMultiplier(lab) > 0);
});

test("a switched-off or damaged building draws no heating", () => {
  const sim = outpostAt(0.1, { types: ["greenhouse"] });
  const g = first(sim, "greenhouse"), lab = first(sim, "lab");
  const before = sim.computeFlows();
  const saved = sim.powerDemand(lab) + sim.powerDemand(g);
  sim.setPriority(lab, "off");
  g.building.disabled = 30;
  const after = sim.computeFlows();
  assert.ok(Math.abs((after.rates.power - before.rates.power) - saved) < EPS);
  assert.equal(lab.building.heatDelivered, 0);
  assert.equal(g.building.heatDelivered, 0);
});
