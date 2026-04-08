import Link from "next/link";

import type { Platform } from "@prisma/client";

export type PlatformTab = "ALL" | Platform;

function buildHref(options: {
  platform: PlatformTab;
  category: string;
  gamesOnly: boolean;
}) {
  const p = new URLSearchParams();
  if (options.platform !== "ALL") p.set("platform", options.platform);
  if (options.category) p.set("category", options.category);
  if (options.gamesOnly) p.set("games", "1");
  const s = p.toString();
  return s ? `/?${s}` : "/";
}

export function FeedToolbar({
  platform,
  category,
  gamesOnly,
  categories,
}: {
  platform: PlatformTab;
  category: string;
  gamesOnly: boolean;
  categories: string[];
}) {
  const platforms: { id: PlatformTab; label: string }[] = [
    { id: "ALL", label: "All" },
    { id: "IOS", label: "iOS" },
    { id: "ANDROID", label: "Android" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Platform</span>
        {platforms.map((t) => {
          const on = platform === t.id;
          return (
            <Link
              key={t.id}
              href={buildHref({ platform: t.id, category, gamesOnly })}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                on
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
        <span className="mx-1 hidden h-4 w-px bg-zinc-300 sm:inline dark:bg-zinc-700" />
        <Link
          href={buildHref({ platform, category, gamesOnly: !gamesOnly })}
          className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
            gamesOnly
              ? "bg-violet-700 text-white dark:bg-violet-600"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          Games only
        </Link>
      </div>

      {categories.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Category</span>
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildHref({ platform, category: "", gamesOnly })}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                !category
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              All categories
            </Link>
            {categories.map((c) => {
              const on = category.toLowerCase() === c.toLowerCase();
              return (
                <Link
                  key={c}
                  href={buildHref({ platform, category: c, gamesOnly })}
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    on
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {c}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
