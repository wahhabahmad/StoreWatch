import { addDays, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import {
  defaultReportTimezone,
  type ReportYmd,
  ymdFromDateInTimezone,
} from "@/lib/daily-report";
import { IOS_GAMES_GENRE_ID } from "@/lib/itunes-rss-charts";
import { HOT_RATING_THRESHOLD, lookupItunesStoreExtrasByTrackIds } from "@/lib/itunes-lookup-batch";

const ITUNES_RSS_BASE =
  "https://itunes.apple.com/WebObjects/MZStoreServices.woa/ws/RSS/newapplications";
const US_STORE_FRONT = 143441;

type ImImage = { label?: string };
type RawEntry = {
  "im:name"?: { label?: string };
  "im:image"?: ImImage[];
  "im:artist"?: { label?: string };
  id?: { label?: string; attributes?: { "im:id"?: string; "im:bundleId"?: string } };
  link?: { attributes?: { rel?: string; href?: string } } | { attributes?: { rel?: string; href?: string } }[];
  category?: { attributes?: { scheme?: string; label?: string } };
  "im:releaseDate"?: { label?: string };
};

function normalizeCategoryLabel(label: string | undefined): string {
  const raw = (label ?? "").trim();
  if (!raw) return "Games";
  return raw.replace(/^game[\s\-_:]+/i, "").trim() || "Games";
}

function asArray<T>(x: T | T[] | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

/**
 * App Store has no "hybrid casual" genre. These are common title/subgenre cues only — expect noise.
 */
export function hybridCasualNameHint(name: string): boolean {
  const n = name.toLowerCase();
  const needles = [
    "merge",
    "idle",
    "tycoon",
    "water sort",
    "ball sort",
    "color sort",
    "sort puzzle",
    " stack",
    "stack ",
    "asmr",
    "satisfying",
    "makeover",
    " match 3",
    "match3",
    " blast",
    "blast!",
    "tile master",
    "triple match",
    "hole.io",
    " organize",
    "cleaning asmr",
    "diy ",
    " jam",
    "factory idle",
    "simulator", // many hybrids; keep last as weaker signal
  ];
  if (needles.slice(0, -1).some((s) => n.includes(s.trim()))) return true;
  if (n.includes("simulator") && (n.includes("idle") || n.includes("tycoon"))) return true;
  return false;
}

function isPrimaryGameCategory(entry: RawEntry): boolean {
  const scheme = entry.category?.attributes?.scheme ?? "";
  return scheme.includes("/genre/ios-games/");
}

export type NewGameRow = {
  appStoreId: string;
  name: string;
  developer: string;
  category: string;
  iconUrl: string;
  storeUrl: string;
  bundleId?: string;
  releaseAt: Date;
  hybridCasualHint: boolean;
  /** From iTunes lookup; Apple does not expose install counts. */
  userRatingCount: number | null;
  /** True when {@link userRatingCount} exceeds {@link HOT_RATING_THRESHOLD}. */
  hotPopular: boolean;
  /** From iTunes lookup App Store listing */
  screenshotUrls: string[];
};

export type NewGamesDayGroup = {
  ymd: ReportYmd;
  games: NewGameRow[];
};

function parseNewGameEntry(entry: RawEntry): NewGameRow | null {
  const id = entry.id?.attributes?.["im:id"];
  const name = entry["im:name"]?.label;
  const rawDate = entry["im:releaseDate"]?.label;
  if (!id || !name || !rawDate) return null;

  const releaseAt = new Date(rawDate);
  if (Number.isNaN(releaseAt.getTime())) return null;

  const images = asArray(entry["im:image"]);
  const iconUrl = images.length ? (images[images.length - 1]?.label ?? "") : "";

  const links = asArray(entry.link);
  const alternate = links.find((l) => l.attributes?.rel === "alternate");
  const storeUrl =
    alternate?.attributes?.href ?? entry.id?.label ?? `https://apps.apple.com/app/id${id}`;

  return {
    appStoreId: id,
    name,
    developer: entry["im:artist"]?.label ?? "",
    category: normalizeCategoryLabel(entry.category?.attributes?.label),
    iconUrl,
    storeUrl,
    bundleId: entry.id?.attributes?.["im:bundleId"],
    releaseAt,
    hybridCasualHint: hybridCasualNameHint(name),
    userRatingCount: null,
    hotPopular: false,
    screenshotUrls: [],
  };
}

async function enrichNewGamesGroupsWithLookup(groups: NewGamesDayGroup[]): Promise<NewGamesDayGroup[]> {
  const ids = [...new Set(groups.flatMap((g) => g.games.map((x) => x.appStoreId)))];
  if (ids.length === 0) return groups;

  const extras = await lookupItunesStoreExtrasByTrackIds(ids);
  return groups.map((g) => ({
    ...g,
    games: g.games.map((game) => {
      const x = extras.get(game.appStoreId);
      const userRatingCount = x === undefined ? null : x.userRatingCount;
      const hotPopular = (x?.userRatingCount ?? 0) > HOT_RATING_THRESHOLD;
      const screenshotUrls = x?.screenshotUrls ?? [];
      return { ...game, userRatingCount, hotPopular, screenshotUrls };
    }),
  }));
}

function minYmdForWindow(timeZone: string, windowDays: number): ReportYmd {
  const wall = toZonedTime(new Date(), timeZone);
  const d = addDays(wall, -(windowDays - 1));
  return format(d, "yyyy-MM-dd");
}

export async function fetchNewIosGamesByDay(options: {
  limit?: number;
  windowDays?: number;
  timeZone?: string;
}): Promise<NewGamesDayGroup[]> {
  const limit = options.limit ?? 200;
  const windowDays = options.windowDays ?? 14;
  const timeZone = options.timeZone ?? defaultReportTimezone();

  const url = `${ITUNES_RSS_BASE}/sf=${US_STORE_FRONT}/genre=${IOS_GAMES_GENRE_ID}/limit=${limit}/json`;
  const res = await fetch(url, {
    next: { revalidate: 3600 },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`iTunes new applications RSS failed: ${res.status}`);

  const data = (await res.json()) as { feed?: { entry?: RawEntry | RawEntry[] } };
  const entries = asArray(data.feed?.entry).filter(isPrimaryGameCategory);

  const minYmd = minYmdForWindow(timeZone, windowDays);

  const rows: NewGameRow[] = [];
  for (const e of entries) {
    const row = parseNewGameEntry(e);
    if (!row) continue;
    const ymd = ymdFromDateInTimezone(row.releaseAt, timeZone);
    if (ymd < minYmd) continue;
    rows.push(row);
  }

  rows.sort((a, b) => b.releaseAt.getTime() - a.releaseAt.getTime());

  const byYmd = new Map<ReportYmd, NewGameRow[]>();
  for (const r of rows) {
    const ymd = ymdFromDateInTimezone(r.releaseAt, timeZone);
    const list = byYmd.get(ymd) ?? [];
    list.push(r);
    byYmd.set(ymd, list);
  }

  const groups = [...byYmd.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([ymd, games]) => ({ ymd, games }));

  return enrichNewGamesGroupsWithLookup(groups);
}
