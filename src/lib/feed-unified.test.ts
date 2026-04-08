import { describe, expect, it } from "vitest";

import { dedupeRows, normalizeCategoryLabel, type UnifiedGameRow } from "./feed-unified";

describe("normalizeCategoryLabel", () => {
  it("normalizes game prefix and lowercase", () => {
    expect(normalizeCategoryLabel("GAME Strategy")).toBe("strategy");
    expect(normalizeCategoryLabel("  Game-Puzzle  ")).toBe("puzzle");
    expect(normalizeCategoryLabel(null)).toBeNull();
  });
});

describe("dedupeRows", () => {
  it("dedupes by key while keeping first", () => {
    const rowA: UnifiedGameRow = {
      id: "1",
      key: "IOS:123",
      bucket: "new_games",
      source: "feed",
      title: "A",
      category: null,
      platform: "IOS",
      externalId: "123",
      iconUrl: null,
      screenshots: [],
      developer: null,
      primaryUrl: "https://apps.apple.com/app/id123",
      iosUrl: "https://apps.apple.com/app/id123",
      androidUrl: null,
      rank: null,
      publishedAt: null,
    };
    const rowB: UnifiedGameRow = { ...rowA, id: "2", title: "B" };
    const out = dedupeRows([rowA, rowB]);
    expect(out).toEqual([rowA]);
  });
});
