// Resource simulation: production, consumption, power/water shortages,
// day/night, radiation, crew health, win/lose.

function solTime() {
  return (state.time % SOL_SECONDS) / SOL_SECONDS;
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

  // Water: extractors depend on power.
  let wProd = 0, wCons = CREW_NEEDS.water;
  for (const t of list) {
    const b = BUILDINGS[t.building.type];
    const lv = level(t);
    wProd += (b.produces.water || 0) * outputMultiplier(t) * lv;
    wCons += (b.consumes.water || 0) * (t.building.disabled > 0 ? 0 : factor.power);
  }
  if (state.resources.water <= 0.01 && wCons > wProd) factor.water = wCons ? wProd / wCons : 1;

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
  for (const [k, v] of Object.entries(CREW_NEEDS)) add(cons, k, v * state.crew);

  const rates = {};
  for (const r of RESOURCES) rates[r.key] = (prod[r.key] || 0) - (cons[r.key] || 0);
  return { rates, prod, factor, crewCapacity, shielding, powerCapacity };
}

function updateGame(dt) {
  if (state.over || state.paused) return;

  const prevPhase = dayPhase(solTime());
  state.time += dt;
  const newSol = Math.floor(state.time / SOL_SECONDS) + 1;
  if (newSol !== state.sol) {
    state.sol = newSol;
    say(`Sol ${newSol}. Still alive. Log entry complete.`, "good");
    if (newSol >= state.nextArrivalSol) tryCrewArrival();
  }
  if (prevPhase !== dayPhase(solTime()) && dayPhase(solTime()) === "🌑 Night") sayOnce("night");

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
    BASE_RADIATION + (hasEffect("flare") ? 40 : 0) - flows.shielding));

  // Crew health
  let dmg = 0;
  for (const k of ["water", "food", "oxygen"]) if (res[k] <= 0) dmg += k === "oxygen" ? 4 : 2;
  if (state.radiation > 50) dmg += (state.radiation - 50) * 0.08;
  if (dmg > 0) state.health -= dmg * dt;
  else state.health = Math.min(100, state.health + 0.5 * dt);

  checkWarnings();

  if (state.health <= 0) {
    state.health = 0;
    endGame("lose");
  } else if (state.sol >= WIN_SOL && state.creditsEarned >= WIN_CREDITS) {
    endGame("win");
  }
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
    say(`NASA postponed the next crew landing: ${blocker}. They'll try again next sol.`, "bad");
    state.nextArrivalSol = state.sol + 1;
    return;
  }
  const name = CREW_NAMES[(state.crew - 1) % CREW_NAMES.length];
  state.crew++;
  state.nextArrivalSol = state.sol + CREW_ARRIVAL_SOLS;
  say(`${name} just landed! Crew is now ${state.crew}. More science, but more mouths to feed.`, "good");
}

// Seconds until a resource runs out (Infinity if not falling).
function timeLeft(key) {
  const rate = state.rates[key] || 0;
  return rate < -0.001 ? state.resources[key] / -rate : Infinity;
}

// "good" | "warn" | "crit"
function resourceStatus(key) {
  if (key === "materials" || key === "credits") return "good";
  if (state.resources[key] <= 0.01 && (state.rates[key] || 0) <= 0) return "crit";
  const tl = timeLeft(key);
  if (tl < 20) return "crit";
  if (tl < 60) return "warn";
  return "good";
}

function checkWarnings() {
  if (resourceStatus("power") !== "good") sayOnce(state.resources.power <= 0.01 ? "noPower" : "lowPower");
  if (resourceStatus("water") !== "good") sayOnce("lowWater");
  if (resourceStatus("food") !== "good") sayOnce("lowFood");
  if (resourceStatus("oxygen") !== "good") sayOnce("lowOxygen");
  if (state.radiation > 50) sayOnce("highRadiation");
  if (state.health < 40) sayOnce("lowHealth");
}
