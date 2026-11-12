// Entry point: setup, main loop, input.

// `?seed=N` replays a map and event sequence for missions without a fixed seed.
const URL_SEED = (() => {
  const v = new URLSearchParams(location.search).get("seed");
  return v !== null && /^\d+$/.test(v) ? Number(v) >>> 0 : null;
})();

function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

// Start a mission. The seed is the mission's own, or the URL's, or fresh.
function newGame(missionId, seed) {
  const mission = missionById(missionId);
  if (seed === undefined) seed = mission.seed ?? URL_SEED ?? randomSeed();
  createState(mission, seed, chosenDifficulty());
  astronauts.length = 0;
  $("messages").innerHTML = "";
  for (const k of Object.keys(lastSaid)) delete lastSaid[k];
  $("end").hidden = true;
  selectTile(null);
  const flows = computeFlows();
  state.rates = flows.rates;
  state.powerCapacity = flows.powerCapacity;
  state.crewCapacity = flows.crewCapacity;
  say(WATNEY_LINES.start, "good");
  updateHud();
}

let lastFrame = performance.now();
let hudTimer = 0;
let simAccumulator = 0;       // game seconds owed to the simulation
const FRAME_MS = 1000 / 30;   // cap at 30 fps: the scene is calm, this halves the work

function frame(now) {
  // Skip this display refresh if a 30 fps frame isn't due yet (2 ms tolerance).
  if (now - lastFrame < FRAME_MS - 2) {
    requestAnimationFrame(frame);
    return;
  }
  const realDt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;

  // Fixed timestep: bank this frame's game time, then run whole steps.
  if (!state.paused && !state.over && !screenOpen()) {
    simAccumulator += realDt * state.speed;
    while (simAccumulator >= SIM_STEP && !state.over) {
      updateGame();
      simAccumulator -= SIM_STEP;
    }
    updateAstronauts(realDt * state.speed);
  } else {
    simAccumulator = 0;
  }
  render(now / 1000);

  hudTimer -= realDt;
  if (hudTimer <= 0) {
    hudTimer = 0.2;
    updateHud();
  }
  requestAnimationFrame(frame);
}

canvas.addEventListener("mousemove", (e) => {
  state.hovered = tileFromPixel(e.clientX, e.clientY);
  canvas.style.cursor = state.hovered && (state.hovered.building || canPlaceOn(state.hovered)) ? "pointer" : "default";
});
canvas.addEventListener("mouseleave", () => { state.hovered = null; });
canvas.addEventListener("click", (e) => {
  if (state.over) return;
  selectTile(tileFromPixel(e.clientX, e.clientY));
});
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  selectTile(null);
});

window.addEventListener("keydown", (e) => {
  if (screenOpen()) return screenKey(e);
  if (e.code === "Space") { state.paused = !state.paused; e.preventDefault(); }
  else if (e.key === "1") state.speed = 1;
  else if (e.key === "2") state.speed = 2;
  else if (e.key === "3") state.speed = 4;
  else if (e.key === "Escape") selectTile(null);
  else if (e.key === "h" || e.key === "H" || e.key === "?") showIntro();
  else if (e.key === "m" || e.key === "M") showMissions(state.mission.id);
  updateHud();
});

window.addEventListener("resize", resizeCanvas);

buildHud();
newGame(progress.last);   // the backdrop behind the first screen
resizeCanvas();
if (progress.seenIntro) showMissions();
else showIntro();
requestAnimationFrame(frame);
