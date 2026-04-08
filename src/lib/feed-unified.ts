import { prisma } from "@/lib/db";
import { fetchItunesGameChart } from "@/lib/itunes-rss-charts";
import { fetchNewIosGamesByDay } from "@/lib/itunes-new-games";
import { fetchPlayGameCategoryViaGplayCharts } from "@/lib/play-store-gplay-lists";
import { scrapePlayStoreGameCategory } from "@/lib/play-store-category-scrape";
import { fetchAppbirdCatalog, parseSlackChannelIdsList } from "@/lib/slack-appbird";

export type UnifiedBucket = "top_downloads" | "top_grossing" | "new_games";
export type UnifiedSource = "feed" | "itunes_chart" | "itunes_new" | "slack" | "play_scrape";

export type UnifiedGameRow = {
  id: string;
  key: string;
  bucket: UnifiedBucket;
  source: UnifiedSource;
  title: string;
  category: string | null;
  platform: "IOS" | "ANDROID" | "CROSS";
  externalId: string;
  iconUrl: string | null;
  screenshots: string[];
  developer: string | null;
  primaryUrl: string;
  iosUrl: string | null;
  androidUrl: string | null;
  rank: number | null;
  publishedAt: Date | null;
};

export function normalizeCategoryLabel(category: string | null | undefined): string | null {
  const raw = (category ?? "").trim();
  if (!raw) return null;
  return raw.replace(/^game[\s\-_:]+/i, "").trim().toLowerCase() || null;
}

function playSearchUrl(title: string, developer?: string | null): string {
  const q = [title, developer ?? ""].filter(Boolean).join(" ");
  return `https://play.google.com/store/search?q=${encodeURIComponent(q)}&c=apps`;
}

function iosUrlFromId(appStoreId: string): string {
  return `https://apps.apple.com/app/id${appStoreId}`;
}

export function dedupeRows(rows: UnifiedGameRow[]): UnifiedGameRow[] {
  const seen = new Set<string>();
  const out: UnifiedGameRow[] = [];
  for (const row of rows) {
    if (seen.has(row.key)) continue;
    seen.add(row.key);
    out.push(row);
  }
  return out;
}

export async function fetchUnifiedFeedBoard(limitPerBucket = 30): Promise<{
  topDownloads: UnifiedGameRow[];
  topGrossing: UnifiedGameRow[];
  newGames: UnifiedGameRow[];
}> {
  const [iosTopFreeSettled, iosTopGrossingSettled, iosNewGroupsSettled, feedItemsSettled, playRowsSettled] =
    await Promise.allSettled([
      fetchItunesGameChart("free", limitPerBucket),
      fetchItunesGameChart("grossing", limitPerBucket),
      fetchNewIosGamesByDay({ windowDays: 14 }),
      prisma.feedItem.findMany({
        where: { eventKind: "FIRST_SEEN" },
        orderBy: { detectedAt: "desc" },
        take: limitPerBucket * 2,
        include: { watchedApp: true },
      }),
      scrapePlayStoreGameCategory({ categoryId: "GAME_CASUAL" }),
    ]);

  const iosTopFree = iosTopFreeSettled.status === "fulfilled" ? iosTopFreeSettled.value : [];
  const iosTopGrossing = iosTopGrossingSettled.status === "fulfilled" ? iosTopGrossingSettled.value : [];
  const iosNewGroups = iosNewGroupsSettled.status === "fulfilled" ? iosNewGroupsSettled.value : [];
  const feedItems =
    feedItemsSettled.status === "fulfilled"
      ? feedItemsSettled.value
      : await prisma.feedItem.findMany({
      where: { eventKind: "FIRST_SEEN" },
      orderBy: { detectedAt: "desc" },
      take: Math.min(20, limitPerBucket),
      include: { watchedApp: true },
    });
  const playRows = playRowsSettled.status === "fulfilled" ? playRowsSettled.value : [];

  const topDownloads: UnifiedGameRow[] = [
    ...iosTopFree.map((r) => ({
      id: `itunes-free-${r.appStoreId}`,
      key: `IOS:${r.appStoreId}`,
      bucket: "top_downloads" as const,
      source: "itunes_chart" as const,
      title: r.name,
      category: null,
      platform: "IOS" as const,
      externalId: r.appStoreId,
      iconUrl: r.iconUrl || null,
      screenshots: r.screenshotUrls ?? [],
      developer: r.developer || null,
      primaryUrl: r.storeUrl || iosUrlFromId(r.appStoreId),
      iosUrl: r.storeUrl || iosUrlFromId(r.appStoreId),
      androidUrl: playSearchUrl(r.name, r.developer),
      rank: r.rank,
      publishedAt: null,
    })),
  ];

  const topGrossing: UnifiedGameRow[] = [
    ...iosTopGrossing.map((r) => ({
      id: `itunes-grossing-${r.appStoreId}`,
      key: `IOS:${r.appStoreId}`,
      bucket: "top_grossing" as const,
      source: "itunes_chart" as const,
      title: r.name,
      category: null,
      platform: "IOS" as const,
      externalId: r.appStoreId,
      iconUrl: r.iconUrl || null,
      screenshots: r.screenshotUrls ?? [],
      developer: r.developer || null,
      primaryUrl: r.storeUrl || iosUrlFromId(r.appStoreId),
      iosUrl: r.storeUrl || iosUrlFromId(r.appStoreId),
      androidUrl: playSearchUrl(r.name, r.developer),
      rank: r.rank,
      publishedAt: null,
    })),
  ];

  const newFromIos = iosNewGroups
    .flatMap((g) => g.games)
    .slice(0, limitPerBucket)
    .map(
      (r): UnifiedGameRow => ({
        id: `itunes-new-${r.appStoreId}`,
        key: `IOS:${r.appStoreId}`,
        bucket: "new_games",
        source: "itunes_new",
        title: r.name,
        category: normalizeCategoryLabel(r.category),
        platform: "IOS",
        externalId: r.appStoreId,
        iconUrl: r.iconUrl || null,
        screenshots: r.screenshotUrls ?? [],
        developer: r.developer || null,
        primaryUrl: r.storeUrl || iosUrlFromId(r.appStoreId),
        iosUrl: r.storeUrl || iosUrlFromId(r.appStoreId),
        androidUrl: playSearchUrl(r.name, r.developer),
        rank: null,
        publishedAt: r.releaseAt,
      }),
    );

  const newFromFeed = feedItems.map(
    (r): UnifiedGameRow => ({
      id: `feed-${r.id}`,
      key: `${r.watchedApp.platform}:${r.watchedApp.externalId}`,
      bucket: "new_games",
      source: "feed",
      title: r.title,
      category: normalizeCategoryLabel(r.watchedApp.category ?? r.category),
      platform: r.watchedApp.platform,
      externalId: r.watchedApp.externalId,
      iconUrl: r.iconUrl || null,
      screenshots: Array.isArray(r.screenshots) ? (r.screenshots as string[]) : [],
      developer: r.developerName || null,
      primaryUrl: r.storeUrl,
      iosUrl: r.watchedApp.platform === "IOS" ? r.storeUrl : null,
      androidUrl: r.watchedApp.platform === "ANDROID" ? r.storeUrl : playSearchUrl(r.title, r.developerName),
      rank: null,
      publishedAt: r.detectedAt,
    }),
  );

  const newFromPlay = playRows.slice(0, Math.ceil(limitPerBucket / 2)).map(
    (r, idx): UnifiedGameRow => ({
      id: `play-${r.packageName}`,
      key: `ANDROID:${r.packageName}`,
      bucket: "new_games",
      source: "play_scrape",
      title: r.title,
      category: "android games",
      platform: "ANDROID",
      externalId: r.packageName,
      iconUrl: r.iconUrl || null,
      screenshots: [],
      developer: null,
      primaryUrl: r.storeUrl,
      iosUrl: null,
      androidUrl: r.storeUrl,
      rank: idx + 1,
      publishedAt: null,
    }),
  );

  let newFromSlack: UnifiedGameRow[] = [];
  if (process.env.SLACK_APPBIRD_ENABLED === "1" && process.env.SLACK_BOT_TOKEN) {
    const channelIds = parseSlackChannelIdsList(process.env.SLACK_APPBIRD_CHANNEL_IDS);
    if (channelIds.length > 0) {
      const slack = await fetchAppbirdCatalog({
        botToken: process.env.SLACK_BOT_TOKEN,
        channelIds,
        messageLimit: 100,
      }).catch(() => null);
      if (slack) {
        newFromSlack = slack.rows.slice(0, limitPerBucket).map(
          (r): UnifiedGameRow => ({
            id: `slack-${r.platform}-${r.externalId}`,
            key: `${r.platform}:${r.externalId}`,
            bucket: "new_games",
            source: "slack",
            title: r.title,
            category: normalizeCategoryLabel(r.category),
            platform: r.platform,
            externalId: r.externalId,
            iconUrl: r.iconUrl || null,
            screenshots: r.screenshots ?? [],
            developer: r.developerName || null,
            primaryUrl: r.storeUrl,
            iosUrl: r.platform === "IOS" ? r.storeUrl : null,
            androidUrl: r.platform === "ANDROID" ? r.storeUrl : playSearchUrl(r.title, r.developerName),
            rank: null,
            publishedAt: r.firstSeenAt,
          }),
        );
      }
    }
  }

  // add Android chart signals via gplay helper and map to top downloads bucket
  const fromAndroidCharts = await fetchPlayGameCategoryViaGplayCharts("GAME_CASUAL", "en_US", "us").catch(() => []);
  topDownloads.push(
    ...fromAndroidCharts.slice(0, Math.floor(limitPerBucket / 2)).map((r, idx) => ({
      id: `gplay-chart-${r.packageName}`,
      key: `ANDROID:${r.packageName}`,
      bucket: "top_downloads" as const,
      source: "play_scrape" as const,
      title: r.title,
      category: "android games",
      platform: "ANDROID" as const,
      externalId: r.packageName,
      iconUrl: r.iconUrl || null,
      screenshots: [],
      developer: null,
      primaryUrl: r.storeUrl,
      iosUrl: null,
      androidUrl: r.storeUrl,
      rank: idx + 1,
      publishedAt: null,
    })),
  );

  const newGames = dedupeRows([...newFromFeed, ...newFromIos, ...newFromSlack, ...newFromPlay])
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
    .slice(0, limitPerBucket);

  return {
    topDownloads: dedupeRows(topDownloads).slice(0, limitPerBucket),
    topGrossing: dedupeRows(topGrossing).slice(0, limitPerBucket),
    newGames,
  };
}
