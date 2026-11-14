// Heating: pressurised buildings draw extra power to stay warm, most at night.
// docs/PHYSICS.md § What is modelled, "Heating".

import test from "node:test";
import assert from "node:assert/strict";
import { loadSim } from "./load-sim.mjs";

const EPS = 1e-9;

function outpostAt(fraction, { power = 1000, types = [] } = {}) {
  const sim = loadSim();
  sim.createState(sim.missionById("the-outpost"), 1, "normal");
  const { state } = sim;
  state.resources.materials = state.resources.credits = 1e6;
  for (const type of types) sim.build(type, state.tiles.find((t) => !sim.buildBlocker(type, t)));
  state.time = fraction * sim.SOL_SECONDS;
  state.resources.power = power;
  state.resources.water = 1000;
  return sim;
}
const built = (sim, type) => sim.state.tiles.filter((t) => t.building && (!type || t.building.type === type));

test("heating follows the same four phases as daylight, and peaks at night", () => {
  const { thermalLoad, daylight, dayPhase } = loadSim();
  const seen = {};
  for (let i = 0; i < 1000; i++) {
    const t = i / 1000;
    const phase = dayPhase(t);
    seen[phase] ??= { heat: thermalLoad(t), sun: daylight(t) };
    assert.equal(thermalLoad(t), seen[phase].heat, `heating changes within ${phase}`);
  }
  const night = Object.entries(seen).find(([p]) => p.includes("Night"))[1].heat;
  assert.equal(night, 1);
  for (const { heat } of Object.values(seen)) assert.ok(heat <= night);
  // The less sun, the more heating.
  const phases = Object.values(seen).sort((a, b) => a.sun - b.sun);
  for (let i = 1; i < phases.length; i++) assert.ok(phases[i].heat <= phases[i - 1].heat);
});

test("a heated building's power demand is its base load plus heating", () => {
  for (const fraction of [0.1, 0.3, 0.5, 0.7]) {
    const sim = outpostAt(fraction);
    for (const t of built(sim)) {
      const b = sim.BUILDINGS[t.building.type];
      const expected = (b.consumes.power || 0) + (b.heat || 0) * sim.thermalLoad(fraction);
      assert.ok(Math.abs(sim.powerDemand(t) - expected) < EPS, `${t.building.type} at ${fraction}`);
    }
  }
});

test("the outpost draws more power at night than at midday, by exactly the heating", () => {
  const night = outpostAt(0.1), midday = outpostAt(0.5);
  const heat = built(night).reduce((s, t) => s + (night.BUILDINGS[t.building.type].heat || 0), 0);
  const drawn = (sim) => sim.computeFlows().prod.power - sim.computeFlows().rates.power;
  const diff = drawn(night) - drawn(midday);
  assert.ok(heat > 0);
  assert.ok(Math.abs(diff - heat * (night.thermalLoad(0.1) - midday.thermalLoad(0.5))) < EPS, `difference ${diff}`);
});

test("a building that's switched off or damaged draws no heating", () => {
  const sim = outpostAt(0.1, { types: ["greenhouse"] });
  const greenhouse = built(sim, "greenhouse")[0];
  const lab = built(sim, "lab")[0];
  const before = sim.computeFlows();
  sim.setPriority(lab, "off");
  greenhouse.building.disabled = 30;
  const after = sim.computeFlows();
  const saved = sim.powerDemand(lab) + sim.powerDemand(greenhouse);
  assert.ok(Math.abs((after.rates.power - before.rates.power) - saved) < EPS);
});

test("in a power shortage, heating is throttled with the rest of the building", () => {
  // Night, nothing stored, only the Solar Array: nothing is generated.
  const sim = outpostAt(0.1, { power: 0 });
  const flows = sim.computeFlows();
  for (const t of built(sim)) if (sim.powerDemand(t) > 0) assert.equal(t.building.level, 0, t.building.type);
  assert.ok(Math.abs(flows.rates.power) < EPS);
});
