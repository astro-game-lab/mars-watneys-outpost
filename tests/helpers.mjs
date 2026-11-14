// Shared test helpers.

// Build and finish at once, skipping the crew's construction work: for tests
// about what a working building does, not about how it gets built.
export function buildNow(sim, type, t) {
  if (!sim.build(type, t)) return false;
  t.building.construct = 0;
  delete t.building.queued.construct;
  return true;
}
