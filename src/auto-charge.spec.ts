import { expect } from "chai";
import Engine from "./engine";
import { Player } from "./enums";
import { autoChargeItars } from "./auto-charge";

describe("AutoCharge", () => {
  it("should auto-charge when no power tokens are going to be put in area3", () => {
    expect(autoChargeItars(2, 2)).to.be.true;
    expect(autoChargeItars(1, 2)).to.be.false;
    expect(autoChargeItars(0, 1)).to.be.false;
  });
});
