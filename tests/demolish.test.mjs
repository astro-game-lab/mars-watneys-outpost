// Demolishing: what comes back, and what can't be demolished.

import test from "node:test";
import assert from "node:assert/strict";
import { buildNow } from "./helpers.mjs";
import { loadSim } from "./load-sim.mjs";

function outpost() {
  const sim = loadSim();
  sim.createState({ ...sim.missionById("the-outpost"), events: null }, 1, "normal");
  sim.state.resources.materials = sim.state.resources.credits = 1000;
  sim.refreshFlows();
  return sim;
}
const all = (sim, type) => sim.state.tiles.filter((t) => t.building && t.building.type === type);

test("demolishing refunds half the cost, rounded down, and half the regolith if reinforced", () => {
  const sim = outpost();
  const { state, BUILDINGS, REINFORCE } = sim;
  const t = state.tiles.find((t) => !sim.buildBlocker("greenhouse", t));
  buildNow(sim, "greenhouse", t);
  const before = { ...state.resources };
  assert.ok(sim.demolish(t));
  assert.equal(t.building, null);
  for (const [k, v] of Object.entries(BUILDINGS.greenhouse.cost)) assert.equal(state.resources[k] - before[k], Math.floor(v / 2), k);

  buildNow(sim, "solar", t);
  t.building.reinforced = true;
  const mats = state.resources.materials;
  assert.ok(sim.demolish(t));
  assert.equal(state.resources.materials - mats, Math.floor((BUILDINGS.solar.cost.materials + REINFORCE.cost.materials) / 2));
});

test("a Habitat whose beds the crew needs can't be demolished", () => {
  const sim = outpost();
  const { state } = sim;
  const [, spare] = all(sim, "habitat");
  assert.equal(sim.demolishBlocker(spare), null, "one crew member, four beds");
  sim.addCrewMember();
  sim.addCrewMember();
  sim.refreshFlows();
  assert.equal(sim.demolishBlocker(spare), "The crew needs these beds");
  assert.equal(sim.demolish(spare), false);
  assert.ok(spare.building);
  assert.equal(state.crew, 3);
});

test("a damaged Habitat keeps its beds, so it can't be demolished out from under the crew", () => {
  const sim = outpost();
  const [, spare] = all(sim, "habitat");
  sim.addCrewMember();
  sim.addCrewMember();
  sim.startJob(spare, "repair", 15);    // a micrometeorite hit
  sim.refreshFlows();
  assert.equal(sim.demolishBlocker(spare), "The crew needs these beds");
  assert.equal(sim.demolish(spare), false);
});

test("a Habitat still under construction gives no beds to count on", () => {
  const sim = outpost();
  const { state } = sim;
  const site = state.tiles.find((t) => !sim.buildBlocker("habitat", t));
  assert.ok(sim.build("habitat", site));
  sim.addCrewMember();
  sim.addCrewMember();
  sim.refreshFlows();
  const [, spare] = all(sim, "habitat").filter((t) => t !== site);
  assert.equal(sim.demolishBlocker(spare), "The crew needs these beds");
});

test("regolith paid for but still being piled on is refunded like finished regolith", () => {
  const sim = outpost();
  const { state, BUILDINGS, REINFORCE } = sim;
  const t = state.tiles.find((t) => !sim.buildBlocker("solar", t));
  buildNow(sim, "solar", t);
  assert.ok(sim.reinforce(t));
  assert.ok(t.building.reinforcing > 0);
  const mats = state.resources.materials;
  assert.ok(sim.demolish(t));
  assert.equal(state.resources.materials - mats, Math.floor((BUILDINGS.solar.cost.materials + REINFORCE.cost.materials) / 2));
});
