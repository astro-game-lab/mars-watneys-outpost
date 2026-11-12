// Game state: one object holds everything.

let state = null;

function createState() {
  state = {
    time: 0.3 * SOL_SECONDS,   // start in the morning
    sol: 1,
    speed: 1,
    paused: false,
    over: null,                // null | "win" | "lose"
    resources: { water: 320, food: 60, oxygen: 800, power: 100, materials: 100, credits: 500 },
    rates: {},
    creditsEarned: 0,
    health: 100,
    radiation: BASE_RADIATION,
    crew: 1,
    nextArrivalSol: 1 + CREW_ARRIVAL_SOLS,
    crewCapacity: 0,
    powerCapacity: POWER_CAPACITY,
    efficiency: 1,             // power-limited operating fraction
    effects: [],               // active events: { kind, label, remaining }
    nextEventIn: 45,
    tiles: createTiles(),
    selected: null,
    hovered: null,
  };
  placeStartingOutpost();
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

// Two habitats, a lab and a solar array on a passable cluster near the centre.
function placeStartingOutpost() {
  const center = tileAt(Math.floor(COLS / 2) - 1, Math.floor(ROWS / 2));
  const cluster = [center, ...neighbors(center)].slice(0, 4);
  const types = ["habitat", "habitat", "lab", "solar"];
  // Order: centre is habitat; make sure the lab touches a habitat (all neighbours of centre do).
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
