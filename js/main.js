// Entry point: setup, main loop, input.

function newGame() {
  createState();
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
}

let lastFrame = performance.now();
let hudTimer = 0;
const FRAME_MS = 1000 / 30;   // cap at 30 fps: the scene is calm, this halves the work

function frame(now) {
  // Skip this display refresh if a 30 fps frame isn't due yet (2 ms tolerance).
  if (now - lastFrame < FRAME_MS - 2) {
    requestAnimationFrame(frame);
    return;
  }
  const realDt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  const dt = realDt * state.speed;

  updateGame(dt);
  if (!state.paused && !state.over) updateAstronauts(dt);
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
  if (e.code === "Space") { state.paused = !state.paused; e.preventDefault(); }
  else if (e.key === "1") state.speed = 1;
  else if (e.key === "2") state.speed = 2;
  else if (e.key === "3") state.speed = 4;
  else if (e.key === "Escape") selectTile(null);
  updateHud();
});

$("restart").addEventListener("click", newGame);
window.addEventListener("resize", resizeCanvas);

buildHud();
newGame();
resizeCanvas();
updateHud();
requestAnimationFrame(frame);
