// Per-crew health and cumulative radiation dose. docs/PHYSICS.md § What is
// modelled, "Health" and "Radiation dose".

import test from "node:test";
import assert from "node:assert/strict";
import { play } from "./bot.mjs";
import { loadSim } from "./load-sim.mjs";
import { STRATEGIES } from "./strategies.mjs";

const EPS = 1e-9;
const { MISSIONS } = loadSim();

// A mission with events off, a crew of `crew`, and the outpost kept alive.
function setUp({ crew = 3, radiation } = {}) {
  const sim = loadSim();
  const m = sim.missionById("the-outpost");
  sim.createState({ ...m, events: null, start: { crew } }, 1, "normal");
  if (radiation !== undefined) sim.state.radiation = radiation;
  return sim;
}

test("the crew count always matches the crew list, and health never exceeds a member's maximum", () => {
  for (const m of MISSIONS) {
    let steps = 0;
    play({
      mission: m.id, seed: m.seed ?? 5, difficulty: "martian", moves: STRATEGIES[m.id].warned.moves, maxTicks: 12000,
      afterStep: (sim) => {
        const { state } = sim;
        assert.equal(state.crew, state.crewMembers.length, `${m.id}, tick ${state.tick}`);
        for (const c of state.crewMembers) {
          assert.ok(c.health <= sim.maxHealth(c) + EPS, `${m.id}: ${c.name} at ${c.health} of ${sim.maxHealth(c)}`);
        }
        steps++;
      },
    });
    assert.ok(steps > 100, m.id);
  }
});

test("maximum health falls steadily with dose, from 100 to MIN_MAX_HEALTH at the limit", () => {
  const sim = setUp();
  const c = sim.state.crewMembers[1];
  let last = Infinity;
  for (let i = 0; i <= 100; i++) {
    c.dose = (i / 100) * sim.DOSE_LIMIT;
    const max = sim.maxHealth(c);
    assert.ok(max < last || i === 0);
    last = max;
  }
  c.dose = 0;
  assert.equal(sim.maxHealth(c), 100);
  c.dose = sim.DOSE_LIMIT;
  assert.equal(sim.maxHealth(c), sim.MIN_MAX_HEALTH);
});

test("dose builds up at exposure / 100 a second, for every member alike", () => {
  const sim = setUp();
  sim.state.resources.water = sim.state.resources.food = sim.state.resources.oxygen = 1e6;
  for (let i = 0; i < 400; i++) sim.updateGame();
  const exposure = sim.state.radiation;   // constant here: no events, no new buildings
  for (const c of sim.state.crewMembers) {
    assert.ok(Math.abs(c.dose - (exposure / 100) * 400 * sim.SIM_STEP) < 1e-6, `${c.name}: ${c.dose}`);
  }
});

test("a member goes home exactly when their dose reaches the limit", () => {
  const sim = setUp();
  const { state } = sim;
  state.resources.water = state.resources.food = state.resources.oxygen = 1e6;
  const okafor = state.crewMembers[1];
  okafor.dose = sim.DOSE_LIMIT - 1e-6;
  sim.updateGame();
  assert.equal(state.crew, 2);
  assert.ok(!state.crewMembers.includes(okafor));
  assert.equal(state.stats.left[0].name, okafor.name);
  assert.equal(state.over, null);
});

test("when Watney reaches the dose limit, the mission is over", () => {
  const sim = setUp();
  const { state } = sim;
  state.resources.water = state.resources.food = state.resources.oxygen = 1e6;
  state.crewMembers[0].dose = sim.DOSE_LIMIT - 1e-6;
  sim.updateGame();
  assert.equal(state.over, "lose");
  assert.equal(state.endCause, "dose");
});

test("one crew member dying loses the mission, and the debrief knows who", () => {
  const sim = setUp();
  const { state } = sim;
  state.resources.water = state.resources.food = state.resources.oxygen = 1e6;
  state.crewMembers[2].health = 0.001;
  state.resources.food = 0;     // no Greenhouse here, so this harms everyone a little
  for (let i = 0; i < 5 && !state.over; i++) sim.updateGame();
  assert.equal(state.over, "lose");
  assert.equal(state.endCause, "health");
  assert.equal(state.stats.lost.name, state.crewMembers[2].name);
});

test("the most-dosed member is the first to die in a shortage", () => {
  const sim = setUp();
  const { state } = sim;
  // 60% of the limit: a lower maximum, but far enough from the limit that
  // they don't go home before the shortage takes its toll.
  state.crewMembers[1].dose = 0.6 * sim.DOSE_LIMIT;
  for (const c of state.crewMembers) c.health = sim.maxHealth(c);
  state.resources.food = 0;
  for (let i = 0; i < 4000 && !state.over; i++) sim.updateGame();
  assert.equal(state.stats.lost.name, state.crewMembers[1].name);
});

test("a name isn't reused after someone leaves", () => {
  const sim = setUp({ crew: 2 });
  const { state } = sim;
  const first = state.crewMembers[1].name;
  sim.removeCrewMember(state.crewMembers[1]);
  const next = sim.addCrewMember();
  assert.notEqual(next.name, first);
});
