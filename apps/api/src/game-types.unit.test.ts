import { GAME_TYPES as CONTRACT_GAME_TYPES } from "@studiakids/contracts";
import { GAME_TYPES } from "@studiakids/core";
import { describe, expect, it } from "vitest";

// core does not depend on contracts, so the closed list of seven game
// types is written twice (like the subjects): the API, which uses both,
// holds them equal.
describe("game types", () => {
  it("are the same closed list, in the same order, in core and in the HTTP contract", () => {
    expect([...GAME_TYPES]).toEqual([...CONTRACT_GAME_TYPES]);
  });
});
