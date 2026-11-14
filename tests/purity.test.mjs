// The simulation is pure: no wall clock, no unseeded randomness, no DOM.
// The loader already proves the last one, since it runs the files in an empty
// context. This catches the rest, including calls on paths no test reaches.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, SIM_FILES, loadSim } from "./load-sim.mjs";

const FORBIDDEN = [
  [/\bMath\.random\b/, "Math.random: use rand() or a seeded generator"],
  [/\bDate\b/, "Date: simulation time is state.time, never the clock"],
  [/\bperformance\b/, "performance: the simulation never reads the clock"],
  [/\b(requestAnimationFrame|setTimeout|setInterval)\b/, "timers: updateGame() advances one fixed step"],
  [/\b(document|window|localStorage|crypto|navigator|location)\s*[.[]/, "browser APIs belong in the UI"],
  [/\bnew\s+(Image|Audio|Worker)\b/, "browser APIs belong in the UI"],
  [/\b(say|sayOnce|endGame|selectTile|updateHud)\s*\(/, "UI calls: queue a message with emit() or set state.over"],
];

// Comments may mention any of these, so strip them first.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

for (const file of SIM_FILES) {
  test(`${file} uses no clock, unseeded randomness, browser API or UI call`, () => {
    const src = code(fs.readFileSync(path.join(ROOT, file), "utf8"));
    for (const [pattern, why] of FORBIDDEN) {
      const line = src.split("\n").findIndex((l) => pattern.test(l));
      assert.equal(line, -1, `${file}:${line + 1}: ${why}`);
    }
  });
}

test("the simulation loads and steps in an empty context", () => {
  const sim = loadSim();
  sim.createState(sim.missionById("the-outpost"), 1, "normal");
  for (let i = 0; i < 2000; i++) sim.updateGame();
  assert.ok(sim.state.outbox.length > 0, "expected queued messages");
});
