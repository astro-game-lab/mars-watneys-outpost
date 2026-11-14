// A scripted player. A strategy is a list of moves, done in order. The next
// move waits until it's allowed and affordable, the way a player saves up, so a
// strategy reads like a build order rather than a timetable.
//
//   { build: "solar" }                       any tile next to the outpost
//   { build: "water", prefer: ["ice"] }      the best tile of these terrains, if any is free
//   { build: "mine", toward: [9, 3] }        the free tile closest to a target tile
//   { build: "lab", at: [5, 3] }             exactly this tile
//   { reinforce: "habitat" }                 the first unreinforced building of a type
//   { wait: 1200 }                           do nothing until this tick
//
// A move may also carry `after: tick` to hold it back until that tick.
// Tile choice is deterministic: the same strategy on the same seed makes the
// same moves, so a strategy is a reproducible playthrough.

import { loadSim } from "./load-sim.mjs";

// Odd-r offset to cube coordinates, for hex distance.
function cube(col, row) {
  const x = col - (row - (row & 1)) / 2;
  return [x, row, -x - row];
}
export function hexDistance(a, b) {
  const [ax, ay, az] = cube(a.col, a.row);
  const [bx, by, bz] = cube(b.col, b.row);
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}

function chooseTile(sim, move) {
  const { state, BUILDINGS } = sim;
  const type = move.build;
  if (move.at) {
    const t = sim.tileAt(move.at[0], move.at[1]);
    return t && !sim.buildBlocker(type, t) ? t : null;
  }
  const free = state.tiles.filter((t) => !sim.buildBlocker(type, t));
  if (!free.length) return null;
  const bonus = BUILDINGS[type].bonus || {};
  const target = move.toward && { col: move.toward[0], row: move.toward[1] };
  const centre = { col: Math.floor(sim.COLS / 2) - 1, row: Math.floor(sim.ROWS / 2) };
  const score = (t) => [
    move.prefer && move.prefer.includes(t.terrain) ? 0 : 1,
    -(bonus[t.terrain] || 1),
    target ? hexDistance(t, target) : 0,
    hexDistance(t, centre),
  ];
  const better = (a, b) => {
    const sa = score(a), sb = score(b);
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sa[i] < sb[i];
    return false; // ties keep the earlier tile
  };
  return free.reduce((best, t) => (better(t, best) ? t : best));
}

// Try the move now. Returns true once it's done.
function tryMove(sim, move) {
  const { state } = sim;
  if (move.after !== undefined && state.tick < move.after) return false;
  if (move.wait !== undefined) return state.tick >= move.wait;
  if (move.build) {
    if (!sim.canAfford(move.build)) return false;
    const t = chooseTile(sim, move);
    return !!t && sim.build(move.build, t);
  }
  if (move.reinforce) {
    const t = state.tiles.find((t) => t.building && t.building.type === move.reinforce && !t.building.reinforced);
    return !!t && sim.reinforce(t);
  }
  throw new Error(`unknown move ${JSON.stringify(move)}`);
}

// Play a mission to its end, or until maxTicks. `override` replaces fields of
// the mission (say, `{ events: null }`). `beforeStep` and `afterStep` are called
// around every simulation step. Returns the simulation, so the caller can read
// its final state.
export function play({
  mission, seed, difficulty = "normal", moves = [], maxTicks = 20000,
  override, beforeStep, afterStep, sim = loadSim(),
}) {
  const base = sim.missionById(mission);
  const m = override ? { ...base, ...override } : base;
  sim.createState(m, seed ?? m.seed ?? 1, difficulty);
  const { state } = sim;
  let next = 0;
  while (!state.over && state.tick < maxTicks) {
    while (next < moves.length && tryMove(sim, moves[next])) next++;
    beforeStep?.(sim);
    sim.updateGame();
    afterStep?.(sim);
    state.outbox.length = 0;
  }
  return { sim, state, movesDone: next };
}
