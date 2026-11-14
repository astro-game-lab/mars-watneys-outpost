// Random and scripted events. Timed effects live in state.effects. Event
// settings (weights, gaps, durations, scripted events) come from the mission,
// merged over EVENT_DEFAULTS in createState(). All draws use the seeded rand().

const EVENTS = {
  dust() {
    addEffect("dust", "🌪️ Dust storm: solar −70%", state.events.durations.dust);
    emit("Dust storm incoming! My solar panels are going to hate this.", "bad");
  },
  flare() {
    addEffect("flare", `☢️ Solar flare: radiation +${FLARE_RADIATION}%`, state.events.durations.flare);
    emit("Solar flare! Staying inside the shielded areas.", "bad");
  },
  meteor() {
    const list = buildings();
    const t = list[Math.floor(rand() * list.length)];
    t.building.disabled = state.events.durations.meteor;
    emit(`Micrometeorite hit the ${BUILDINGS[t.building.type].name}! Repairs will take a while.`, "bad");
  },
  failure() {
    addEffect("failure", "🔧 Pump failure: water −50%", state.events.durations.failure);
    emit("Water pump is acting up. Output's down until I fix it.", "bad");
  },
  supply() {
    const drop = state.events.supply;
    for (const [k, v] of Object.entries(drop)) state.resources[k] += v;
    emit(`Supply drop from NASA! ${Object.entries(drop).map(([k, v]) => `+${v} ${k}`).join(", ")}. Thanks, Earth!`, "good");
  },
};

function addEffect(kind, label, duration) {
  const existing = state.effects.find((e) => e.kind === kind);
  if (existing) existing.remaining = Math.max(existing.remaining, duration);
  else state.effects.push({ kind, label, remaining: duration });
}

function hasEffect(kind) {
  return state.effects.some((e) => e.kind === kind);
}

// Game time at which a scripted event fires.
function scriptedTime(e) {
  return (e.sol - 1 + e.at) * SOL_SECONDS;
}

function updateEvents(dt) {
  for (const e of state.effects) e.remaining -= dt;
  state.effects = state.effects.filter((e) => e.remaining > 0);
  for (const t of buildings()) {
    if (t.building.disabled > 0) t.building.disabled = Math.max(0, t.building.disabled - dt);
  }

  const cfg = state.events;
  while (state.nextScripted < cfg.scripted.length && state.time >= scriptedTime(cfg.scripted[state.nextScripted])) {
    EVENTS[cfg.scripted[state.nextScripted++].kind]();
  }

  const weights = Object.entries(cfg.weights).filter(([, w]) => w > 0);
  if (!weights.length) return;
  state.nextEventIn -= dt;
  if (state.nextEventIn <= 0) {
    const [min, max] = cfg.interval;
    state.nextEventIn = (min + rand() * (max - min)) * difficulty().eventGap;
    EVENTS[pickWeighted(state.rng, weights)]();
  }
}
