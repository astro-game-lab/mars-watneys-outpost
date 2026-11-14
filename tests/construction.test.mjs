// Construction time and crew labour. Building, repairing, cleaning and
// reinforcing are jobs; each crew member does one at a time at 1 unit of work
// per second. docs/PHYSICS.md § What is modelled, "Crew work".

import test from "node:test";
import assert from "node:assert/strict";
import { loadSim } from "./load-sim.mjs";

const EPS = 1e-9;

// The Outpost at midday with events off, a crew of `crew`, and plenty of everything.
function setUp({ crew = 1 } = {}) {
  const sim = loadSim();
  sim.createState({ ...sim.missionById("the-outpost"), events: null, start: { crew } }, 1, "normal");
  const { state } = sim;
  for (const k of Object.keys(state.resources)) state.resources[k] = 1e6;
  state.time = 0.5 * sim.SOL_SECONDS;
  return sim;
}
const free = (sim, type) => sim.state.tiles.find((t) => !sim.buildBlocker(type, t));
const steps = (sim, n) => { for (let i = 0; i < n; i++) { sim.updateGame(); sim.state.outbox.length = 0; } };
const stepsFor = (sim, seconds) => Math.round(seconds / sim.SIM_STEP);

test("a construction site draws nothing, makes nothing and adds no beds until it's finished", () => {
  const sim = setUp();
  const before = sim.computeFlows();
  const t = free(sim, "habitat");
  assert.ok(sim.build("habitat", t));
  assert.equal(t.building.construct, sim.BUILDINGS.habitat.work);
  const during = sim.computeFlows();
  assert.equal(during.crewCapacity, before.crewCapacity);
  assert.equal(during.rates.power, before.rates.power);
  assert.equal(during.rates.oxygen, before.rates.oxygen);
  assert.equal(during.shielding, before.shielding);
});

test("one crew member finishes a building in exactly its work time", () => {
  const sim = setUp();
  const t = free(sim, "solar");
  sim.build("solar", t);
  steps(sim, stepsFor(sim, sim.BUILDINGS.solar.work) - 1);
  assert.ok(t.building.construct > 0, "finished early");
  steps(sim, 1);
  assert.equal(t.building.construct, 0);
  assert.ok(sim.computeFlows().prod.power > 0);
});

test("one worker does jobs one after another; two workers do them side by side", () => {
  const time = (crew) => {
    const sim = setUp({ crew });
    const a = free(sim, "solar"); sim.build("solar", a);
    const b = free(sim, "battery"); sim.build("battery", b);
    let n = 0;
    while (a.building.construct > 0 || b.building.construct > 0) { steps(sim, 1); n++; }
    return n * sim.SIM_STEP;
  };
  const { BUILDINGS } = loadSim();
  assert.ok(Math.abs(time(1) - (BUILDINGS.solar.work + BUILDINGS.battery.work)) < 0.11);
  assert.ok(Math.abs(time(2) - Math.max(BUILDINGS.solar.work, BUILDINGS.battery.work)) < 0.11);
});

test("repairs come first, then the oldest job of each kind", () => {
  const sim = setUp();
  const first = free(sim, "solar"); sim.build("solar", first);
  const second = free(sim, "mine"); sim.build("mine", second);
  const habitat = sim.state.tiles.find((t) => t.building && t.building.type === "habitat");
  sim.startJob(habitat, "repair", 5);
  steps(sim, 1);
  assert.deepEqual({ ...sim.state.crewMembers[0].job }, { tile: sim.state.tiles.indexOf(habitat), kind: "repair" });
  steps(sim, stepsFor(sim, 5));
  assert.equal(sim.state.crewMembers[0].job.tile, sim.state.tiles.indexOf(first));
});

test("micrometeorite damage stays until someone repairs it", () => {
  const sim = setUp({ crew: 1 });
  const [habitat] = sim.state.tiles.filter((t) => t.building && t.building.type === "habitat");
  const lab = sim.state.tiles.find((t) => t.building && t.building.type === "lab");
  sim.startJob(habitat, "repair", 6);   // queued first, so Watney takes it
  sim.startJob(lab, "repair", 4);
  steps(sim, stepsFor(sim, 3));
  assert.equal(lab.building.disabled, 4, "the Lab healed with nobody on it");
  assert.ok(Math.abs(habitat.building.disabled - 3) < 1e-6);
  steps(sim, stepsFor(sim, 3 + 4));
  assert.equal(habitat.building.disabled, 0);
  assert.equal(lab.building.disabled, 0);
});

test("cancelling construction refunds the cost in full, and can't split the outpost", () => {
  const sim = setUp();
  const { state } = sim;
  const before = { ...state.resources };
  const t = free(sim, "nuclear");
  sim.build("nuclear", t);
  assert.ok(sim.cancel(t));
  assert.equal(t.building, null);
  for (const k of Object.keys(before)) assert.equal(state.resources[k], before[k], k);
  const habitat = state.tiles.find((x) => x.building && x.building.type === "habitat");
  assert.match(sim.cancelBlocker(habitat), /Not under construction/);
  assert.match(sim.demolishBlocker((sim.build("solar", free(sim, "solar")), state.tiles.find((x) => x.building && x.building.construct > 0))), /cancel/);
});

test("reinforcing takes effect only when the work is done", () => {
  const sim = setUp();
  const habitat = sim.state.tiles.find((t) => t.building && t.building.type === "habitat");
  const before = sim.computeFlows().shielding;
  assert.ok(sim.reinforce(habitat));
  assert.equal(sim.computeFlows().shielding, before);
  steps(sim, stepsFor(sim, sim.REINFORCE.work));
  assert.equal(habitat.building.reinforced, true);
  assert.equal(sim.computeFlows().shielding, before + sim.REINFORCE.radiation);
});

test("jobs left over when every crew member is busy are counted as waiting", () => {
  const sim = setUp({ crew: 2 });
  for (const type of ["solar", "battery", "mine", "water"]) sim.build(type, free(sim, type));
  steps(sim, 1);
  assert.equal(sim.state.jobsWaiting, 2);
  assert.ok(sim.state.crewMembers.every((m) => m.job));
});

test("repair progress counts every hit: a second strike adds to the work and to the total", () => {
  const sim = setUp({ crew: 1 });
  const lab = sim.state.tiles.find((t) => t.building && t.building.type === "lab");
  sim.startJob(lab, "repair", 10);
  steps(sim, stepsFor(sim, 5));
  assert.ok(Math.abs(sim.jobProgress(lab.building, "repair") - 0.5) < 1e-6);
  sim.addWork(lab, "repair", 10);              // hit again: 15 left of 20
  assert.ok(Math.abs(sim.jobProgress(lab.building, "repair") - 0.25) < 1e-6);
  steps(sim, stepsFor(sim, 15));
  assert.equal(lab.building.disabled, 0);
  assert.equal(lab.building.jobTotal.repair, undefined);
});
