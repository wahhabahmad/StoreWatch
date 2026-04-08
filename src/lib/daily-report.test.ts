import { describe, expect, it } from "vitest";

import { dayBoundsUtc, yesterdayYmd } from "./daily-report";

describe("dayBoundsUtc", () => {
  it("returns half-open interval for a calendar day in UTC", () => {
    const { start, end } = dayBoundsUtc("2024-06-15", "UTC");
    expect(start.toISOString()).toBe("2024-06-15T00:00:00.000Z");
    expect(end.toISOString()).toBe("2024-06-16T00:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe("yesterdayYmd", () => {
  it("returns yyyy-MM-dd string", () => {
    const s = yesterdayYmd("UTC");
    expect(/^\d{4}-\d{2}-\d{2}$/.test(s)).toBe(true);
  });
});
