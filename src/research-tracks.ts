import { ResearchField, Expansion } from "./enums";

export default {
  [ResearchField.Terraforming]: (expansions: Expansion) => [
    [], ["2o"], ["d"], ["d", "3pw"], ["2o"], []
  ],
  [ResearchField.Navigation]: (expansions: Expansion) => [
    [], ["q"], ["r"], ["q" , "3pw"], ["r"], ["r"]
  ],
  [ResearchField.Intelligence]: (expansions: Expansion) => [
    [], ["q"], ["q"], ["2q", "3pw"], ["2q"], ["4q"]
  ],
  [ResearchField.GaiaProject]: (expansions: Expansion) => [
    [], [">gf"], ["3t"], [">gf", "3pw"], [">gf"], ["4vp", "g > vp"]
  ],
  [ResearchField.Economy]: (expansions: Expansion) => [
    [], ["+2c,pw"], ["+2c,1o,2pw"], ["+3c,1o,3pw", "3pw"], ["+4c,2o,4pw"], ["6c,3o,6pw"]
  ],
  [ResearchField.Science]: (expansions: Expansion) => expansions & Expansion.Spaceships ? [
    [], ["+k", "k"], ["+2k", "k"], ["+3k", "k", "3pw"], ["+4k", "tech"], [['+4k', '4k'], ["10k"]]
  ]: [
    [], ["+k"], ["+2k"], ["+3k", "3pw"], ["+4k"], ["9k"]
  ],
  [ResearchField.TradingBonus]: (expansions: Expansion) => [
    ["trade >> 2k"], ["trade 1>> 2k,3c"], ["trade 1>> 2k,1o,3c"], ["trade 1>> 2k,1o,3c", "tech", "3pw"], ["trade 1>> 2k,1o,3c,q"], ["trade 2>> 2k,1o,3c,q"]
  ],
  [ResearchField.TradingVolume]: (expansions: Expansion) => [
    ["+ship"], ["+ship", "2ship-range"], ["+2ship", "ship-move"], ["+2ship", "tech", "3pw"], ["+3ship", "ship-move", "1> up-nav,up-int"], ["+4ship", "ship-move", "ship-range"]
  ]
};

export function lastTile(field: ResearchField) {
  return 5;
}

export function keyNeeded(field: ResearchField, dest: number): boolean {
  return dest === lastTile(field);
}
