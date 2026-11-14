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
    radiation: BASE_RADIATION,
    crew: 0,                   // the count; always crewMembers.length
    crewMembers: [],           // { name, arrival, health, dose, landedAt }; member 0 is Watney
    arrivals: 0,               // crew landed so far, which names the next one
    nextArrivalSol: 1 + (mission.crewArrivalSols || CREW_ARRIVAL_SOLS),
    crewCapacity: 0,
    powerCapacity: POWER_CAPACITY,
    efficiency: 1,             // power-limited operating fraction
    waterFactor: 1,            // water-limited operating fraction
    supply: null,              // shortage shares and demand by priority tier, for the HUD
    effects: [],               // active events: { kind, label, remaining }
    nextEventIn: events.first * diff.eventGap,
    nextScripted: 0,           // index into events.scripted
    // For the debrief: health lost to each cause, and when each need first ran out.
    jobSeq: 0,                 // order jobs were queued in, for who does what first
    stats: { damage: { water: 0, food: 0, oxygen: 0, radiation: 0, cold: 0 }, firstEmpty: {}, lost: null, left: [] },
    outbox: [],                // messages for the UI: { kind: "say", text, tone } | { kind: "line", key }
    lastSaid: {},              // game time each keyed line was last queued, for its cooldown
    tiles: createTiles(rng, mission.map),
    selected: null,
    hovered: null,
  };
  placeStartingOutpost(start.outpost);
  addCrewMember("Watney");
  for (let i = 1; i < start.crew; i++) addCrewMember();
}

// ---------- Crew ----------
// The crew is a list of members; state.crew is its length, kept in step here.
function addCrewMember(name) {
  const member = {
    name: name || CREW_NAMES[(state.arrivals - 1) % CREW_NAMES.length],
    arrival: state.arrivals,
    health: 100,
    dose: 0,
    landedAt: state.time,
  };
  state.arrivals++;
  state.crewMembers.push(member);
  state.crew = state.crewMembers.length;
  return member;
}

function removeCrewMember(member) {
  state.crewMembers = state.crewMembers.filter((m) => m !== member);
  state.crew = state.crewMembers.length;
}

// A member's maximum health, which falls as their dose builds up.
function maxHealth(member) {
  return 100 - (100 - MIN_MAX_HEALTH) * Math.min(1, member.dose / DOSE_LIMIT);
}

function lowestHealth() {
  return Math.min(...state.crewMembers.map((m) => m.health));
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
  const b = {
    type, disabled: 0, reinforced: false, priority: BUILDINGS[type].priority || null,
    construct: 0, reinforcing: 0, queued: {},   // remaining work per job, and when each was queued
  };
  if (BUILDINGS[type].solar) Object.assign(b, { dust: 0, cleaning: 0 });
  if (BUILDINGS[type].heat) b.tempK = SETPOINT_K;
  if (type === "greenhouse") b.crop = 1;
  return b;
}

// ---------- Jobs ----------
// A job is remaining work in one of a building's JOB_FIELD fields. Crew pick
// jobs up in updateWork() (js/simulation.js).
function startJob(t, kind, work) {
  t.building[JOB_FIELD[kind]] = work;
  t.building.queued[kind] = state.jobSeq++;
}

// Not working: damaged or still being built. Switched off is separate.
function offline(b) {
  return b.disabled > 0 || b.construct > 0;
}

// Reason a Solar Array can't be cleaned, or null if it can.
function cleanBlocker(t) {
  if (!t || !t.building) return "No building";
  if (!BUILDINGS[t.building.type].solar) return "Only Solar Arrays collect dust";
  if (t.building.construct > 0) return "Still under construction";
  if (t.building.cleaning > 0) return "Already queued for cleaning";
  if (t.building.dust < 0.01) return "Nothing to clean";
  return null;
}

// Queue a cleaning job. The array goes offline while someone works on it,
// and its dust is gone when they finish.
function clean(t) {
  if (cleanBlocker(t)) return false;
  startJob(t, "clean", CLEAN_SECONDS);
  return true;
}

// Reason a building can't be given a shortage priority, or null if it can.
function priorityBlocker(t, priority) {
  if (!t || !t.building) return "No building";
  if (state.mission.priorities === false) return "Shortage priorities aren't available in this mission";
  if (!PRIORITIES[priority]) return "Unknown priority";
  const b = BUILDINGS[t.building.type];
  if (!b.priority) return "Draws no power or water, so it has no priority";
  if (priority === "off" && b.alwaysOn) return `The ${b.name} is life support and can't be switched off`;
  return null;
}

function setPriority(t, priority) {
  if (priorityBlocker(t, priority)) return false;
  t.building.priority = priority;
  return true;
}

function canAffordCost(cost) {
  return Object.entries(cost).every(([k, v]) => state.resources[k] >= v);
}

// Reason a building can't be reinforced, or null if it can.
function reinforceBlocker(t) {
  if (!t || !t.building) return "No building";
  if (t.building.reinforced) return "Already reinforced";
  if (t.building.reinforcing > 0) return "Already being reinforced";
  if (t.building.construct > 0) return "Still under construction";
  if (!canAffordCost(REINFORCE.cost)) return "Not enough materials";
  return null;
}

function reinforce(t) {
  if (reinforceBlocker(t)) return false;
  for (const [k, v] of Object.entries(REINFORCE.cost)) state.resources[k] -= v;
  startJob(t, "reinforce", REINFORCE.work);   // takes effect when the job is done
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
  startJob(t, "construct", BUILDINGS[type].work);   // a construction site until the crew finish it
  return true;
}

// Reason a construction site can't be cancelled, or null if it can.
function cancelBlocker(t) {
  if (!t || !t.building || !(t.building.construct > 0)) return "Not under construction";
  if (!canDemolish(t)) return "Would disconnect the outpost";
  return null;
}

// Cancel construction: the site goes, and the cost comes back in full.
function cancel(t) {
  if (cancelBlocker(t)) return false;
  for (const [k, v] of Object.entries(BUILDINGS[t.building.type].cost)) state.resources[k] += v;
  t.building = null;
  return true;
}

// Reason a building can't be demolished, or null if it can.
function demolishBlocker(t) {
  if (t && t.building && t.building.construct > 0) return "Still under construction: cancel it for a full refund";
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
