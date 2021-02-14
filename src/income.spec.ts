import Event from "./events";
import Player from "./player";
import { expect } from "chai";
import { combinations } from "./income";
import { Power } from "./player-data";
import { BrainstoneArea } from "./enums";

describe("IncomeSelection", () => {
  describe("remainingChargesAfterIncome", () => {
    const tests: {
      name: string;
      power: Power;
      brainstone: BrainstoneArea;
      events: Event[];
      expected: number;
    }[] = [
      {
        name: "no events - not fully charged",
        power: new Power(1),
        brainstone: null,
        events: [],
        expected: 2,
      },
      {
        name: "no events - not fully charged (brainstone)",
        power: new Power(),
        brainstone: BrainstoneArea.Area1,
        events: [],
        expected: 2,
      },
      {
        name: "no events - fully charged",
        power: new Power(0, 0, 1),
        brainstone: null,
        events: [],
        expected: 0,
      },
      {
        name: "no events - fully charged (brainstone)",
        power: new Power(),
        brainstone: BrainstoneArea.Area3,
        events: [],
        expected: 0,
      },
      {
        name: "no events - no tokens",
        power: new Power(),
        brainstone: null,
        events: [],
        expected: 0,
      },
      {
        name: "events - will charge fully",
        power: new Power(0, 1, 0),
        brainstone: null,
        events: Event.parse(["+3pw", "+1t"], null),
        expected: 0,
      },
      {
        name: "events - will charge more than fully",
        power: new Power(0, 1, 0),
        brainstone: null,
        events: Event.parse(["+4pw", "+1t"], null),
        expected: -1,
      },
      {
        name: "events - will charge fully (brainstone)",
        power: new Power(),
        brainstone: BrainstoneArea.Area2,
        events: Event.parse(["+3pw", "+1t"], null),
        expected: 0,
      },
      {
        name: "events - will not charge fully",
        power: new Power(0, 1, 0),
        brainstone: null,
        events: Event.parse(["+2pw", "+1t"], null),
        expected: 1,
      },
      {
        name: "events - will not charge fully (brainstone)",
        power: new Power(),
        brainstone: BrainstoneArea.Area2,
        events: Event.parse(["+2pw", "+1t"], null),
        expected: 1,
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const player = new Player();
        player.data.power = test.power;
        player.data.brainstone = test.brainstone;
        player.loadEvents(test.events);

        expect(player.getIncomeSelection().remainingChargesAfterIncome).to.equal(test.expected);
      });
    }
  });

  describe("autoplayEvents", () => {
    const tests: {
      name: string;
      give: { events: Event[]; autoIncome: boolean };
      want: { events: Event[]; needsManualSelection: boolean };
    }[] = [
      {
        name: "gain - no autoIncome",
        give: { events: Event.parse(["+1t"], null), autoIncome: false },
        want: { events: Event.parse(["+1t"], null), needsManualSelection: false },
      },
      {
        name: "gain - autoIncome",
        give: { events: Event.parse(["+1t"], null), autoIncome: true },
        want: { events: Event.parse(["+1t"], null), needsManualSelection: false },
      },
      {
        name: "gain & charge - no autoIncome",
        give: { events: Event.parse(["+1t", "+2pw"], null), autoIncome: false },
        want: { events: [], needsManualSelection: true },
      },
      {
        name: "gain & charge - autoIncome",
        give: { events: Event.parse(["+1t", "+2pw"], null), autoIncome: true },
        want: { events: Event.parse(["+1t", "+2pw"], null), needsManualSelection: false },
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const player = new Player();
        player.settings.autoIncome = test.give.autoIncome;
        player.loadEvents(test.give.events);

        const incomeSelection = player.getIncomeSelection();
        expect(incomeSelection.needsManualSelection).to.equal(test.want.needsManualSelection);
        expect(incomeSelection.autoplayEvents()).to.deep.equal(test.want.events);
      });
    }
  });

  describe("calculateAutoIncome", () => {
    const tests: {
      name: string;
      give: { power: Power; events: Event[] };
      want: { events: Event[] };
    }[] = [
      {
        name: "charge first",
        give: { power: new Power(1), events: Event.parse(["+1t", "+2pw"], null) },
        want: { events: Event.parse(["+2pw", "+1t"], null) },
      },
      {
        name: "income first",
        give: { power: new Power(), events: Event.parse(["+1t", "+2pw"], null) },
        want: { events: Event.parse(["+1t", "+2pw"], null) },
      },
      {
        name: "income first - but still waste",
        give: { power: new Power(), events: Event.parse(["+1t", "+3pw"], null) },
        want: { events: Event.parse(["+1t", "+3pw"], null) },
      },
      {
        name: "income, charge, income",
        give: { power: new Power(), events: Event.parse(["+1t", "+2t", "+2pw"], null) },
        want: { events: Event.parse(["+1t", "+2pw", "+2t"], null) },
      },
    ];

    for (const test of tests) {
      it(test.name, () => {
        const player = new Player();
        player.settings.autoIncome = true;
        player.data.power = test.give.power;
        player.loadEvents(test.give.events);

        expect(player.getIncomeSelection().autoplayEvents()).to.deep.equal(test.want.events);
      });
    }
  });

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
