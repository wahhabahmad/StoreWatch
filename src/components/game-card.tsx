import { quickAddUnifiedToWishlist } from "@/app/actions/watchlist";
import { GameNameWithStorePreview } from "@/components/game-name-store-preview";
import type { UnifiedGameRow } from "@/lib/feed-unified";

export function GameCard({ row }: { row: UnifiedGameRow }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start gap-3">
        {row.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.iconUrl} alt="" className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
        ) : (
          <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            <GameNameWithStorePreview href={row.primaryUrl} screenshotUrls={row.screenshots ?? []}>
              {row.title}
            </GameNameWithStorePreview>
          </p>
          <p className="text-xs text-zinc-500">
            {row.platform}
            {row.category ? ` · ${row.category}` : ""}
            {row.rank ? ` · #${row.rank}` : ""}
          </p>
        </div>
        {(row.platform === "IOS" || row.platform === "ANDROID") && row.externalId ? (
          <form action={quickAddUnifiedToWishlist}>
            <input type="hidden" name="platform" value={row.platform} />
            <input type="hidden" name="externalId" value={row.externalId} />
            <button
              type="submit"
              title="Add to wishlist"
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              ☆
            </button>
          </form>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <a
          href={row.primaryUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded bg-zinc-900 px-2 py-1 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Open
        </a>
        {row.iosUrl ? (
          <a
            href={row.iosUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-zinc-300 px-2 py-1 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            iOS
          </a>
        ) : null}
        {row.androidUrl ? (
          <a
            href={row.androidUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-zinc-300 px-2 py-1 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            Android
          </a>
        ) : null}
      </div>
    </article>
  );
}
