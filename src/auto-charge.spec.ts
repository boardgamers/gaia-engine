import { expect } from "chai";
import { askOrDeclineBasedOnCost, autoChargeItars, ChargeDecision } from "./auto-charge";

describe("AutoCharge", () => {
  it("should auto-charge when no power tokens are going to be put in area3", () => {
    expect(autoChargeItars(2, 2)).to.be.true;
    expect(autoChargeItars(1, 2)).to.be.false;
    expect(autoChargeItars(0, 1)).to.be.false;
  });

  describe("askOrDeclineBasedOnCost", () => {
    const tests: {
      name: string;
      give: { power: number; autoCharge: number };
      want: ChargeDecision;
    }[] = [
      {
        name: "accept free or decline - it's free",
        give: { power: 1, autoCharge: 0 },
        want: ChargeDecision.Undecided,
      },
      {
        name: "accept free or decline - it's not free",
        give: { power: 2, autoCharge: 0 },
        want: ChargeDecision.No,
      },
      {
        name: "accept free or ask - it's free",
        give: { power: 1, autoCharge: 1 },
        want: ChargeDecision.Undecided,
      },
      {
        name: "accept free or ask - it's not free",
        give: { power: 2, autoCharge: 1 },
        want: ChargeDecision.Ask,
      },
      {
        name: "auto charge 3 - 2 power",
        give: { power: 2, autoCharge: 3 },
        want: ChargeDecision.Undecided,
      },
      {
        name: "auto charge 3 - 3 power",
        give: { power: 3, autoCharge: 3 },
        want: ChargeDecision.Undecided,
      },
      {
        name: "auto charge 3 - 4 power",
        give: { power: 4, autoCharge: 3 },
        want: ChargeDecision.Ask,
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const decision = askOrDeclineBasedOnCost(test.give.power, test.give.autoCharge);
        expect(decision).to.equal(test.want);
      });
    }
  });
});
