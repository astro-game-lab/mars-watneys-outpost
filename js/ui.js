// DOM UI: HUD, clock, objectives, build menu, building info, Watney messages.
// The full-screen overlays (intro, missions, end screen) are in js/screens.js.

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.floor(n).toLocaleString();
const fmtRate = (r) => (r >= 0 ? "+" : "−") + Math.abs(r).toFixed(1) + "/s";
const fmtList = (obj, perSec) => Object.entries(obj)
  .map(([k, v]) => `${ICON[k]} ${perSec ? v + "/s" : v}`).join("  ") || "—";

// Clock time for a fraction of a sol (a sol is about 24.65 hours).
function clockText(t) {
  const hours = Math.floor(t * 24.65);
  const mins = Math.floor((t * 24.65 - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}
// "Sol 3 at 14:20" for a game time.
function whenText(time) {
  return `Sol ${Math.floor(time / SOL_SECONDS) + 1} at ${clockText((time % SOL_SECONDS) / SOL_SECONDS)}`;
}

// ---------- Objectives ----------
const resourceName = (k) => RESOURCES.find((r) => r.key === k).name.toLowerCase();

function objectiveLabel(o) {
  switch (o.type) {
    case "sol": return `Reach Sol ${o.value}`;
    case "credits": return `Earn ${fmt(o.value)} 💰 in total`;
    case "crew": return `Grow the crew to ${o.value} 👨‍🚀`;
    case "stock": return `Store ${fmt(o.value)} ${ICON[o.resource]} ${resourceName(o.resource)}`;
    case "radiation": return `Bring exposure down to ${o.value}% ☢️`;
  }
}

function objectiveProgress(o) {
  const v = objectiveValue(o);
  if (o.type === "sol") return `now ${v}`;
  if (o.type === "radiation") return `now ${Math.round(v)}%`;
  return fmt(v);
}

function failureLabel(f) {
  if (f.type === "blackout") return "The batteries go flat (a blackout)";
  if (f.type === "deadline") return `Sol ${f.sol} starts before you've finished`;
}

function failureHud(f) {
  if (f.type === "blackout") return "Don't let the batteries go flat";
  if (f.type === "deadline") return `Deadline: start of Sol ${f.sol}`;
}

// Production plus non-resource effects (crew space, shielding, storage).
function makesText(b) {
  const parts = Object.entries(b.produces).map(([k, v]) => `${ICON[k]} ${v}/s`);
  if (b.crew) parts.push(`👨‍🚀 +${b.crew} crew`);
  if (b.radiation) parts.push(`🛡️ −${b.radiation}% rad`);
  if (b.storage) parts.push(`🔋 +${b.storage} storage`);
  if (b.key === "lab") parts.push(`(+${CREW_SCIENCE_BONUS * 100}% per extra crew)`);
  return parts.join("  ") || "—";
}

// ---------- Watney messages ----------
const lastSaid = {};
function say(text, kind = "") {
  const box = $("messages");
  const el = document.createElement("div");
  el.className = `msg ${kind}`;
  el.innerHTML = `<b>👨‍🚀 WATNEY:</b> ${text}`;
  box.prepend(el);
  while (box.children.length > 4) box.lastChild.remove();
}
// Trigger-based line with a cooldown (game seconds).
function sayOnce(key, cooldown = 45) {
  const now = state.time;
  if (lastSaid[key] !== undefined && now - lastSaid[key] < cooldown) return;
  lastSaid[key] = now;
  say(WATNEY_LINES[key], key === "night" ? "" : "bad");
}

// ---------- HUD ----------
function buildHud() {
  $("resources").innerHTML = RESOURCES.map((r) => `
    <div class="res" id="res-${r.key}">
      <span class="dot"></span>
      <span class="ricon">${r.icon}</span>
      <span class="rname">${r.name}</span>
      <span class="rval"></span>
      <span class="rrate"></span>
      <span class="rleft"></span>
    </div>`).join("");
}

function updateHud() {
  for (const r of RESOURCES) {
    const row = $(`res-${r.key}`);
    const rate = state.rates[r.key] || 0;
    const status = resourceStatus(r.key);
    row.className = `res ${status}`;
    row.querySelector(".rval").textContent =
      fmt(state.resources[r.key]) + (r.key === "power" ? `/${state.powerCapacity}` : "");
    const rr = row.querySelector(".rrate");
    rr.textContent = fmtRate(rate);
    rr.className = `rrate ${rate < -0.001 ? "neg" : "pos"}`;
    const tl = timeLeft(r.key);
    row.querySelector(".rleft").textContent =
      status !== "good" ? (state.resources[r.key] <= 0.01 ? "EMPTY" : `${Math.ceil(tl)}s left`) : "";
  }

  $("crew").textContent = `${state.crew} / ${state.crewCapacity}`;
  if (state.mission.crewArrivals === false) {
    $("arrival").textContent = "No crew landings this mission";
  } else {
    const blocker = arrivalBlocker();
    $("arrival").innerHTML = `Next crew landing: Sol ${state.nextArrivalSol}` +
      (blocker ? ` <span class="warn-text">· blocked: ${blocker}</span>` : "");
  }
  const rad = $("radiation");
  rad.textContent = `${Math.round(state.radiation)}%`;
  rad.className = state.radiation > 50 ? "crit-text" : state.radiation > 25 ? "warn-text" : "";
  $("health-bar").style.width = `${state.health}%`;
  $("health-bar").className = state.health < 30 ? "crit" : state.health < 60 ? "warn" : "";
  $("health-val").textContent = `${Math.ceil(state.health)}%`;
  const m = state.mission;
  const diff = state.difficulty !== "normal" ? ` <span class="badge">${difficulty().name}</span>` : "";
  $("goal").innerHTML = `<div class="mtitle">${m.name}${diff}</div>` +
    m.objectives.map((o) => {
      const met = objectiveMet(o);
      return `<div class="obj ${met ? "met" : ""}">${met ? "✓" : "○"} ${objectiveLabel(o)} <span class="prog">(${objectiveProgress(o)})</span></div>`;
    }).join("") +
    m.failures.map((f) => `<div class="obj fail">⚠ ${failureHud(f)}</div>`).join("");
  $("power-note").textContent = state.efficiency < 0.99
    ? `⚠ Power shortage: buildings at ${Math.round(state.efficiency * 100)}%` : "";

  // Clock
  const t = solTime();
  $("sol").textContent = `SOL ${state.sol}`;
  $("clock").textContent = clockText(t);
  $("phase").textContent = dayPhase(t);
  $("solar-pct").textContent = `Solar ${Math.round(daylight(t) * (hasEffect("dust") ? 30 : 100))}%`;
  const sun = $("sun");
  const day = Math.min(1, Math.max(0, (t - 0.2) / 0.65));
  const up = t >= 0.2 && t < 0.85;
  sun.style.left = `${day * 100}%`;
  sun.style.bottom = `${up ? Math.sin(day * Math.PI) * 70 : -10}%`;
  sun.style.opacity = up ? 1 : 0.15;
  $("speed").textContent = state.paused ? "⏸ Paused" : `▶ ×${state.speed}`;

  $("effects").innerHTML = state.effects
    .map((e) => `<div class="effect">${e.label} · ${Math.ceil(e.remaining)}s</div>`).join("");

  if (state.selected) updatePanelLive();
}

// ---------- Side panel: build menu / building info ----------
let openWhy = null;

function selectTile(t) {
  state.selected = t;
  openWhy = null;
  renderPanel();
}

function renderPanel() {
  const panel = $("panel");
  const t = state.selected;
  if (!t) { panel.hidden = true; return; }
  panel.hidden = false;
  const terrain = TERRAIN[t.terrain].name;

  if (t.building) {
    const b = BUILDINGS[t.building.type];
    panel.innerHTML = `
      <div class="ptitle">${b.icon} ${b.name}<button class="close" data-act="close">✕</button></div>
      <div class="sub">${terrain}</div>
      <div id="live"></div>
      <div class="kv"><span>Consumes</span><span>${fmtList(b.consumes, true)}</span></div>
      <div class="kv"><span>Produces</span><span>${makesText(b)}</span></div>
      <div class="why">${b.why}</div>
      <div class="opt">
        <div class="orow">
          <b>🧱 Regolith shielding</b>
          <button data-act="why" data-key="reinforce" class="whybtn">Why?</button>
          ${t.building.reinforced
            ? `<span class="bonus">✓ Reinforced (−${REINFORCE.radiation}% rad)</span>`
            : `<button data-act="reinforce" ${reinforceBlocker(t) ? "disabled" : ""}>Reinforce</button>`}
        </div>
        ${t.building.reinforced ? "" : `<div class="ocost">Cost: ${fmtList(REINFORCE.cost)} · Radiation −${REINFORCE.radiation}%, no power needed</div>`}
        ${openWhy === "reinforce" ? `<div class="why">${REINFORCE.why}</div>` : ""}
      </div>
      <div class="actions">
        <button data-act="demolish" ${demolishBlocker(t) ? "disabled" : ""}
          title="${demolishBlocker(t) || "Refunds 50% of the cost"}">Demolish (50% refund)</button>
      </div>`;
    updatePanelLive();
  } else if (canPlaceOn(t)) {
    panel.innerHTML = `
      <div class="ptitle">🏗️ Build<button class="close" data-act="close">✕</button></div>
      <div class="sub">${terrain}</div>
      ${BUILD_ORDER.filter(buildingUnlocked).map((k) => buildOption(k, t)).join("")}`;
  } else {
    const reason = t.terrain === "impassable" ? "Impassable terrain — nothing can be built here."
      : "Too far from the outpost. Build next to an existing structure.";
    panel.innerHTML = `
      <div class="ptitle">${terrain}<button class="close" data-act="close">✕</button></div>
      <p>${reason}</p>`;
  }
}

function buildOption(key, t) {
  const b = BUILDINGS[key];
  const blocker = buildBlocker(key, t);
  const bonus = b.bonus && b.bonus[t.terrain];
  return `
    <div class="opt ${blocker ? "blocked" : ""}">
      <div class="orow">
        <b>${b.icon} ${b.name}</b>
        <button data-act="why" data-key="${key}" class="whybtn">Why?</button>
        <button data-act="build" data-key="${key}" ${blocker ? "disabled" : ""}>Build</button>
      </div>
      <div class="ocost">Cost: ${fmtList(b.cost)} ${blocker ? `<span class="blk">· ${blocker}</span>` : ""}</div>
      <div class="ocost">Uses: ${fmtList(b.consumes, true)} → Makes: ${makesText(b)}${b.solar ? " (× daylight)" : ""}</div>
      ${bonus ? `<div class="bonus">★ ${TERRAIN[t.terrain].name} bonus: ×${bonus} output</div>` : ""}
      ${b.needsHabitat ? `<div class="ocost">Must touch a Habitat</div>` : ""}
      ${openWhy === key ? `<div class="why">${b.why}</div>` : ""}
    </div>`;
}

// Refresh parts of the panel that change every tick.
function updatePanelLive() {
  const t = state.selected;
  if (t.building) {
    const live = $("live");
    if (!live) return;
    const lv = t.building.level ?? 1;
    const status = t.building.disabled > 0 ? `🔧 Damaged — repairs ${Math.ceil(t.building.disabled)}s`
      : lv < 0.99 ? `⚡ Short of inputs — running at ${Math.round(lv * 100)}%` : "✅ Running";
    const b = BUILDINGS[t.building.type];
    const mult = outputMultiplier(t);
    const actual = Object.entries(b.produces)
      .map(([k, v]) => `${ICON[k]} ${(v * mult * (t.building.disabled > 0 ? 0 : k === "power" ? 1 : lv)).toFixed(1)}/s`).join("  ");
    live.innerHTML = `<div class="kv"><span>Status</span><span>${status}</span></div>` +
      (actual ? `<div class="kv"><span>Output now</span><span>${actual}</span></div>` : "");
    const rbtn = document.querySelector('#panel button[data-act="reinforce"]');
    if (rbtn) rbtn.disabled = !!reinforceBlocker(t);
  } else {
    // Update affordability of build options without losing the open "Why?"
    for (const btn of document.querySelectorAll('#panel button[data-act="build"]')) {
      btn.disabled = !!buildBlocker(btn.dataset.key, t);
    }
  }
}

$("panel").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const t = state.selected;
  const act = btn.dataset.act;
  if (act === "close") selectTile(null);
  else if (act === "why") { openWhy = openWhy === btn.dataset.key ? null : btn.dataset.key; renderPanel(); }
  else if (act === "build" && build(btn.dataset.key, t)) {
    say(`${BUILDINGS[btn.dataset.key].name} is up and running.`, "good");
    renderPanel();
  } else if (act === "reinforce" && reinforce(t)) {
    say(`Shovelled regolith over the ${BUILDINGS[t.building.type].name}. Mars dirt: now with radiation protection.`, "good");
    renderPanel();
  } else if (act === "demolish" && demolish(t)) renderPanel();
});
