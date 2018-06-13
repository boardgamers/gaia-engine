import { expect } from "chai";
import Engine from "..";
import { AssertionError } from "assert";

describe("Engine", () => {
  it("should process a simple game without errors", () => {
    const moves = ["init 3 seed?2", "p1 faction terrans", "p2 faction geodens"];

    expect(() => new Engine(moves)).to.not.throw();
  });

  it("should throw when two players choose factions on the same planet", () => {
    const moves = ["init 3 seed?2", "p1 faction terrans", "p2 faction lantids"];

    expect(() => new Engine(moves)).to.throw(AssertionError);
  });

  it("should throw when two players choose the same faction", () => {
    const moves = ["init 3 seed?2", "p1 faction terrans", "p2 faction terrans"];

    expect(() => new Engine(moves)).to.throw(AssertionError);
  });

  it("should give a valid JSON even when not initialized", () => {
    expect(() => JSON.stringify(new Engine([]))).to.not.throw();
  });
});