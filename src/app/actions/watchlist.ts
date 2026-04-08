"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { ingestWatchedApp } from "@/lib/ingest";

export async function addWatchedApp(formData: FormData): Promise<void> {
  const platform = formData.get("platform") as string;
  const externalId = String(formData.get("externalId") ?? "").trim();
  const isGame = formData.get("isGame") === "on";
  const trackDownloadMilestones = formData.get("skipInstallAlerts") !== "on";

  if (!externalId) {
    redirect("/watchlist?err=missing_id");
  }

  if (platform !== "IOS" && platform !== "ANDROID") {
    redirect("/watchlist?err=invalid_platform");
  }

  let app;
  try {
    app = await prisma.watchedApp.create({
      data: {
        platform,
        externalId,
        isGame,
        trackDownloadMilestones,
      },
    });
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2002") {
      redirect("/watchlist?err=duplicate");
    }
    redirect("/watchlist?err=unknown");
  }

  await ingestWatchedApp(app.id);
  revalidatePath("/");
  revalidatePath("/watchlist");
  revalidatePath("/alerts");
  redirect("/watchlist?ok=added");
}

export type QuickAddIosResult = { ok: true } | { ok: false; error: string };

/** Add iOS app by numeric App Store id without redirect (for chart / new-games tables). */
export async function quickAddIosGameToWatchlist(
  appStoreId: string,
  isGame = true,
): Promise<QuickAddIosResult> {
  const trimmed = appStoreId.trim();
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, error: "Invalid App Store id." };
  }

  let app;
  try {
    app = await prisma.watchedApp.create({
      data: {
        platform: "IOS",
        externalId: trimmed,
        isGame,
        trackDownloadMilestones: true,
      },
    });
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2002") {
      return { ok: false, error: "Already on watchlist." };
    }
    return { ok: false, error: "Could not add app." };
  }

  try {
    await ingestWatchedApp(app.id);
  } catch {
    /* row exists; user can run ingestion from Watchlist */
  }

  revalidatePath("/");
  revalidatePath("/watchlist");
  revalidatePath("/alerts");
  revalidatePath("/top-charts");
  revalidatePath("/new-games");
  return { ok: true };
}

export type QuickAddAndroidResult = { ok: true } | { ok: false; error: string };

/** Add Android app by package name (Play scrape / tables). */
export async function quickAddAndroidGameToWatchlist(
  packageName: string,
  isGame = true,
): Promise<QuickAddAndroidResult> {
  const trimmed = packageName.trim();
  if (!/^([a-zA-Z_][a-zA-Z0-9_]*\.)+[a-zA-Z0-9_]+$/.test(trimmed)) {
    return { ok: false, error: "Invalid package name." };
  }

  let app;
  try {
    app = await prisma.watchedApp.create({
      data: {
        platform: "ANDROID",
        externalId: trimmed,
        isGame,
        trackDownloadMilestones: true,
      },
    });
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2002") {
      return { ok: false, error: "Already on watchlist." };
    }
    return { ok: false, error: "Could not add app." };
  }

  try {
    await ingestWatchedApp(app.id);
  } catch {
    /* user can run ingestion from Watchlist */
  }

  revalidatePath("/");
  revalidatePath("/watchlist");
  revalidatePath("/alerts");
  revalidatePath("/play-scrape");
  return { ok: true };
}

export async function removeWatchedApp(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/watchlist?err=missing_id");
  }
  await prisma.watchedApp.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/watchlist");
  revalidatePath("/alerts");
  redirect("/watchlist?ok=removed");
}

export async function quickAddUnifiedToWishlist(formData: FormData): Promise<void> {
  const platform = String(formData.get("platform") ?? "").trim().toUpperCase();
  const externalId = String(formData.get("externalId") ?? "").trim();
  const isGame = String(formData.get("isGame") ?? "1") !== "0";
  if (!externalId) return;

  if (platform === "IOS") {
    await quickAddIosGameToWatchlist(externalId, isGame);
  } else if (platform === "ANDROID") {
    await quickAddAndroidGameToWatchlist(externalId, isGame);
  }

  revalidatePath("/");
  revalidatePath("/watchlist");
}

export async function updateWatchedAppAlerts(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/watchlist?err=missing_id");
  }

  const enableMilestones = String(formData.get("enableMilestones") ?? "") === "1";
  const enableSurge = String(formData.get("enableSurge") ?? "") === "1";

  await prisma.watchedApp.update({
    where: { id },
    data: {
      trackDownloadMilestones: enableMilestones,
      isGame: enableSurge,
    },
  });

  revalidatePath("/");
  revalidatePath("/watchlist");
  redirect("/watchlist?ok=alerts_updated");
}
