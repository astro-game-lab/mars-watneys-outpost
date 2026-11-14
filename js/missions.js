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
//   overrides    per-building changes to BUILDINGS for this mission, merged
//                over the defaults, such as { habitat: { produces: {} } }
//   climate      overrides for OUTSIDE_K (the outside temperature curve)
//   sunlight     multiplier on Solar Array output (default 1)
//   priorities   false to turn off shortage priorities: every building keeps
//                its default (PRIORITIES in js/data.js), and the panel hides them
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
//                  { type: "dose", value }       anyone's dose passes this share of DOSE_LIMIT

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
      "Watch ⚡ Power's rate and time left in the HUD before evening. At night the Habitats and the Lab also draw power for heating.",
      "A second Solar Array fills the batteries faster. A Battery Bank holds more for the night. Watney builds one thing at a time, so put the arrays up first: the sooner they're generating, the more you bank before sunset.",
      "On Normal difficulty, water and food will hold for this mission. Power won't.",
    ],
    seed: 1101,
    start: { resources: { food: 100, oxygen: 400, materials: 120, credits: 300 } },
    buildings: ["solar", "battery", "water", "greenhouse"],
    priorities: false,          // the lesson is storage; switching the Lab off would dodge it
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
    start: { resources: { water: 260, food: 120, materials: 120, credits: 400 } },
    buildings: ["water", "solar", "battery", "greenhouse", "mine", "habitat"],
    events: { first: 50, interval: [50, 80], weights: { failure: 2, supply: 1 } },
    crewArrivals: false,
    objectives: [{ type: "stock", resource: "water", value: 2000 }],
    failures: [{ type: "deadline", sol: 4 }],
  },
  {
    id: "thin-air",
    name: "Thin Air",
    lesson: "Mars' air is a resource too. An Oxygen Plant pulls oxygen out of carbon dioxide with power alone, no water needed.",
    briefing: [
      "Bad landing. The outpost came down in one piece, but the Habitats' oxygen generators didn't. The Habitats still keep us warm and pressurised. They just can't make air any more, and the spares are on a lander that hasn't launched yet.",
      "Luckily the air outside is about 95% carbon dioxide, and NASA packed an Oxygen Plant, a grown-up version of the MOXIE experiment that made oxygen on the Perseverance rover. It splits carbon dioxide and keeps the oxygen. All it wants is power, and plenty of it.",
      "Two more crew are due before Sol 6, and NASA won't land them unless the oxygen is in good shape. Get the crew up to three.",
    ],
    tips: [
      "Each Oxygen Plant makes 1 oxygen a second, and each crew member breathes 0.5. Plan for the crew you'll have, not the crew you've got.",
      "An Oxygen Plant draws 3 power around the clock. At night that means batteries, or a Nuclear Generator.",
      "Greenhouses add a little oxygen too, but not enough on their own.",
    ],
    seed: 2601,
    start: { resources: { oxygen: 250 } },
    buildings: null,
    overrides: {
      habitat: {
        produces: {},
        consumes: { power: 1 },
        why: "Habitats are pressurised shelters, heated against the Martian night, and their walls block some of the radiation the thin atmosphere lets through. Normally their life support turns water and power into oxygen, but on this landing the oxygen generators were wrecked: these Habitats shelter the crew and make no air.",
      },
    },
    events: { first: 60, interval: [50, 80], weights: { dust: 2, meteor: 1, supply: 2, devil: 1 } },
    objectives: [{ type: "crew", value: 3 }],
    failures: [{ type: "deadline", sol: 6 }],
  },
  {
    id: "dust-season",
    name: "Dust Season",
    lesson: "Solar power is at the mercy of the weather. Nuclear power runs through storms and nights alike.",
    briefing: [
      "It's dust storm season. On Mars a storm can keep growing until it wraps the whole planet. In 2018 one blotted out the Sun for months and ended the Opportunity rover's mission.",
      "Ours will be shorter, but there will be a lot of them, and each one cuts solar output by 70%. They also coat the panels in dust, which stays until someone cleans it off. Batteries buy time. What I really need is power that doesn't care about the weather.",
      "NASA has approved a Nuclear Generator. It's expensive, but it runs day and night, storm or no storm. Earn 3,000 credits for the science program before Sol 6.",
    ],
    tips: [
      "Save up for a Nuclear Generator: 80 materials and 300 credits.",
      "A Mine on rocky or high-resource ground pays back fastest.",
      "Science Labs earn the credits, but they start at Low priority. In a storm, raise them above the Mines so they're the last to lose power.",
      "Storms coat Solar Arrays in dust five times faster than clear skies. Clean them, or wait for a dust devil to do it.",
    ],
    seed: 3301,
    start: { resources: { materials: 120 } },
    buildings: null,
    events: { first: 25, interval: [30, 45], weights: { dust: 6, meteor: 1, supply: 1, devil: 2 }, durations: { dust: 90 } },
    objectives: [{ type: "credits", value: 3000 }],
    failures: [{ type: "deadline", sol: 6 }],
  },
  {
    id: "long-night",
    name: "Long Night",
    lesson: "Heating is a big share of an outpost's power. When a night gets cold enough, you decide what stays warm.",
    briefing: [
      "NASA has moved us north for the winter, to a plain like the one Viking 2 landed on. Up here the Sun stays low, the days are short, and the nights get properly cold. Viking 2 measured about −113 °C before dawn in late winter.",
      "Everything that's pressurised needs heating, and on nights like these the heaters want more than they ever have. If power runs short, something gets cold. A cold Greenhouse loses its crop. A cold Habitat hurts whoever's sleeping in it.",
      "Hold out until Sol 5 with 400 food in the stores, before Sol 6 starts. Decide what matters: shortage priorities say who gets the heat when there isn't enough to go round.",
    ],
    tips: [
      "Leave the Habitats at Critical: they're what keeps people warm. Raising a Greenhouse to Critical makes it share their heat. Let the Lab and the Mine, on Low, be the first to go cold.",
      "Solar is weak this far north in winter. A Nuclear Generator doesn't care.",
      "Watch each building's temperature in its panel: holding, cooling or rewarming.",
    ],
    seed: 4601,
    start: { crew: 2, resources: { food: 150, materials: 140 } },
    buildings: null,
    climate: { min: 160, max: 205 },
    sunlight: 0.6,
    crewArrivals: false,
    events: { first: 70, interval: [60, 90], weights: { meteor: 1, supply: 1, devil: 1 } },
    objectives: [{ type: "sol", value: 5 }, { type: "stock", resource: "food", value: 400 }],
    failures: [{ type: "deadline", sol: 6 }],
  },
  {
    id: "flare-watch",
    name: "Flare Watch",
    lesson: "With no global magnetic field and a thin atmosphere, radiation reaches the surface. The answer is mass between you and the sky.",
    briefing: [
      "Mars has no global magnetic field and only a thin atmosphere, so much of the radiation that Earth keeps out reaches the ground here. Curiosity measured it: a steady background dose, with spikes when the Sun flares up. And it adds up: NASA caps how much radiation an astronaut may take over a whole career, so every bit of exposure counts.",
      "The Sun is in a mood this week. Flares will come often, and one is forecast for midday on Sol 2. Each one pushes exposure way up for a while.",
      "Get the outpost's everyday exposure down to 10% and hold out until Sol 5, without anyone's dose passing 70% of their career limit. Every flare adds to it, and it never comes back down, so shield early. Radiation Shields help. So does shovelling regolith over buildings, which needs no power at all.",
    ],
    tips: [
      "Exposure above 50% hurts the crew. Watch it during a flare.",
      "A Radiation Shield blocks 15% while it has power.",
      "Reinforcing any building with regolith blocks another 5%, power or not.",
      "Dose never heals. The hatched end of each health bar in the crew roster is maximum health it has already cost.",
    ],
    seed: 4401,
    buildings: null,
    events: {
      first: 30, interval: [35, 50], weights: { flare: 5, dust: 1, supply: 1 },
      scripted: [{ sol: 2, at: 0.5, kind: "flare" }],
    },
    objectives: [{ type: "sol", value: 5 }, { type: "radiation", value: 10 }],
    failures: [{ type: "dose", value: 0.7 }],   // dose adds up: shielding late is too late
  },
  {
    id: "crew-rotation",
    name: "Crew Rotation",
    lesson: "Every person needs a bed, water, food and air. An outpost grows only as fast as its life support.",
    briefing: [
      "NASA is sending company. A lot of company. Real crews wait for a launch window, which comes round about every 26 months. Here someone has found a shortcut, because there's a lander every sol.",
      "Every new crewmate means more science and more hands. They also mean another bed, another pair of lungs and another stomach. NASA won't land anyone unless there's a free bed and water, food and oxygen are all in good shape.",
      "Get the crew up to six before Sol 9. And mind the radiation: anyone who reaches the career dose limit goes home, and the count goes down with them.",
    ],
    tips: [
      "Each Habitat sleeps two, so you need a third before the fifth crew member lands.",
      "A landing is postponed if water, food or oxygen is running low. Keep all three green.",
      "Each extra crew member makes every Science Lab 25% more productive, and is another pair of hands for building and repairs.",
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
      "This is the full mission: everything from the last seven, all at once, on fresh ground every time.",
      "Keep everyone alive until Sol 8 and earn 4,000 credits of science. NASA lands a new crew member every two sols if there's a bed and supplies are healthy. Dust storms, flares, micrometeorites and dodgy pumps will all turn up, along with the odd supply drop from home.",
      "No pressure. Well, some pressure: about 0.6% of Earth's.",
    ],
    tips: [
      "Before the first night: a Greenhouse, a Water Extractor, and storage or a second Solar Array.",
      "Science Labs earn the credits, and more crew make them earn faster.",
      "Every building's “Why?” button explains the real reason it exists.",
    ],
    seed: null,
    buildings: null,
    objectives: [{ type: "sol", value: 8 }, { type: "credits", value: 4000 }],
    failures: [],
  },
];

function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[0];
}
