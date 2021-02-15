import Player from "./player";
import { IncomeSelection } from "./income";
import { Faction } from "./enums";
import { Offer } from "./available-command";

export enum ChargeDecision {
  Yes,
  No,
  Ask,
  Undecided,
}

export class ChargeRequest {
  constructor(
    public readonly player: Player,
    public readonly offers: Offer[],
    public readonly power: number,
    public readonly isLastRound: boolean,
    public readonly playerHasPassed: boolean,
    public readonly incomeSelection: IncomeSelection
  ) {}
}

const chargeRules: ((ChargeRequest) => ChargeDecision)[] = [
  askOrDeclineForPassedPlayer,
  askForMultipleTaklonsOffers,
  (r: ChargeRequest) => askOrDeclineBasedOnCost(r.power, r.player.settings.autoChargePower),
  askForItars,
  () => ChargeDecision.Yes,
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
  const noOfferIsFree = r.offers.every((offer) => offer.cost !== "~");

  if (r.playerHasPassed && noOfferIsFree) {
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

function askForMultipleTaklonsOffers(r: ChargeRequest): ChargeDecision {
  // if autoBrainstone is, we won't have multiple offers here, as the best offer is selected already
  if (r.offers.length > 1) {
    return ChargeDecision.Ask;
  }
  return ChargeDecision.Undecided;
}

export function askOrDeclineBasedOnCost(power: number, autoChargePower: number) {
  if (autoChargePower == 0) {
    // 0 means we decline if it's not free
    if (power > 1) {
      return ChargeDecision.No;
    }
    return ChargeDecision.Undecided;
  }

  if (power > autoChargePower) {
    return ChargeDecision.Ask;
  }
  return ChargeDecision.Undecided;
}

function askForItars(r: ChargeRequest): ChargeDecision {
  // Itars may want to burn power instead, but we can safely move to area2
  if (
    r.player.faction === Faction.Itars &&
    !r.player.settings.itarsAutoChargeToArea3 &&
    !autoChargeItars(r.player.data.power.area1, r.power) &&
    !this.isLastRound
  ) {
    return ChargeDecision.Ask;
  }
  return ChargeDecision.Undecided;
}

export function autoChargeItars(area1: number, power: number) {
  return area1 >= power;
}
