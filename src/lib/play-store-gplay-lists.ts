import { createRequire } from "module";

import { buildPlayStoreUrl } from "@/lib/play-store";
import { cleanPlayListingTitle, type PlayCategoryAppRow } from "@/lib/play-store-category-scrape";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CJS-only package
const gplay = require("google-play-scraper") as {
  list: (opts: {
    category: string;
    collection: string;
    num: number;
    lang: string;
    country: string;
  }) => Promise<GplayListApp[]>;
  category: Record<string, string>;
  collection: { TOP_FREE: string; TOP_PAID: string; GROSSING: string };
};

type GplayListApp = {
  appId?: string;
  title?: string;
  icon?: string;
  url?: string;
};

function hlGlToLangCountry(hl: string, gl: string): { lang: string; country: string } {
  const lang = hl.split("_")[0]?.toLowerCase() || "en";
  return { lang, country: gl.toLowerCase() };
}

/**
 * Extra apps for a Play **game** category via google-play-scraper (TOP_FREE + TOP_PAID + GROSSING).
 * Each chart returns up to ~50; merged and deduped. Unofficial and may break if Google changes batchexecute.
 */
export async function fetchPlayGameCategoryViaGplayCharts(
  categoryId: string,
  hl: string,
  gl: string,
): Promise<PlayCategoryAppRow[]> {
  const gCategory = gplay.category[categoryId];
  if (!gCategory) return [];

  const { lang, country } = hlGlToLangCountry(hl, gl);
  const collections = [gplay.collection.TOP_FREE, gplay.collection.TOP_PAID, gplay.collection.GROSSING];

  const batches = await Promise.all(
    collections.map((collection) =>
      gplay.list({ category: gCategory, collection, num: 50, lang, country }).catch(() => [] as GplayListApp[]),
    ),
  );

  const byPackage = new Map<string, PlayCategoryAppRow>();
  for (const batch of batches) {
    for (const app of batch) {
      const id = app.appId?.trim();
      if (!id || !/^([a-zA-Z_][a-zA-Z0-9_]*\.)+[a-zA-Z0-9_]+$/.test(id)) continue;
      if (byPackage.has(id)) continue;
      const title = cleanPlayListingTitle((app.title ?? id).replace(/\s+/g, " ").trim()) || id;
      const iconUrl = app.icon?.startsWith("http") ? app.icon : null;
      const storeUrl = app.url?.startsWith("http") ? app.url : buildPlayStoreUrl(id);
      byPackage.set(id, { packageName: id, title, storeUrl, iconUrl });
    }
  }

  return [...byPackage.values()];
}
