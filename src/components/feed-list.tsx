import Link from "next/link";
import type { ReactNode } from "react";

import type { FeedItem, Platform, WatchedApp } from "@prisma/client";

import type { PlatformTab } from "@/components/feed-toolbar";

type Row = FeedItem & { watchedApp: WatchedApp };

export type FeedEmptyContext = {
  watchedCount: number;
  totalBeforeFilter: number;
  platformFilter: PlatformTab;
  gamesOnly: boolean;
  category: string;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function formatDay(ts: number) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(ts));
}

function platformLabel(p: Platform) {
  return p === "IOS" ? "iOS" : "Android";
}

function normalizeCategoryLabel(category: string | null | undefined): string {
  const raw = (category ?? "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/^game[\s\-_:]+/i, "").trim() || "Games";
  return cleaned.toLowerCase();
}

function filterSummary(ctx: FeedEmptyContext): string {
  const parts: string[] = [];
  if (ctx.platformFilter !== "ALL") parts.push(`platform: ${ctx.platformFilter}`);
  if (ctx.gamesOnly) parts.push("games only");
  if (ctx.category) parts.push(`category: ${ctx.category}`);
  return parts.length ? parts.join(", ") : "";
}

export function FeedList({
  items,
  emptyContext,
}: {
  items: Row[];
  emptyContext?: FeedEmptyContext;
}) {
  const groups = new Map<number, Row[]>();
  for (const item of items) {
    const key = startOfDay(item.detectedAt);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  const days = [...groups.keys()].sort((a, b) => b - a);

  if (days.length === 0) {
    const ctx = emptyContext;
    const filteredOut = Boolean(ctx && ctx.totalBeforeFilter > 0);

    let body: ReactNode;
    if (filteredOut && ctx) {
      body = (
        <>
          <p className="font-medium text-zinc-800 dark:text-zinc-200">
            Nothing matches your filters ({filterSummary(ctx)}).
          </p>
          <p className="mt-2">
            You have <strong>{ctx.totalBeforeFilter}</strong> feed row(s) total — try{" "}
            <Link href="/" className="font-medium text-blue-600 underline dark:text-blue-400">
              All platforms
            </Link>{" "}
            or turn off extra filters.
          </p>
        </>
      );
    } else if (ctx && ctx.watchedCount === 0) {
      body = (
        <>
          <p className="font-medium text-zinc-800 dark:text-zinc-200">
            No tracked apps yet.
          </p>
          <p className="mt-2">Use Developers, Slack refresh, or ingestion sources to bring apps into the feed.</p>
        </>
      );
    } else if (ctx && ctx.watchedCount > 0 && ctx.totalBeforeFilter === 0) {
      body = (
        <>
          <p className="font-medium text-zinc-800 dark:text-zinc-200">
            No feed rows yet for your {ctx.watchedCount} watched app(s).
          </p>
          <p className="mt-2">Run ingestion or refresh Slack feed. New apps get a feed entry after the first successful fetch.</p>
        </>
      );
    } else {
      body = (
        <p>No feed rows yet. Refresh Slack or run ingestion.</p>
      );
    }

    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
        {body}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {days.map((day) => (
        <section key={day}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {formatDay(day)}
          </h2>
          <ul className="flex flex-col gap-4">
            {groups.get(day)!.map((item) => (
              <FeedCard key={item.id} item={item} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FeedCard({ item }: { item: Row }) {
  const shots = (item.screenshots as string[]) ?? [];
  const kind =
    item.eventKind === "FIRST_SEEN" ? "First seen" : "Update";
  const category = normalizeCategoryLabel(item.category ?? item.watchedApp.category);

  return (
    <li className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <div className="flex shrink-0 gap-3">
          {item.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.iconUrl}
              alt=""
              className="h-16 w-16 rounded-2xl border border-zinc-100 bg-zinc-50 object-cover dark:border-zinc-800"
              loading="lazy"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-900">
              No icon
            </div>
          )}
          <div className="flex flex-col gap-1 sm:hidden">
            <span className="text-[11px] font-medium uppercase text-zinc-500">
              {platformLabel(item.watchedApp.platform)}
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {kind}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 hidden flex-wrap items-center gap-2 sm:flex">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              {platformLabel(item.watchedApp.platform)}
            </span>
            {item.watchedApp.isGame ? (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                Game
              </span>
            ) : null}
            {category ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                {category}
              </span>
            ) : null}
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {kind}
            </span>
            {item.version ? (
              <span className="text-xs text-zinc-500">v{item.version}</span>
            ) : null}
            {item.watchedApp.platform === "ANDROID" &&
            item.watchedApp.lastInstallLabel ? (
              <span className="text-xs text-zinc-500">
                Installs: {item.watchedApp.lastInstallLabel}
              </span>
            ) : null}
          </div>
          <div className="mb-2 flex flex-wrap gap-2 sm:hidden">
            {item.watchedApp.isGame ? (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                Game
              </span>
            ) : null}
            {category ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                {category}
              </span>
            ) : null}
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {item.title}
          </h3>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
            {item.developerName ?? "Unknown developer"}
            {item.developerUrl ? (
              <>
                {" · "}
                <a
                  href={item.developerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Developer page
                </a>
              </>
            ) : null}
          </p>
          {item.releaseNotes ? (
            <details className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900/60">
              <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-200">
                What’s new
              </summary>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-zinc-700 dark:text-zinc-300">
                {item.releaseNotes}
              </pre>
            </details>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={item.storeUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Open in store
            </a>
          </div>
        </div>
      </div>

      {shots.length > 0 ? (
        <div className="border-t border-zinc-100 bg-zinc-50/80 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Screenshots
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {shots.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt=""
                className="h-40 shrink-0 rounded-lg border border-zinc-200 object-cover dark:border-zinc-700"
                loading="lazy"
              />
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}
