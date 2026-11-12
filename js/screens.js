// Full-screen overlays: the intro (story and how to play), mission select with
// each mission's briefing, and the end screen with its debrief. The simulation
// never runs while one is open. Campaign progress is kept in localStorage.

// ---------- Progress ----------
const PROGRESS_KEY = "mwo-progress-v1";
const progress = loadProgress();

// Storage can be missing or blocked (private windows, previews). Then progress
// lasts for this page load only, and the intro shows again next time.
function loadProgress() {
  const base = { seenIntro: false, won: {}, difficulty: "normal", last: MISSIONS[0].id };
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null");
    if (saved && typeof saved === "object") Object.assign(base, saved);
  } catch { /* use the defaults */ }
  if (!DIFFICULTIES[base.difficulty]) base.difficulty = "normal";
  return base;
}

function saveProgress() {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch { /* not persisted */ }
}

const missionIndex = (id) => MISSIONS.findIndex((m) => m.id === id);
const isWon = (id) => progress.won[id] !== undefined;

function missionUnlocked(i) {
  return i === 0 || isWon(MISSIONS[i - 1].id);
}

// Difficulty tiers unlock once the last mission of the campaign is won.
function campaignComplete() {
  return isWon(MISSIONS[MISSIONS.length - 1].id);
}

function chosenDifficulty() {
  return campaignComplete() ? progress.difficulty : "normal";
}

function recordWin(id, diff) {
  const prev = progress.won[id];
  if (prev === undefined || DIFFICULTY_ORDER.indexOf(diff) > DIFFICULTY_ORDER.indexOf(prev)) progress.won[id] = diff;
  saveProgress();
}

// ---------- Overlay state ----------
let inMission = false;       // a mission has begun and hasn't ended
let shownMission = null;     // whose briefing is on the mission screen

function screenOpen() {
  return !$("intro").hidden || !$("missions").hidden || !$("end").hidden;
}

// ---------- Intro ----------
function showIntro() {
  selectTile(null);
  $("intro-story").innerHTML = STORY.map((p) => `<p>${p}</p>`).join("");
  $("intro-go").textContent = inMission ? "Back to the outpost" : "Choose a mission";
  $("intro").hidden = false;
  $("intro-go").focus();
}

function closeIntro() {
  progress.seenIntro = true;
  saveProgress();
  $("intro").hidden = true;
  if (!inMission) showMissions();
}

// ---------- Mission select and briefing ----------
function showMissions(id = progress.last) {
  selectTile(null);
  let i = missionIndex(id);
  if (i < 0 || !missionUnlocked(i)) i = MISSIONS.findLastIndex((m, j) => missionUnlocked(j));
  shownMission = MISSIONS[i].id;
  $("missions-close").hidden = !inMission;
  renderMissions();
  $("missions").hidden = false;
  $("begin").focus();
}

function closeMissions() {
  if (!inMission) return;  // nothing to go back to
  $("missions").hidden = true;
}

function renderMissions() {
  $("mission-list").innerHTML = MISSIONS.map((m, i) => {
    const locked = !missionUnlocked(i);
    const won = progress.won[m.id];
    const mark = won ? `✓${won !== "normal" ? ` ${DIFFICULTIES[won].name}` : ""}` : locked ? "🔒" : "";
    return `<li><button class="mission-btn ${m.id === shownMission ? "selected" : ""}" data-mission="${m.id}"
      ${locked ? `disabled title="Win ${MISSIONS[i - 1].name} to unlock"` : ""}>
      <span class="mnum">${i + 1}</span><span class="mname">${m.name}</span><span class="mmark">${mark}</span></button></li>`;
  }).join("");

  $("difficulty").innerHTML = campaignComplete()
    ? `<h4>Difficulty</h4><div class="diff-row">${DIFFICULTY_ORDER.map((k) =>
        `<button class="diff-btn ${k === progress.difficulty ? "selected" : ""}" data-difficulty="${k}"
          aria-pressed="${k === progress.difficulty}">${DIFFICULTIES[k].name}</button>`).join("")}</div>
       <p class="sub">${DIFFICULTIES[progress.difficulty].blurb}</p>`
    : `<p class="sub">🔒 Difficulty settings unlock when you finish ${MISSIONS[MISSIONS.length - 1].name}.</p>`;

  const m = missionById(shownMission);
  const diff = chosenDifficulty();
  $("briefing").innerHTML = `
    <h3>${missionIndex(m.id) + 1}. ${m.name}</h3>
    <div class="lesson">🔬 ${m.lesson}</div>
    <div class="story log">${m.briefing.map((p) => `<p>${p}</p>`).join("")}</div>
    <h4>To win</h4>
    <ul>${m.objectives.map((o) => `<li>${objectiveLabel(o)}</li>`).join("")}</ul>
    <h4>You lose if</h4>
    <ul><li>Crew health reaches zero</li>${m.failures.map((f) => `<li>${failureLabel(f)}</li>`).join("")}</ul>
    <h4>Buildings</h4>
    <div class="chips">${(m.buildings || BUILD_ORDER).map((k) =>
      `<span class="chip">${BUILDINGS[k].icon} ${BUILDINGS[k].name}</span>`).join("")}</div>
    <h4>First moves</h4>
    <ul>${m.tips.map((t) => `<li>${t}</li>`).join("")}</ul>
    <div class="screen-actions">
      ${diff !== "normal" ? `<span class="badge">${DIFFICULTIES[diff].name}</span>` : ""}
      <button id="begin" class="primary">${inMission ? "Abandon and begin ▶" : "Begin mission ▶"}</button>
    </div>`;
}

function beginMission(id, seed) {
  progress.last = id;
  saveProgress();
  newGame(id, seed);
  $("missions").hidden = true;
  $("end").hidden = true;
  inMission = true;
}

$("intro-go").addEventListener("click", closeIntro);
$("missions-close").addEventListener("click", closeMissions);
$("missions").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.dataset.mission) {
    shownMission = btn.dataset.mission;
    renderMissions();
    $("begin").focus();
  } else if (btn.dataset.difficulty) {
    progress.difficulty = btn.dataset.difficulty;
    saveProgress();
    renderMissions();
  } else if (btn.id === "begin") {
    beginMission(shownMission);
  }
});
$("btn-help").addEventListener("click", showIntro);
$("btn-missions").addEventListener("click", () => showMissions(state.mission.id));

// Escape closes an overlay when there's a running mission to go back to.
function screenKey(e) {
  if (e.key !== "Escape" || !inMission) return;
  if (!$("intro").hidden) closeIntro();
  else if (!$("missions").hidden) closeMissions();
}

// ---------- End screen and debrief ----------
const NEED_HINTS = {
  water: "Water Extractors need power, and on ice they yield twice as much. Habitats and Greenhouses drink too.",
  food: "Only Greenhouses make food, and they need water and power. Build one early.",
  oxygen: "Habitats make oxygen from water and power. When either runs short, so does the air.",
  radiation: "Exposure above 50% hurts the crew. Radiation Shields and regolith reinforcement bring it down, and flares push it up.",
};

function lossDebrief(cause) {
  if (cause === "blackout") {
    return {
      text: `The batteries went flat on ${whenText(state.time)}, and the outpost went dark.`,
      hints: ["Solar Arrays stop at night and in dust storms. Bank power during the day with Battery Banks, or add generation."],
    };
  }
  if (cause === "deadline") {
    const missing = state.mission.objectives.filter((o) => !objectiveMet(o));
    return {
      text: `Sol ${state.sol} started and the mission wasn't done.`,
      hints: [`Still missing: ${missing.map((o) => `${objectiveLabel(o)} (${objectiveProgress(o)})`).join("; ")}.`,
        "The objective list in the HUD shows how far along you are."],
    };
  }
  // Health: name the cause that did the most harm.
  const [worst] = Object.entries(state.stats.damage).sort((a, b) => b[1] - a[1])[0];
  const first = state.stats.firstEmpty[worst];
  const what = worst === "radiation" ? "radiation exposure" : `running out of ${worst}`;
  return {
    text: `The crew didn't make it. Most of the harm came from ${what}` +
      (first !== undefined ? `, which first ran out on ${whenText(first)}.` : "."),
    hints: [NEED_HINTS[worst], "A big stockpile means nothing if it's falling fast. Watch the rates."],
  };
}

function endGame(result, cause) {
  state.over = result;
  state.endCause = cause;
  inMission = false;
  selectTile(null);
  const m = state.mission;
  const i = missionIndex(m.id);
  const win = result === "win";
  const wasComplete = campaignComplete();
  if (win) recordWin(m.id, state.difficulty);

  $("end-title").textContent = `${win ? "🎉 MISSION SUCCESS" : "💀 MISSION FAILED"}: ${m.name}`;
  let debrief;
  if (win) {
    $("end-text").textContent = i === MISSIONS.length - 1
      ? `Watney's outpost survived until Sol ${state.sol}, and its science earned ${fmt(state.creditsEarned)} credits. NASA is sending a ride home!`
      : `Mission complete on Sol ${state.sol}.`;
    debrief = `<div class="lesson">🔬 ${m.lesson}</div>` +
      (!wasComplete && campaignComplete()
        ? `<p class="unlock">🏆 Campaign complete! Difficulty settings are now unlocked in the mission screen.</p>` : "");
  } else {
    const d = lossDebrief(cause);
    $("end-text").textContent = d.text;
    debrief = `<h4>What to try</h4><ul>${d.hints.map((h) => `<li>${h}</li>`).join("")}</ul>`;
  }
  $("end-debrief").innerHTML = debrief;
  $("end-stats").textContent =
    `${DIFFICULTIES[state.difficulty].name} · Buildings: ${buildings().length} · Credits earned: ${fmt(state.creditsEarned)} · ` +
    `Radiation: ${Math.round(state.radiation)}% · Seed ${state.seed}`;
  const next = win && i < MISSIONS.length - 1 ? MISSIONS[i + 1] : null;
  $("end-next").hidden = !next;
  $("end").hidden = false;
  (next ? $("end-next") : $("end-retry")).focus();
}

$("end-retry").addEventListener("click", () => beginMission(state.mission.id, state.seed));
$("end-missions").addEventListener("click", () => { $("end").hidden = true; showMissions(state.mission.id); });
$("end-next").addEventListener("click", () => {
  $("end").hidden = true;
  showMissions(MISSIONS[missionIndex(state.mission.id) + 1].id);
});
