import { describe, expect, it } from "vitest";

import { extractPlayInstallsFromHtml, parsePlayInstallString } from "./installs";

describe("parsePlayInstallString", () => {
  it("parses plus tiers", () => {
    expect(parsePlayInstallString("10,000+")).toEqual({
      label: "10,000+",
      min: 10_000,
      max: null,
    });
    expect(parsePlayInstallString("1M+")).toEqual({
      label: "1M+",
      min: 1_000_000,
      max: null,
    });
  });

  it("parses ranges", () => {
    const r = parsePlayInstallString("1,000 – 5,000");
    expect(r?.min).toBe(1000);
    expect(r?.max).toBe(5000);
  });
});

describe("extractPlayInstallsFromHtml", () => {
  it("reads numDownloads JSON", () => {
    const html = `<html><script>var x = { "numDownloads": "50,000+" };</script></html>`;
    const r = extractPlayInstallsFromHtml(html);
    expect(r?.min).toBe(50_000);
  });
});
