// Hex map: pointy-top hexes in "odd-r" offset layout (from tile-game-demo).

const SQRT3 = Math.sqrt(3);
const view = { size: 40, originX: 0, originY: 0 };

function randomTerrain() {
  const total = TERRAIN_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let n = Math.random() * total;
  for (const [key, w] of TERRAIN_WEIGHTS) {
    if ((n -= w) < 0) return key;
  }
  return "regolith";
}

function createTiles() {
  const tiles = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      tiles.push({ col, row, terrain: randomTerrain(), building: null });
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

function tileCenter(t) {
  return {
    x: view.originX + SQRT3 * view.size * (t.col + 0.5 * (t.row & 1)),
    y: view.originY + 1.5 * view.size * t.row,
  };
}

// Pixel -> axial (fractional) -> cube round -> odd-r offset.
function tileFromPixel(x, y) {
  const px = x - view.originX;
  const py = y - view.originY;
  const q = ((SQRT3 / 3) * px - (1 / 3) * py) / view.size;
  const r = ((2 / 3) * py) / view.size;
  const s = -q - r;

  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;

  const col = rq + (rr - (rr & 1)) / 2;
  return tileAt(col, rr);
}

// Fit the grid into the area left of the side panels.
function layoutView(w, h) {
  const left = Math.min(300, w * 0.3);
  const availW = w - left - 20;
  const gridW = SQRT3 * (COLS + 0.5);
  const gridH = 1.5 * (ROWS - 1) + 2;
  view.size = Math.min((availW * 0.95) / gridW, (h * 0.85) / gridH);
  view.originX = left + (availW - gridW * view.size) / 2 + (SQRT3 / 2) * view.size;
  view.originY = (h - gridH * view.size) / 2 + view.size;
}
