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

// Compute every building's actual operating level and the net rates.
function computeFlows() {
  const list = buildings();
  const prod = {}, cons = {};
  const add = (obj, k, v) => { obj[k] = (obj[k] || 0) + v; };

  // Per-resource supply factor for shortages (power and water can run out).
  const factor = { power: 1, water: 1 };
  const level = (t) => {
    if (t.building.disabled > 0) return 0;
    const b = BUILDINGS[t.building.type];
    let f = 1;
    for (const k of Object.keys(b.consumes)) if (factor[k] !== undefined) f = Math.min(f, factor[k]);
    return f;
  };

  // Power: producers have no inputs.
  let pProd = 0, pCons = 0;
  for (const t of list) {
    const b = BUILDINGS[t.building.type];
    if (t.building.disabled > 0) continue;
    pProd += (b.produces.power || 0) * outputMultiplier(t);
    pCons += b.consumes.power || 0;
  }
  if (state.resources.power <= 0.01 && pCons > pProd) factor.power = pCons ? pProd / pCons : 1;

  // Water: extractors depend on power. The crew drinks first and isn't
  // throttled, so buildings share only what's left after the crew's needs.
  // wBuild is what buildings would draw at their power-limited level; the
  // factor is a fraction of their full demand, because level() takes the
  // smaller of the power and water factors rather than multiplying them.
  const crewWater = crewNeed("water");
  let wProd = 0, wBuild = 0, wFull = 0;
  for (const t of list) {
    const b = BUILDINGS[t.building.type];
    const lv = level(t);
    wProd += (b.produces.water || 0) * outputMultiplier(t) * lv;
    if (t.building.disabled > 0) continue;
    wBuild += (b.consumes.water || 0) * factor.power;
    wFull += b.consumes.water || 0;
  }
  if (state.resources.water <= 0.01 && crewWater + wBuild > wProd) {
    factor.water = wFull ? Math.max(0, wProd - crewWater) / wFull : 1;
  }

  // Final flows.
  let crewCapacity = 0, shielding = 0, powerCapacity = POWER_CAPACITY;
  for (const t of list) {
    const b = BUILDINGS[t.building.type];
    const lv = level(t);
    t.building.level = lv;
    for (const [k, v] of Object.entries(b.produces)) add(prod, k, v * outputMultiplier(t) * (k === "power" ? (t.building.disabled > 0 ? 0 : 1) : lv));
    for (const [k, v] of Object.entries(b.consumes)) add(cons, k, v * lv);
    if (t.building.reinforced) shielding += REINFORCE.radiation; // passive, works even when damaged
    if (t.building.disabled > 0) continue;
    crewCapacity += b.crew || 0;
    powerCapacity += b.storage || 0;
    shielding += (b.radiation || 0) * lv;
  }
  for (const k of Object.keys(CREW_NEEDS)) add(cons, k, crewNeed(k));

  const rates = {};
  for (const r of RESOURCES) rates[r.key] = (prod[r.key] || 0) - (cons[r.key] || 0);
  return { rates, prod, factor, crewCapacity, shielding, powerCapacity };
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

  const flows = computeFlows();
  state.rates = flows.rates;
  state.efficiency = flows.factor.power;
  state.waterFactor = flows.factor.water;
  state.crewCapacity = flows.crewCapacity;
  state.powerCapacity = flows.powerCapacity;

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
