import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parsePlayStoreHtml } from "./play-store";

const fixturePath = path.join(__dirname, "__fixtures__", "play-sample.html");

describe("parsePlayStoreHtml", () => {
  it("extracts metadata from fixture HTML", () => {
    const html = readFileSync(fixturePath, "utf-8");
    const result = parsePlayStoreHtml(html, "com.example.fixture");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.title).toBe("Fixture App");
    expect(result.version).toBe("1.2.3");
    expect(result.developerName).toBe("Fixture Dev");
    expect(result.releaseNotes).toContain("Bug fixes");
    expect(result.iconUrl).toContain("googleusercontent.com");
    expect(result.screenshots.length).toBeGreaterThanOrEqual(1);
    expect(result.storeUrl).toContain("com.example.fixture");
    expect(result.category?.toUpperCase()).toContain("GAME");
    expect(result.isGame).toBe(true);
    expect(result.installMin).toBe(5000);
    expect(result.installLabel).toBe("5,000+");
  });
});
