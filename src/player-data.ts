import Reward from "./reward";
import { GaiaHex } from "./gaia-hex";
import { ResearchField, Building, Booster, TechTile, AdvTechTile, Federation, Resource, BrainstoneArea, TechTilePos, AdvTechTilePos } from "./enums";
import { EventEmitter } from "eventemitter3";

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
  [Building.SpaceStation]: number = 0;
  satellites: number = 0;
  research: {
    [key in ResearchField]: number
  } = {
    terra: 0, nav: 0, int: 0, gaia: 0, eco: 0, sci: 0
  };
  range: number = 1;
  temporaryRange: number = 0;
  gaiaformers: number = 0;
  gaiaformersInGaia: number = 0;
  terraformCostDiscount: number = 0;
  temporaryStep: number = 0;

  roundBooster: Booster;
  techTiles: Array<{ tile: TechTile, pos: TechTilePos, enabled: boolean}> = [];
  advTechTiles: Array<{ tile: AdvTechTile, pos: AdvTechTilePos}> = [];
  federations: Federation[] = [];
  greenFederations: number = 0;
  /** Coordinates occupied by buildings */
  occupied: GaiaHex[] = [];
  brainstone: BrainstoneArea = BrainstoneArea.Out;
  leechPossible: number;
  tokenModifier: number = 1;

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
      temporaryRange: this.temporaryRange,
      gaiaformers: this.gaiaformers,
      terraformCostDiscount: this.terraformCostDiscount,
      temporaryStep: this.temporaryStep,
      roundBooster: this.roundBooster,
      techTiles: this.techTiles,
      advTechTiles: this.advTechTiles,
      federations: this.federations,
      greenFederations: this.federations,
      occupied: this.occupied,
      satellites: this.satellites,
      brainstone: this.brainstone,
      leechPossible: this.leechPossible,
      tokenModifier: this.tokenModifier
    };

    for (const building of Object.values(Building)) {
      ret[building] = this[building];
    }

    return ret;
  }

  payCost(cost: Reward) {
    this.gainReward(cost, true);
  }

  gainReward(reward: Reward, pay = false) {
    if (reward.isEmpty()) {
      return;
    }
    let { count } = reward;
    const resource = reward.type;

    if (pay) {
      count = -count;
    }

    if (resource.startsWith("up-")) {
      this.advanceResearch(resource.slice("up-".length) as ResearchField, count);
      return;
    }

    switch (resource) {
      case Resource.Ore: this.ores = Math.min(MAX_ORE, this.ores + count); return;
      case Resource.Credit: this.credits = Math.min(MAX_CREDIT, this.credits + count); return;
      case Resource.Knowledge: this.knowledge = Math.min(MAX_KNOWLEDGE, this.knowledge + count); return;
      case Resource.VictoryPoint: this.victoryPoints += count; return;
      case Resource.Qic: this.qics += count; return;
      case Resource.GainToken: count > 0 ?  this.power.area1 += count : this.discardPower(-count); return;
      case Resource.GainTokenGaiaArea: count > 0 ? this.chargeGaiaPower(count) :  this.discardGaiaPower(-count); return;
      case Resource.ChargePower: count > 0 ? this.chargePower(count) : this.spendPower(-count); return;
      case Resource.Range: this.range += count; return;
      case Resource.TemporaryRange: this.temporaryRange += count; return;
      case Resource.GaiaFormer: count > 0 ? this.gaiaformers += count : this.gaiaformersInGaia -= count; return;
      case Resource.TerraformCostDiscount: this.terraformCostDiscount += count; return;
      case Resource.TemporaryStep: this.temporaryStep += count; return;
      case Resource.TokenArea3: if (count < 0) { this.power.area3 += count; this.power.gaia -= count; } return;

      default: break; // Not implemented
    }
  }

  hasResource(reward: Reward) {
    switch (reward.type) {
      case Resource.Ore: return this.ores >= reward.count;
      case Resource.Credit: return this.credits >= reward.count;
      case Resource.Knowledge: return this.knowledge >= reward.count;
      case Resource.VictoryPoint: return this.victoryPoints >= reward.count;
      case Resource.Qic: return this.qics >= reward.count;
      case Resource.None: return true;
      case Resource.GainToken: return this.discardablePowerTokens() >= reward.count;
      case Resource.GainTokenGaiaArea: return this.gaiaPowerTokens() >= reward.count;
      case Resource.ChargePower: return this.spendablePowerTokens() >= reward.count;
      case Resource.TokenArea3: return this.power.area3 >= reward.count;
      case Resource.GaiaFormer: return this.gaiaformers - this.gaiaformersInGaia - this[Building.GaiaFormer]  >= reward.count;
    }

    return false;
  }

  hasPlanetaryInstitute(): boolean {
    return this[Building.PlanetaryInstitute] > 0;
  }

  discardablePowerTokens(): number {
    return this.power.area1 + this.power.area2 + this.power.area3 + (this.brainstoneInPlay() ? 1 : 0);
  }

  spendablePowerTokens(): number {
    return Math.floor(this.power.area3 * this.tokenModifier) + this.brainstoneValue();
  }

  gaiaPowerTokens(): number {
    return this.power.gaia + (this.brainstoneInPlay() ? 1 : 0);
  }

  /**
   * Move power tokens from a power area to an upper one, depending on the amount
   * of power chaged
   *
   * @param power Power charged
   */
  chargePower(power: number, apply: boolean = true): number {
    let brainstoneUsage = 0;
    let brainstonePos = this.brainstone;

    if (brainstonePos === BrainstoneArea.Area1) {
      brainstoneUsage += 1;
      power -= 1;
      brainstonePos = BrainstoneArea.Area2;
    }

    const area1ToUp = Math.min(power, this.power.area1);

    if (brainstonePos === BrainstoneArea.Area2 && (power - area1ToUp) > 0) {
      brainstoneUsage += 1;
      power -= 1;
      brainstonePos = BrainstoneArea.Area3;
    }

    const area2ToUp = Math.min(power - area1ToUp, this.power.area2 + area1ToUp);

    if (apply) {
      this.power.area1 -= area1ToUp;
      this.power.area2 += area1ToUp - area2ToUp;
      this.power.area3 += area2ToUp;
      this.brainstone = brainstonePos;
    }

    // returns real charged power
    return area1ToUp + area2ToUp + brainstoneUsage;
  }

  spendPower(power: number) {
    if (this.brainstone === BrainstoneArea.Area3 && (power >= 3 || this.power.area3 < power)) {
      this.brainstone = BrainstoneArea.Area1;
      power = Math.max(power - 3, 0);
    }
    this.power.area3 -= Math.ceil( power / this.tokenModifier );
    this.power.area1 += power;
  }

  discardPower(power: number) {
    const area1ToGaia = Math.min(power, this.power.area1);
    const area2ToGaia = Math.min(power - area1ToGaia, this.power.area2);
    const area3ToGaia = Math.min(power - area1ToGaia - area2ToGaia, this.power.area3);
    const brainstoneNeeded = this.brainstoneInPlay() && this.discardablePowerTokens() === power;

    this.power.area1 -= area1ToGaia;
    this.power.area2 -= area2ToGaia;
    this.power.area3 -= area3ToGaia;
    if (brainstoneNeeded) {
      this.brainstone =  BrainstoneArea.Transit;
    }
  }

  chargeGaiaPower(power: number) {
    if ( this.brainstone === BrainstoneArea.Transit) {
      this.brainstone = BrainstoneArea.Gaia;
      power -= 1;
    }
    this.power.gaia += power;
  }

  discardGaiaPower(power: number) {
    this.power.gaia -= power;
    this.emit('discardGaia', power);
  }

  burnablePower() {
    return Math.floor((this.power.area2 + (this.brainstone === BrainstoneArea.Area2 ? 1 : 0)) / 2);
  }

  burnPower(power: number) {
    if (this.brainstone === BrainstoneArea.Area2) {
      this.brainstone = BrainstoneArea.Area3;
      power -= 1;
    }
    this.power.area2 -= 2 * power;
    this.power.area3 += power;
    this.emit('burn', power);
  }

  advanceResearch(which: ResearchField, count: number) {
    while (count-- > 0) {
      this.research[which] += 1;
      this.emit("advance-research", which);
    }
  }

  brainstoneInPlay() {
    return this.brainstone !== BrainstoneArea.Out;
  }

  brainstoneValue() {
    return this.brainstone === BrainstoneArea.Area3 ? 3 : 0;
  }

  gaiaFormingDiscount() {
    return this.gaiaformers > 1  ?  this.gaiaformers : 0;
  }

  gainFinalVictoryPoints() {
    // Gain 4 points for research at level 3, 8 points for research at level 4
    // and 12 points for research at level 12
    for (const research of Object.values(ResearchField)) {
      this.victoryPoints += Math.max(this.research[research] - 3, 0) * 4;
    }

    // Gain 1 point for any 3 of ore, credits & knowledge.
    // Knowing that pw at area3 can be converted for credits
    // and Q.I.C for ore
    let resources = this.ores + this.credits + this.qics + this.knowledge;

    // Move as many tokens as possible into area3 and add to power tokens
    this.burnPower(this.burnablePower());
    resources += this.spendablePowerTokens();

    this.victoryPoints += Math.floor(resources / 3);
  }
}
