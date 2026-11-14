// The campaign, and the story text. Each mission teaches one piece of Mars
// science. A mission overrides the defaults in js/data.js; anything it leaves
// out uses the default. Every factual claim in this file has a row in
// docs/PHYSICS.md § Claims the game makes to the player.
//
// Mission fields:
//   seed         number, or null for a fresh random map every run
//   map          optional handmade terrain, one string per row (TERRAIN_CHARS)
//   start        overrides for DEFAULT_START (resources merge key by key)
//   buildings    the buildings the player may build, or null for all
//   events       overrides for EVENT_DEFAULTS, or null for no events at all
//   crewArrivals false to turn crew landings off
//   crewArrivalSols  sols between landings (default CREW_ARRIVAL_SOLS)
//   objectives   all must hold at once to win:
//                  { type: "sol", value }        reach the start of this sol
//                  { type: "credits", value }    credits earned in total
//                  { type: "crew", value }       crew size
//                  { type: "stock", resource, value }  amount in storage
//                  { type: "radiation", value }  exposure at or below this %
//   failures     extra ways to lose, besides crew health reaching zero:
//                  { type: "blackout" }          stored power reaches zero
//                  { type: "deadline", sol }     this sol starts, objectives unmet

const STORY = [
  "Mark Watney here: botanist, mechanical engineer, and as of this morning the person in charge of a small outpost on Mars. NASA has given me a couple of Habitats, a Science Lab, one Solar Array, and a planet that is not on my side.",
  "The job sounds simple. Keep the crew breathing, drinking and eating. Do enough science to keep the funding coming. Don't let a sunset turn into a crisis. Repeat every sol.",
  "The nearest hardware store is about 225 million kilometres away, so whatever this place needs, I build here.",
];

const MISSIONS = [
  {
    id: "first-night",
    name: "First Night",
    lesson: "Solar power stops at sunset. An outpost needs storage, or enough generation to bank power for the night.",
    briefing: [
      "Sol 1, morning. The outpost is up: two Habitats, a Science Lab, and one Solar Array that is very pleased with itself.",
      "Here's the problem. In about a minute the Sun starts going down, and the Solar Array goes from hero to decoration. Mars gets well under half the sunlight Earth does, and none of it at night. Everything here runs on power, so if the batteries go flat, so does the mission.",
      "Job for today: get through two nights without a blackout.",
    ],
    tips: [
      "Watch ⚡ Power's rate and time left in the HUD before evening.",
      "A second Solar Array fills the batteries faster. A Battery Bank holds more for the night.",
      "On Normal difficulty, water and food will hold for this mission. Power won't.",
    ],
    seed: 1101,
    start: { resources: { food: 100, oxygen: 400, materials: 120, credits: 300 } },
    buildings: ["solar", "battery", "water", "greenhouse"],
    events: null,
    crewArrivals: false,
    objectives: [{ type: "sol", value: 3 }],
    failures: [{ type: "blackout" }],
  },
  {
    id: "ice-line",
    name: "Ice Line",
    lesson: "Water comes from the ground, not from Earth. Ice deposits yield far more than ordinary soil.",
    briefing: [
      "Water. Habitats need it to make oxygen, Greenhouses need it to grow food, and I need it because I'm a human. Shipping it from Earth, at thousands of dollars a kilogram? No thanks.",
      "Good news: Mars has water ice in the ground. Orbiters have mapped it, and the Phoenix lander dug some up in 2008. Bad news: the nearest deposit is to the east, past a ridge. Water Extractors work on ordinary regolith, but on ice they pull out twice as much.",
      "NASA wants 2,000 units of water banked before Sol 4. The pumps here are old, so expect a failure or two.",
    ],
    tips: [
      "Water is short from the start. Build an extractor right away.",
      "Build a chain of useful buildings east, around the ridge, to reach the ice.",
      "Extractors need power, and they stop if the batteries run flat at night.",
    ],
    seed: 2201,
    map: [
      "r..#...r...",
      "..r....#.i.",
      ".#..r..#.ii",
      "r.....r..ii",
      "..r.....#i.",
      ".#..r...ri.",
      "..r..#....r",
      "r....r..#..",
    ],
    start: { resources: { water: 60, food: 120, materials: 120, credits: 400 } },
    buildings: ["water", "solar", "battery", "greenhouse", "mine", "habitat"],
    events: { first: 50, interval: [50, 80], weights: { failure: 2, supply: 1 } },
    crewArrivals: false,
    objectives: [{ type: "stock", resource: "water", value: 2000 }],
    failures: [{ type: "deadline", sol: 4 }],
  },
  {
    id: "dust-season",
    name: "Dust Season",
    lesson: "Solar power is at the mercy of the weather. Nuclear power runs through storms and nights alike.",
    briefing: [
      "It's dust storm season. On Mars a storm can keep growing until it wraps the whole planet. In 2018 one blotted out the Sun for months and ended the Opportunity rover's mission.",
      "Ours will be shorter, but there will be a lot of them, and each one cuts solar output by 70%. Batteries buy time. What I really need is power that doesn't care about the weather.",
      "NASA has approved a Nuclear Generator. It's expensive, but it runs day and night, storm or no storm. Earn 3,000 credits for the science program before Sol 6.",
    ],
    tips: [
      "Save up for a Nuclear Generator: 80 materials and 300 credits.",
      "A Mine on rocky or high-resource ground pays back fastest.",
      "Science Labs earn the credits. Keep them powered.",
    ],
    seed: 3301,
    start: { resources: { materials: 120 } },
    buildings: null,
    events: { first: 25, interval: [30, 45], weights: { dust: 6, meteor: 1, supply: 1 }, durations: { dust: 90 } },
    objectives: [{ type: "credits", value: 3000 }],
    failures: [{ type: "deadline", sol: 6 }],
  },
  {
    id: "flare-watch",
    name: "Flare Watch",
    lesson: "With no global magnetic field and a thin atmosphere, radiation reaches the surface. The answer is mass between you and the sky.",
    briefing: [
      "Mars has no global magnetic field and only a thin atmosphere, so much of the radiation that Earth keeps out reaches the ground here. Curiosity measured it: a steady background dose, with spikes when the Sun flares up.",
      "The Sun is in a mood this week. Flares will come often, and one is forecast for midday on Sol 2. Each one pushes exposure way up for a while.",
      "Get the outpost's everyday exposure down to 10% and hold out until Sol 5. Radiation Shields help. So does shovelling regolith over buildings, which needs no power at all.",
    ],
    tips: [
      "Exposure above 50% hurts the crew. Watch it during a flare.",
      "A Radiation Shield blocks 15% while it has power.",
      "Reinforcing any building with regolith blocks another 5%, power or not.",
    ],
    seed: 4401,
    buildings: null,
    events: {
      first: 30, interval: [35, 50], weights: { flare: 5, dust: 1, supply: 1 },
      scripted: [{ sol: 2, at: 0.5, kind: "flare" }],
    },
    objectives: [{ type: "sol", value: 5 }, { type: "radiation", value: 10 }],
    failures: [],
  },
  {
    id: "crew-rotation",
    name: "Crew Rotation",
    lesson: "Every person needs a bed, water, food and air. An outpost grows only as fast as its life support.",
    briefing: [
      "NASA is sending company. A lot of company. Real crews wait for a launch window, which comes round about every 26 months. Here someone has found a shortcut, because there's a lander every sol.",
      "Every new crewmate means more science and more hands. They also mean another bed, another pair of lungs and another stomach. NASA won't land anyone unless there's a free bed and water, food and oxygen are all in good shape.",
      "Get the crew up to six before Sol 9.",
    ],
    tips: [
      "Each Habitat sleeps two, so you need a third before the fifth crew member lands.",
      "A landing is postponed if water, food or oxygen is running low. Keep all three green.",
      "Each extra crew member makes every Science Lab 25% more productive.",
    ],
    seed: 5501,
    buildings: null,
    crewArrivalSols: 1,
    objectives: [{ type: "crew", value: 6 }],
    failures: [{ type: "deadline", sol: 9 }],
  },
  {
    id: "the-outpost",
    name: "The Outpost",
    lesson: "A closed loop of power, water, air and food, on a planet that isn't trying to help.",
    briefing: [
      "This is the full mission: everything from the last five, all at once, on fresh ground every time.",
      "Keep everyone alive until Sol 8 and earn 1,000 credits of science. NASA lands a new crew member every two sols if there's a bed and supplies are healthy. Dust storms, flares, micrometeorites and dodgy pumps will all turn up, along with the odd supply drop from home.",
      "No pressure. Well, some pressure: about 0.6% of Earth's.",
    ],
    tips: [
      "Before the first night: a Greenhouse, a Water Extractor, and storage or a second Solar Array.",
      "Science Labs earn the credits, and more crew make them earn faster.",
      "Every building's “Why?” button explains the real reason it exists.",
    ],
    seed: null,
    buildings: null,
    objectives: [{ type: "sol", value: 8 }, { type: "credits", value: 1000 }],
    failures: [],
  },
];

function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[0];
}
