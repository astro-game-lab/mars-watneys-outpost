// Loads the simulation into a fresh, empty JavaScript context: the same classic
// scripts the browser loads, in index.html order, with no DOM, no timers and no
// Node APIs. If a simulation file reaches for `document`, `Image`, `say()` or
// anything else outside the simulation, loading or stepping it throws.
//
//   const sim = loadSim();
//   sim.createState(sim.missionById("first-night"), 1101, "normal");
//   sim.updateGame();
//   sim.state.resources.power
//
// Every property of `sim` is looked up by name inside the context, so it sees
// top-level `let` and `const` bindings (like `state`) as well as functions.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The simulation's files, in the order index.html loads them.
export const SIM_FILES = ["data", "missions", "rng", "hexmap", "state", "events", "simulation"]
  .map((f) => `js/${f}.js`);

export function loadSim() {
  const ctx = vm.createContext({});
  for (const file of SIM_FILES) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx, { filename: file });
  }
  return new Proxy({}, { get: (_, name) => vm.runInContext(String(name), ctx) });
}

// The simulation's objects belong to another realm, so compare them as JSON.
export const snapshot = (value) => JSON.stringify(value);
