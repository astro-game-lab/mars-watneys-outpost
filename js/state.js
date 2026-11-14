// Game state: one object holds everything.

let state = null;

// A fresh mission. The seed and the player's inputs fully determine what
// happens next: all randomness comes from state.rng.
function createState(mission, seed, difficulty = "normal") {
  const diff = DIFFICULTIES[difficulty];
  const start = { ...DEFAULT_START, ...mission.start };
  const resources = { ...DEFAULT_START.resources, ...(mission.start && mission.start.resources) };
  for (const k of ["water", "food", "oxygen"]) resources[k] = Math.round(resources[k] * diff.start);
  const events = mission.events === null
    ? { ...EVENT_DEFAULTS, weights: {}, scripted: [] }
    : {
        ...EVENT_DEFAULTS, ...mission.events,
        durations: { ...EVENT_DEFAULTS.durations, ...(mission.events && mission.events.durations) },
      };
  const rng = createRng(seed);
  const startTime = start.time * SOL_SECONDS;

  state = {
    mission,
    seed,
    difficulty,
    rng,
    events,                    // this mission's event settings
    tick: 0,                   // simulation steps since the mission started
    startTime,
    time: startTime,           // game seconds since the start of Sol 1
    sol: 1,
    speed: 1,
    paused: false,
    over: null,                // null | "win" | "lose"
    endCause: null,            // why it ended: "objectives" | "health" | "blackout" | "deadline"
    resources,
    rates: {},
    creditsEarned: 0,
    health: 100,
    radiation: BASE_RADIATION,
    crew: start.crew,
    nextArrivalSol: 1 + (mission.crewArrivalSols || CREW_ARRIVAL_SOLS),
    crewCapacity: 0,
    powerCapacity: POWER_CAPACITY,
    efficiency: 1,             // power-limited operating fraction
    effects: [],               // active events: { kind, label, remaining }
    nextEventIn: events.first * diff.eventGap,
    nextScripted: 0,           // index into events.scripted
    // For the debrief: health lost to each cause, and when each need first ran out.
    stats: { damage: { water: 0, food: 0, oxygen: 0, radiation: 0 }, firstEmpty: {} },
    outbox: [],                // messages for the UI: { kind: "say", text, tone } | { kind: "line", key }
    lastSaid: {},              // game time each keyed line was last queued, for its cooldown
    tiles: createTiles(rng, mission.map),
    selected: null,
    hovered: null,
  };
  placeStartingOutpost(start.outpost);
}

// ---------- Messages ----------
// The simulation never calls the UI. It queues messages here, and the UI
// drains the queue once per frame (drainOutbox() in js/ui.js).
function emit(text, tone = "") {
  state.outbox.push({ kind: "say", text, tone });
}

// A keyed line from WATNEY_LINES, queued at most once per cooldown (game seconds).
function emitLine(key, cooldown = 45) {
  const last = state.lastSaid[key];
  if (last !== undefined && state.time - last < cooldown) return;
  state.lastSaid[key] = state.time;
  state.outbox.push({ kind: "line", key });
}

function difficulty() {
  return DIFFICULTIES[state.difficulty];
}

function buildingUnlocked(type) {
  return !state.mission.buildings || state.mission.buildings.includes(type);
}

function makeBuilding(type) {
  return { type, disabled: 0, reinforced: false };
}

function canAffordCost(cost) {
  return Object.entries(cost).every(([k, v]) => state.resources[k] >= v);
}

// Reason a building can't be reinforced, or null if it can.
function reinforceBlocker(t) {
  if (!t || !t.building) return "No building";
  if (t.building.reinforced) return "Already reinforced";
  if (!canAffordCost(REINFORCE.cost)) return "Not enough materials";
  return null;
}

function reinforce(t) {
  if (reinforceBlocker(t)) return false;
  for (const [k, v] of Object.entries(REINFORCE.cost)) state.resources[k] -= v;
  t.building.reinforced = true;
  return true;
}

// The starting buildings on the centre tile and its neighbours, cleared to
// regolith. The centre gets the first type, so a Lab placed later touches it.
function placeStartingOutpost(types) {
  const center = tileAt(Math.floor(COLS / 2) - 1, Math.floor(ROWS / 2));
  const cluster = [center, ...neighbors(center)].slice(0, types.length);
  cluster.forEach((t, i) => {
    t.terrain = "regolith";
    t.building = makeBuilding(types[i]);
  });
}

function canAfford(type) {
  return canAffordCost(BUILDINGS[type].cost);
}

function touchesHabitat(t) {
  return neighbors(t).some((n) => n.building && n.building.type === "habitat");
}

// Reason a building can't be placed on a tile, or null if it can.
function buildBlocker(type, t) {
  if (!buildingUnlocked(type)) return "Not available in this mission";
  if (!canPlaceOn(t)) return "Must be next to the outpost";
  if (BUILDINGS[type].needsHabitat && !touchesHabitat(t)) return "Must touch a Habitat";
  if (!canAfford(type)) return "Not enough resources";
  return null;
}

function build(type, t) {
  if (buildBlocker(type, t)) return false;
  for (const [k, v] of Object.entries(BUILDINGS[type].cost)) state.resources[k] -= v;
  t.building = makeBuilding(type);
  return true;
}

// Reason a building can't be demolished, or null if it can.
function demolishBlocker(t) {
  if (!canDemolish(t)) return "Would disconnect the outpost";
  const b = BUILDINGS[t.building.type];
  if (b.crew && t.building.disabled <= 0 && state.crewCapacity - b.crew < state.crew) return "The crew needs these beds";
  return null;
}

function demolish(t) {
  if (demolishBlocker(t)) return false;
  const cost = { ...BUILDINGS[t.building.type].cost };
  if (t.building.reinforced) cost.materials = (cost.materials || 0) + REINFORCE.cost.materials;
  for (const [k, v] of Object.entries(cost)) state.resources[k] += Math.floor(v / 2);
  t.building = null;
  return true;
}

function buildings() {
  return state.tiles.filter((t) => t.building);
}
