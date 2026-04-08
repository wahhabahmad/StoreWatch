"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PlayAppIconScreenshotHover } from "@/components/play-app-icon-screenshot-hover";
import type { PlayCategoryAppRow } from "@/lib/play-store-category-scrape";

const PAGE = 24;

export function PlayScrapeInfiniteList({
  rows,
  categoryId,
}: {
  rows: PlayCategoryAppRow[];
  categoryId: string;
}) {
  const [visible, setVisible] = useState(() => Math.min(PAGE, rows.length));
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisible(Math.min(PAGE, rows.length));
  }, [rows, categoryId]);

  const loadMore = useCallback(() => {
    setVisible((v) => Math.min(v + PAGE, rows.length));
  }, [rows.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visible >= rows.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { root: null, rootMargin: "200px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore, visible, rows.length]);

  const slice = rows.slice(0, visible);

  return (
    <div className="flex flex-col gap-0">
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-2 py-2">Icon</th>
              <th className="px-3 py-2">App</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {slice.map((r, i) => (
              <tr key={r.packageName} className="bg-white dark:bg-zinc-950">
                <td className="whitespace-nowrap px-3 py-2 text-zinc-500 tabular-nums">{i + 1}</td>
                <td className="px-2 py-2 align-middle">
                  <PlayAppIconScreenshotHover
                    packageName={r.packageName}
                    title={r.title}
                    storeUrl={r.storeUrl}
                    iconUrl={r.iconUrl}
                  />
                </td>
                <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                  <a
                    href={r.storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {r.title}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible < rows.length ? (
        <div ref={sentinelRef} className="h-6 shrink-0" aria-hidden />
      ) : null}
      <p className="border-t border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {visible < rows.length ? (
          <>
            Showing {visible} of {rows.length} · scroll down to load more · category{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">{categoryId}</code> · list cached ~10 min
          </>
        ) : (
          <>
            End of listing · {rows.length} app(s) · category{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">{categoryId}</code> · cached ~10 min · merged HTML
            + top charts (free / paid / grossing); not an exhaustive catalog
          </>
        )}
      </p>
    </div>
  );
}
