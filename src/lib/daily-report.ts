import type { AlertKind, EventKind, Platform } from "@prisma/client";
import { addDays, format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

import type { PrismaClient } from "@prisma/client";

import { prisma } from "./db";

/** ISO date only */
export type ReportYmd = string;

export type DailyReportSummary = {
  totalWatched: number;
  ios: number;
  android: number;
  withErrors: number;
  alertsThatDay: number;
  feedEventsThatDay: number;
};

export type DailyReportAppSignals = {
  surgeCount: number;
  milestoneCount: number;
  versionUpdates: number;
  firstSeens: number;
};

export type DailyReportTopRow = {
  watchedAppId: string;
  score: number;
  title: string;
  platform: Platform;
  externalId: string;
  category: string | null;
  isGame: boolean;
  iconUrl: string | null;
  storeUrl: string;
  version: string | null;
  lastInstallLabel: string | null;
  bullets: string[];
  signals: DailyReportAppSignals;
};

export type DailyReportAllRow = {
  watchedAppId: string;
  title: string;
  platform: Platform;
  externalId: string;
  category: string | null;
  isGame: boolean;
  iconUrl: string | null;
  storeUrl: string;
  version: string | null;
  lastInstallLabel: string | null;
  lastError: string | null;
  healthy: boolean;
  score: number;
  signals: DailyReportAppSignals;
};

export type DailyReportPayload = {
  reportDate: ReportYmd;
  timezone: string;
  generatedAt: string;
  summary: DailyReportSummary;
  topPerformers: DailyReportTopRow[];
  allApps: DailyReportAllRow[];
};

const WEIGHT_SURGE = 150;
const WEIGHT_MILESTONE = 100;
const WEIGHT_VERSION = 50;
const WEIGHT_FIRST_SEEN = 25;
const TOP_N = 8;

export function defaultReportTimezone(): string {
  return process.env.DAILY_REPORT_TIMEZONE?.trim() || "UTC";
}

/** Inclusive start, exclusive end in UTC for querying. */
export function dayBoundsUtc(ymd: ReportYmd, timeZone: string): { start: Date; end: Date } {
  const start = fromZonedTime(`${ymd}T00:00:00.000`, timeZone);
  const wall = toZonedTime(start, timeZone);
  const nextWall = addDays(wall, 1);
  const nextYmd = format(nextWall, "yyyy-MM-dd");
  const end = fromZonedTime(`${nextYmd}T00:00:00.000`, timeZone);
  return { start, end };
}

export function ymdFromDateInTimezone(date: Date, timeZone: string): ReportYmd {
  const wall = toZonedTime(date, timeZone);
  return format(wall, "yyyy-MM-dd");
}

export function yesterdayYmd(timeZone: string): ReportYmd {
  const wall = toZonedTime(new Date(), timeZone);
  const prev = addDays(wall, -1);
  return format(prev, "yyyy-MM-dd");
}

function scoreFromSignals(
  signals: DailyReportAppSignals,
  lastInstallMin: number | null,
): number {
  let s =
    signals.surgeCount * WEIGHT_SURGE +
    signals.milestoneCount * WEIGHT_MILESTONE +
    signals.versionUpdates * WEIGHT_VERSION +
    signals.firstSeens * WEIGHT_FIRST_SEEN;
  const tier = lastInstallMin ?? 0;
  s += Math.log10(tier + 1) * 10;
  return Math.round(s * 100) / 100;
}

function emptySignals(): DailyReportAppSignals {
  return {
    surgeCount: 0,
    milestoneCount: 0,
    versionUpdates: 0,
    firstSeens: 0,
  };
}

function aggregateAlerts(alerts: { watchedAppId: string; kind: AlertKind }[]) {
  const map = new Map<string, DailyReportAppSignals>();
  for (const a of alerts) {
    const cur = map.get(a.watchedAppId) ?? emptySignals();
    if (a.kind === "DOWNLOAD_SURGE") cur.surgeCount += 1;
    else if (a.kind === "DOWNLOAD_MILESTONE") cur.milestoneCount += 1;
    map.set(a.watchedAppId, cur);
  }
  return map;
}

function aggregateFeed(
  rows: { watchedAppId: string; eventKind: EventKind }[],
) {
  const map = new Map<string, DailyReportAppSignals>();
  for (const r of rows) {
    const cur = map.get(r.watchedAppId) ?? emptySignals();
    if (r.eventKind === "VERSION_UPDATE") cur.versionUpdates += 1;
    else if (r.eventKind === "FIRST_SEEN") cur.firstSeens += 1;
    map.set(r.watchedAppId, cur);
  }
  return map;
}

function mergeSignals(
  a: DailyReportAppSignals,
  b: DailyReportAppSignals,
): DailyReportAppSignals {
  return {
    surgeCount: a.surgeCount + b.surgeCount,
    milestoneCount: a.milestoneCount + b.milestoneCount,
    versionUpdates: a.versionUpdates + b.versionUpdates,
    firstSeens: a.firstSeens + b.firstSeens,
  };
}

function bulletsFromSignals(s: DailyReportAppSignals): string[] {
  const out: string[] = [];
  if (s.surgeCount) out.push(`${s.surgeCount} download surge alert(s)`);
  if (s.milestoneCount) out.push(`${s.milestoneCount} install milestone alert(s)`);
  if (s.versionUpdates) out.push(`${s.versionUpdates} version update(s) in feed`);
  if (s.firstSeens) out.push(`${s.firstSeens} first-seen feed event(s)`);
  if (out.length === 0) out.push("No feed or alert activity this day (tier tie-break only)");
  return out;
}

export async function buildDailyReportPayload(
  db: PrismaClient,
  ymd: ReportYmd,
  timeZone: string,
): Promise<DailyReportPayload> {
  const { start, end } = dayBoundsUtc(ymd, timeZone);

  const apps = await db.watchedApp.findMany({
    orderBy: { createdAt: "asc" },
  });

  const ids = apps.map((a) => a.id);

  const [alertsThatDay, feedThatDay, feedLatest] = await Promise.all([
    ids.length
      ? db.alert.findMany({
          where: {
            watchedAppId: { in: ids },
            createdAt: { gte: start, lt: end },
          },
          select: { watchedAppId: true, kind: true },
        })
      : [],
    ids.length
      ? db.feedItem.findMany({
          where: {
            watchedAppId: { in: ids },
            detectedAt: { gte: start, lt: end },
          },
          select: { watchedAppId: true, eventKind: true },
        })
      : [],
    ids.length
      ? db.feedItem.findMany({
          where: { watchedAppId: { in: ids } },
          orderBy: { detectedAt: "desc" },
          select: {
            watchedAppId: true,
            title: true,
            iconUrl: true,
            storeUrl: true,
            version: true,
            detectedAt: true,
          },
        })
      : [],
  ]);

  const latestByApp = new Map<
    string,
    { title: string; iconUrl: string | null; storeUrl: string; version: string | null }
  >();
  for (const row of feedLatest) {
    if (!latestByApp.has(row.watchedAppId)) {
      latestByApp.set(row.watchedAppId, {
        title: row.title,
        iconUrl: row.iconUrl,
        storeUrl: row.storeUrl,
        version: row.version,
      });
    }
  }

  const alertMap = aggregateAlerts(alertsThatDay);
  const feedDayMap = aggregateFeed(feedThatDay);

  const summary: DailyReportSummary = {
    totalWatched: apps.length,
    ios: apps.filter((a) => a.platform === "IOS").length,
    android: apps.filter((a) => a.platform === "ANDROID").length,
    withErrors: apps.filter((a) => a.lastError != null && a.lastError !== "").length,
    alertsThatDay: alertsThatDay.length,
    feedEventsThatDay: feedThatDay.length,
  };

  const allApps: DailyReportAllRow[] = apps.map((app) => {
    const aSig = alertMap.get(app.id) ?? emptySignals();
    const fSig = feedDayMap.get(app.id) ?? emptySignals();
    const signals = mergeSignals(aSig, fSig);
    const score = scoreFromSignals(signals, app.lastInstallMin);
    const meta = latestByApp.get(app.id);
    const title = meta?.title ?? app.externalId;
    const storeUrl =
      meta?.storeUrl ??
      (app.platform === "IOS"
        ? `https://apps.apple.com/app/id${app.externalId}`
        : `https://play.google.com/store/apps/details?id=${encodeURIComponent(app.externalId)}`);

    return {
      watchedAppId: app.id,
      title,
      platform: app.platform,
      externalId: app.externalId,
      category: app.category,
      isGame: app.isGame,
      iconUrl: meta?.iconUrl ?? null,
      storeUrl,
      version: meta?.version ?? app.lastVersion,
      lastInstallLabel: app.lastInstallLabel,
      lastError: app.lastError,
      healthy: !app.lastError,
      score,
      signals,
    };
  });

  const ranked = [...allApps].sort((x, y) => y.score - x.score);
  const topPerformers: DailyReportTopRow[] = ranked.slice(0, TOP_N).map((row) => ({
    watchedAppId: row.watchedAppId,
    score: row.score,
    title: row.title,
    platform: row.platform,
    externalId: row.externalId,
    category: row.category,
    isGame: row.isGame,
    iconUrl: row.iconUrl,
    storeUrl: row.storeUrl,
    version: row.version,
    lastInstallLabel: row.lastInstallLabel,
    bullets: bulletsFromSignals(row.signals),
    signals: row.signals,
  }));

  const allAppsSorted = [...allApps].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
  );

  return {
    reportDate: ymd,
    timezone: timeZone,
    generatedAt: new Date().toISOString(),
    summary,
    topPerformers,
    allApps: allAppsSorted,
  };
}

export function reportDateToPrismaDate(ymd: ReportYmd): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export async function upsertDailyReportSnapshot(
  ymd: ReportYmd,
  timeZone: string,
): Promise<DailyReportPayload> {
  const payload = await buildDailyReportPayload(prisma, ymd, timeZone);
  const reportDate = reportDateToPrismaDate(ymd);

  await prisma.dailyReportSnapshot.upsert({
    where: {
      reportDate_timezone: { reportDate, timezone: timeZone },
    },
    create: {
      reportDate,
      timezone: timeZone,
      payload: payload as object,
    },
    update: {
      payload: payload as object,
    },
  });

  return payload;
}

export async function getSnapshotPayloadIfExists(
  ymd: ReportYmd,
  timeZone: string,
): Promise<DailyReportPayload | null> {
  const reportDate = reportDateToPrismaDate(ymd);
  const row = await prisma.dailyReportSnapshot.findUnique({
    where: {
      reportDate_timezone: { reportDate, timezone: timeZone },
    },
  });
  if (!row?.payload) return null;
  return row.payload as unknown as DailyReportPayload;
}

/** Prefer stored snapshot when present (stable EOD); otherwise compute live from DB. */
export async function getReportForView(
  ymd: ReportYmd,
  timeZone: string,
): Promise<DailyReportPayload> {
  const snap = await getSnapshotPayloadIfExists(ymd, timeZone);
  if (snap) return snap;
  return buildDailyReportPayload(prisma, ymd, timeZone);
}
