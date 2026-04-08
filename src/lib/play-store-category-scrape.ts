import { load } from "cheerio";

import { buildPlayStoreUrl } from "@/lib/play-store";
import { fetchPlayGameCategoryViaGplayCharts } from "@/lib/play-store-gplay-lists";

const PLAY_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export type PlayCategoryAppRow = {
  packageName: string;
  title: string;
  storeUrl: string;
  /** Listing icon from category HTML when present. */
  iconUrl: string | null;
};

/** Google Play “Games” category ids (path segment after /category/). */
export const PLAY_GAME_CATEGORY_IDS = [
  "GAME_ACTION",
  "GAME_ADVENTURE",
  "GAME_ARCADE",
  "GAME_BOARD",
  "GAME_CARD",
  "GAME_CASINO",
  "GAME_CASUAL",
  "GAME_EDUCATIONAL",
  "GAME_MUSIC",
  "GAME_PUZZLE",
  "GAME_RACING",
  "GAME_ROLE_PLAYING",
  "GAME_SIMULATION",
  "GAME_SPORTS",
  "GAME_STRATEGY",
  "GAME_TRIVIA",
  "GAME_WORD",
] as const;

export type PlayGameCategoryId = (typeof PLAY_GAME_CATEGORY_IDS)[number];

export function isPlayGameCategoryId(s: string): s is PlayGameCategoryId {
  return (PLAY_GAME_CATEGORY_IDS as readonly string[]).includes(s);
}

/**
 * Strip trailing “4.5star” style suffixes Play often concatenates into link text.
 */
export function cleanPlayListingTitle(raw: string): string {
  return raw
    .replace(/\d+\.?\d*\s*star$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse public Play Store category HTML (server-rendered list).
 * Unofficial / brittle — Google can change markup anytime.
 */
export function parsePlayCategoryListingsHtml(html: string): PlayCategoryAppRow[] {
  const $ = load(html);
  const byPackage = new Map<string, PlayCategoryAppRow>();

  $("a[href*='/store/apps/details?id=']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const m = href.match(/[?&]id=([a-zA-Z0-9._]+)/);
    if (!m) return;
    const packageName = m[1];
    if (!/^([a-zA-Z_][a-zA-Z0-9_]*\.)+[a-zA-Z0-9_]+$/.test(packageName)) return;

    const rawTitle = $(el).text().trim().replace(/\s+/g, " ");
    const title = cleanPlayListingTitle(rawTitle);
    if (title.length < 1 || title.length > 200) return;

    if (!byPackage.has(packageName)) {
      const fromItemprop = $(el).find('img[itemprop="image"]').first().attr("src");
      const fromLh = $(el).find('img[src*="play-lh.googleusercontent"]').first().attr("src");
      const rawIcon = fromItemprop?.startsWith("http")
        ? fromItemprop
        : fromLh?.startsWith("http")
          ? fromLh
          : null;

      byPackage.set(packageName, {
        packageName,
        title: title || packageName,
        storeUrl: buildPlayStoreUrl(packageName),
        iconUrl: rawIcon,
      });
    }
  });

  return [...byPackage.values()];
}

export type ScrapePlayCategoryOptions = {
  categoryId: string;
  hl?: string;
  gl?: string;
};

const DEFAULT_HL = "en_US";
const DEFAULT_GL = "us";

/**
 * Fetch a Play Store **games** category page and extract visible listings.
 * This is whatever ordering Google serves (usually top/trending in category), not a guaranteed “new uploads” feed.
 */
export async function scrapePlayStoreGameCategory(
  options: ScrapePlayCategoryOptions,
): Promise<PlayCategoryAppRow[]> {
  const { categoryId, hl = DEFAULT_HL, gl = DEFAULT_GL } = options;
  if (!/^GAME_[A-Z_]+$/.test(categoryId)) {
    throw new Error("Invalid category id.");
  }

  const url = new URL(`https://play.google.com/store/apps/category/${categoryId}`);
  url.searchParams.set("hl", hl);
  url.searchParams.set("gl", gl);

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": PLAY_UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    next: { revalidate: 600 },
  });

  if (!res.ok) {
    throw new Error(`Play Store HTTP ${res.status}`);
  }

  const html = await res.text();
  const fromHtml = parsePlayCategoryListingsHtml(html);

  let fromCharts: PlayCategoryAppRow[] = [];
  try {
    fromCharts = await fetchPlayGameCategoryViaGplayCharts(categoryId, hl, gl);
  } catch {
    /* charts are optional; HTML list still works */
  }

  const seen = new Set(fromHtml.map((r) => r.packageName));
  const extra = fromCharts.filter((r) => !seen.has(r.packageName));
  return [...fromHtml, ...extra];
}
