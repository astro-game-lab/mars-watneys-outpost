// Campaign progress (js/screens.js): what's saved, what unlocks, and what a
// damaged or missing save falls back to.

import test from "node:test";
import assert from "node:assert/strict";
import { loadUi } from "./load-ui.mjs";

const KEY = "mwo-progress-v1";
const saved = (progress) => ({ [KEY]: JSON.stringify(progress) });

test("a first visit starts at the first mission, on Normal, with tips on", () => {
  const ui = loadUi();
  const p = ui.progress;
  assert.equal(p.seenIntro, false);
  assert.equal(p.last, ui.MISSIONS[0].id);
  assert.equal(p.difficulty, "normal");
  assert.equal(p.tips, true);
  assert.equal(ui.missionUnlocked(0), true);
  assert.equal(ui.missionUnlocked(1), false);
});

test("a damaged save, or an unknown difficulty, falls back to the defaults", () => {
  assert.equal(loadUi({ storage: { [KEY]: "{not json" } }).progress.seenIntro, false);
  assert.equal(loadUi({ storage: saved({ difficulty: "impossible" }) }).progress.difficulty, "normal");
});

test("winning a mission unlocks the next, and is saved", () => {
  const ui = loadUi();
  ui.recordWin(ui.MISSIONS[0].id, "normal");
  assert.equal(ui.missionUnlocked(1), true);
  assert.equal(ui.missionUnlocked(2), false);
  const again = loadUi({ storage: Object.fromEntries(ui.storage) });
  assert.equal(again.missionUnlocked(1), true);
});

test("a mission added mid-campaign doesn't lock the ones after it", () => {
  const ui = loadUi({ storage: saved({ won: { [/* the last */ "the-outpost"]: "normal" } }) });
  for (let i = 0; i < ui.MISSIONS.length; i++) assert.equal(ui.missionUnlocked(i), true, ui.MISSIONS[i].id);
});

test("a win is recorded at the hardest difficulty it was won on", () => {
  const ui = loadUi();
  const id = ui.MISSIONS[0].id;
  ui.recordWin(id, "hard");
  ui.recordWin(id, "normal");
  assert.equal(ui.progress.won[id], "hard");
  ui.recordWin(id, "martian");
  assert.equal(ui.progress.won[id], "martian");
});

test("difficulty tiers apply only once the campaign is complete", () => {
  const before = loadUi({ storage: saved({ difficulty: "martian" }) });
  assert.equal(before.campaignComplete(), false);
  assert.equal(before.chosenDifficulty(), "normal");
  const after = loadUi({ storage: saved({ difficulty: "martian", won: { "the-outpost": "normal" } }) });
  assert.equal(after.campaignComplete(), true);
  assert.equal(after.chosenDifficulty(), "martian");
});
