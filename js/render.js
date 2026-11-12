// Canvas rendering (tile drawing from tile-game-demo) + night, markers, crew.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const bg = new Image();
bg.src = "assets/mars3.png";

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
  const img = BUILDINGS[type].img;
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
    if (sp) {
      c.globalAlpha = t.building.disabled > 0 ? 0.45 : 1;
      c.drawImage(sp.canvas, x - sp.w / 2, y - sp.h / 2, sp.w, sp.h);
      c.globalAlpha = 1;
    }
  }
}

// Changes whenever anything drawn into the static layer would change.
function staticSignature() {
  let sig = `${canvas.width}x${canvas.height}|${view.size}|${bg.complete && bg.naturalWidth ? 1 : 0}|`;
  for (const k of BUILD_ORDER) sig += BUILDINGS[k].img.naturalWidth ? 1 : 0;
  for (const t of state.tiles) {
    const b = t.building;
    sig += b ? `${b.type[0]}${b.type[1]}${b.reinforced ? "r" : ""}${b.disabled > 0 ? "d" : ""},` : ".";
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
  let mark = null;
  if (t.building.disabled > 0) mark = "🔧";
  else if (t.building.level !== undefined && t.building.level < 0.99) mark = "⚡";
  if (mark) {
    ctx.font = `${Math.round(size * 0.45)}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(180, 20, 20, 0.85)";
    ctx.beginPath();
    ctx.arc(x + size * 0.5, y - size * 0.5, size * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(mark, x + size * 0.5, y - size * 0.48);
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
  // New arrivals appear at a habitat (or any building).
  while (astronauts.length < state.crew) {
    const home = list.find((t) => t.building.type === "habitat") || list[0];
    const c = tileCenter(home);
    astronauts.push({ x: c.x, y: c.y + view.size * 0.45, target: null, wait: 0 });
  }
  astronauts.length = Math.min(astronauts.length, state.crew);

  for (const a of astronauts) {
    if (!a.target || !a.target.building) a.target = pick();
    const c = tileCenter(a.target);
    const tx = c.x, ty = c.y + view.size * 0.45;
    const dx = tx - a.x, dy = ty - a.y;
    const dist = Math.hypot(dx, dy);
    const speed = view.size * 0.9 * dt;
    if (dist > speed) {
      a.x += (dx / dist) * speed;
      a.y += (dy / dist) * speed;
    } else if ((a.wait -= dt) <= 0) {
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
  astronauts.forEach((a, i) => {
    const bob = Math.sin(time * 8 + i * 1.7) * 1.5;
    ctx.fillText(CREW_SPRITES[i % CREW_SPRITES.length], a.x, a.y + bob);
  });
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
  if (state.selected) drawHighlight(state.selected, "#ffd27a", 3, 14);
  if (state.hovered && state.hovered !== state.selected) drawHighlight(state.hovered, "#ffffff", 2, 12);
}
