import type { EventKind } from "@prisma/client";

import { prisma } from "./db";
import { fetchItunesSnapshot } from "./itunes";
import { milestonesCrossed, shouldFireSurgeAlert } from "./milestones";
import { fetchPlayStoreSnapshot } from "./play-store";

type PrevState = { version: string | null; releaseNotes: string | null };

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
}

function nextFeedEvent(
  prev: PrevState | null,
  next: PrevState,
): EventKind | null {
  if (!prev) return "FIRST_SEEN";
  if ((prev.version ?? "") !== (next.version ?? "")) return "VERSION_UPDATE";
  if ((prev.releaseNotes ?? "") !== (next.releaseNotes ?? "")) {
    return "VERSION_UPDATE";
  }
  return null;
}

export async function ingestWatchedApp(watchedAppId: string) {
  const app = await prisma.watchedApp.findUnique({
    where: { id: watchedAppId },
  });
  if (!app) {
    return { ok: false as const, error: "Watched app not found." };
  }

  const snap =
    app.platform === "IOS"
      ? await fetchItunesSnapshot(app.externalId)
      : await fetchPlayStoreSnapshot(app.externalId);

  if (!snap.ok) {
    await prisma.watchedApp.update({
      where: { id: watchedAppId },
      data: { lastError: snap.error },
    });
    return { ok: false as const, error: snap.error };
  }

  const lastItem = await prisma.feedItem.findFirst({
    where: { watchedAppId },
    orderBy: { detectedAt: "desc" },
  });

  const nextState: PrevState = {
    version: snap.version,
    releaseNotes: snap.releaseNotes,
  };

  const prevState: PrevState | null = lastItem
    ? { version: lastItem.version, releaseNotes: lastItem.releaseNotes }
    : null;

  const eventKind = nextFeedEvent(prevState, nextState);

  const mergedIsGame = app.isGame || snap.isGame;
  const mergedCategory = snap.category || app.category;

  const prevInstallMin = app.lastInstallMin;
  const newInstallMin =
    app.platform === "ANDROID" ? snap.installMin : null;

  let nextAlerted = asNumberArray(app.alertedMilestones);
  let nextSurgeAt = app.lastSurgeAlertAt;

  if (
    app.platform === "ANDROID" &&
    app.trackDownloadMilestones &&
    newInstallMin != null
  ) {
    const { fireThresholds, nextAlerted: na } = milestonesCrossed(
      prevInstallMin,
      newInstallMin,
      nextAlerted,
    );
    nextAlerted = na;

    for (const T of fireThresholds) {
      await prisma.alert.create({
        data: {
          watchedAppId,
          kind: "DOWNLOAD_MILESTONE",
          threshold: T,
          title: `~${T.toLocaleString()}+ installs`,
          body: `${snap.title} crossed the ~${T.toLocaleString()} install tier (Play shows: ${snap.installLabel ?? "unknown"}). Public store data is bucketed — not an exact live count.`,
        },
      });
    }

    if (
      shouldFireSurgeAlert({
        isGame: mergedIsGame,
        trackMilestones: app.trackDownloadMilestones,
        prevMin: prevInstallMin,
        newMin: newInstallMin,
        lastSurgeAlertAt: app.lastSurgeAlertAt,
      })
    ) {
      await prisma.alert.create({
        data: {
          watchedAppId,
          kind: "DOWNLOAD_SURGE",
          title: "Install tier jumped (game)",
          body: `${snap.title} (${app.externalId}) moved from about ${prevInstallMin?.toLocaleString() ?? "?"} to ${newInstallMin.toLocaleString()} installs between checks — possible strong momentum. Surge alerts are limited to items marked as games (or auto-detected from Play category).`,
        },
      });
      nextSurgeAt = new Date();
    }
  }

  await prisma.watchedApp.update({
    where: { id: watchedAppId },
    data: {
      lastSuccessAt: new Date(),
      lastError: null,
      lastVersion: snap.version,
      category: mergedCategory,
      isGame: mergedIsGame,
      lastInstallMin:
        app.platform === "ANDROID"
          ? (snap.installMin ?? app.lastInstallMin)
          : null,
      lastInstallMax:
        app.platform === "ANDROID"
          ? (snap.installMax ?? app.lastInstallMax)
          : null,
      lastInstallLabel:
        app.platform === "ANDROID"
          ? (snap.installLabel ?? app.lastInstallLabel)
          : null,
      alertedMilestones: nextAlerted,
      lastSurgeAlertAt: nextSurgeAt,
    },
  });

  if (eventKind) {
    await prisma.feedItem.create({
      data: {
        watchedAppId,
        eventKind,
        title: snap.title,
        category: snap.category,
        version: snap.version,
        releaseNotes: snap.releaseNotes,
        iconUrl: snap.iconUrl,
        screenshots: snap.screenshots,
        developerName: snap.developerName,
        developerUrl: snap.developerUrl,
        storeUrl: snap.storeUrl,
        raw: snap.raw as object,
        parseOk: true,
      },
    });
  }

  return { ok: true as const, emitted: Boolean(eventKind) };
}

export async function runAllIngestion() {
  const run = await prisma.ingestionRun.create({ data: {} });
  const apps = await prisma.watchedApp.findMany();
  const logs: string[] = [];
  let allOk = true;

  for (const app of apps) {
    const r = await ingestWatchedApp(app.id);
    if (!r.ok) {
      allOk = false;
      logs.push(`${app.platform}:${app.externalId} — ${r.error}`);
    }
  }

  await prisma.ingestionRun.update({
    where: { id: run.id },
    data: {
      finishedAt: new Date(),
      ok: allOk,
      message: allOk
        ? `OK — ${apps.length} watched app(s)`
        : "Completed with errors",
      details: { logs },
    },
  });

  return { ok: allOk, processed: apps.length, logs };
}
