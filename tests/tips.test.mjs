// Watney's tips (TIPS in js/data.js): each fires in the situation it's about,
// and checking them never changes the simulation.

import test from "node:test";
import assert from "node:assert/strict";
import { buildNow } from "./helpers.mjs";
import { loadSim, snapshot } from "./load-sim.mjs";
import { play } from "./bot.mjs";
import { STRATEGIES } from "./strategies.mjs";

// The Outpost at midday, events off, with plenty of everything.
function calm() {
  const sim = loadSim();
  sim.createState({ ...sim.missionById("the-outpost"), events: null }, 1, "normal");
  const { state } = sim;
  for (const k of Object.keys(state.resources)) state.resources[k] = 1000;
  state.time = 0.5 * sim.SOL_SECONDS;
  sim.refreshFlows();
  return sim;
}
const tip = (sim, id) => sim.TIPS.find((t) => t.id === id);
const fires = (sim, id) => tip(sim, id).when(sim.state);
const first = (sim, type) => sim.state.tiles.find((t) => t.building && t.building.type === type);

test("every tip has an id, a check and a text, and the ids are unique", () => {
  const { TIPS } = loadSim();
  const ids = TIPS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of TIPS) assert.ok(t.id && typeof t.when === "function" && t.text, t.id);
});

const cases = {
  nightPower: (sim) => { sim.state.time = 0.1 * sim.SOL_SECONDS; sim.state.resources.power = 30; sim.refreshFlows(); },
  iceNearby: (sim) => {
    const [ice] = sim.tilesNearOutpost(2).filter((t) => t.terrain !== "ice");
    ice.terrain = "ice";
    return ice;
  },
  flareShield: (sim) => { sim.addEffect("flare", "flare", 20); sim.state.radiation = 60; },
  dustyPanels: (sim) => { const t = first(sim, "solar"); t.building.dust = 0.4; return t; },
  noBed: (sim) => { while (sim.state.crew < sim.state.crewCapacity) sim.addCrewMember(); sim.state.nextArrivalSol = sim.state.sol + 1; },
  highDose: (sim) => { sim.state.crewMembers[0].dose = 0.6 * sim.DOSE_LIMIT; },
  repairWaiting: (sim) => { const t = first(sim, "lab"); sim.startJob(t, "repair", 10); return t; },
  jobsPiling: (sim) => { sim.state.jobsWaiting = 3; },
  noMine: (sim) => { sim.state.resources.materials = 10; },
  greenhouseCold: (sim) => {
    const t = sim.state.tiles.find((x) => !sim.buildBlocker("greenhouse", x));
    buildNow(sim, "greenhouse", t);
    t.building.tempK = sim.FROST_K + 5;
    return t;
  },
  habitatCooling: (sim) => {
    const t = first(sim, "habitat");
    t.building.tempK = sim.SETPOINT_K - 6;
    sim.state.crewMembers[0].bed = sim.state.tiles.indexOf(t);
    return t;
  },
};

test("every tip has a test case", () => {
  assert.deepEqual([...loadSim().TIPS.map((t) => t.id)].sort(), Object.keys(cases).sort());
});

for (const [id, arrange] of Object.entries(cases)) {
  test(`the ${id} tip fires when it should, and not before`, () => {
    const sim = calm();
    // Clear the ground for tips about the map, so the "before" is clean.
    if (id === "iceNearby") for (const t of sim.tilesNearOutpost(2)) if (t.terrain === "ice") t.terrain = "regolith";
    assert.ok(!fires(sim, id), "fired before the situation was set up");
    const expectedTile = arrange(sim);
    const hit = fires(sim, id);
    assert.ok(hit, "didn't fire");
    if (expectedTile) assert.equal(hit, expectedTile, "pointed at the wrong tile");
    const t = tip(sim, id);
    const text = typeof t.text === "function" ? t.text(hit === true ? null : hit) : t.text;
    assert.ok(typeof text === "string" && text.length > 20);
  });
}

test("the priority advice is left out where priorities are turned off", () => {
  const sim = loadSim();
  sim.createState(sim.missionById("first-night"), 1101, "normal");
  const text = tip(sim, "nightPower").text(null);
  assert.ok(!/priority|Low/.test(text), text);
});

test("checking every tip, every step, changes nothing in the simulation", () => {
  const args = { mission: "the-outpost", seed: 3, moves: STRATEGIES["the-outpost"].win, maxTicks: 6000 };
  const plain = play(args).state;
  const checked = play({ ...args, afterStep: (sim) => { for (const t of sim.TIPS) t.when(sim.state); } }).state;
  const strip = (s) => snapshot({ ...s, mission: s.mission.id });
  assert.equal(strip(checked), strip(plain));
});
