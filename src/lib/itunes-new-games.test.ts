import { describe, expect, it } from "vitest";

import { hybridCasualNameHint } from "./itunes-new-games";

describe("hybridCasualNameHint", () => {
  it("flags common hybrid-casual title cues", () => {
    expect(hybridCasualNameHint("Merge Dragons!")).toBe(true);
    expect(hybridCasualNameHint("Idle Factory Tycoon")).toBe(true);
    expect(hybridCasualNameHint("Water Sort Puzzle")).toBe(true);
  });

  it("does not flag arbitrary puzzle names", () => {
    expect(hybridCasualNameHint("Chess")).toBe(false);
    expect(hybridCasualNameHint("Sudoku Daily")).toBe(false);
  });
});
