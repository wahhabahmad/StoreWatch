const UA = "Storewatch/1.0 (watchlist) Apple iTunes lookup batch";

const CHUNK = 50;

type LookupRow = {
  trackId: number;
  userRatingCount?: number;
  screenshotUrls?: string[];
  ipadScreenshotUrls?: string[];
};

function isLikelyStoreScreenshot(url: string): boolean {
  // iTunes image URLs usually carry dimensions like ".../1242x2208bb.jpg".
  const m = url.match(/\/(\d{2,5})x(\d{2,5})bb/i);
  if (!m) return true;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return true;
  // Drop small/square assets (e.g. age-rating/icon-like tiles).
  if (Math.min(w, h) < 300) return false;
  const ratio = Math.max(w, h) / Math.min(w, h);
  return ratio >= 1.3;
}

function screenshotListFromRow(r: LookupRow): string[] {
  const phone = r.screenshotUrls ?? [];
  const pad = r.ipadScreenshotUrls ?? [];
  const merged = [...phone, ...pad].filter((x) => Boolean(x) && isLikelyStoreScreenshot(x));
  return [...new Set(merged)].slice(0, 12);
}

export type ItunesStoreExtras = {
  userRatingCount: number;
  screenshotUrls: string[];
};

/**
 * Batch iTunes lookup: ratings (Apple does not expose installs) + store screenshot URLs.
 */
export async function lookupItunesStoreExtrasByTrackIds(
  trackIds: string[],
): Promise<Map<string, ItunesStoreExtras>> {
  const map = new Map<string, ItunesStoreExtras>();
  const unique = [...new Set(trackIds.filter((id) => /^\d+$/.test(id)))];
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const url = `https://itunes.apple.com/lookup?id=${chunk.join(",")}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": UA },
        next: { revalidate: 3600 },
      });
    } catch {
      continue;
    }
    if (!res.ok) continue;
    let data: { results?: LookupRow[] };
    try {
      data = (await res.json()) as { results?: LookupRow[] };
    } catch {
      continue;
    }
    for (const r of data.results ?? []) {
      map.set(String(r.trackId), {
        userRatingCount: r.userRatingCount ?? 0,
        screenshotUrls: screenshotListFromRow(r),
      });
    }
  }
  return map;
}

/** Treat as “hot” when App Store shows enough user ratings (downloads are not public on iOS). */
export const HOT_RATING_THRESHOLD = 100;
