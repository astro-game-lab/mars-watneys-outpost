// The side panel follows the selected tile: when what the tile needs changes
// under an open panel, the panel is drawn again.

import test from "node:test";
import assert from "node:assert/strict";
import { loadUi } from "./load-ui.mjs";

function outpost() {
  const ui = loadUi();
  ui.createState({ ...ui.missionById("the-outpost"), events: null }, 1, "normal");
  ui.refreshFlows();
  return ui;
}

test("a site's panel becomes the building's panel when construction finishes", () => {
  const ui = outpost();
  const t = ui.state.tiles.find((t) => ui.canPlaceOn(t));
  assert.ok(ui.build("solar", t));
  ui.selectTile(t);
  assert.match(ui.$el("panel").innerHTML, /under construction/);
  while (t.building.construct > 0) ui.updateGame();
  ui.updatePanelLive();
  const html = ui.$el("panel").innerHTML;
  assert.doesNotMatch(html, /under construction|data-act="cancel"/);
  assert.match(html, /data-act="demolish"/);
  assert.match(html, /data-act="clean"/);
});

test("an empty tile's panel stops offering to build once nothing connects it", () => {
  const ui = outpost();
  const { state } = ui;
  // A site on the edge of the outpost, and a free tile that only it connects.
  let site, lonely;
  for (const s of state.tiles.filter((t) => ui.canPlaceOn(t))) {
    lonely = ui.neighbors(s).find((n) => !n.building && n.terrain !== "impassable" &&
      ui.neighbors(n).every((m) => !m.building));
    if (lonely) { site = s; break; }
  }
  assert.ok(ui.build("solar", site));
  ui.selectTile(lonely);
  assert.match(ui.$el("panel").innerHTML, /Build/);
  assert.ok(ui.cancel(site));
  ui.updatePanelLive();
  assert.match(ui.$el("panel").innerHTML, /Too far from the outpost/);
});

test("a construction site's priority can be set before it's finished, and it holds", () => {
  const ui = outpost();
  const t = ui.state.tiles.find((t) => !ui.buildBlocker("lab", t));
  assert.ok(ui.build("lab", t));
  ui.selectTile(t);
  assert.match(ui.$el("panel").innerHTML, /data-act="priority" data-key="off"/);
  assert.ok(ui.setPriority(t, "off"));
  while (t.building.construct > 0) ui.updateGame();
  assert.equal(t.building.priority, "off");
});
