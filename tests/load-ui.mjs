// Loads the simulation plus the UI's logic (js/ui.js and js/screens.js) into a
// fresh context with a stand-in DOM, so the text and rules the UI owns can be
// tested without a browser: objective labels, debriefs, saved progress,
// mission unlocks. Drawing (js/render.js) and the frame loop (js/main.js) are
// left out; play them in a browser.
//
//   const ui = loadUi();
//   ui.createState(ui.missionById("thin-air"), 2601, "normal");
//   ui.lossDebrief("health").hints
//
// `storage` seeds localStorage, as a map of key to string.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT, SIM_FILES } from "./load-sim.mjs";

export const UI_FILES = ["js/ui.js", "js/screens.js"];

// An element that accepts whatever the UI does to it.
function fakeElement(id) {
  return {
    id, hidden: true, innerHTML: "", textContent: "", className: "", disabled: false, title: "",
    style: {}, dataset: {}, children: [],
    addEventListener() {}, focus() {}, prepend() {}, remove() {},
    querySelector: () => fakeElement(), querySelectorAll: () => [],
  };
}

export function loadUi({ storage = {} } = {}) {
  const elements = new Map();
  const store = new Map(Object.entries(storage));
  const ctx = vm.createContext({
    document: {
      getElementById: (id) => elements.get(id) ?? elements.set(id, fakeElement(id)).get(id),
      createElement: () => fakeElement(),
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    performance: { now: () => 0 },
  });
  for (const file of [...SIM_FILES, ...UI_FILES]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx, { filename: file });
  }
  const ui = new Proxy({}, { get: (_, name) => vm.runInContext(String(name), ctx) });
  return Object.assign(Object.create(ui), { $el: (id) => ctx.document.getElementById(id), storage: store });
}
