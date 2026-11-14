// Game data: terrain, buildings, balance constants. Tune numbers here.

const COLS = 11;
const ROWS = 8;

const SOL_SECONDS = 120;        // one Mars sol in real seconds
const POWER_CAPACITY = 200;     // base battery size (Battery Banks add more)
const BASE_RADIATION = 35;      // % exposure with no protection
const FLARE_RADIATION = 40;     // % exposure added during a solar flare

// Temperatures, in kelvin; the UI shows °C. Heated buildings (those with
// `heat`) hold SETPOINT_K while their heater keeps up. Each loses heat in
// proportion to the difference from the outside temperature, which follows a
// smooth daily curve between the Viking 1 extremes: its low just before dawn,
// its high in the early afternoon. A heater can deliver HEATER_HEADROOM times
// the loss on the coldest night, which sets each building's heat loss per
// kelvin. THERMAL_TAU sets how fast a building cools with no heat at all: an
// unpowered building at night reaches FROST_K in about two minutes.
const SETPOINT_K = 293;            // 20 °C
const COLD_K = 283;                // 10 °C: crew in a colder Habitat get hurt, and Labs stop
const FROST_K = 273;               // 0 °C: Greenhouse crops take frost damage
const OUTSIDE_K = { min: 184, max: 242, minAt: 0.18, maxAt: 0.58 };   // sol fractions
const HEATER_HEADROOM = 1.25;
const THERMAL_TAU = 600;           // game seconds
const COLD_HARM = 0.1;             // health per second per kelvin below COLD_K
const CROP_FROST_RATE = 0.02;      // crop lost per second below FROST_K: 50 s of frost kills it
const CROP_REGROW_SOLS = 1;        // a dead crop regrows in this long, while warm

// Dust on Solar Arrays. `dust` is the share of an array's output lost, from 0
// to DUST_MAX. It settles faster during a dust storm. Cleaning by hand takes an
// array offline for CLEAN_SECONDS; a dust devil cleans each array with chance
// DEVIL.chance, leaving DEVIL.keep of its dust behind.
const DUST_PER_SOL = 0.04;      // in clear weather; real arrays lose ~0.2% a sol
const DUST_STORM_FACTOR = 5;
const DUST_MAX = 0.6;
const CLEAN_SECONDS = 10;       // the work it takes to clean an array
const DEVIL = { chance: 0.6, keep: 0.2 };

// Fixed simulation step, in game seconds: a whole number of steps to the sol.
// The frame loop accumulates game time and runs whole steps, so a mission
// plays out the same at any frame rate. The clock counts steps, so the time of
// day and the sol never depend on rounding. Timers that count down by whole
// steps end when less than TIME_EPS (half a step) is left, for the same reason.
const STEPS_PER_SOL = 2400;
const SIM_STEP = SOL_SECONDS / STEPS_PER_SOL;
const TIME_EPS = SIM_STEP / 2;

// What a mission starts with unless it says otherwise (see js/missions.js).
// `time` is the fraction of Sol 1 the mission starts at. The outpost is placed
// on the centre tile and its neighbours, in this order, so the first entry
// should be a Habitat (Science Labs must touch one).
const DEFAULT_START = {
  time: 0.3,
  crew: 1,
  outpost: ["habitat", "habitat", "lab", "solar"],
  resources: { water: 320, food: 60, oxygen: 800, power: 100, materials: 100, credits: 500 },
};

// Random events unless a mission overrides them. A random event fires every
// `interval` game seconds (uniform in [min, max]); the first after `first`.
const EVENT_DEFAULTS = {
  first: 45,
  interval: [40, 70],
  weights: { dust: 3, flare: 2, meteor: 2, failure: 2, supply: 2, devil: 1 },
  durations: { dust: 30, flare: 20, meteor: 15, failure: 25 },   // meteor: work to repair
  supply: { materials: 50, credits: 100 },
  scripted: [],                 // [{ sol, at: fraction of the sol, kind }]
};

// Difficulty tiers, unlocked once the campaign is finished. They scale crew
// consumption, the starting water, food and oxygen (not the build budget),
// and the gap between random events.
const DIFFICULTIES = {
  normal:  { name: "Normal",  needs: 1,    start: 1,    eventGap: 1,    blurb: "The missions as designed." },
  hard:    { name: "Hard",    needs: 1.2,  start: 0.9,  eventGap: 0.8,  blurb: "Hungrier crew, thinner supplies, more frequent trouble." },
  martian: { name: "Martian", needs: 1.4,  start: 0.8,  eventGap: 0.6,  blurb: "A crew that eats like it's training for something, short supplies, and trouble every half-minute or so." },
};
const DIFFICULTY_ORDER = ["normal", "hard", "martian"];

const TERRAIN = {
  regolith:   { name: "Regolith", color: "#c9824f" },
  rocky:      { name: "Rocky", color: "#8a3b2a" },
  ice:        { name: "Ice deposit", color: "#7fc8ff" },
  resource:   { name: "High-resource", color: "#f2c94c" },
  impassable: { name: "Impassable", color: "#1a1a1a" },
};
const TERRAIN_WEIGHTS = [
  ["regolith", 5], ["rocky", 3], ["ice", 1], ["resource", 1], ["impassable", 1],
];
// Characters for handmade mission maps (one string per row, COLS long).
const TERRAIN_CHARS = { ".": "regolith", r: "rocky", i: "ice", $: "resource", "#": "impassable" };

const RESOURCES = [
  { key: "water",     icon: "💧", name: "Water" },
  { key: "food",      icon: "🥔", name: "Food" },
  { key: "oxygen",    icon: "O₂", name: "Oxygen" },
  { key: "power",     icon: "⚡", name: "Power" },
  { key: "materials", icon: "⛏️", name: "Materials" },
  { key: "credits",   icon: "💰", name: "Credits" },
];
const ICON = Object.fromEntries(RESOURCES.map((r) => [r.key, r.icon]));

// Crew arrivals: NASA sends one astronaut every CREW_ARRIVAL_SOLS sols,
// if there's a free bed and water/food/oxygen aren't in warning.
const CREW_ARRIVAL_SOLS = 2;
const CREW_SCIENCE_BONUS = 0.25;  // Science Lab output per extra crew member
const CREW_NAMES = ["Okafor", "Lindqvist", "Tanaka", "Moreau", "Silva", "Novak", "Reyes", "Chen"];

// Radiation dose. Each crew member builds up dose at (exposure / 100) per
// second: one unit is a second at 100% exposure. It never heals. As it grows,
// that member's maximum health falls linearly from 100 to MIN_MAX_HEALTH, and
// at DOSE_LIMIT they go home. Tuned so that a crew left at the 35% baseline
// reaches the limit around Sol 7 of The Outpost; real limits are in mSv.
const DOSE_LIMIT = 240;
const MIN_MAX_HEALTH = 50;
const DOSE_WARNING = 0.75;      // share of the limit at which Watney warns

// Consumption per crew member per second
const CREW_NEEDS = { water: 0.3, food: 0.25, oxygen: 0.5 };

// Shortage priorities. When stored power (or water) runs out and demand is
// more than supply, supply goes to critical buildings first, then normal,
// then low; buildings in the same tier share alike. An "off" building draws
// nothing and makes nothing. Buildings that draw no power or water have none.
const PRIORITIES = {
  critical: { name: "Critical", tip: "Served first in a shortage" },
  normal:   { name: "Normal",   tip: "Served after critical buildings in a shortage" },
  low:      { name: "Low",      tip: "First to be cut in a shortage" },
  off:      { name: "Off",      tip: "Switched off: draws nothing and makes nothing" },
};
const PRIORITY_ORDER = ["critical", "normal", "low", "off"];
const SUPPLY_TIERS = ["critical", "normal", "low"];   // served in this order

// Crew work. Building, repairing, cleaning panels and reinforcing are jobs,
// each done by one crew member at a time at 1 unit of work per second. Each
// building's `work` is how long it takes to build; repairs take the
// micrometeorite's damage (EVENT_DEFAULTS.durations.meteor). Jobs are done in
// JOB_ORDER, oldest first within a kind.
const JOB_ORDER = ["repair", "construct", "clean", "reinforce"];
const JOB_FIELD = { repair: "disabled", construct: "construct", clean: "cleaning", reinforce: "reinforcing" };
const JOB_NAME = { repair: "repairing", construct: "building", clean: "cleaning", reinforce: "reinforcing" };

// Buildings. produces/consumes are per second at 100% efficiency. `priority`
// is the default shortage priority; `alwaysOn` buildings can't be switched off.
// `heat` is the most power a heated building's heater can draw. How much it
// actually draws comes from the building's temperature and the weather
// outside (heatingDemand() in js/simulation.js).
const BUILDINGS = {
  habitat: {
    name: "Habitat", icon: "🏠", sprite: "habitat",
    cost: { materials: 40, credits: 60 },
    work: 12,
    consumes: { power: 1, water: 0.5 },
    produces: { oxygen: 1.5 },
    heat: 1,
    crew: 2, radiation: 5,
    priority: "critical", alwaysOn: true,
    why: "Habitats are pressurised shelters with built-in life support that turns water and power into breathable oxygen (via electrolysis). Their walls also block some of the radiation that the thin Martian atmosphere lets through. They need heating too, hardest at night: the thin air holds little of the day's warmth, so Martian nights are far colder than the days.",
  },
  water: {
    name: "Water Extractor", icon: "💧", sprite: "water",
    cost: { materials: 20, credits: 40 },
    work: 6,
    consumes: { power: 1.5 },
    produces: { water: 2 },
    bonus: { ice: 2 },
    priority: "critical",       // the crew drinks what it pulls out of the ground
    why: "Mars has lots of water locked up as ice in the ground. Heating icy soil releases water that can be collected. Bringing water from Earth would be far too heavy, so extracting it locally (in-situ resource utilisation) is essential.",
  },
  greenhouse: {
    name: "Greenhouse", icon: "🌱", sprite: "greenhouse",
    cost: { materials: 30, credits: 100 },
    work: 9,
    consumes: { power: 2, water: 1 },
    produces: { food: 2, oxygen: 0.3 },
    heat: 1,
    priority: "normal",
    why: "Growing food locally reduces how much must be shipped from Earth, but plants need water, energy, warmth and light. Let a greenhouse freeze and the frost kills the leaves: the plants grow back, but it takes time. As a bonus, photosynthesis adds a little oxygen.",
  },
  moxie: {
    name: "Oxygen Plant", icon: "⚗️", sprite: "moxie",
    cost: { materials: 40, credits: 150 },
    work: 9,
    consumes: { power: 3 },
    produces: { oxygen: 1 },
    priority: "critical",       // life support, like the Habitats
    why: "Mars' air is about 95% carbon dioxide. An Oxygen Plant splits it, pulling out oxygen and venting carbon monoxide, so it needs power but no water. NASA's MOXIE experiment did exactly this on the Perseverance rover, making 122 grams of oxygen in 16 runs before it finished in 2023.",
  },
  solar: {
    name: "Solar Array", icon: "☀️", sprite: "solar",
    cost: { materials: 20, credits: 80 },
    work: 6,
    consumes: {},
    produces: { power: 6 },
    solar: true,
    why: "Solar panels give clean, renewable power, but only when the Sun is up. Mars gets less than half of Earth's sunlight, nights are long and dust storms can block the Sun for days. Dust also settles on the panels and slowly smothers them: it ended NASA's InSight lander in 2022. Now and then a gust or a dust devil sweeps them clean, as happened to the Spirit rover more than once.",
  },
  nuclear: {
    name: "Nuclear Generator", icon: "☢️", sprite: "nuclear",
    cost: { materials: 80, credits: 300 },
    work: 18,
    consumes: {},
    produces: { power: 12 },
    why: "Nuclear power (like NASA's Kilopower project) works day and night, in any weather. It is expensive and needs careful engineering and shielding, but it never stops at sunset.",
  },
  battery: {
    name: "Battery Bank", icon: "🔋", sprite: "battery",
    cost: { materials: 30, credits: 60 },
    work: 6,
    consumes: {},
    produces: {},
    storage: 150,
    why: "Solar panels only work in daylight, so a solar-powered outpost must store energy for the night, and for dust storms that can last weeks. Real Mars mission designs need large battery banks; they are heavy, but they turn cheap daytime solar into round-the-clock power.",
  },
  mine: {
    name: "Mine", icon: "⛏️", sprite: "mine",
    cost: { materials: 10, credits: 50 },
    work: 6,
    consumes: { power: 2 },
    produces: { materials: 1.5 },
    bonus: { rocky: 1.5, resource: 2 },
    priority: "low",
    why: "Building materials can be made from Martian rock and regolith instead of being launched from Earth, where every kilogram costs thousands of dollars to send.",
  },
  lab: {
    name: "Science Lab", icon: "🔬", sprite: "lab",
    cost: { materials: 40, credits: 120 },
    work: 12,
    consumes: { power: 2 },
    produces: { credits: 3 },
    heat: 0.5,
    needsHabitat: true,
    priority: "low",
    why: "Science is why we go to Mars: studying rocks, ice and the atmosphere to learn whether Mars ever had life. Here, discoveries earn funding (credits) for expanding the outpost.",
  },
  shield: {
    name: "Radiation Shield", icon: "🛡️", sprite: "shield",
    cost: { materials: 50, credits: 80 },
    work: 9,
    consumes: { power: 0.5 },
    produces: {},
    radiation: 15,
    priority: "normal",
    why: "Mars has no global magnetic field and a thin atmosphere, so cosmic rays and solar particles reach the surface. Shielding (thick regolith walls, water or special materials) protects the crew's long-term health.",
  },
};
// Upgrade: pile regolith over an existing structure for extra shielding.
// Passive (no power needed), one per building.
const REINFORCE = {
  cost: { materials: 30 },
  work: 6,
  radiation: 5,
  why: "Martian soil (regolith) is free shielding. Piling a couple of metres of it over a structure blocks a large share of cosmic rays and solar particles. NASA studies for Mars habitats often propose exactly this, or 3D-printing walls from regolith.",
};

const BUILD_ORDER = ["habitat", "water", "greenhouse", "moxie", "solar", "nuclear", "battery", "mine", "lab", "shield"];

for (const key of BUILD_ORDER) BUILDINGS[key].key = key;

// Solar output by time of day (0..1 of a sol)
function daylight(t) {
  if (t < 0.2 || t >= 0.85) return 0;      // night
  if (t < 0.35) return 0.4;                 // morning
  if (t < 0.65) return 1;                   // midday
  return 0.3;                               // evening
}
function dayPhase(t) {
  if (t < 0.2 || t >= 0.85) return "🌑 Night";
  if (t < 0.35) return "🌅 Morning";
  if (t < 0.65) return "☀️ Midday";
  return "🌇 Evening";
}

// Watney's tips: short hints at teachable moments, each shown at most once a
// mission. `when(s)` reads the state (never changes it) and returns false, true,
// or a tile to pulse on the map; `text` is a string, or a function of that
// tile. Checked by checkTips() in js/ui.js, in this order. Factual claims in
// these texts are covered by docs/PHYSICS.md § Claims.
const TIP_GRACE = 10;      // game seconds into a mission before the first tip
const TIP_GAP = 20;        // game seconds between tips
const TIP_PULSE_MS = 4000; // how long a tip's tile pulses on the map

// Tiles within `range` steps of the outpost that are free to build on.
function tilesNearOutpost(range) {
  let frontier = buildings(), seen = new Set(frontier);
  for (let i = 0; i < range; i++) {
    const next = [];
    for (const t of frontier) for (const n of neighbors(t)) if (!seen.has(n)) { seen.add(n); next.push(n); }
    frontier = next;
  }
  return [...seen].filter((t) => !t.building && t.terrain !== "impassable");
}
const builtOf = (type) => buildings().filter((t) => t.building.type === type && !(t.building.construct > 0));
const priorityHint = (s, advice) => (s.mission.priorities === false ? "" : ` ${advice}`);

const TIPS = [
  {
    id: "nightPower",
    when: (s) => {
      const t = solTime();
      if (t >= 0.2 && t < 0.65) return false;                             // only evening and night
      const untilMorning = ((0.2 - t + 1) % 1) * SOL_SECONDS;
      return (s.rates.power || 0) < -0.001 && timeLeft("power") < untilMorning;
    },
    text: () => "At this rate the batteries die before sunrise. More Battery Banks bank more of the day." +
      priorityHint(state, "Or switch the Lab off until sunrise: at Low it's only cut once the batteries are already flat."),
  },
  {
    id: "iceNearby",
    when: () => {
      if (!buildingUnlocked("water") || builtOf("water").some((t) => t.terrain === "ice")) return false;
      return tilesNearOutpost(2).find((t) => t.terrain === "ice") || false;
    },
    text: "There's ice right there. A Water Extractor on ice pulls out twice as much as on regolith.",
  },
  {
    id: "flareShield",
    when: (s) => hasEffect("flare") && s.radiation > 25 && buildingUnlocked("shield") && !builtOf("shield").length,
    text: "Flares are no joke. A Radiation Shield, or regolith piled over any building, takes the edge off.",
  },
  {
    id: "dustyPanels",
    when: () => builtOf("solar").find((t) => t.building.dust > 0.3 && !(t.building.cleaning > 0)) || false,
    text: "My panels are filthy. Cleaning one takes it offline for a few seconds, then it's back to full output.",
  },
  {
    id: "noBed",
    when: (s) => s.mission.crewArrivals !== false && s.crew >= s.crewCapacity &&
      s.nextArrivalSol - s.sol <= 1 && buildingUnlocked("habitat"),
    text: "No bed, no crewmate. NASA won't land anyone until there's room. Another Habitat sleeps two more.",
  },
  {
    id: "highDose",
    when: (s) => s.crewMembers.some((m) => m.dose > 0.5 * DOSE_LIMIT),
    text: "That radiation dose isn't going away. Shielding now is cheaper than a crewmate going home later.",
  },
  {
    id: "repairWaiting",
    when: () => buildings().find((t) => t.building.disabled > 0 && !beingWorked(t.building, "repair")) || false,
    text: (t) => `Nobody's free to fix the ${BUILDINGS[t.building.type].name}. Repairs come first, so it's next in line.`,
  },
  {
    id: "jobsPiling",
    when: (s) => (s.jobsWaiting || 0) >= 3,
    text: "More jobs than hands. Each of us does one thing at a time: repairs first, then building, cleaning and reinforcing. More crew means more hands.",
  },
  {
    id: "noMine",
    when: (s) => buildingUnlocked("mine") && !buildings().some((t) => t.building.type === "mine") && s.resources.materials < 30,
    text: "Running low on materials. A Mine makes them, and on rock or high-resource ground it makes more.",
  },
  {
    id: "greenhouseCold",
    when: () => builtOf("greenhouse").find((t) => t.building.tempK < FROST_K + 8) || false,
    text: () => "The greenhouse is getting cold. Potatoes don't do frost." +
      priorityHint(state, "Give it power, or a higher priority."),
  },
  {
    id: "habitatCooling",
    when: (s) => builtOf("habitat").find((t) => t.building.tempK < SETPOINT_K - 4 &&
      s.crewMembers.some((m) => m.bed === s.tiles.indexOf(t))) || false,
    text: "The Habitat's losing heat. It's critical for a reason: below about 10 °C, the people sleeping in it start to suffer.",
  },
];

// Watney's lines, keyed by trigger
const WATNEY_LINES = {
  start: "Okay. I'm alone on Mars. Let's science the heck out of this.",
  lowPower: "We're going to need more power.",
  noPower: "Batteries are dead. We're living on whatever the generators make right now, critical stuff first. Not great.",
  lowWater: "Water reserves are getting low.",
  lowFood: "I'm running out of potatoes. That's a sentence I never wanted to say.",
  lowOxygen: "Oxygen is dropping. I kind of need that.",
  highRadiation: "My dosimeter is clicking a lot. More shielding would be nice.",
  lowHealth: "I don't feel so good...",
  frost: "The greenhouse is freezing. Potatoes don't do frost. It needs heat, now.",
  cold: "It's cold enough in the Habitat to see my breath. It needs heat.",
  highDose: "Somebody's career radiation dose is getting up there. More shielding, please. It doesn't wash off.",
  night: "Sun's going down. Hope the batteries are charged.",
};
