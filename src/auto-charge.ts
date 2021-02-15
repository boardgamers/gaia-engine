//todo
//array of charge rules ((Player) -> ChargeDecision)
//ChargeDecision = (Charge, Decline, Ask, Undecided)
//if some charges would be wasted during income phase -> ask
//if all are undecided, ask

import Player from "./player";
import { IncomeSelection } from "./income";
import assert from "assert";
import { Faction } from "./enums";

export enum ChargeDecision {
  Yes,
  No,
  Ask,
  Undecided,
}

export class ChargeRequest {
  constructor(
    public readonly player: Player,
    public readonly offers: any,
    public readonly power: number,
    public readonly isLastRound: boolean,
    public readonly playerHasPassed: boolean,
    public readonly incomeSelection: IncomeSelection
  ) {}
}

const chargeRules: ((ChargeRequest) => ChargeDecision)[] = [
  askOrDeclineForPassedPlayer,
  askForMultipleOffers,
  askBasedOnCost,
  askForItars,
  () => {
    return ChargeDecision.Yes;
  },
];

export function decideChargeRequest(r: ChargeRequest): ChargeDecision {
  for (const chargeRule of chargeRules) {
    const decision = chargeRule(r);
    if (decision != ChargeDecision.Undecided) {
      return decision;
    }
  }
  return ChargeDecision.Undecided;
}

// A passed player should always decline a leech if there's a VP cost associated with it -
// if it's either the last round or if the income phase would already move all tokens to area3.
// If this not true, please add an example (or link to) in the comments
function askOrDeclineForPassedPlayer(r: ChargeRequest): ChargeDecision {
  if (r.playerHasPassed && r.offers.every((offer) => offer.cost !== "~")) {
    //all offers cost something
    const remaining = r.incomeSelection.remainingChargesAfterIncome;
    if (r.isLastRound) {
      return ChargeDecision.No;
    } else if (remaining <= 0) {
      //all charges are wasted
      return ChargeDecision.No;
    } else if (remaining < r.power) {
      //some charges are wasted
      return ChargeDecision.Ask;
    }
  }
  return ChargeDecision.Undecided;
}

function askForMultipleOffers(r: ChargeRequest): ChargeDecision {
  if (r.offers.length > 1) {
    return ChargeDecision.Ask;
  }
  return ChargeDecision.Undecided;
}

function askBasedOnCost(r: ChargeRequest): ChargeDecision {
  if (r.power > (r.player.settings.autoChargePower ?? 1)) {
    return ChargeDecision.Ask;
  }
  return ChargeDecision.Undecided;
}

function askForItars(r: ChargeRequest): ChargeDecision {
  // Itars may want to burn power instead, but we can safely move to area2
  if (r.player.faction === Faction.Itars && !autoChargeItars(r.player.data.power.area1, r.power) && !this.isLastRound) {
    return ChargeDecision.Ask;
  }
  return ChargeDecision.Undecided;
}

export function autoChargeItars(area1: number, power: number) {
  return area1 >= power;
}
