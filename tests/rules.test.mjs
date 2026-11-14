// The rules around the economy: crew landings, building placement, how a
// mission is won or lost, and what a difficulty tier changes.

import test from "node:test";
import assert from "node:assert/strict";
import { buildNow } from "./helpers.mjs";
import { loadSim } from "./load-sim.mjs";

function outpost(difficulty = "normal", mission = "the-outpost") {
  const sim = loadSim();
  sim.createState({ ...sim.missionById(mission), events: null }, 1, difficulty);
  sim.refreshFlows();
  return sim;
}
// Run to the step a new sol starts on.
function toSol(sim, sol) {
  while (sim.state.sol < sol && !sim.state.over) sim.updateGame();
}
const plenty = (sim) => { for (const k of ["water", "food", "oxygen"]) sim.state.resources[k] = 1e5; };

// ---------- Crew landings ----------

test("a crew member lands every CREW_ARRIVAL_SOLS sols when there's a bed and supplies are healthy", () => {
  const sim = outpost();
  plenty(sim);
  const due = 1 + sim.CREW_ARRIVAL_SOLS;
  toSol(sim, due - 1);
  assert.equal(sim.state.crew, 1);
  plenty(sim);
  toSol(sim, due);
  assert.equal(sim.state.crew, 2);
  assert.equal(sim.state.crewMembers[1].name, sim.CREW_NAMES[0]);
  assert.equal(sim.state.nextArrivalSol, due + sim.CREW_ARRIVAL_SOLS);
});

test("a landing waits a sol when there's no free bed, and when supplies are low", () => {
  const sim = outpost();
  plenty(sim);
  while (sim.state.crew < sim.state.crewCapacity) sim.addCrewMember();
  sim.state.nextArrivalSol = 2;
  assert.match(sim.arrivalBlocker(), /no free bed/);
  toSol(sim, 2);
  assert.equal(sim.state.crew, 4);
  assert.equal(sim.state.nextArrivalSol, 3);
  assert.ok(sim.state.outbox.some((m) => /postponed/.test(m.text)));

  const low = outpost();
  low.state.resources.food = 0;
  low.refreshFlows();
  assert.match(low.arrivalBlocker(), /food/);
});

test("a mission with landings turned off never lands anyone", () => {
  const sim = outpost("normal", "first-night");
  plenty(sim);
  toSol(sim, 3);
  assert.equal(sim.state.crew, 1);
});

test("Crew Rotation lands someone every sol", () => {
  const sim = outpost("normal", "crew-rotation");
  sim.state.resources.power = 1e4;
  plenty(sim);
  toSol(sim, 2);
  assert.equal(sim.state.crew, 2);
  plenty(sim);
  toSol(sim, 3);
  assert.equal(sim.state.crew, 3);
});

// ---------- Building placement ----------

test("a building goes only on a free, passable tile next to the outpost", () => {
  const sim = outpost();
  const { state } = sim;
  const occupied = state.tiles.find((t) => t.building);
  assert.equal(sim.buildBlocker("solar", occupied), "Must be next to the outpost");
  const far = state.tiles.find((t) => !t.building && t.terrain !== "impassable" && !sim.canPlaceOn(t));
  assert.equal(sim.buildBlocker("solar", far), "Must be next to the outpost");
  const rock = state.tiles.find((t) => sim.canPlaceOn(t));
  rock.terrain = "impassable";
  assert.equal(sim.buildBlocker("solar", rock), "Must be next to the outpost");
});

test("a Science Lab has to touch a Habitat", () => {
  const sim = outpost();
  const { state } = sim;
  const away = state.tiles.find((t) => sim.canPlaceOn(t) && !sim.touchesHabitat(t));
  assert.equal(sim.buildBlocker("lab", away), "Must touch a Habitat");
  assert.equal(sim.buildBlocker("solar", away), null);
});

test("building costs what it says, and refuses when it can't be afforded", () => {
  const sim = outpost();
  const { state, BUILDINGS } = sim;
  const t = state.tiles.find((t) => sim.canPlaceOn(t));
  const before = { ...state.resources };
  assert.ok(sim.build("nuclear", t));
  for (const [k, v] of Object.entries(BUILDINGS.nuclear.cost)) assert.equal(before[k] - state.resources[k], v, k);
  const next = state.tiles.find((t) => sim.canPlaceOn(t));
  state.resources.credits = BUILDINGS.nuclear.cost.credits - 1;
  assert.equal(sim.buildBlocker("nuclear", next), "Not enough resources");
  assert.equal(sim.build("nuclear", next), false);
});

test("a mission's building list is enforced", () => {
  const sim = outpost("normal", "first-night");
  const t = sim.state.tiles.find((t) => sim.canPlaceOn(t));
  assert.equal(sim.buildBlocker("nuclear", t), "Not available in this mission");
  assert.equal(sim.buildBlocker("solar", t), null);
});

test("reinforcing costs its materials, once, and not on a site", () => {
  const sim = outpost();
  const { state, REINFORCE } = sim;
  const hab = state.tiles.find((t) => t.building && t.building.type === "habitat");
  const mats = state.resources.materials;
  assert.ok(sim.reinforce(hab));
  assert.equal(mats - state.resources.materials, REINFORCE.cost.materials);
  assert.equal(sim.reinforceBlocker(hab), "Already being reinforced");
  const site = state.tiles.find((t) => sim.canPlaceOn(t));
  sim.build("solar", site);
  assert.equal(sim.reinforceBlocker(site), "Still under construction");
  state.resources.materials = 0;
  const lab = state.tiles.find((t) => t.building && t.building.type === "lab");
  assert.equal(sim.reinforceBlocker(lab), "Not enough materials");
});

// ---------- Winning and losing ----------

test("a mission is won the step every objective holds at once", () => {
  const sim = outpost();
  sim.state.creditsEarned = 4000;
  sim.updateGame();
  assert.equal(sim.state.over, null, "credits alone aren't enough");
  sim.state.time = 7 * sim.SOL_SECONDS - sim.SIM_STEP;   // the last step of Sol 7
  sim.updateGame();
  assert.equal(sim.state.sol, 8);
  assert.equal(sim.state.over, "win");
  assert.equal(sim.state.endCause, "objectives");
});

test("a deadline loses the mission when its sol starts, but a win on that step counts", () => {
  const lose = outpost("normal", "ice-line");
  lose.state.time = 3 * lose.SOL_SECONDS - lose.SIM_STEP;
  lose.updateGame();
  assert.equal(lose.state.over, "lose");
  assert.equal(lose.state.endCause, "deadline");

  const win = outpost("normal", "ice-line");
  win.state.time = 3 * win.SOL_SECONDS - win.SIM_STEP;
  win.state.resources.water = 5000;
  win.updateGame();
  assert.equal(win.state.over, "win");
});

test("a blackout ends First Night as soon as stored power runs out", () => {
  const sim = outpost("normal", "first-night");
  sim.state.time = 0.9 * sim.SOL_SECONDS;
  sim.state.resources.power = 0.5;
  for (let i = 0; i < 20 && !sim.state.over; i++) sim.updateGame();
  assert.equal(sim.state.over, "lose");
  assert.equal(sim.state.endCause, "blackout");
});

test("a death outranks a win on the same step", () => {
  const sim = outpost();
  sim.state.creditsEarned = 4000;
  sim.state.time = 7 * sim.SOL_SECONDS - sim.SIM_STEP;
  sim.state.crewMembers[0].health = 1e-3;
  for (const t of sim.state.tiles) if (t.building && t.building.type === "habitat") t.building.tempK = 200;   // freezing
  sim.updateGame();
  assert.equal(sim.state.over, "lose");
  assert.equal(sim.state.endCause, "health");
});

test("an ended mission doesn't step any further", () => {
  const sim = outpost();
  sim.finish("lose", "health");
  const tick = sim.state.tick;
  sim.updateGame();
  assert.equal(sim.state.tick, tick);
});

test("pausing stops the simulation", () => {
  const sim = outpost();
  sim.state.paused = true;
  sim.updateGame();
  assert.equal(sim.state.tick, 0);
});

// ---------- Difficulty ----------

test("a difficulty scales starting water, food and oxygen, and the crew's needs, but not the build budget", () => {
  const normal = outpost("normal"), martian = outpost("martian");
  const d = normal.DIFFICULTIES.martian;
  for (const k of ["water", "food", "oxygen"]) {
    assert.equal(martian.state.resources[k], Math.round(normal.state.resources[k] * d.start), k);
    assert.ok(Math.abs(martian.crewNeed(k) - normal.crewNeed(k) * d.needs) < 1e-12, k);
  }
  for (const k of ["materials", "credits", "power"]) assert.equal(martian.state.resources[k], normal.state.resources[k], k);
});

// ---------- Resources ----------

test("stored power never exceeds capacity, and a Battery Bank raises it", () => {
  const sim = outpost();
  const { state, POWER_CAPACITY, BUILDINGS } = sim;
  state.time = 0.5 * sim.SOL_SECONDS;
  state.resources.power = POWER_CAPACITY;
  sim.updateGame();
  assert.ok(state.resources.power <= POWER_CAPACITY);
  const t = state.tiles.find((t) => sim.canPlaceOn(t));
  buildNow(sim, "battery", t);
  sim.refreshFlows();
  assert.equal(state.powerCapacity, POWER_CAPACITY + BUILDINGS.battery.storage);
});

test("a resource's status turns to warning and critical as its time left runs short", () => {
  const sim = outpost();
  const { state } = sim;
  state.rates.water = -1;
  state.resources.water = 100;
  assert.equal(sim.resourceStatus("water"), "good");
  state.resources.water = 40;
  assert.equal(sim.resourceStatus("water"), "warn");
  state.resources.water = 10;
  assert.equal(sim.resourceStatus("water"), "crit");
  state.resources.water = 0;
  state.rates.water = 0;
  assert.equal(sim.resourceStatus("water"), "crit");
  assert.equal(sim.resourceStatus("materials"), "good");
});

test("each extra crew member makes every Science Lab CREW_SCIENCE_BONUS more productive", () => {
  const sim = outpost();
  const lab = sim.state.tiles.find((t) => t.building && t.building.type === "lab");
  const one = sim.outputMultiplier(lab);
  sim.addCrewMember();
  sim.addCrewMember();
  assert.ok(Math.abs(sim.outputMultiplier(lab) - one * (1 + 2 * sim.CREW_SCIENCE_BONUS)) < 1e-12);
});

test("terrain bonuses multiply output", () => {
  const sim = outpost();
  const { state, BUILDINGS } = sim;
  const t = state.tiles.find((t) => sim.canPlaceOn(t));
  buildNow(sim, "water", t);
  t.terrain = "regolith";
  const base = sim.outputMultiplier(t);
  t.terrain = "ice";
  assert.equal(sim.outputMultiplier(t), base * BUILDINGS.water.bonus.ice);
});
