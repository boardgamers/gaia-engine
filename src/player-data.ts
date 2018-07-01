import Reward from "./reward";
import { Resource } from "..";
import { ResearchField, Building, Booster, TechTile, AdvTechTile, Federation } from "./enums";
import { EventEmitter } from "eventemitter3";
import { CubeCoordinates } from "hexagrid";

const MAX_ORE = 15;
const MAX_CREDIT = 30;
const MAX_KNOWLEDGE = 15;

export default class PlayerData extends EventEmitter {
  victoryPoints: number = 10;
  credits: number = 0;
  ores: number = 0;
  qics: number = 0;
  knowledge: number = 0;
  power: {
    area1: number,
    area2: number,
    area3: number,
    gaia: number
  } = {
    area1: 0,
    area2: 0,
    area3: 0,
    gaia: 0
  };
  [Building.Mine]: number = 0;
  [Building.TradingStation]: number = 0;
  [Building.PlanetaryInstitute]: number = 0;
  [Building.ResearchLab]: number = 0;
  [Building.Academy1]: number = 0;
  [Building.Academy2]: number = 0; 
  [Building.GaiaFormer]: number = 0; 
  research: {
    [key in ResearchField]: number
  } = {
    terra: 0, nav: 0,int: 0, gaia: 0, eco: 0, sci: 0
  };
  range: number = 1;
  gaiaformers: number = 0;
  terraformSteps: number = 0;
  roundBooster: Booster;
  techTiles: { tile: TechTile, enabled: boolean}[] = [];
  advTechTiles: AdvTechTile[] = [];
  federations: Federation[] = [];
  greenFederations: number = 0;
  // Coordinates occupied by buildings
  occupied: CubeCoordinates[] = [];

  toJSON(): Object {
    const ret = {
      victoryPoints: this.victoryPoints,
      credits: this.credits,
      ores: this.ores,
      qics: this.qics,
      knowledge: this.knowledge,
      power: this.power,
      research: this.research,
      range: this.range,
      gaiaformers: this.gaiaformers,
      terraformSteps: this.terraformSteps,
      roundBooster: this.roundBooster,
      techTiles: this.techTiles,
      advTechTiles: this.advTechTiles,
      federations: this.federations,
      greenFederations: this.federations,
      occupied: this.occupied
    }

    for (const building of Object.values(Building)) {
      ret[building] = this[building];
    }

    return ret;
  }

  payCosts(costs: Reward[]) {
    for (let cost of costs) {
      this.payCost(cost);
    }
  }

  payCost(cost: Reward) {
    this.gainReward(cost, true);
  }

  gainRewards(rewards: Reward[]) {
    for (let reward of rewards) {
      this.gainReward(reward);
    }
  }

  gainReward(reward: Reward, pay = false) {
    if (reward.isEmpty()) {
      return;
    }
    let { count, type: resource } = reward;

    if (pay) {
      count = -count;
    }
    
    if (resource.startsWith("up-")) {
      this.advanceResearch(resource.slice("up-".length) as ResearchField, count);
      return;
    }
    
    switch(resource) {
      case Resource.Ore: this.ores = Math.min(MAX_ORE, this.ores + count); return;
      case Resource.Credit: this.credits = Math.min(MAX_CREDIT, this.credits + count); return;
      case Resource.Knowledge: this.knowledge = Math.min(MAX_KNOWLEDGE, this.knowledge + count); return;
      case Resource.VictoryPoint: this.victoryPoints += count; return;
      case Resource.Qic: this.qics += count; return;
      case Resource.GainTokenArea1: this.power.area1 += count; return;
      case Resource.GainTokenArea2: this.power.area2 += count; return;
      case Resource.GainTokenArea3: this.power.area3 += count; return;
      case Resource.GainTokenGaiaArea:  this.movePowerToGaia(-count); return;
      case Resource.ChargePower: this.chargePower(count); return;
      case Resource.RangeExtension: this.range += count; return;
      case Resource.GaiaFormer: this.gaiaformers +=count; return;
      case Resource.TerraformStep: this.terraformSteps +=count; return;
      default: break; // Not implemented
    }
  }

  canPay(reward: Reward[]): boolean {
    const rewards = Reward.merge(reward);

    for (const reward of rewards) {
      if (!this.hasResource(reward)) {
        return false;
      }
    }
    return true;
  }

  hasResource(reward: Reward) {
    switch (reward.type) {
      case Resource.Ore: return this.ores >= reward.count;
      case Resource.Credit: return this.credits >= reward.count;
      case Resource.Knowledge: return this.knowledge >= reward.count;
      case Resource.VictoryPoint: return this.victoryPoints >= reward.count;
      case Resource.Qic: return this.qics >= reward.count;
      case Resource.None: return true;
      case Resource.GainTokenArea1: return this.power.area1 >= reward.count;
      case Resource.GainTokenArea2: return this.power.area2 >= reward.count;
      case Resource.GainTokenArea3: return this.power.area3 >= reward.count;
      case Resource.GainTokenGaiaArea: return this.power.area1 + this.power.area2 + this.power.area3 >= reward.count;
    }

    return false;
  }

  /**
   * Move power tokens from a power area to an upper one, depending on the amount
   * of power chaged
   * 
   * @param power Power charged
   */
  chargePower(power: number, checkOnly : boolean = false) : number {
    const area1ToUp = Math.min(power, this.power.area1);
    power -= area1ToUp;
    const area2ToUp = Math.min(power, this.power.area2 + area1ToUp );

    if (!checkOnly) {
      this.power.area1 -= area1ToUp;
      this.power.area2 += area1ToUp;
      this.power.area2 -= area2ToUp;
      this.power.area3 += area2ToUp;
    }
    
    //returns real charged power
    return area1ToUp + area2ToUp;
  }

  spendPower(power: number)  {  
      this.power.area3 -= power;
      this.power.area1 += power;
  }

  movePowerToGaia(power: number) {
    const area1ToGaia = Math.min(power, this.power.area1);
    this.power.gaia += area1ToGaia;
    this.power.area1 -= area1ToGaia;
    power -= area1ToGaia;

    if (power <= 0) {
      return;
    }

    const area2ToGaia = Math.min(power, this.power.area2);
    this.power.gaia += area2ToGaia;
    this.power.area2 -= area2ToGaia;
    power -= area2ToGaia

    if (power <= 0) {
      return;
    }

    const area3ToGaia = Math.min(power, this.power.area2);
    this.power.gaia += area3ToGaia;
    power -= area3ToGaia
    this.power.area3 -= area3ToGaia;

   if (power <= 0) {
      return;
    }
  }

  advanceResearch(which: ResearchField, count: number) {
    while (count-- > 0) {
      this.research[which] += 1;
      this.emit("advance-research", which);
    }
  }
}
