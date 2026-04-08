import { createRequire } from "module";

import type { Platform } from "@prisma/client";

import { prisma } from "@/lib/db";
import { ingestWatchedApp } from "@/lib/ingest";
import { buildItunesStoreUrl } from "@/lib/itunes";
import { fetchPlayStoreSnapshot } from "@/lib/play-store";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CJS-only package
const gplay = require("google-play-scraper") as {
  developer: (opts: {
    devId: string;
    lang: string;
    country: string;
    num: number;
  }) => Promise<
    Array<{
      appId?: string;
      title?: string;
      url?: string;
      genre?: string;
      genreId?: string;
      released?: string;
      developer?: string;
      icon?: string;
    }>
  >;
};

export type NormalizedDeveloperInput = {
  externalDeveloperId: string;
  storeUrl: string | null;
};

type IosDeveloperLookup = {
  resultCount: number;
  results?: Array<{
    artistId?: number;
    artistName?: string;
    artistViewUrl?: string;
    trackId?: number;
    trackName?: string;
    trackViewUrl?: string;
    artworkUrl512?: string;
    artworkUrl100?: string;
    screenshotUrls?: string[];
    primaryGenreName?: string;
    genreIds?: string[];
  }>;
};

type DiscoveredCandidate = {
  platform: Platform;
  externalId: string;
  title: string | null;
  category: string | null;
  storeUrl: string | null;
  iconUrl: string | null;
  screenshots: string[];
};

export function pickUndiscoveredCandidates(
  candidates: DiscoveredCandidate[],
  discoveredKeys: Set<string>,
): DiscoveredCandidate[] {
  return candidates.filter((c) => !discoveredKeys.has(`${c.platform}:${c.externalId}`));
}

export type DeveloperDiscoverySummary = {
  processedDevelopers: number;
  scannedCandidates: number;
  newlyDiscovered: number;
  newlyWatchedApps: number;
  ingestErrors: number;
  logs: string[];
};

const IOS_GAME_GENRE_IDS = new Set([
  "6014", "7001", "7002", "7003", "7004", "7005", "7006", "7009", "7011", "7012", "7013",
  "7014", "7015", "7016", "7017", "7018", "7019", "7020", "7021", "7022", "7023", "7024",
  "7025", "7026", "7027", "7028", "7029", "7030", "7031", "7032", "7033", "7034", "7035",
  "7036", "7037", "7038", "7039", "7040", "7041", "7042",
]);

export function normalizeWishlistedDeveloperInput(
  platform: Platform,
  value: string,
): NormalizedDeveloperInput | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (platform === "IOS") {
    const idMatch = trimmed.match(/id(\d{4,})/i) ?? trimmed.match(/^(\d{4,})$/);
    const id = idMatch?.[1];
    if (!id) return null;
    const storeUrl = /^https?:\/\//i.test(trimmed) ? trimmed : null;
    return { externalDeveloperId: id, storeUrl };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      const id = u.searchParams.get("id")?.trim();
      if (!id) return null;
      return {
        externalDeveloperId: decodeURIComponent(id),
        storeUrl: trimmed,
      };
    } catch {
      return null;
    }
  }
  return { externalDeveloperId: trimmed, storeUrl: null };
}

export function normalizeCategoryForDisplay(category: string | null): string {
  const raw = (category ?? "").trim();
  if (!raw) return "Games";
  return raw.replace(/^game[\s\-_:]+/i, "").trim() || "Games";
}

export function isIosGameCategory(primaryGenreName: string | null, genreIds: string[] = []): boolean {
  if ((primaryGenreName ?? "").toLowerCase().includes("game")) return true;
  return genreIds.some((id) => IOS_GAME_GENRE_IDS.has(String(id)));
}

async function fetchIosDeveloperGames(externalDeveloperId: string): Promise<DiscoveredCandidate[]> {
  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(externalDeveloperId)}&entity=software&limit=200`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`iOS developer lookup HTTP ${res.status}`);
  const data = (await res.json()) as IosDeveloperLookup;
  const rows = data.results ?? [];
  const apps = rows
    .filter((r) => typeof r.trackId === "number")
    .filter((r) => isIosGameCategory(r.primaryGenreName ?? null, r.genreIds ?? []));

  return apps.map((r) => ({
    platform: "IOS",
    externalId: String(r.trackId),
    title: r.trackName ?? null,
    category: normalizeCategoryForDisplay(r.primaryGenreName ?? null),
    storeUrl: r.trackViewUrl ?? buildItunesStoreUrl(Number(r.trackId)),
    iconUrl: r.artworkUrl512 ?? r.artworkUrl100 ?? null,
    screenshots: (r.screenshotUrls ?? []).filter(Boolean).slice(0, 12),
  }));
}

async function fetchAndroidDeveloperGames(externalDeveloperId: string): Promise<DiscoveredCandidate[]> {
  const maxApps = Number(process.env.DEVELOPER_WISHLIST_MAX_APPS_PER_DEVELOPER ?? "60") || 60;
  const list = await gplay.developer({
    devId: externalDeveloperId,
    lang: "en",
    country: "us",
    num: Math.min(120, Math.max(10, maxApps)),
  });
  const ids = [...new Set(list.map((x) => (x.appId ?? "").trim()).filter(Boolean))];
  const out: DiscoveredCandidate[] = [];

  for (const appId of ids) {
    const snap = await fetchPlayStoreSnapshot(appId, { revalidateSeconds: 3600 });
    if (!snap.ok || !snap.isGame) continue;
    out.push({
      platform: "ANDROID",
      externalId: appId,
      title: snap.title,
      category: normalizeCategoryForDisplay(snap.category),
      storeUrl: snap.storeUrl,
      iconUrl: snap.iconUrl,
      screenshots: snap.screenshots,
    });
  }
  return out;
}

async function discoverForDeveloper(
  dev: {
    id: string;
    platform: Platform;
    externalDeveloperId: string;
  },
): Promise<{
  scanned: number;
  discovered: number;
  createdWatched: number;
  ingestErrors: number;
}> {
  const candidates =
    dev.platform === "IOS"
      ? await fetchIosDeveloperGames(dev.externalDeveloperId)
      : await fetchAndroidDeveloperGames(dev.externalDeveloperId);

  const discoveredRows = await prisma.developerDiscoveredApp.findMany({
    where: { developerId: dev.id },
    select: { id: true, platform: true, externalId: true },
  });
  const existingByKey = new Map<string, (typeof discoveredRows)[number]>(
    discoveredRows.map((x) => [`${x.platform}:${x.externalId}`, x] as const),
  );
  const seen = new Set(existingByKey.keys());
  const freshCandidates = pickUndiscoveredCandidates(candidates, seen);

  let discovered = 0;
  let createdWatched = 0;
  let ingestErrors = 0;

  for (const c of freshCandidates) {
    discovered += 1;

    const watched = await prisma.watchedApp.upsert({
      where: {
        platform_externalId: {
          platform: c.platform,
          externalId: c.externalId,
        },
      },
      update: {
        isGame: true,
        category: c.category ?? undefined,
      },
      create: {
        platform: c.platform,
        externalId: c.externalId,
        isGame: true,
        category: c.category,
        trackDownloadMilestones: true,
      },
    });

    await prisma.developerDiscoveredApp.create({
      data: {
        developerId: dev.id,
        platform: c.platform,
        externalId: c.externalId,
        title: c.title,
        category: c.category,
        storeUrl: c.storeUrl,
        watchedAppId: watched.id,
      },
    });

    if (watched.createdAt.getTime() === watched.updatedAt.getTime()) {
      createdWatched += 1;
      try {
        await ingestWatchedApp(watched.id);
      } catch {
        ingestErrors += 1;
      }
    }
  }

  return { scanned: candidates.length, discovered, createdWatched, ingestErrors };
}

export async function runDeveloperDiscovery(options?: {
  developerId?: string;
}): Promise<DeveloperDiscoverySummary> {
  const where = options?.developerId ? { id: options.developerId } : undefined;
  const developers = await prisma.wishlistedDeveloper.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      platform: true,
      externalDeveloperId: true,
    },
  });

  const logs: string[] = [];
  let scannedCandidates = 0;
  let newlyDiscovered = 0;
  let newlyWatchedApps = 0;
  let ingestErrors = 0;

  for (const dev of developers) {
    try {
      const r = await discoverForDeveloper(dev);
      scannedCandidates += r.scanned;
      newlyDiscovered += r.discovered;
      newlyWatchedApps += r.createdWatched;
      ingestErrors += r.ingestErrors;
      await prisma.wishlistedDeveloper.update({
        where: { id: dev.id },
        data: { lastCheckedAt: new Date(), lastError: null },
      });
    } catch (e) {
      const msg = String(e);
      logs.push(`${dev.platform}:${dev.externalDeveloperId} — ${msg}`);
      await prisma.wishlistedDeveloper.update({
        where: { id: dev.id },
        data: { lastCheckedAt: new Date(), lastError: msg },
      });
    }
  }

  return {
    processedDevelopers: developers.length,
    scannedCandidates,
    newlyDiscovered,
    newlyWatchedApps,
    ingestErrors,
    logs,
  };
}
