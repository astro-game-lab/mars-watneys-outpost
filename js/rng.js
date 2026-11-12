// Seeded random numbers (mulberry32). Every random draw in the simulation goes
// through state.rng, so one seed plus the same inputs replays the same mission.
// The generator is a plain object, so its state can be copied or inspected.

function createRng(seed) {
  return { s: seed >>> 0 };
}

// Next float in [0, 1). Advances the generator.
function rngNext(rng) {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Simulation randomness: always the running mission's generator.
function rand() {
  return rngNext(state.rng);
}

// Pick a key from [[key, weight], ...] in proportion to its weight.
function pickWeighted(rng, entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let n = rngNext(rng) * total;
  for (const [key, w] of entries) {
    if ((n -= w) < 0) return key;
  }
  return entries[entries.length - 1][0];
}
