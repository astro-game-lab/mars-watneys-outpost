// DOM UI: HUD, clock, objectives, build menu, building info, Watney messages.
// The full-screen overlays (intro, missions, end screen) are in js/screens.js.

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.floor(n).toLocaleString();
// Temperatures are kelvin in the simulation; shown as °C with a true minus sign.
const fmtC = (k) => { const c = Math.round(k - 273.15); return `${c < 0 ? "−" : ""}${Math.abs(c)} °C`; };
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

// "⚠ Power shortage: critical 100% · normal 60% · low 0%", listing only the
// tiers that want some, or "" when nothing is short.
function shortageNote(key) {
  const supply = state.supply;
  if (!supply) return "";
  const share = supply.shares[key], demand = supply.demand[key];
  const tiers = SUPPLY_TIERS.filter((tier) => (demand[tier] || 0) > 0);
  if (!tiers.some((tier) => share[tier] < 0.99)) return "";
  const name = RESOURCES.find((r) => r.key === key).name;
  return `⚠ ${name} shortage: ` +
    tiers.map((tier) => `${PRIORITIES[tier].name.toLowerCase()} ${Math.round(share[tier] * 100)}%`).join(" · ");
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
function say(text, kind = "") {
  const box = $("messages");
  const el = document.createElement("div");
  el.className = `msg ${kind}`;
  el.innerHTML = `<b>👨‍🚀 WATNEY:</b> ${text}`;
  box.prepend(el);
  while (box.children.length > 4) box.lastChild.remove();
}
// Show the messages the simulation has queued since the last frame.
function drainOutbox() {
  for (const m of state.outbox) {
    if (m.kind === "line") say(WATNEY_LINES[m.key], m.key === "night" ? "" : "bad");
    else say(m.text, m.tone);
  }
  state.outbox.length = 0;
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

  const busy = state.crewMembers.filter((m) => m.job).length;
  $("crew").textContent = `${state.crew} / ${state.crewCapacity}` + (busy ? ` · ${busy} busy` : "") +
    (state.jobsWaiting ? ` · ${state.jobsWaiting} job${state.jobsWaiting > 1 ? "s" : ""} waiting` : "");
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
  renderRoster();
  const m = state.mission;
  const diff = state.difficulty !== "normal" ? ` <span class="badge">${difficulty().name}</span>` : "";
  $("goal").innerHTML = `<div class="mtitle">${m.name}${diff}</div>` +
    m.objectives.map((o) => {
      const met = objectiveMet(o);
      return `<div class="obj ${met ? "met" : ""}">${met ? "✓" : "○"} ${objectiveLabel(o)} <span class="prog">(${objectiveProgress(o)})</span></div>`;
    }).join("") +
    m.failures.map((f) => `<div class="obj fail">⚠ ${failureHud(f)}</div>`).join("");
  $("power-note").innerHTML = ["power", "water"].map(shortageNote).filter(Boolean).join("<br>");

  // Clock
  const t = solTime();
  $("sol").textContent = `SOL ${state.sol}`;
  $("clock").textContent = clockText(t);
  $("phase").textContent = dayPhase(t);
  $("solar-pct").textContent = `Solar ${Math.round(daylight(t) * (hasEffect("dust") ? 30 : 100))}%`;
  $("outside-temp").textContent = `Outside ${fmtC(outsideTempK(t))}`;
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

// ---------- Crew roster ----------
// One row per crew member: health, with the share of maximum health lost to
// radiation dose hatched at the right end. Past ROSTER_MAX rows, the healthiest
// are summarised so the HUD stays compact.
const ROSTER_MAX = 8;

function renderRoster() {
  let shown = state.crewMembers;
  if (shown.length > ROSTER_MAX) {
    shown = [...shown].sort((a, b) => a.health - b.health || a.arrival - b.arrival).slice(0, ROSTER_MAX - 2)
      .sort((a, b) => a.arrival - b.arrival);
  }
  $("roster").innerHTML = shown.map((m) => {
    const max = maxHealth(m);
    const doseShare = Math.min(1, m.dose / DOSE_LIMIT);
    const level = m.health < 30 ? "crit" : m.health < 60 ? "warn" : "";
    const bed = m.bed !== null && m.bed !== undefined ? state.tiles[m.bed] : null;
    const cold = bed && bed.building && bed.building.tempK < COLD_K;
    const tip = `${m.name}: health ${Math.ceil(m.health)} / ${Math.round(max)} · dose ${Math.round(doseShare * 100)}% of the career limit` +
      (bed && bed.building ? ` · sleeps in a Habitat at ${fmtC(bed.building.tempK)}` : "") +
      (m.job && state.tiles[m.job.tile].building
        ? ` · ${JOB_NAME[m.job.kind]} the ${BUILDINGS[state.tiles[m.job.tile].building.type].name}` : " · free");
    return `<div class="crew-row" title="${tip}">
      <span class="cname">${cold ? "🥶 " : m.arrival === 0 ? "⭐ " : ""}${m.name}</span>
      <div class="bar"><div class="fill ${level}" style="width:${m.health}%"></div><div class="lost" style="width:${100 - max}%"></div></div>
      <span class="cval">${Math.ceil(m.health)}</span>
    </div>`;
  }).join("") + (shown.length < state.crewMembers.length
    ? `<div class="crew-more">+${state.crewMembers.length - shown.length} more, all healthier</div>` : "");
}

// "being built by Tanaka" or "waiting for a free crew member", for a job on a building.
function workText(b, kind, verb) {
  const who = b.working && b.working[kind];
  return who ? `${verb} by ${who}` : "waiting for a free crew member";
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

  if (t.building && t.building.construct > 0) {
    const b = BUILDINGS[t.building.type];
    panel.innerHTML = `
      <div class="ptitle">🏗️ ${b.name}<button class="close" data-act="close">✕</button></div>
      <div class="sub">${terrain} · under construction</div>
      <div id="live"></div>
      <div class="kv"><span>When finished</span><span>${makesText(b)}</span></div>
      <div class="why">${b.why}</div>
      <div class="actions">
        <button data-act="cancel" ${cancelBlocker(t) ? "disabled" : ""}
          title="${cancelBlocker(t) || "Refunds the full cost"}">Cancel (full refund)</button>
      </div>`;
    updatePanelLive();
  } else if (t.building) {
    const b = BUILDINGS[t.building.type];
    panel.innerHTML = `
      <div class="ptitle">${b.icon} ${b.name}<button class="close" data-act="close">✕</button></div>
      <div class="sub">${terrain}</div>
      <div id="live"></div>
      <div class="kv"><span>Consumes</span><span>${fmtList(b.consumes, true)}</span></div>
      ${b.heat ? `<div class="kv"><span>Heating</span><span>${ICON.power} up to ${b.heat}/s, most before dawn</span></div>` : ""}
      <div class="kv"><span>Produces</span><span>${makesText(b)}</span></div>
      ${priorityControl(t)}
      <div class="why">${b.why}</div>
      <div class="opt">
        <div class="orow">
          <b>🧱 Regolith shielding</b>
          <button data-act="why" data-key="reinforce" class="whybtn">Why?</button>
          ${t.building.reinforced
            ? `<span class="bonus">✓ Reinforced (−${REINFORCE.radiation}% rad)</span>`
            : t.building.reinforcing > 0 ? `<span class="bonus">🧱 Under way</span>`
            : `<button data-act="reinforce" ${reinforceBlocker(t) ? "disabled" : ""}>Reinforce</button>`}
        </div>
        ${t.building.reinforced ? "" : `<div class="ocost">Cost: ${fmtList(REINFORCE.cost)} · ${REINFORCE.work}s of crew work · Radiation −${REINFORCE.radiation}%, no power needed</div>`}
        ${openWhy === "reinforce" ? `<div class="why">${REINFORCE.why}</div>` : ""}
      </div>
      <div class="actions">
        ${b.solar ? `<button data-act="clean" ${cleanBlocker(t) ? "disabled" : ""}
          title="${cleanBlocker(t) || `${CLEAN_SECONDS}s of crew work, offline while it's done`}">🧹 Clean panels</button>` : ""}
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

// The shortage-priority buttons for a building, if it has a priority and the
// mission allows changing it.
function priorityControl(t) {
  if (!t.building.priority || state.mission.priorities === false) return "";
  const buttons = PRIORITY_ORDER.map((p) => {
    const blocker = priorityBlocker(t, p);
    const on = t.building.priority === p;
    return `<button data-act="priority" data-key="${p}" class="prio-btn ${on ? "selected" : ""}"
      aria-pressed="${on}" ${blocker ? "disabled" : ""} title="${blocker || PRIORITIES[p].tip}">${PRIORITIES[p].name}</button>`;
  }).join("");
  return `<div class="prio"><div class="kv"><span>Priority in a shortage</span></div><div class="prio-row">${buttons}</div></div>`;
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
      <div class="ocost">Cost: ${fmtList(b.cost)} · ${b.work}s to build ${blocker ? `<span class="blk">· ${blocker}</span>` : ""}</div>
      <div class="ocost">Uses: ${fmtList(b.consumes, true)}${b.heat ? ` + heating up to ${ICON.power} ${b.heat}/s, most before dawn` : ""} → Makes: ${makesText(b)}${b.solar ? " (× daylight)" : ""}</div>
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
    const bld = t.building;
    if (bld.construct > 0) {
      const total = BUILDINGS[bld.type].work;
      live.innerHTML = `<div class="kv"><span>Status</span><span>🏗️ ${Math.floor(100 * (1 - bld.construct / total))}% · ${workText(bld, "construct", "being built")}</span></div>` +
        `<div class="kv"><span>Work left</span><span>${Math.ceil(bld.construct)}s of crew time</span></div>`;
      const cbtn = document.querySelector('#panel button[data-act="cancel"]');
      if (cbtn) cbtn.disabled = !!cancelBlocker(t);
      return;
    }
    const status = bld.disabled > 0 ? `🔧 Damaged · ${Math.ceil(bld.disabled)}s of repairs · ${workText(bld, "repair", "being repaired")}`
      : bld.cleaning > 0 && beingWorked(bld, "clean") ? `🧹 Being cleaned by ${bld.working.clean} · ${Math.ceil(bld.cleaning)}s left`
      : t.building.priority === "off" ? "💤 Switched off"
      : lv < 0.99 ? `⚡ Short of inputs — running at ${Math.round(lv * 100)}%` : "✅ Running";
    const b = BUILDINGS[t.building.type];
    const mult = outputMultiplier(t);
    const actual = Object.entries(b.produces)
      .map(([k, v]) => `${ICON[k]} ${(v * mult * (t.building.disabled > 0 ? 0 : k === "power" ? 1 : lv)).toFixed(1)}/s`).join("  ");
    const dust = b.solar
      ? `<div class="kv"><span>Dust on panels</span><span>${Math.round(t.building.dust * 100)}% · output −${Math.round(t.building.dust * 100)}%` +
        `${t.building.cleaning > 0 && !beingWorked(t.building, "clean") ? " · cleaning queued" : ""}</span></div>`
      : "";
    let temp = "";
    if (t.building.tempK !== undefined) {
      const T = t.building.tempK;
      const trend = T >= SETPOINT_K - 0.05 ? "holding"
        : (t.building.heatDelivered || 0) >= heatingDemand(t) - 1e-6 ? "rewarming" : "cooling";
      const warn = t.building.type === "greenhouse" && T < FROST_K ? " · ❄️ frost!"
        : T < COLD_K ? (t.building.type === "lab" ? " · too cold to work" : " · too cold") : "";
      temp = `<div class="kv"><span>Temperature</span><span>🌡️ ${fmtC(T)} · ${trend}${warn}</span></div>`;
      if (t.building.crop !== undefined) {
        temp += `<div class="kv"><span>Crop</span><span>${Math.round(t.building.crop * 100)}%${t.building.crop < 1 ? (T >= FROST_K ? " · regrowing" : " · freezing") : ""}</span></div>`;
      }
    }
    const drawing = powerDemand(t) > 0 ? `${ICON.power} ${(powerDemand(t) * lv).toFixed(1)}/s` : "";
    live.innerHTML = `<div class="kv"><span>Status</span><span>${status}</span></div>` +
      (actual ? `<div class="kv"><span>Output now</span><span>${actual}</span></div>` : "") +
      (drawing ? `<div class="kv"><span>Drawing now</span><span>${drawing}${b.heat ? " incl. heating" : ""}</span></div>` : "") + temp + dust;
    const rbtn = document.querySelector('#panel button[data-act="reinforce"]');
    if (rbtn) rbtn.disabled = !!reinforceBlocker(t);
    const cbtn = document.querySelector('#panel button[data-act="clean"]');
    if (cbtn) {
      const blocker = cleanBlocker(t);
      cbtn.disabled = !!blocker;
      cbtn.title = blocker || `Offline for ${CLEAN_SECONDS}s, then the dust is gone`;
    }
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
    say(`Construction started on the ${BUILDINGS[btn.dataset.key].name}. ${BUILDINGS[btn.dataset.key].work}s of work.`, "good");
    renderPanel();
  } else if (act === "reinforce" && reinforce(t)) {
    say(`Regolith shielding queued for the ${BUILDINGS[t.building.type].name}.`, "good");
    renderPanel();
  } else if (act === "clean" && clean(t)) {
    say("Panel cleaning queued. The array goes offline while someone's on it.", "good");
    renderPanel();
  } else if (act === "cancel" && cancel(t)) {
    say("Construction cancelled. Everything went back into storage.", "good");
    refreshFlows();
    selectTile(null);
  } else if (act === "priority" && setPriority(t, btn.dataset.key)) {
    refreshFlows();   // show the effect straight away, even while paused
    renderPanel();
    updateHud();
  } else if (act === "demolish" && demolish(t)) renderPanel();
});
