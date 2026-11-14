// Resource simulation: production, consumption, power/water shortages,
// day/night, radiation, crew health, objectives, win/lose.
// updateGame() advances exactly one fixed SIM_STEP. Nothing here touches the
// DOM or calls the UI: messages go to state.outbox, and the end of a mission
// is recorded in state.over and state.endCause for the UI to pick up.

// The time of day, 0..1 of a sol, and the sol: from the step count on the
// clock, so both are exact. Tests may set state.time directly; it is snapped to
// the nearest step.
function clockSteps() {
  return Math.round(state.time / SIM_STEP);
}
function solTime() {
  return (clockSteps() % STEPS_PER_SOL) / STEPS_PER_SOL;
}

// What the whole crew consumes of a need per second, at this difficulty.
function crewNeed(k) {
  return CREW_NEEDS[k] * state.crew * difficulty().needs;
}

// Production multiplier for a building, before input shortages.
function outputMultiplier(t) {
  const b = spec(t.building.type);
  let m = (b.bonus && b.bonus[t.terrain]) || 1;
  if (b.solar) {
    m *= daylight(solTime()) * (hasEffect("dust") ? 0.3 : 1) * (1 - t.building.dust) * (state.mission.sunlight ?? 1);
    if (beingWorked(t.building, "clean")) m = 0;   // offline while someone cleans it
  }
  if (b.key === "water" && hasEffect("failure")) m *= 0.5;
  if (b.key === "lab") m *= 1 + CREW_SCIENCE_BONUS * (state.crew - 1);
  if (b.key === "lab" && t.building.tempK < COLD_K) m = 0;    // too cold to work
  if (t.building.crop !== undefined) m *= t.building.crop;    // frost-damaged crop
  return m;
}

// ---------- Temperature ----------

// The outside temperature at a time of day (0..1 of a sol): a smooth curve,
// lowest just before dawn and highest in the early afternoon.
function outsideTempK(t) {
  const { min, max, minAt, maxAt } = (state && state.climate) || OUTSIDE_K;
  const warming = maxAt - minAt;                       // fraction of the sol spent warming
  const since = (t - minAt + 1) % 1;                   // time since the low
  const rise = since < warming ? since / warming : 1 - (since - warming) / (1 - warming);
  return min + (max - min) * (1 - Math.cos(Math.PI * rise)) / 2;
}

// A heated building's heat loss per kelvin of difference from outside.
function heatLoss(b) {
  return b.heat / (HEATER_HEADROOM * (SETPOINT_K - OUTSIDE_K.min));
}

// What a building's thermostat asks its heater for this step: whatever holds
// the setpoint against the current loss, plus enough to climb back to it if
// the building has cooled, up to the heater's maximum.
function heatingDemand(t, outside = outsideTempK(solTime())) {
  const b = spec(t.building.type);
  if (!b.heat) return 0;
  const loss = heatLoss(b);
  const T = t.building.tempK;
  const lost = loss * (T - outside);
  const catchUp = loss * THERMAL_TAU * (SETPOINT_K - T) / SIM_STEP;
  return Math.max(0, Math.min(b.heat, lost + catchUp));
}

// Power a building draws at full operation right now: its base load plus heating.
function powerDemand(t, outside) {
  return (spec(t.building.type).consumes.power || 0) + heatingDemand(t, outside);
}

// Each heated building warms with the heat it got this step and cools toward
// the outside temperature:  dT/dt = (heat delivered ÷ loss − (T − T_outside)) ÷ THERMAL_TAU.
// Greenhouse crops take frost damage below FROST_K, and regrow while warm.
function updateTemperatures(dt) {
  const outside = outsideTempK(solTime());
  for (const t of buildings()) {
    const bld = t.building, b = spec(bld.type);
    if (!b.heat || bld.construct > 0) continue;   // a site isn't sealed or heated yet
    const delivered = bld.heatDelivered || 0;
    bld.tempK += (dt * (delivered / heatLoss(b) - (bld.tempK - outside))) / THERMAL_TAU;
    bld.tempK = Math.min(SETPOINT_K, bld.tempK);
    if (bld.crop !== undefined) {
      if (bld.tempK < FROST_K) bld.crop = Math.max(0, bld.crop - CROP_FROST_RATE * dt);
      else bld.crop = Math.min(1, bld.crop + dt / (CROP_REGROW_SOLS * SOL_SECONDS));
    }
  }
}

// Which Habitat each crew member sleeps in: the warmest working Habitats fill
// first, two to a Habitat; ties go to tile order. Anyone without a bed shares
// the warmest. Returns a Map from member to tile.
function assignBeds() {
  const habitats = buildings().filter((t) => t.building.type === "habitat" && !offline(t.building))
    .sort((a, b) => b.building.tempK - a.building.tempK);   // stable: ties keep tile order
  const beds = [];
  for (const t of habitats) for (let i = 0; i < BUILDINGS.habitat.crew; i++) beds.push(t);
  const fallback = habitats[0] || buildings().find((t) => t.building.type === "habitat");
  const assigned = new Map();
  state.crewMembers.forEach((m, i) => { if (beds[i] || fallback) assigned.set(m, beds[i] || fallback); });
  return assigned;
}

// ---------- Crew work ----------

// Every job waiting to be done, in the order the crew take them: by kind
// (JOB_ORDER), then oldest first, then tile order.
function pendingJobs() {
  const jobs = [];
  state.tiles.forEach((t, tile) => {
    if (!t.building) return;
    JOB_ORDER.forEach((kind, rank) => {
      if (t.building[JOB_FIELD[kind]] > 0) jobs.push({ t, tile, kind, rank, seq: t.building.queued[kind] ?? -1 });
    });
  });
  return jobs.sort((a, b) => a.rank - b.rank || a.seq - b.seq || a.tile - b.tile);
}

function beingWorked(b, kind) {
  return !!(b.working && b.working[kind]);
}

// Crew member i takes job i, one worker to a job, at 1 unit of work a
// second. Each job's progress lives on its building, so who does it can
// change from step to step without losing anything.
function updateWork(dt) {
  for (const t of state.tiles) if (t.building) t.building.working = null;
  const jobs = pendingJobs();
  state.crewMembers.forEach((m, i) => {
    const job = jobs[i];
    m.job = job ? { tile: job.tile, kind: job.kind } : null;
    if (!job) return;
    const b = job.t.building, field = JOB_FIELD[job.kind];
    (b.working ??= {})[job.kind] = m.name;
    b[field] = Math.max(0, b[field] - dt);
    if (b[field] < TIME_EPS) finishJob(job.t, job.kind, m);
  });
  state.jobsWaiting = Math.max(0, jobs.length - state.crewMembers.length);
}

function finishJob(t, kind, member) {
  const b = t.building, name = spec(b.type).name;
  b[JOB_FIELD[kind]] = 0;
  delete b.queued[kind];
  delete b.jobTotal[kind];
  if (b.working) delete b.working[kind];
  if (kind === "construct") emit(`The ${name} is finished${member.arrival ? `, thanks to ${member.name}` : ""}. Up and running.`, "good");
  else if (kind === "repair") emit(`${member.name} has the ${name} working again.`, "good");
  else if (kind === "clean") { b.dust = 0; emit("Solar Array's clean and back online. Shiny.", "good"); }
  else if (kind === "reinforce") { b.reinforced = true; emit(`Regolith's piled over the ${name}. Mars dirt: now with radiation protection.`, "good"); }
}

// Dust settles on Solar Arrays, faster in a storm. An array being cleaned
// collects none, and comes back with none.
function updateDust(dt) {
  const settle = (DUST_PER_SOL / SOL_SECONDS) * (hasEffect("dust") ? DUST_STORM_FACTOR : 1) * dt;
  for (const t of buildings()) {
    const b = t.building;
    if (!spec(b.type).solar || b.construct > 0 || beingWorked(b, "clean")) continue;
    b.dust = Math.min(DUST_MAX, b.dust + settle);
  }
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
  const running = (t) => !offline(t.building) && t.building.priority !== "off";

  // Each building's heating and power demand, worked out once for this step.
  const outside = outsideTempK(solTime());
  const heatingOf = new Map(list.map((t) => [t, heatingDemand(t, outside)]));
  const demandOf = (t) => (spec(t.building.type).consumes.power || 0) + heatingOf.get(t);

  // Power: producers have no inputs, and nothing throttles them.
  let pProd = 0;
  const pDemand = {};
  for (const t of list) {
    const b = spec(t.building.type);
    if (offline(t.building)) continue;
    pProd += (b.produces.power || 0) * outputMultiplier(t);
    const demand = demandOf(t);
    if (running(t) && demand > 0) add(pDemand, t.building.priority, demand);
  }
  const pTotal = sumValues(pDemand);
  const powerShare = state.resources.power <= 0.01 && pTotal > pProd ? allocate(pProd, pDemand) : fullShare();
  const powerLevelOf = new Map(list.map((t) => [t,
    !running(t) ? 0 : demandOf(t) > 0 ? powerShare[t.building.priority] : 1]));
  const powerLevel = (t) => powerLevelOf.get(t);

  // Water: extractors depend on power, and buildings want water only as fast
  // as their power lets them run. The crew drinks first.
  const crewWater = crewNeed("water");
  let wProd = 0;
  const wDemand = {};
  for (const t of list) {
    const b = spec(t.building.type);
    const lv = powerLevel(t);
    wProd += (b.produces.water || 0) * outputMultiplier(t) * lv;
    if (b.consumes.water && lv > 0) add(wDemand, t.building.priority, b.consumes.water * lv);
  }
  const wTotal = sumValues(wDemand);
  const waterShare = state.resources.water <= 0.01 && crewWater + wTotal > wProd
    ? allocate(Math.max(0, wProd - crewWater), wDemand) : fullShare();
  const level = (t) => {
    const lv = powerLevel(t);
    return spec(t.building.type).consumes.water && lv > 0 ? lv * waterShare[t.building.priority] : lv;
  };

  // Final flows.
  let crewCapacity = 0, shielding = 0, powerCapacity = POWER_CAPACITY;
  for (const t of list) {
    const b = spec(t.building.type);
    const lv = level(t);
    t.building.level = lv;
    for (const [k, v] of Object.entries(b.produces)) add(prod, k, v * outputMultiplier(t) * (k === "power" ? (offline(t.building) ? 0 : 1) : lv));
    for (const [k, v] of Object.entries(b.consumes)) if (k !== "power") add(cons, k, v * lv);
    if (lv > 0) add(cons, "power", (b.consumes.power || 0) * lv);
    // The heater runs on power alone, so it gets the building's power share
    // even if a water shortage has slowed the rest of the building.
    const heat = heatingOf.get(t) * powerLevel(t);
    t.building.heatDelivered = heat;
    if (heat > 0) add(cons, "power", heat);
    if (t.building.reinforced) shielding += REINFORCE.radiation; // passive, works even when damaged or off
    if (offline(t.building)) continue;
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
  state.time = (state.startTick + state.tick) * SIM_STEP;
  const newSol = Math.floor(clockSteps() / STEPS_PER_SOL) + 1;
  if (newSol !== state.sol) {
    state.sol = newSol;
    emit(`Sol ${newSol}. Still alive. Log entry complete.`, "good");
    if (state.mission.crewArrivals !== false && newSol >= state.nextArrivalSol) tryCrewArrival();
  }
  if (prevPhase !== dayPhase(solTime()) && dayPhase(solTime()) === "🌑 Night") emitLine("night");

  updateEvents(dt);
  updateDust(dt);   // before work, so an array cleaned this step ends it clean
  updateWork(dt);

  const flows = refreshFlows();

  updateTemperatures(dt);

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

  // Everyone shares the air and the stores, so harm hits every member alike.
  // Dose builds up for everyone and never heals; it lowers each member's
  // maximum health, and recovery stops there.
  // A cold Habitat hurts only the crew sleeping in it.
  const beds = assignBeds();
  let worstCold = 0;
  for (const m of state.crewMembers) {
    m.dose += (state.radiation / 100) * dt;
    const bed = beds.get(m);
    m.bed = bed ? state.tiles.indexOf(bed) : null;
    const cold = bed && bed.building.tempK < COLD_K ? COLD_HARM * (COLD_K - bed.building.tempK) : 0;
    worstCold = Math.max(worstCold, cold);
    const harmed = dmg + cold;
    if (harmed > 0) m.health -= harmed * dt;
    else m.health += 0.5 * dt;
    m.health = Math.min(m.health, maxHealth(m));
  }
  if (worstCold > 0) {
    stats.damage.cold += worstCold * dt;
    if (stats.firstEmpty.cold === undefined) stats.firstEmpty.cold = state.time;
  }
  updateCareerLimits();

  checkWarnings();
  checkEnd();
}

// Crew who reach the career dose limit go home. If it's Watney, the mission
// is over.
function updateCareerLimits() {
  for (const m of [...state.crewMembers]) {
    if (m.dose < DOSE_LIMIT) continue;
    state.stats.left.push({ name: m.name, time: state.time });
    if (m === state.crewMembers[0]) return finish("lose", "dose");
    removeCrewMember(m);
    emit(`${m.name} has reached the career radiation dose limit and is heading home. Crew is now ${state.crew}.`, "bad");
  }
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
  if (state.over) return;   // already ended this step, by a dose limit
  const dead = state.crewMembers.find((m) => m.health <= 0);
  if (dead) {
    dead.health = 0;
    state.stats.lost = { name: dead.name, time: state.time };
    return finish("lose", "health");
  }
  if (objectivesMet()) return finish("win", "objectives");
  for (const f of state.mission.failures) {
    if (f.type === "blackout" && state.resources.power <= 0.01) return finish("lose", "blackout");
    if (f.type === "deadline" && state.sol >= f.sol) return finish("lose", "deadline");
    if (f.type === "dose") {
      const over = state.crewMembers.find((m) => m.dose > f.value * DOSE_LIMIT);
      if (over) {
        state.stats.overdosed = { name: over.name, time: state.time, share: f.value };
        return finish("lose", "dosecap");
      }
    }
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
  const { name } = addCrewMember();
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
  if (lowestHealth() < 40) emitLine("lowHealth");
  const heated = buildings().filter((t) => t.building.tempK !== undefined);
  if (heated.some((t) => t.building.type === "greenhouse" && t.building.tempK < FROST_K + 3)) emitLine("frost", 60);
  if (heated.some((t) => t.building.type === "habitat" && t.building.tempK < COLD_K &&
      state.crewMembers.some((m) => m.bed === state.tiles.indexOf(t)))) emitLine("cold", 60);
  if (state.crewMembers.some((m) => m.dose >= DOSE_WARNING * DOSE_LIMIT)) emitLine("highDose", 120);
}
