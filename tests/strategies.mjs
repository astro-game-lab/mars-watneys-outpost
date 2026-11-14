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
    // heating included. With one bank it takes a third array instead; one
    // bank and two arrays go flat on the first night.
    win: [{ build: "solar" }, { build: "battery" }, { build: "battery" }, { build: "solar" }, { build: "water" }],
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

  "flare-watch": {
    // A Radiation Shield and regolith over four buildings bring exposure to 10% or less.
    win: [{ build: "greenhouse" }, mine, water, { build: "solar" }, { build: "battery" }, { build: "shield" },
      { build: "solar" }, { reinforce: "habitat" }, { reinforce: "habitat" }, { build: "battery" },
      { build: "solar" }, { reinforce: "lab" }, { reinforce: "solar" }],
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
