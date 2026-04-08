import type { StoreFetchResult } from "./types";

const UA =
  "Storewatch/1.0 (watchlist; +https://github.com) Apple iTunes lookup client";

/** Common App Store genre ids that indicate games / game subgenres. */
const GAME_GENRE_IDS = new Set([
  6014, 7001, 7002, 7003, 7004, 7005, 7006, 7009, 7011, 7012, 7013, 7014, 7015, 7016,
  7017, 7018, 7019, 7020, 7021, 7022, 7023, 7024, 7025, 7026, 7027, 7028, 7029, 7030,
  7031, 7032, 7033, 7034, 7035, 7036, 7037, 7038, 7039, 7040, 7041, 7042,
]);

type ItunesLookupResponse = {
  resultCount: number;
  results: Array<{
    trackId: number;
    trackName: string;
    bundleId?: string;
    version?: string;
    releaseNotes?: string;
    artworkUrl512?: string;
    artworkUrl100?: string;
    screenshotUrls?: string[];
    sellerName?: string;
    artistName?: string;
    trackViewUrl?: string;
    sellerUrl?: string;
    primaryGenreName?: string;
    genres?: string[];
    genreIds?: string[];
  }>;
};

export function buildItunesStoreUrl(trackId: number): string {
  return `https://apps.apple.com/app/id${trackId}`;
}

function detectGameFromItunes(r: ItunesLookupResponse["results"][0]): boolean {
  const name = r.primaryGenreName?.toLowerCase() ?? "";
  if (name.includes("game")) return true;
  const ids = (r.genreIds ?? []).map((x) => Number(x));
  return ids.some((id) => GAME_GENRE_IDS.has(id));
}

export async function fetchItunesSnapshot(
  externalId: string,
  options?: { revalidateSeconds?: number },
): Promise<StoreFetchResult> {
  const trimmed = externalId.trim();
  if (!trimmed) {
    return { ok: false, error: "Empty App Store id or bundle id." };
  }

  const isNumeric = /^\d+$/.test(trimmed);
  const url = isNumeric
    ? `https://itunes.apple.com/lookup?id=${encodeURIComponent(trimmed)}`
    : `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(trimmed)}`;

  let res: Response;
  try {
    const revalidate = options?.revalidateSeconds ?? 0;
    res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate },
    });
  } catch (e) {
    return { ok: false, error: `iTunes lookup network error: ${String(e)}` };
  }

  if (!res.ok) {
    return { ok: false, error: `iTunes lookup HTTP ${res.status}` };
  }

  let data: ItunesLookupResponse;
  try {
    data = (await res.json()) as ItunesLookupResponse;
  } catch {
    return { ok: false, error: "iTunes lookup returned invalid JSON." };
  }

  if (!data.resultCount || !data.results?.length) {
    return { ok: false, error: "No results from iTunes lookup (check id or bundle id)." };
  }

  const r = data.results[0];
  const trackId = r.trackId;
  const iconUrl = r.artworkUrl512 ?? r.artworkUrl100 ?? null;
  const screenshots = (r.screenshotUrls ?? []).filter(Boolean);
  const storeUrl = r.trackViewUrl ?? buildItunesStoreUrl(trackId);
  const developerName = r.sellerName ?? r.artistName ?? null;
  const category = r.primaryGenreName ?? (r.genres?.[0] ?? null) ?? null;
  const isGame = detectGameFromItunes(r);

  return {
    ok: true,
    platform: "IOS",
    externalId: String(trackId),
    title: r.trackName ?? "Unknown app",
    category,
    isGame,
    version: r.version ?? null,
    releaseNotes: r.releaseNotes ?? null,
    iconUrl,
    screenshots,
    developerName,
    developerUrl: r.sellerUrl ?? null,
    storeUrl,
    installLabel: null,
    installMin: null,
    installMax: null,
    raw: r,
  };
}
