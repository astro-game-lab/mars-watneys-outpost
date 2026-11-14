// The end screen's debrief: a loss names its cause, and its advice is true for
// the mission being played.

import test from "node:test";
import assert from "node:assert/strict";
import { loadUi } from "./load-ui.mjs";

// A mission that's just been lost to running out of one need.
function lostTo(mission, need) {
  const ui = loadUi();
  ui.createState(ui.missionById(mission), ui.missionById(mission).seed ?? 1, "normal");
  ui.state.stats.damage[need] = 100;
  ui.state.stats.firstEmpty[need] = ui.state.time;
  ui.state.stats.lost = { name: "Watney", time: ui.state.time };
  return ui.lossDebrief("health");
}

test("an oxygen loss advises what makes oxygen in that mission", () => {
  const usual = lostTo("the-outpost", "oxygen");
  assert.match(usual.hints[0], /Habitats make oxygen/);
  // Thin Air's Habitats make no oxygen: the advice has to point at the Oxygen Plant.
  const thin = lostTo("thin-air", "oxygen");
  assert.doesNotMatch(thin.hints[0], /Habitats make oxygen/);
  assert.match(thin.hints[0], /Oxygen Plant/);
});

test("a water loss names only buildings that drink in that mission", () => {
  assert.match(lostTo("the-outpost", "water").hints[0], /Habitats and Greenhouses/);
  assert.doesNotMatch(lostTo("thin-air", "water").hints[0], /Habitats/);
});
