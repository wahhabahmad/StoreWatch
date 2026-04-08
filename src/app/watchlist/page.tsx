export const dynamic = "force-dynamic";

import { DeveloperWishlistPanel } from "@/components/developer-wishlist-panel";
import { WatchlistPanel } from "@/components/watchlist-panel";
import { prisma } from "@/lib/db";

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const [apps, developers, discoveries] = await Promise.all([
    prisma.watchedApp.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        feedItems: {
          orderBy: { detectedAt: "desc" },
          take: 1,
          select: {
            title: true,
            iconUrl: true,
            screenshots: true,
            storeUrl: true,
          },
        },
      },
    }),
    prisma.wishlistedDeveloper.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { discoveries: true } } },
    }),
    prisma.developerDiscoveredApp.findMany({
      orderBy: { firstSeenAt: "desc" },
      take: 40,
    }),
  ]);

  const errText: Record<string, string> = {
    missing_id: "Missing app id.",
    duplicate: "Already in wishlist.",
    invalid_platform: "Invalid platform.",
    invalid_identifier: "Invalid developer identifier.",
    unknown: "Action failed.",
  };
  const bannerErr = sp.err ? errText[sp.err] ?? sp.err : null;
  const bannerOk = sp.ok
    ? ({
        added: "Added to wishlist.",
        removed: "Removed from wishlist.",
        discovered: "Developer discovery completed.",
        alerts_updated: "Alert settings updated.",
      }[sp.ok] ?? "Updated.")
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Wishlist</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Manage games and developers in one place.
        </p>
      </div>
      {bannerErr ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {bannerErr}
        </p>
      ) : null}
      {bannerOk ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {bannerOk}
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <WatchlistPanel apps={apps} />
        <DeveloperWishlistPanel developers={developers} discoveries={discoveries} />
      </div>
    </div>
  );
}
