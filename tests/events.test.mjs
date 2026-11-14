// Random and scripted events (js/events.js): what each one does, and when
// they fire.

import test from "node:test";
import assert from "node:assert/strict";
import { buildNow } from "./helpers.mjs";
import { loadSim } from "./load-sim.mjs";

// The Outpost with no random events, at midday.
function calm(difficulty = "normal") {
  const sim = loadSim();
  sim.createState({ ...sim.missionById("the-outpost"), events: null }, 1, difficulty);
  sim.state.time = 0.5 * sim.SOL_SECONDS;
  sim.refreshFlows();
  return sim;
}

test("a dust storm cuts solar output to 30% while it lasts, then ends on time", () => {
  const sim = calm();
  const solar = sim.state.tiles.find((t) => t.building && t.building.type === "solar");
  const clear = sim.outputMultiplier(solar);
  sim.EVENTS.dust();
  assert.ok(Math.abs(sim.outputMultiplier(solar) - 0.3 * clear) < 1e-12);
  const steps = Math.round(sim.EVENT_DEFAULTS.durations.dust / sim.SIM_STEP);
  for (let i = 0; i < steps - 1; i++) sim.updateEvents(sim.SIM_STEP);
  assert.ok(sim.hasEffect("dust"), "still blowing a step before the end");
  sim.updateEvents(sim.SIM_STEP);
  assert.ok(!sim.hasEffect("dust"));
});

test("a second storm during the first extends it rather than stacking", () => {
  const sim = calm();
  sim.EVENTS.dust();
  for (let i = 0; i < 100; i++) sim.updateEvents(sim.SIM_STEP);
  sim.EVENTS.dust();
  const storms = sim.state.effects.filter((e) => e.kind === "dust");
  assert.equal(storms.length, 1);
  assert.equal(storms[0].remaining, sim.EVENT_DEFAULTS.durations.dust);
});

test("a solar flare adds FLARE_RADIATION to the exposure", () => {
  const sim = calm();
  sim.updateGame();
  const before = sim.state.radiation;
  sim.EVENTS.flare();
  sim.updateGame();
  assert.equal(sim.state.radiation, Math.min(100, before + sim.FLARE_RADIATION));
});

test("a pump failure halves Water Extractor output", () => {
  const sim = calm();
  const t = sim.state.tiles.find((t) => !sim.buildBlocker("water", t));
  buildNow(sim, "water", t);
  const before = sim.outputMultiplier(t);
  sim.EVENTS.failure();
  assert.equal(sim.outputMultiplier(t), before / 2);
});

test("a micrometeorite hits a finished building, never a construction site", () => {
  const sim = calm();
  const { state } = sim;
  state.resources.materials = state.resources.credits = 1e4;
  const sites = state.tiles.filter((t) => sim.canPlaceOn(t)).slice(0, 4);
  for (const t of sites) assert.ok(sim.build("battery", t));
  for (let i = 0; i < 50; i++) {
    sim.EVENTS.meteor();
    assert.ok(sites.every((t) => t.building.disabled === 0), "a site was hit");
  }
  assert.ok(state.tiles.some((t) => t.building && t.building.disabled > 0));
});

test("a supply drop adds the mission's supplies to storage, but not to credits earned", () => {
  const sim = calm();
  const before = { ...sim.state.resources };
  sim.EVENTS.supply();
  for (const [k, v] of Object.entries(sim.EVENT_DEFAULTS.supply)) assert.equal(sim.state.resources[k] - before[k], v, k);
  assert.equal(sim.state.creditsEarned, 0);
});

test("the first random event fires `first` seconds in, scaled by the difficulty's event gap", () => {
  for (const difficulty of ["normal", "martian"]) {
    const sim = loadSim();
    sim.createState({ ...sim.missionById("the-outpost"), seed: 7 }, 7, difficulty);
    const due = sim.EVENT_DEFAULTS.first * sim.DIFFICULTIES[difficulty].eventGap;
    let fired = null;
    for (let i = 0; i < 4000 && fired === null; i++) {
      const before = sim.state.nextEventIn;
      sim.updateEvents(sim.SIM_STEP);
      if (sim.state.nextEventIn > before) fired = (i + 1) * sim.SIM_STEP;
    }
    assert.ok(Math.abs(fired - due) < sim.SIM_STEP, `${difficulty}: fired at ${fired}, due at ${due}`);
    const [min, max] = sim.EVENT_DEFAULTS.interval.map((s) => s * sim.DIFFICULTIES[difficulty].eventGap);
    assert.ok(sim.state.nextEventIn >= min && sim.state.nextEventIn <= max, `next gap ${sim.state.nextEventIn}`);
  }
});

test("a mission with no events never has one", () => {
  const sim = calm();
  const rng = { ...sim.state.rng };
  for (let i = 0; i < 6000; i++) sim.updateGame();
  assert.equal(sim.state.effects.length, 0);
  assert.ok(sim.state.tiles.every((t) => !t.building || !(t.building.disabled > 0)));
  assert.deepEqual({ ...sim.state.rng }, rng, "no random draws at all");
});

test("only the event kinds a mission weights can happen", () => {
  const sim = loadSim();
  sim.createState(sim.missionById("ice-line"), 2201, "martian");   // failure and supply only
  const seen = new Set();
  for (let i = 0; i < 4 * sim.STEPS_PER_SOL; i++) {
    sim.updateGame();
    for (const e of sim.state.effects) seen.add(e.kind);
    if (sim.state.over) break;
  }
  assert.deepEqual([...seen].filter((k) => k !== "failure"), []);
});

test("Flare Watch's scripted flare arrives at midday on Sol 2", () => {
  const sim = loadSim();
  sim.createState({ ...sim.missionById("flare-watch"), events: { ...sim.missionById("flare-watch").events, weights: {} } }, 4401, "normal");
  const due = Math.round(1.5 * sim.STEPS_PER_SOL);
  while (sim.clockSteps() < due - 1) sim.updateGame();
  assert.ok(!sim.hasEffect("flare"));
  sim.updateGame();
  assert.ok(sim.hasEffect("flare"));
});
