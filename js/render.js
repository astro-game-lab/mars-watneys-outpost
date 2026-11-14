// Canvas rendering (tile drawing from tile-game-demo) + night, markers, crew.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const bg = new Image();
bg.src = "assets/mars3.png";

// Building sprites, keyed by building type.
const SPRITES = Object.fromEntries(BUILD_ORDER.map((k) => {
  const img = new Image();
  img.src = `sprites/${BUILDINGS[k].sprite}.svg`;
  return [k, img];
}));

// ---------- Layout ----------
// Pointy-top hexes in odd-r offset layout; js/hexmap.js has the grid itself.
const SQRT3 = Math.sqrt(3);
const view = { size: 40, originX: 0, originY: 0 };

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

const astronauts = [];

// Performance: everything that rarely changes (background, terrain, expansion
// outlines, reinforcement rings, building sprites) is drawn once into an
// off-screen "static layer" and only redrawn when its signature changes.
const staticLayer = document.createElement("canvas");
const sctx = staticLayer.getContext("2d");
let staticKey = "";

// Building sprites pre-rasterised to bitmaps at the current tile size,
// so SVGs aren't re-scaled on every draw.
const spriteCache = {};   // type -> { key, canvas, w, h }

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layoutView(w, h);
}

function hexPath(cx, cy, radius, c = ctx) {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.closePath();
}

function drawBackground(c, w, h) {
  if (!bg.complete || !bg.naturalWidth) {
    c.fillStyle = "#6b3a22";
    c.fillRect(0, 0, w, h);
    return;
  }
  const scale = Math.max(w / bg.naturalWidth, h / bg.naturalHeight);
  const dw = bg.naturalWidth * scale;
  const dh = bg.naturalHeight * scale;
  c.drawImage(bg, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

// Bitmap of a building sprite sized for the current hex size and DPR.
function spriteBitmap(type) {
  const img = SPRITES[type];
  if (!img.complete || !img.naturalWidth) return null;
  const dpr = window.devicePixelRatio || 1;
  const box = view.size * 1.6;
  const scale = Math.min(box / img.naturalWidth, box / img.naturalHeight);
  const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
  const key = `${w.toFixed(2)}x${dpr}`;
  let entry = spriteCache[type];
  if (!entry || entry.key !== key) {
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(w * dpr);
    cv.height = Math.ceil(h * dpr);
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    entry = spriteCache[type] = { key, canvas: cv, w, h };
  }
  return entry;
}

// A dusty Solar Array: its sprite with a rust-coloured film, one cached
// bitmap per 10% step of dust, so the static layer redraws rarely.
const DUST_STEPS = 10;
const dustCache = {};   // step -> { key, canvas }
const dustStep = (b) => Math.min(DUST_STEPS, Math.floor((b.dust || 0) * DUST_STEPS));

function dustyBitmap(sp, step) {
  let entry = dustCache[step];
  if (!entry || entry.key !== sp.key) {
    const cv = document.createElement("canvas");
    cv.width = sp.canvas.width;
    cv.height = sp.canvas.height;
    const c = cv.getContext("2d");
    c.drawImage(sp.canvas, 0, 0);
    c.globalCompositeOperation = "source-atop";   // tint only the sprite's own pixels
    c.fillStyle = `rgba(176, 104, 58, ${Math.min(0.75, step * 0.11)})`;
    c.fillRect(0, 0, cv.width, cv.height);
    entry = dustCache[step] = { key: sp.key, canvas: cv };
  }
  return entry.canvas;
}

// Static part of a tile: terrain, outline, expansion hint, berm, sprite.
function drawTileStatic(c, t) {
  const { x, y } = tileCenter(t);
  const size = view.size;

  hexPath(x, y, size, c);
  c.globalAlpha = t.terrain === "impassable" ? 0.55 : 0.2;
  c.fillStyle = TERRAIN[t.terrain].color;
  c.fill();
  c.globalAlpha = 1;
  c.lineWidth = 1;
  c.strokeStyle = "rgba(255, 235, 220, 0.35)";
  c.stroke();

  // Show where the outpost can expand
  if (!t.building && canPlaceOn(t)) {
    hexPath(x, y, size * 0.85, c);
    c.setLineDash([4, 4]);
    c.strokeStyle = "rgba(160, 255, 190, 0.45)";
    c.stroke();
    c.setLineDash([]);
  }

  if (t.building) {
    // Reinforced: a regolith berm around the hex edge
    if (t.building.reinforced) {
      hexPath(x, y, size * 0.9, c);
      c.lineWidth = Math.max(3, size * 0.1);
      c.strokeStyle = "rgba(150, 85, 45, 0.9)";
      c.stroke();
      c.lineWidth = 1;
    }
    const sp = spriteBitmap(t.building.type);
    const site = t.building.construct > 0;
    if (sp) {
      // A construction site shows the finished building, faint; its status
      // marker carries the progress (drawTileDynamic).
      c.globalAlpha = site ? 0.35 : t.building.disabled > 0 || t.building.priority === "off" ? 0.45 : 1;
      const step = dustStep(t.building);
      c.drawImage(step > 0 ? dustyBitmap(sp, step) : sp.canvas, x - sp.w / 2, y - sp.h / 2, sp.w, sp.h);
      c.globalAlpha = 1;
    }
  }
}

const TERRAIN_CODE = Object.fromEntries(Object.keys(TERRAIN).map((k, i) => [k, i]));
const BUILDING_CODE = Object.fromEntries(BUILD_ORDER.map((k, i) => [k, i]));

// Changes whenever anything drawn into the static layer would change,
// including the terrain, which differs between missions and seeds.
function staticSignature() {
  let sig = `${canvas.width}x${canvas.height}|${view.size}|${bg.complete && bg.naturalWidth ? 1 : 0}|`;
  for (const k of BUILD_ORDER) sig += SPRITES[k].naturalWidth ? 1 : 0;
  for (const t of state.tiles) {
    const b = t.building;
    sig += `${TERRAIN_CODE[t.terrain]}:`;
    sig += b ? `${BUILDING_CODE[b.type]}${b.reinforced ? "r" : ""}${b.disabled > 0 ? "d" : ""}${b.priority === "off" ? "o" : ""}${b.construct > 0 ? "c" : ""}${b.dust !== undefined ? `u${dustStep(b)}` : ""},` : ".,";
  }
  return sig;
}

function rebuildStaticLayer(w, h) {
  const dpr = window.devicePixelRatio || 1;
  if (staticLayer.width !== canvas.width || staticLayer.height !== canvas.height) {
    staticLayer.width = canvas.width;
    staticLayer.height = canvas.height;
  }
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackground(sctx, w, h);
  for (const t of state.tiles) drawTileStatic(sctx, t);
}

// Per-frame part of a tile: hover tint and status marker.
function drawTileDynamic(t) {
  const { x, y } = tileCenter(t);
  const size = view.size;
  if (t === state.hovered) {
    hexPath(x, y, size);
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = TERRAIN[t.terrain].color;
    ctx.fill();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (!t.building) return;
  // One status marker per building, top-right of its hex: the most pressing
  // first. Every crew job (construction, repair, cleaning, reinforcing) has a
  // ring around its marker showing how much of the work is done, from the
  // moment it's queued.
  const b = t.building, blue = "rgba(46, 90, 122, 0.9)";
  let mark = null, color = "rgba(180, 20, 20, 0.85)", progress = null;
  if (b.construct > 0) { mark = "🔨"; color = "rgba(120, 72, 30, 0.9)"; progress = jobProgress(b, "construct"); }
  else if (b.disabled > 0) { mark = "🔧"; progress = jobProgress(b, "repair"); }
  else if (b.type === "greenhouse" && b.tempK < FROST_K) { mark = "❄️"; color = blue; }
  else if (b.tempK < COLD_K) { mark = "🥶"; color = blue; }
  else if (b.cleaning > 0) { mark = "🧹"; color = blue; progress = jobProgress(b, "clean"); }
  else if (b.reinforcing > 0) { mark = "🧱"; color = "rgba(150, 85, 45, 0.9)"; progress = jobProgress(b, "reinforce"); }
  else if (t.building.priority === "off") { mark = "OFF"; color = "rgba(60, 60, 60, 0.9)"; }
  else if (t.building.level !== undefined && t.building.level < 0.99) mark = "⚡";
  if (mark) {
    const text = mark === "OFF";   // plain text needs its own colour; emoji bring theirs
    const mx = x + size * 0.5, my = y - size * 0.5, r = size * 0.28;
    ctx.font = text ? `bold ${Math.round(size * 0.2)}px system-ui` : `${Math.round(size * 0.45)}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fill();
    if (progress !== null) {
      // The ring: a dark track, and the work done so far, clockwise from the top.
      const ringR = r + size * 0.07;
      ctx.lineWidth = Math.max(2, size * 0.07);
      ctx.beginPath();
      ctx.arc(mx, my, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(mx, my, ringR, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.strokeStyle = "rgba(242, 140, 40, 0.95)";
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    if (text) ctx.fillStyle = "#fff";
    ctx.fillText(mark, x + size * 0.5, y - size * (text ? 0.5 : 0.48));
  }
}

function drawHighlight(t, color, width, glow) {
  const { x, y } = tileCenter(t);
  hexPath(x, y, view.size - width / 2);
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();
}

// Crew members wander between buildings. Walker 0 is Watney. Purely cosmetic,
// with its own generator so it can never change what the simulation draws.
const CREW_SPRITES = ["👨‍🚀", "👩‍🚀"];  // avoid 🧑‍🚀: not supported by older emoji fonts
const crewRng = createRng(0x5eed);

function updateAstronauts(dt) {
  const list = buildings();
  if (!list.length) return;
  const pick = () => list[Math.floor(rngNext(crewRng) * list.length)];
  // One figure per crew member: those who've left disappear, and new arrivals
  // appear at a habitat (or any building).
  const here = new Set(state.crewMembers.map((m) => m.arrival));
  for (let i = astronauts.length - 1; i >= 0; i--) if (!here.has(astronauts[i].arrival)) astronauts.splice(i, 1);
  for (const m of state.crewMembers) {
    if (astronauts.some((a) => a.arrival === m.arrival)) continue;
    const home = list.find((t) => t.building.type === "habitat") || list[0];
    const c = tileCenter(home);
    astronauts.push({ arrival: m.arrival, x: c.x, y: c.y + view.size * 0.45, target: null, wait: 0 });
  }

  const jobOf = new Map(state.crewMembers.map((m) => [m.arrival, m.job]));
  for (const a of astronauts) {
    const job = jobOf.get(a.arrival);
    if (job) { a.target = state.tiles[job.tile]; a.wait = 0.5; }   // off to work
    else if (!a.target || !a.target.building) a.target = pick();
    const c = tileCenter(a.target);
    const tx = c.x, ty = c.y + view.size * 0.45;
    const dx = tx - a.x, dy = ty - a.y;
    const dist = Math.hypot(dx, dy);
    const speed = view.size * 0.9 * dt;
    if (dist > speed) {
      a.x += (dx / dist) * speed;
      a.y += (dy / dist) * speed;
    } else if (!job && (a.wait -= dt) <= 0) {
      a.wait = 1.5 + rngNext(crewRng) * 2;
      a.target = pick();
    }
  }
}

function drawAstronauts(time) {
  ctx.font = `${Math.round(view.size * 0.55)}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 4;
  for (const a of astronauts) {
    const bob = Math.sin(time * 8 + a.arrival * 1.7) * 1.5;
    ctx.fillText(CREW_SPRITES[a.arrival % CREW_SPRITES.length], a.x, a.y + bob);
  }
  ctx.shadowBlur = 0;
}

function drawNight(w, h) {
  // Sun elevation: smooth curve peaking at midday (t = 0.5)
  const t = solTime();
  const elev = Math.max(0, Math.sin(((t - 0.2) / 0.65) * Math.PI));
  const dark = (1 - elev) * 0.5 + (hasEffect("dust") ? 0.15 : 0);
  if (dark > 0.01) {
    ctx.fillStyle = `rgba(10, 12, 40, ${dark})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (hasEffect("dust")) {
    ctx.fillStyle = "rgba(190, 120, 60, 0.18)";
    ctx.fillRect(0, 0, w, h);
  }
}

function render(time) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const key = staticSignature();
  if (key !== staticKey) {
    rebuildStaticLayer(w, h);
    staticKey = key;
  }
  ctx.drawImage(staticLayer, 0, 0, w, h);
  for (const t of state.tiles) drawTileDynamic(t);
  drawNight(w, h);
  drawAstronauts(time);
  if (tipPulse && performance.now() < tipPulse.until && tipPulse.tile.terrain) {
    const a = 0.45 + 0.45 * Math.sin(time * 6);
    drawHighlight(tipPulse.tile, `rgba(255, 210, 122, ${a.toFixed(2)})`, 4, 20);
  }
  if (state.selected) drawHighlight(state.selected, "#ffd27a", 3, 14);
  if (state.hovered && state.hovered !== state.selected) drawHighlight(state.hovered, "#ffffff", 2, 12);
}
