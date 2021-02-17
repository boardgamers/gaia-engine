import Event from "./events";
import Player from "./player";
import { expect } from "chai";
import { combinations } from "./income";
import { Power } from "./player-data";
import { BrainstoneArea } from "./enums";

describe("Utils", () => {
  describe("combinations", () => {
    const tests: {
      name: string;
      give: number[];
      want: number[][];
    }[] = [
      {
        name: "empty",
        give: [],
        want: [[]],
      },
      {
        name: "1,2",
        give: [1, 2],
        want: [[], [1], [2], [2, 1]],
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const target = combinations(test.give);
        expect(target).to.deep.equal(test.want);
      });
    }
  });
});
