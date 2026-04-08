export const IOS_GAMES_GENRE_ID = 6014;
const US_STORE_FRONT = 143441;
const ITUNES_RSS_BASE =
  "https://itunes.apple.com/WebObjects/MZStoreServices.woa/ws/RSS";

export type GameChartKind = "free" | "paid" | "grossing";

const CHART_PATH: Record<GameChartKind, string> = {
  free: "topfreeapplications",
  paid: "toppaidapplications",
  grossing: "topgrossingapplications",
};

export type ItunesChartGame = {
  rank: number;
  appStoreId: string;
  name: string;
  developer: string;
  iconUrl: string;
  storeUrl: string;
  bundleId?: string;
  /** From iTunes lookup; empty if unavailable */
  screenshotUrls: string[];
};

type ImImage = { label?: string; attributes?: { height?: string } };
type RawEntry = {
  "im:name"?: { label?: string };
  "im:image"?: ImImage[];
  "im:artist"?: { label?: string };
  id?: { label?: string; attributes?: { "im:id"?: string; "im:bundleId"?: string } };
  link?: { attributes?: { rel?: string; href?: string } }[];
};

function asArray<T>(x: T | T[] | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function parseEntry(entry: RawEntry, rank: number): ItunesChartGame | null {
  const id = entry.id?.attributes?.["im:id"];
  const name = entry["im:name"]?.label;
  if (!id || !name) return null;

  const images = asArray(entry["im:image"]);
  const iconUrl = images.length ? (images[images.length - 1]?.label ?? "") : "";

  const links = asArray(entry.link);
  const alternate = links.find((l) => l.attributes?.rel === "alternate");
  const storeUrl = alternate?.attributes?.href ?? entry.id?.label ?? `https://apps.apple.com/app/id${id}`;

  return {
    rank,
    appStoreId: id,
    name,
    developer: entry["im:artist"]?.label ?? "",
    iconUrl,
    storeUrl,
    bundleId: entry.id?.attributes?.["im:bundleId"],
    screenshotUrls: [],
  };
}

export async function fetchItunesGameChart(
  kind: GameChartKind,
  limit: number,
): Promise<ItunesChartGame[]> {
  const path = CHART_PATH[kind];
  const url = `${ITUNES_RSS_BASE}/${path}/sf=${US_STORE_FRONT}/genre=${IOS_GAMES_GENRE_ID}/limit=${limit}/json`;

  const res = await fetch(url, {
    next: { revalidate: 3600 },
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`iTunes RSS ${kind} failed: ${res.status}`);
  }

  const data = (await res.json()) as { feed?: { entry?: RawEntry | RawEntry[] } };
  const entries = asArray(data.feed?.entry);

  const out: ItunesChartGame[] = [];
  let rank = 1;
  for (const e of entries) {
    const row = parseEntry(e, rank);
    if (row) {
      out.push(row);
      rank += 1;
    }
  }
  return out;
}

/** Attach lookup screenshots for chart rows (same Map from {@link lookupItunesStoreExtrasByTrackIds}). */
export function attachStoreExtrasToChartGames(
  rows: ItunesChartGame[],
  extras: Map<string, { screenshotUrls: string[] }>,
): ItunesChartGame[] {
  return rows.map((r) => ({
    ...r,
    screenshotUrls: extras.get(r.appStoreId)?.screenshotUrls ?? r.screenshotUrls,
  }));
}
