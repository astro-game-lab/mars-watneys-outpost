// Random events. Timed effects live in state.effects.

const EVENTS = [
  {
    kind: "dust", weight: 3,
    start() {
      addEffect("dust", "🌪️ Dust storm: solar −70%", 30);
      say("Dust storm incoming! My solar panels are going to hate this.", "bad");
    },
  },
  {
    kind: "flare", weight: 2,
    start() {
      addEffect("flare", "☢️ Solar flare: radiation +40%", 20);
      say("Solar flare! Staying inside the shielded areas.", "bad");
    },
  },
  {
    kind: "meteor", weight: 2,
    start() {
      const list = buildings();
      const t = list[Math.floor(Math.random() * list.length)];
      t.building.disabled = 30;
      say(`Micrometeorite hit the ${BUILDINGS[t.building.type].name}! Repairs will take a while.`, "bad");
    },
  },
  {
    kind: "failure", weight: 2,
    start() {
      addEffect("failure", "🔧 Pump failure: water −50%", 25);
      say("Water pump is acting up. Output's down until I fix it.", "bad");
    },
  },
  {
    kind: "supply", weight: 2,
    start() {
      state.resources.materials += 50;
      state.resources.credits += 100;
      say("Supply drop from NASA! +50 materials, +100 credits. Thanks, Earth!", "good");
    },
  },
];

function addEffect(kind, label, duration) {
  const existing = state.effects.find((e) => e.kind === kind);
  if (existing) existing.remaining = Math.max(existing.remaining, duration);
  else state.effects.push({ kind, label, remaining: duration });
}

function hasEffect(kind) {
  return state.effects.some((e) => e.kind === kind);
}

function updateEvents(dt) {
  for (const e of state.effects) e.remaining -= dt;
  state.effects = state.effects.filter((e) => e.remaining > 0);
  for (const t of buildings()) {
    if (t.building.disabled > 0) t.building.disabled = Math.max(0, t.building.disabled - dt);
  }

  state.nextEventIn -= dt;
  if (state.nextEventIn <= 0) {
    state.nextEventIn = 40 + Math.random() * 30;
    const total = EVENTS.reduce((s, e) => s + e.weight, 0);
    let n = Math.random() * total;
    for (const e of EVENTS) {
      if ((n -= e.weight) < 0) { e.start(); break; }
    }
  }
}
