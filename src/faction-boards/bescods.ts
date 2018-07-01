import { FactionBoardRaw } from ".";
import { Building } from "../enums";

const bescods: FactionBoardRaw = {
  [Building.TradingStation]: {
    income: ["+k","+k","+k","+k"],
  },
  [Building.ResearchLab]: {
    income: ["+3c","+4c","+5c"]
  },
  [Building.PlanetaryInstitute]: {
    income: ["+4pw,2t1"]
  },
  income: ["k,4o,15c,q", "+o"]
};

export default bescods;