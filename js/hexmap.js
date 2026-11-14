// Hex map: pointy-top hexes in "odd-r" offset layout (from tile-game-demo).
// The terrain generator uses the mission's seeded generator (js/rng.js).
// Pixel layout and picking are drawing concerns, so they live in js/render.js.

// Terrain from a handmade map (rows of TERRAIN_CHARS), or drawn from the
// mission's seeded generator.
function createTiles(rng, map) {
  const tiles = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const terrain = map ? TERRAIN_CHARS[map[row][col]] : pickWeighted(rng, TERRAIN_WEIGHTS);
      tiles.push({ col, row, terrain, building: null });
    }
  }
  return tiles;
}

function tileAt(col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return null;
  return state.tiles[row * COLS + col];
}

// Odd-r offset neighbours: odd rows are shifted right by half a hex.
function neighbors(t) {
  const d = t.row & 1
    ? [[1, 0], [-1, 0], [0, -1], [1, -1], [0, 1], [1, 1]]
    : [[1, 0], [-1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]];
  return d.map(([dc, dr]) => tileAt(t.col + dc, t.row + dr)).filter(Boolean);
}

// True if all occupied tiles (other than `removed`) form one connected group.
function staysConnected(removed) {
  const occupied = state.tiles.filter((t) => t.building && t !== removed);
  if (!occupied.length) return false; // never remove the last building
  const seen = new Set([occupied[0]]);
  const stack = [occupied[0]];
  while (stack.length) {
    for (const n of neighbors(stack.pop())) {
      if (n.building && n !== removed && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return seen.size === occupied.length;
}

// Empty, passable tile adjacent to the outpost network.
function canPlaceOn(t) {
  if (!t || t.building || t.terrain === "impassable") return false;
  return neighbors(t).some((n) => n.building);
}

function canDemolish(t) {
  return !!t && !!t.building && staysConnected(t);
}
