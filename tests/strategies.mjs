// Scripted playthroughs for every mission: one that should win at every
// difficulty, and one that plays the way the briefing warns against, which
// should lose. They're the balance contract for the campaign. A change that
// moves a rate, a mission or a rule must keep these passing, or change them in
// the same pull request and say why. See tests/bot.mjs for the move format.

const water = { build: "water", prefer: ["ice"] };
const mine = { build: "mine", prefer: ["resource", "rocky"] };

// The Outpost has no fixed map, so its strategy is checked on these seeds.
export const OUTPOST_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

export const STRATEGIES = {
  "first-night": {
    // A second array and two Battery Banks get the outpost through two nights,
    // heating included. Watney builds alone, one thing at a time, so the
    // arrays go up first: the sooner they're generating, the more gets banked
    // before sunset. With one bank it takes a third array instead.
    win: [{ build: "solar" }, { build: "solar" }, { build: "battery" }, { build: "battery" }, { build: "water" }],
    // The briefing: the Sun sets and the batteries go flat.
    warned: { why: "no extra generation or storage", moves: [] },
  },

  "ice-line": (() => {
    const solar = { build: "solar", toward: [9, 3] };
    const battery = { build: "battery", toward: [9, 3] };
    return {
      // Chain power east around the ridge, then put the extractors on the ice.
      win: [{ build: "water" }, { build: "mine", prefer: ["rocky"] }, solar, solar, battery,
        water, water, solar, solar, water, battery, water, solar, water, solar, { build: "greenhouse" }],
      // The same spend, with every extractor on regolith.
      warned: {
        why: "the same build, but no extractor on ice",
        moves: [{ build: "water" }, { build: "mine", prefer: ["rocky"] }, { build: "solar" }, { build: "solar" },
          { build: "battery" }, { build: "water" }, { build: "water" }, { build: "solar" }, { build: "solar" },
          { build: "water" }, { build: "battery" }, { build: "water" }, { build: "solar" }, { build: "water" },
          { build: "solar" }, { build: "greenhouse" }],
      },
    };
  })(),

  "thin-air": {
    // The Habitats make no oxygen here, so Oxygen Plants do, with nuclear power
    // to run them through the night, and a second Greenhouse so supplies stay
    // healthy enough for NASA to land the crew on time.
    win: [{ build: "greenhouse" }, { build: "moxie" }, { build: "solar" }, { build: "battery" }, water, mine,
      { priority: "mine", to: "normal" }, { build: "nuclear" }, { build: "moxie" }, { build: "greenhouse" },
      { build: "moxie" }, { build: "battery" }, water],
    // Greenhouses add a little oxygen, but nowhere near enough for a crew.
    warned: {
      why: "no Oxygen Plant, only Greenhouses for air",
      moves: [{ build: "greenhouse" }, { build: "solar" }, { build: "battery" }, water, { build: "greenhouse" }, mine,
        { build: "solar" }, { build: "greenhouse" }, { build: "battery" }, { build: "greenhouse" }, { build: "solar" }],
    },
  },

  "dust-season": {
    // A Nuclear Generator first, then a second, keeps the Labs running through
    // the storms. Wins around Sol 3.1, nearly three sols before the deadline.
    win: [mine, { build: "nuclear" }, { build: "lab" }, { build: "lab" }, { build: "greenhouse" }, water,
      mine, { build: "nuclear" }, { build: "lab" }, { build: "lab" }, { build: "habitat" }, { build: "lab" }],
    // The briefing says solar alone won't do: a big solar build with batteries
    // and as many Labs reaches only about a quarter of the target.
    warned: {
      why: "solar power and batteries only, no Nuclear Generator",
      moves: [mine, { build: "greenhouse" }, water, { build: "solar" }, { build: "solar" }, { build: "battery" },
        { build: "lab" }, { build: "solar" }, { build: "battery" }, { build: "lab" }, { build: "solar" },
        { build: "solar" }, { build: "lab" }, { build: "battery" }, { build: "lab" }, { build: "solar" },
        { build: "lab" }, mine, { build: "solar" }, { build: "solar" }, { build: "battery" }, { build: "lab" },
        { build: "solar" }, { build: "solar" }, { build: "lab" }, water, { build: "greenhouse" }],
    },
  },

  "long-night": {
    // Reliable power for the heaters: a Nuclear Generator. The default
    // priorities already put the Habitats first and the Lab and the Mine last.
    win: [{ build: "greenhouse" }, mine, { build: "battery" }, { build: "solar" }, { build: "nuclear" },
      { build: "greenhouse" }, water, { build: "battery" }, { build: "greenhouse" }],
    // Weak winter sun can't heat the outpost through the night, however much storage.
    warned: {
      why: "solar and batteries only, no Nuclear Generator",
      moves: [{ build: "greenhouse" }, mine, { build: "solar" }, { build: "battery" }, { build: "solar" },
        { build: "greenhouse" }, water, { build: "battery" }, { build: "solar" }, { build: "greenhouse" },
        { build: "battery" }, { build: "solar" }],
    },
  },

  "flare-watch": {
    // A Radiation Shield at Critical priority, regolith over four buildings and a
    // second shield bring exposure to 10% or less, soon enough to keep everyone's
    // dose under the 70% cap: about 42% on Normal and 58-63% on Hard and Martian.
    // A shield alone reaches 72-80% there, and fails.
    win: [{ build: "greenhouse" }, mine, water, { build: "solar" }, { build: "battery" }, { build: "shield" },
      { priority: "shield", to: "critical" }, { build: "solar" }, { reinforce: "habitat" }, { reinforce: "habitat" },
      { build: "battery" }, { build: "solar" }, { build: "shield" }, { priority: "shield", to: "critical" },
      { reinforce: "lab" }, { reinforce: "solar" }],
    // No shielding: the flares hurt, and the exposure objective is never met.
    warned: {
      why: "no Radiation Shield and no regolith",
      moves: [{ build: "greenhouse" }, water, { build: "solar" }, { build: "battery" }, { build: "solar" },
        { build: "solar" }],
    },
  },

  "crew-rotation": {
    // A third Habitat for beds, and enough water, food and air for six.
    // Since building temperature, a power-short night freezes the Habitats, so
    // this build puts up nuclear power early and keeps the Mines running.
    win: [{ build: "greenhouse" }, water, { build: "solar" }, { build: "battery" }, mine,
      { priority: "mine", to: "normal" }, { build: "nuclear" }, { build: "habitat" }, water,
      { build: "greenhouse" }, { build: "shield" }, { build: "battery" }, water, { build: "solar" }],
    // No new Habitat: four beds, so the crew stops at four.
    warned: {
      why: "no new Habitat",
      moves: [{ build: "greenhouse" }, water, { build: "solar" }, { build: "battery" }, mine,
        { build: "greenhouse" }, { build: "solar" }, water, { build: "solar" }, { build: "greenhouse" },
        { build: "battery" }],
    },
  },

  "the-outpost": {
    // Life support, then nuclear power early so the Mines keep running (raised
    // to normal priority), then shielding so no one's dose nears the career
    // limit. Without the early power, materials stall on some maps; without
    // the shielding, crew start going home around Sol 7.
    win: [{ build: "greenhouse" }, water, { build: "solar" }, mine, { priority: "mine", to: "normal" },
      { build: "nuclear" }, { build: "shield" }, { build: "lab" }, { build: "battery" }, { build: "habitat" },
      { build: "greenhouse" }, water, { build: "shield" }, { build: "lab" }, { reinforce: "habitat" },
      { reinforce: "habitat" }, { build: "nuclear" }, { build: "greenhouse" }, water, { build: "habitat" },
      { build: "lab" }, { reinforce: "lab" }],
    // The tips: a Greenhouse and a Water Extractor before the first night.
    warned: {
      why: "power and science, but no Greenhouse or Water Extractor",
      moves: [{ build: "solar" }, { build: "lab" }, { build: "solar" }, { build: "battery" }, { build: "lab" }],
    },
  },
};
