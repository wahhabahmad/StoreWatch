import Link from "next/link";

import { refreshInspirationNow } from "@/app/actions/videos";
import { listInspirationVideoItems } from "@/lib/video-items-store";

export const revalidate = 900;

function formatPublishedAt(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export default async function InspirationPage({
  searchParams,
}: {
  searchParams: Promise<{ sub?: string; videos_ok?: string; videos_err?: string }>;
}) {
  const sp = await searchParams;
  const selectedSubreddit = (sp.sub ?? "").trim();

  const items = await listInspirationVideoItems(200);

  const subreddits = [...new Set(items.map((item) => item.subreddit))].sort((a, b) => a.localeCompare(b));
  const filtered = selectedSubreddit
    ? items.filter((item) => item.subreddit.toLowerCase() === selectedSubreddit.toLowerCase())
    : items;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Inspiration</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Curated from Reddit video posts. Content refreshes hourly via cron, and you can run a manual refresh here.
          </p>
        </div>
        <form action={refreshInspirationNow}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Refresh now
          </button>
        </form>
      </div>

      {sp.videos_ok === "refreshed" ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          Inspiration feed refreshed.
        </p>
      ) : null}
      {sp.videos_err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          Refresh failed. Please try again.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/inspiration"
          className={`rounded-full px-3 py-1 font-medium ${
            !selectedSubreddit
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
          }`}
        >
          All
        </Link>
        {subreddits.map((sub) => (
          <Link
            key={sub}
            href={`/inspiration?sub=${encodeURIComponent(sub)}`}
            className={`rounded-full px-3 py-1 font-medium ${
              selectedSubreddit.toLowerCase() === sub.toLowerCase()
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
            }`}
          >
            r/{sub}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No video posts yet. Set `VIDEOS_REDDIT_SUBREDDITS` and click refresh.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((item) => (
            <article key={item.id} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {item.source === "REDDIT" ? `r/${item.subreddit}` : `YouTube: ${item.subreddit}`}
                  </p>
                  <h2 className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.title}</h2>
                </div>
              </div>
              {item.embedUrl && item.source === "YOUTUBE" ? (
                <iframe
                  className="h-56 w-full rounded-md border border-zinc-200 dark:border-zinc-800"
                  src={item.embedUrl}
                  title={item.title}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              ) : item.embedUrl ? (
                <video
                  className="w-full rounded-md border border-zinc-200 bg-black dark:border-zinc-800"
                  controls
                  preload="metadata"
                  src={item.embedUrl}
                />
              ) : item.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote Reddit thumbnail
                <img
                  src={item.thumbnailUrl}
                  alt={item.title}
                  className="w-full rounded-md border border-zinc-200 object-cover dark:border-zinc-800"
                />
              ) : (
                <div className="h-40 w-full rounded-md border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
              )}
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>{formatPublishedAt(item.publishedAt)}</span>
                <a
                  href={item.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 underline dark:text-blue-400"
                >
                  Open Reddit
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
