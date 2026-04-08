import { describe, expect, it } from "vitest";

import {
  baselineAlertedSet,
  DOWNLOAD_MILESTONE_THRESHOLDS,
  milestonesCrossed,
  shouldFireSurgeAlert,
} from "./milestones";

describe("milestonesCrossed", () => {
  it("baselines without firing when prev is null", () => {
    const r = milestonesCrossed(null, 12_000, []);
    expect(r.fireThresholds).toEqual([]);
    expect(r.nextAlerted).toEqual(baselineAlertedSet(12_000));
  });

  it("fires thresholds crossed since prevMin", () => {
    const alerted = baselineAlertedSet(9000);
    const r = milestonesCrossed(9000, 12_000, alerted);
    expect(r.fireThresholds).toContain(10_000);
    expect(r.nextAlerted.length).toBeGreaterThanOrEqual(alerted.length);
  });

  it("does not repeat fired thresholds", () => {
    const alerted = baselineAlertedSet(15_000);
    const r = milestonesCrossed(14_000, 20_000, alerted);
    expect(r.fireThresholds.every((t) => !alerted.includes(t))).toBe(true);
  });
});

describe("shouldFireSurgeAlert", () => {
  it("returns false for non-games", () => {
    expect(
      shouldFireSurgeAlert({
        isGame: false,
        trackMilestones: true,
        prevMin: 1000,
        newMin: 5000,
        lastSurgeAlertAt: null,
      }),
    ).toBe(false);
  });

  it("returns true on large jump for games", () => {
    expect(
      shouldFireSurgeAlert({
        isGame: true,
        trackMilestones: true,
        prevMin: 2000,
        newMin: 5000,
        lastSurgeAlertAt: null,
      }),
    ).toBe(true);
  });
});

describe("DOWNLOAD_MILESTONE_THRESHOLDS", () => {
  it("includes user-requested early rungs", () => {
    for (const n of [1000, 2000, 3000, 4000, 5000, 10_000]) {
      expect(DOWNLOAD_MILESTONE_THRESHOLDS).toContain(n);
    }
  });
});
