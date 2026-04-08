import { refreshSlackAppbirdForFeed } from "@/app/actions/slack-appbird";
import { GameCard } from "@/components/game-card";
import { fetchUnifiedFeedBoard } from "@/lib/feed-unified";

export const revalidate = 600;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    slack_ok?: string;
    slack_err?: string;
  }>;
}) {
  const sp = await searchParams;
  const slackOk = sp.slack_ok;
  const slackErr = sp.slack_err;

  const board = await fetchUnifiedFeedBoard(24);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Feed board
          </h1>
          <form action={refreshSlackAppbirdForFeed}>
            <button
              type="submit"
              title="Refresh Slack feed now"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <span aria-hidden="true">↻</span>
              Refresh Slack
            </button>
          </form>
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Unified view of top downloads, top grossing, and new games. Auto-refreshes every 10 minutes.
        </p>
      </div>
      {slackOk === "refreshed" ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          Slack feed refreshed. New games appear below as normal feed cards.
        </p>
      ) : null}
      {slackErr ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {slackErr === "disabled"
            ? "Slack feed refresh is disabled. Set SLACK_APPBIRD_ENABLED=1."
            : slackErr === "missing_config"
              ? "Missing Slack config (token or channel IDs)."
              : "Slack refresh failed. Try again."}
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
            Top downloads
          </h2>
          <div className="space-y-3">
            {board.topDownloads.map((row) => (
              <GameCard key={`d-${row.id}`} row={row} />
            ))}
          </div>
        </section>
        <section className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
            Top grossing
          </h2>
          <div className="space-y-3">
            {board.topGrossing.map((row) => (
              <GameCard key={`g-${row.id}`} row={row} />
            ))}
          </div>
        </section>
        <section className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
            New games
          </h2>
          <div className="space-y-3">
            {board.newGames.map((row) => (
              <GameCard key={`n-${row.id}`} row={row} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
