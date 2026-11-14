// The HUD tells the player what the simulation is doing.

import test from "node:test";
import assert from "node:assert/strict";
import { loadUi } from "./load-ui.mjs";

function at(mission, solFraction, setup) {
  const ui = loadUi();
  const m = ui.missionById(mission);
  ui.createState({ ...m, events: null }, m.seed ?? 1, "normal");
  ui.state.time = solFraction * ui.SOL_SECONDS;
  setup?.(ui);
  ui.refreshFlows();
  ui.updateHud();
  return ui;
}

test("the clock's solar share is what a clean array makes, as a share of its rating", () => {
  for (const [mission, fraction, setup] of [
    ["the-outpost", 0.5], ["the-outpost", 0.3], ["the-outpost", 0.9],
    ["the-outpost", 0.5, (ui) => ui.addEffect("dust", "dust", 30)],
    ["long-night", 0.5],
  ]) {
    const ui = at(mission, fraction, setup);
    const solar = ui.state.tiles.find((t) => t.building && t.building.type === "solar");
    const expected = Math.round(100 * ui.outputMultiplier(solar));
    assert.equal(ui.$el("solar-pct").textContent, `Solar ${expected}%`, `${mission} at ${fraction}`);
  }
  assert.equal(at("long-night", 0.5).$el("solar-pct").textContent, "Solar 60%");
});
