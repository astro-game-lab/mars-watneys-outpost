// Resource simulation: production, consumption, power/water shortages,
// day/night, radiation, crew health, objectives, win/lose.
// updateGame() advances exactly one fixed SIM_STEP. Nothing here touches the
// DOM or calls the UI: messages go to state.outbox, and the end of a mission
// is recorded in state.over and state.endCause for the UI to pick up.

function solTime() {
  return (state.time % SOL_SECONDS) / SOL_SECONDS;
}

// What the whole crew consumes of a need per second, at this difficulty.
function crewNeed(k) {
  return CREW_NEEDS[k] * state.crew * difficulty().needs;
}

// Production multiplier for a building, before input shortages.
function outputMultiplier(t) {
  const b = BUILDINGS[t.building.type];
  let m = (b.bonus && b.bonus[t.terrain]) || 1;
  if (b.solar) m *= daylight(solTime()) * (hasEffect("dust") ? 0.3 : 1);
  if (b.key === "water" && hasEffect("failure")) m *= 0.5;
  if (b.key === "lab") m *= 1 + CREW_SCIENCE_BONUS * (state.crew - 1);
  return m;
}

// Power a building draws at full operation right now: its base load plus
// heating, which depends on the time of day.
function powerDemand(t) {
  const b = BUILDINGS[t.building.type];
  return (b.consumes.power || 0) + (b.heat || 0) * thermalLoad(solTime());
}

// Share `supply` out tier by tier (SUPPLY_TIERS: critical, normal, low).
// Each tier gets as much of its demand as is left after the tiers before it,
// as a fraction from 0 to 1; buildings in the same tier share alike.
function allocate(supply, demand) {
  const share = {};
  let left = supply;
  for (const tier of SUPPLY_TIERS) {
    const d = demand[tier] || 0;
    share[tier] = d > 0 ? Math.min(1, left / d) : 1;
    left = Math.max(0, left - d);
  }
  return share;
}

const sumValues = (obj) => Object.values(obj).reduce((s, v) => s + v, 0);
const fullShare = () => Object.fromEntries(SUPPLY_TIERS.map((tier) => [tier, 1]));

// Compute every building's actual operating level and the net rates.
//
// Shortages are resolved in order: power, then water. Power is short when
// stored power is empty and consumers want more than is generated; water is
// short when stored water is empty and the crew and buildings want more than
// is produced. The crew drinks first and is never throttled. Each shortage is
// shared out by priority tier (allocate()), so a building's level is
//   (its tier's share of power) × (its tier's share of water)
// for whichever of the two it consumes. Water shares are fractions of the
// buildings' power-limited demand, so the product never draws more than there is.
function computeFlows() {
  const list = buildings();
  const prod = {}, cons = {};
  const add = (obj, k, v) => { obj[k] = (obj[k] || 0) + v; };
  const running = (t) => t.building.disabled <= 0 && t.building.priority !== "off";

  // Power: producers have no inputs, and nothing throttles them.
  let pProd = 0;
  const pDemand = {};
  for (const t of list) {
    const b = BUILDINGS[t.building.type];
    if (t.building.disabled > 0) continue;
    pProd += (b.produces.power || 0) * outputMultiplier(t);
    const demand = powerDemand(t);
    if (running(t) && demand > 0) add(pDemand, t.building.priority, demand);
  }
  const pTotal = sumValues(pDemand);
  const powerShare = state.resources.power <= 0.01 && pTotal > pProd ? allocate(pProd, pDemand) : fullShare();
  const powerLevel = (t) => {
    if (!running(t)) return 0;
    return powerDemand(t) > 0 ? powerShare[t.building.priority] : 1;
  };

  // Water: extractors depend on power, and buildings want water only as fast
  // as their power lets them run. The crew drinks first.
  const crewWater = crewNeed("water");
  let wProd = 0;
  const wDemand = {};
  for (const t of list) {
    const b = BUILDINGS[t.building.type];
    const lv = powerLevel(t);
    wProd += (b.produces.water || 0) * outputMultiplier(t) * lv;
    if (b.consumes.water && lv > 0) add(wDemand, t.building.priority, b.consumes.water * lv);
  }
  const wTotal = sumValues(wDemand);
  const waterShare = state.resources.water <= 0.01 && crewWater + wTotal > wProd
    ? allocate(Math.max(0, wProd - crewWater), wDemand) : fullShare();
  const level = (t) => {
    const lv = powerLevel(t);
    return BUILDINGS[t.building.type].consumes.water && lv > 0 ? lv * waterShare[t.building.priority] : lv;
  };

  // Final flows.
  let crewCapacity = 0, shielding = 0, powerCapacity = POWER_CAPACITY;
  for (const t of list) {
    const b = BUILDINGS[t.building.type];
    const lv = level(t);
    t.building.level = lv;
    for (const [k, v] of Object.entries(b.produces)) add(prod, k, v * outputMultiplier(t) * (k === "power" ? (t.building.disabled > 0 ? 0 : 1) : lv));
    for (const [k, v] of Object.entries(b.consumes)) if (k !== "power") add(cons, k, v * lv);
    if (lv > 0) add(cons, "power", powerDemand(t) * lv);
    if (t.building.reinforced) shielding += REINFORCE.radiation; // passive, works even when damaged or off
    if (t.building.disabled > 0) continue;
    crewCapacity += b.crew || 0;
    powerCapacity += b.storage || 0;
    shielding += (b.radiation || 0) * lv;
  }
  for (const k of Object.keys(CREW_NEEDS)) add(cons, k, crewNeed(k));

  // Overall fraction of demand met, for the HUD.
  const delivered = (share, demand, total) =>
    total > 0 ? SUPPLY_TIERS.reduce((s, tier) => s + share[tier] * (demand[tier] || 0), 0) / total : 1;
  const factor = { power: delivered(powerShare, pDemand, pTotal), water: delivered(waterShare, wDemand, wTotal) };

  const rates = {};
  for (const r of RESOURCES) rates[r.key] = (prod[r.key] || 0) - (cons[r.key] || 0);
  return {
    rates, prod, factor, crewCapacity, shielding, powerCapacity,
    shares: { power: powerShare, water: waterShare },
    demand: { power: pDemand, water: wDemand },
  };
}

// Recompute the flows and keep what the HUD and the rest of the step read.
function refreshFlows() {
  const flows = computeFlows();
  state.rates = flows.rates;
  state.efficiency = flows.factor.power;
  state.waterFactor = flows.factor.water;
  state.crewCapacity = flows.crewCapacity;
  state.powerCapacity = flows.powerCapacity;
  state.supply = { shares: flows.shares, demand: flows.demand };
  return flows;
}

// One fixed simulation step. Time comes from the tick count rather than a
// running sum, so sol boundaries land on the same step every run.
function updateGame() {
  if (state.over || state.paused) return;
  const dt = SIM_STEP;

  const prevPhase = dayPhase(solTime());
  state.tick++;
  state.time = state.startTime + state.tick * SIM_STEP;
  const newSol = Math.floor(state.time / SOL_SECONDS) + 1;
  if (newSol !== state.sol) {
    state.sol = newSol;
    emit(`Sol ${newSol}. Still alive. Log entry complete.`, "good");
    if (state.mission.crewArrivals !== false && newSol >= state.nextArrivalSol) tryCrewArrival();
  }
  if (prevPhase !== dayPhase(solTime()) && dayPhase(solTime()) === "🌑 Night") emitLine("night");

  updateEvents(dt);

  const flows = refreshFlows();

  const res = state.resources;
  for (const r of RESOURCES) {
    res[r.key] = Math.max(0, res[r.key] + flows.rates[r.key] * dt);
  }
  res.power = Math.min(state.powerCapacity, res.power);
  state.creditsEarned += (flows.prod.credits || 0) * dt;

  // Radiation: baseline + flare − shielding
  state.radiation = Math.max(0, Math.min(100,
    BASE_RADIATION + (hasEffect("flare") ? FLARE_RADIATION : 0) - flows.shielding));

  // Crew health. A need hurts only when the stock is empty and production
  // can't cover the crew. Each cause is tallied for the debrief.
  const stats = state.stats;
  const harm = {};
  for (const k of ["water", "food", "oxygen"]) {
    if (res[k] <= 0 && (flows.prod[k] || 0) < crewNeed(k)) {
      harm[k] = k === "oxygen" ? 4 : 2;
      if (stats.firstEmpty[k] === undefined) stats.firstEmpty[k] = state.time;
    }
  }
  if (state.radiation > 50) harm.radiation = (state.radiation - 50) * 0.08;
  const dmg = Object.values(harm).reduce((s, v) => s + v, 0);
  for (const [k, v] of Object.entries(harm)) stats.damage[k] += v * dt;
  if (dmg > 0) state.health -= dmg * dt;
  else state.health = Math.min(100, state.health + 0.5 * dt);

  checkWarnings();
  checkEnd();
}

// ---------- Objectives and failures ----------

// Current value of an objective, and whether it holds.
const OBJECTIVE_TYPES = {
  sol:       { value: () => state.sol,                         met: (o, v) => v >= o.value },
  credits:   { value: () => state.creditsEarned,               met: (o, v) => v >= o.value },
  crew:      { value: () => state.crew,                        met: (o, v) => v >= o.value },
  stock:     { value: (o) => state.resources[o.resource],      met: (o, v) => v >= o.value },
  radiation: { value: () => state.radiation,                   met: (o, v) => v <= o.value },
};

function objectiveValue(o) {
  return OBJECTIVE_TYPES[o.type].value(o);
}

function objectiveMet(o) {
  return OBJECTIVE_TYPES[o.type].met(o, objectiveValue(o));
}

function objectivesMet() {
  return state.mission.objectives.every(objectiveMet);
}

// Death first, then a win, then the mission's own failure conditions.
function checkEnd() {
  if (state.health <= 0) {
    state.health = 0;
    return finish("lose", "health");
  }
  if (objectivesMet()) return finish("win", "objectives");
  for (const f of state.mission.failures) {
    if (f.type === "blackout" && state.resources.power <= 0.01) return finish("lose", "blackout");
    if (f.type === "deadline" && state.sol >= f.sol) return finish("lose", "deadline");
  }
}

// End the mission. The frame loop sees state.over and shows the end screen.
function finish(result, cause) {
  state.over = result;
  state.endCause = cause;
}

// Why a new crew member can't arrive right now, or null if they can.
function arrivalBlocker() {
  if (state.crew >= state.crewCapacity) return "no free bed. Build another Habitat";
  const low = ["water", "food", "oxygen"].filter((k) => resourceStatus(k) !== "good");
  if (low.length) return `${low.map((k) => RESOURCES.find((r) => r.key === k).name.toLowerCase()).join(" and ")} supplies are too low`;
  return null;
}

// Checked at the start of each sol once an arrival is due; retries next sol if blocked.
function tryCrewArrival() {
  const blocker = arrivalBlocker();
  if (blocker) {
    emit(`NASA postponed the next crew landing: ${blocker}. They'll try again next sol.`, "bad");
    state.nextArrivalSol = state.sol + 1;
    return;
  }
  const name = CREW_NAMES[(state.crew - 1) % CREW_NAMES.length];
  state.crew++;
  state.nextArrivalSol = state.sol + (state.mission.crewArrivalSols || CREW_ARRIVAL_SOLS);
  emit(`${name} just landed! Crew is now ${state.crew}. More science, but more mouths to feed.`, "good");
}

// Seconds until a resource runs out (Infinity if not falling).
function timeLeft(key) {
  const rate = state.rates[key] || 0;
  return rate < -0.001 ? state.resources[key] / -rate : Infinity;
}

// "good" | "warn" | "crit"
function resourceStatus(key) {
  if (key === "materials" || key === "credits") return "good";
  if (state.resources[key] <= 0.01 && (state.rates[key] || 0) < 0.001) return "crit";
  const tl = timeLeft(key);
  if (tl < 20) return "crit";
  if (tl < 60) return "warn";
  return "good";
}

function checkWarnings() {
  if (resourceStatus("power") !== "good") emitLine(state.resources.power <= 0.01 ? "noPower" : "lowPower");
  if (resourceStatus("water") !== "good") emitLine("lowWater");
  if (resourceStatus("food") !== "good") emitLine("lowFood");
  if (resourceStatus("oxygen") !== "good") emitLine("lowOxygen");
  if (state.radiation > 50) emitLine("highRadiation");
  if (state.health < 40) emitLine("lowHealth");
}
