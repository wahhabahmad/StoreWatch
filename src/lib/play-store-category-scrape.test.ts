import { describe, expect, it } from "vitest";

import {
  cleanPlayListingTitle,
  parsePlayCategoryListingsHtml,
} from "./play-store-category-scrape";

describe("cleanPlayListingTitle", () => {
  it("removes trailing star rating blob", () => {
    expect(cleanPlayListingTitle("Block Blast!4.6star")).toBe("Block Blast!");
    expect(cleanPlayListingTitle("My Game 4.5star")).toBe("My Game");
  });
});

describe("parsePlayCategoryListingsHtml", () => {
  it("extracts package, title, store url, and icon when inside anchor", () => {
    const html = `
      <html><body>
        <a href="/store/apps/details?id=com.example.puzzle">
          <img itemprop="image" src="https://play-lh.googleusercontent.com/abc=s128-rw" alt="" />
          Puzzle Fun4.2star
        </a>
        <a href="https://play.google.com/store/apps/details?id=com.other.game&amp;hl=en">Other4.0star</a>
      </body></html>`;
    const rows = parsePlayCategoryListingsHtml(html);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      packageName: "com.example.puzzle",
      title: "Puzzle Fun",
      storeUrl: "https://play.google.com/store/apps/details?id=com.example.puzzle",
      iconUrl: "https://play-lh.googleusercontent.com/abc=s128-rw",
    });
    expect(rows[1].iconUrl).toBeNull();
  });

  it("dedupes by package", () => {
    const html = `
      <a href="/store/apps/details?id=com.dup.app">One4star</a>
      <a href="/store/apps/details?id=com.dup.app">Two4star</a>`;
    const rows = parsePlayCategoryListingsHtml(html);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("One");
  });
});
