import { describe, expect, it } from "vitest";

import {
  isIosGameCategory,
  normalizeCategoryForDisplay,
  normalizeWishlistedDeveloperInput,
  pickUndiscoveredCandidates,
} from "./developer-discovery";

describe("normalizeWishlistedDeveloperInput", () => {
  it("parses iOS developer id from URL and raw id", () => {
    expect(
      normalizeWishlistedDeveloperInput("IOS", "https://apps.apple.com/us/developer/foo/id123456789"),
    )?.toEqual({
      externalDeveloperId: "123456789",
      storeUrl: "https://apps.apple.com/us/developer/foo/id123456789",
    });
    expect(normalizeWishlistedDeveloperInput("IOS", "123456789"))?.toEqual({
      externalDeveloperId: "123456789",
      storeUrl: null,
    });
  });

  it("parses Android developer id from URL and raw id", () => {
    expect(
      normalizeWishlistedDeveloperInput(
        "ANDROID",
        "https://play.google.com/store/apps/dev?id=Supercell",
      ),
    )?.toEqual({
      externalDeveloperId: "Supercell",
      storeUrl: "https://play.google.com/store/apps/dev?id=Supercell",
    });
    expect(
      normalizeWishlistedDeveloperInput(
        "ANDROID",
        "https://play.google.com/store/apps/developer?id=VOODOO",
      ),
    )?.toEqual({
      externalDeveloperId: "VOODOO",
      storeUrl: "https://play.google.com/store/apps/developer?id=VOODOO",
    });
    expect(normalizeWishlistedDeveloperInput("ANDROID", "Supercell"))?.toEqual({
      externalDeveloperId: "Supercell",
      storeUrl: null,
    });
  });
});

describe("game filtering helpers", () => {
  it("normalizes GAME prefix from categories", () => {
    expect(normalizeCategoryForDisplay("GAME SIMULATION")).toBe("SIMULATION");
    expect(normalizeCategoryForDisplay("Game-Puzzle")).toBe("Puzzle");
    expect(normalizeCategoryForDisplay(null)).toBe("Games");
  });

  it("identifies iOS game categories by genre name or id", () => {
    expect(isIosGameCategory("Games", [])).toBe(true);
    expect(isIosGameCategory("Entertainment", ["6014"])).toBe(true);
    expect(isIosGameCategory("Productivity", ["6007"])).toBe(false);
  });
});

describe("pickUndiscoveredCandidates", () => {
  it("drops already-seen (platform, externalId) candidates", () => {
    const out = pickUndiscoveredCandidates(
      [
        { platform: "IOS", externalId: "1", title: null, category: null, storeUrl: null },
        { platform: "ANDROID", externalId: "com.a", title: null, category: null, storeUrl: null },
      ],
      new Set(["IOS:1"]),
    );
    expect(out).toEqual([
      { platform: "ANDROID", externalId: "com.a", title: null, category: null, storeUrl: null },
    ]);
  });
});
