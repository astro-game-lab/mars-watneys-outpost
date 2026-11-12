// Game data: terrain, buildings, balance constants. Tune numbers here.

const COLS = 11;
const ROWS = 8;

const SOL_SECONDS = 120;        // one Mars sol in real seconds
const POWER_CAPACITY = 200;     // base battery size (Battery Banks add more)
const BASE_RADIATION = 35;      // % exposure with no protection
const FLARE_RADIATION = 40;     // % exposure added during a solar flare

// Fixed simulation step, in game seconds. The frame loop accumulates game time
// and runs whole steps, so a mission plays out the same at any frame rate.
const SIM_STEP = 0.05;

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
  weights: { dust: 3, flare: 2, meteor: 2, failure: 2, supply: 2 },
  durations: { dust: 30, flare: 20, meteor: 30, failure: 25 },
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

// Consumption per crew member per second
const CREW_NEEDS = { water: 0.3, food: 0.25, oxygen: 0.5 };

// Buildings. produces/consumes are per second at 100% efficiency.
const BUILDINGS = {
  habitat: {
    name: "Habitat", icon: "🏠", sprite: "habitat",
    cost: { materials: 40, credits: 60 },
    consumes: { power: 1, water: 0.5 },
    produces: { oxygen: 1.5 },
    crew: 2, radiation: 5,
    why: "Habitats are pressurised shelters with built-in life support that turns water and power into breathable oxygen (via electrolysis). Their walls also block some of the radiation that the thin Martian atmosphere lets through.",
  },
  water: {
    name: "Water Extractor", icon: "💧", sprite: "water",
    cost: { materials: 20, credits: 40 },
    consumes: { power: 1.5 },
    produces: { water: 2 },
    bonus: { ice: 2 },
    why: "Mars has lots of water locked up as ice in the ground. Heating icy soil releases water that can be collected. Bringing water from Earth would be far too heavy, so extracting it locally (in-situ resource utilisation) is essential.",
  },
  greenhouse: {
    name: "Greenhouse", icon: "🌱", sprite: "greenhouse",
    cost: { materials: 30, credits: 100 },
    consumes: { power: 2, water: 1 },
    produces: { food: 2, oxygen: 0.3 },
    why: "Growing food locally reduces how much must be shipped from Earth, but plants need water, energy, warmth and light. As a bonus, photosynthesis adds a little oxygen.",
  },
  solar: {
    name: "Solar Array", icon: "☀️", sprite: "solar",
    cost: { materials: 20, credits: 80 },
    consumes: {},
    produces: { power: 6 },
    solar: true,
    why: "Solar panels give clean, renewable power, but only when the Sun is up. Mars gets less than half of Earth's sunlight, nights are long and dust storms can block the Sun for days. An outpost must plan for that.",
  },
  nuclear: {
    name: "Nuclear Generator", icon: "☢️", sprite: "nuclear",
    cost: { materials: 80, credits: 300 },
    consumes: {},
    produces: { power: 12 },
    why: "Nuclear power (like NASA's Kilopower project) works day and night, in any weather. It is expensive and needs careful engineering and shielding, but it never stops at sunset.",
  },
  battery: {
    name: "Battery Bank", icon: "🔋", sprite: "battery",
    cost: { materials: 30, credits: 60 },
    consumes: {},
    produces: {},
    storage: 150,
    why: "Solar panels only work in daylight, so a solar-powered outpost must store energy for the night, and for dust storms that can last weeks. Real Mars mission designs need large battery banks; they are heavy, but they turn cheap daytime solar into round-the-clock power.",
  },
  mine: {
    name: "Mine", icon: "⛏️", sprite: "mine",
    cost: { materials: 10, credits: 50 },
    consumes: { power: 2 },
    produces: { materials: 1.5 },
    bonus: { rocky: 1.5, resource: 2 },
    why: "Building materials can be made from Martian rock and regolith instead of being launched from Earth, where every kilogram costs thousands of dollars to send.",
  },
  lab: {
    name: "Science Lab", icon: "🔬", sprite: "lab",
    cost: { materials: 40, credits: 120 },
    consumes: { power: 2 },
    produces: { credits: 3 },
    needsHabitat: true,
    why: "Science is why we go to Mars: studying rocks, ice and the atmosphere to learn whether Mars ever had life. Here, discoveries earn funding (credits) for expanding the outpost.",
  },
  shield: {
    name: "Radiation Shield", icon: "🛡️", sprite: "shield",
    cost: { materials: 50, credits: 80 },
    consumes: { power: 0.5 },
    produces: {},
    radiation: 15,
    why: "Mars has no global magnetic field and a thin atmosphere, so cosmic rays and solar particles reach the surface. Shielding (thick regolith walls, water or special materials) protects the crew's long-term health.",
  },
};
// Upgrade: pile regolith over an existing structure for extra shielding.
// Passive (no power needed), one per building.
const REINFORCE = {
  cost: { materials: 30 },
  radiation: 5,
  why: "Martian soil (regolith) is free shielding. Piling a couple of metres of it over a structure blocks a large share of cosmic rays and solar particles. NASA studies for Mars habitats often propose exactly this, or 3D-printing walls from regolith.",
};

const BUILD_ORDER = ["habitat", "water", "greenhouse", "solar", "nuclear", "battery", "mine", "lab", "shield"];

for (const key of BUILD_ORDER) {
  const b = BUILDINGS[key];
  b.key = key;
  b.img = new Image();
  b.img.src = `sprites/${b.sprite}.svg`;
}

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

// Watney's lines, keyed by trigger
const WATNEY_LINES = {
  start: "Okay. I'm alone on Mars. Let's science the heck out of this.",
  lowPower: "We're going to need more power.",
  noPower: "Batteries are dead. Everything's running at half speed. Not great.",
  lowWater: "Water reserves are getting low.",
  lowFood: "I'm running out of potatoes. That's a sentence I never wanted to say.",
  lowOxygen: "Oxygen is dropping. I kind of need that.",
  highRadiation: "My dosimeter is clicking a lot. More shielding would be nice.",
  lowHealth: "I don't feel so good...",
  night: "Sun's going down. Hope the batteries are charged.",
};
