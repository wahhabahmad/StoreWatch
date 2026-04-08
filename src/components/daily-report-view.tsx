import Link from "next/link";

import type { DailyReportPayload } from "@/lib/daily-report";

function platformLabel(p: string) {
  return p === "IOS" ? "iOS" : "Android";
}

export function DailyReportView({
  payload,
  prevYmd,
  nextYmd,
}: {
  payload: DailyReportPayload;
  prevYmd: string | null;
  nextYmd: string | null;
}) {
  const { reportDate, timezone, generatedAt, summary, topPerformers, allApps } = payload;

  return (
    <article className="report-sheet mx-auto max-w-5xl print:max-w-none">
      <header className="report-header mb-8 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
              Daily report
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {reportDate}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Timezone: <strong className="font-medium text-zinc-800 dark:text-zinc-200">{timezone}</strong>.
              Top performers rank <strong>activity that day</strong> (install milestone/surge alerts and feed
              updates). Android install numbers are <strong>public tiers only</strong>, not exact counts. iOS has
              no public install data.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Generated {new Date(generatedAt).toLocaleString()} · Open this page and use Print → Save as PDF for a
              static copy.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2 print:hidden">
            {prevYmd ? (
              <Link
                href={`/report/${prevYmd}`}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                ← Previous day
              </Link>
            ) : null}
            {nextYmd ? (
              <Link
                href={`/report/${nextYmd}`}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Next day →
              </Link>
            ) : null}
          </nav>
        </div>
      </header>

      <section className="report-summary mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Watched apps" value={summary.totalWatched} hint={`${summary.ios} iOS · ${summary.android} Android`} />
        <StatCard label="Alerts (this day)" value={summary.alertsThatDay} hint="Milestones + surges" accent />
        <StatCard label="Feed events (this day)" value={summary.feedEventsThatDay} hint="Updates & first seen" />
        <StatCard label="Watchlist errors" value={summary.withErrors} hint="Parse / fetch issues" warn={summary.withErrors > 0} />
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">Top performers</h2>
        {topPerformers.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No watchlisted apps yet.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {topPerformers.map((row, i) => (
              <li
                key={row.watchedAppId}
                className="report-card flex gap-4 rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-4 shadow-sm print:border-zinc-300 print:bg-white print:shadow-none dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900/80"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-lg font-bold text-white dark:bg-violet-500">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {row.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.iconUrl} alt="" className="h-10 w-10 rounded-xl border border-zinc-200 object-cover dark:border-zinc-700" />
                    ) : null}
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{row.title}</h3>
                      <p className="text-xs text-zinc-500">
                        {platformLabel(row.platform)} · {row.externalId}
                        {row.category ? ` · ${row.category}` : ""}
                        {row.isGame ? " · Game" : ""}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-medium text-violet-700 dark:text-violet-300">Score {row.score}</p>
                  <ul className="mt-2 list-inside list-disc text-sm text-zinc-700 dark:text-zinc-300">
                    {row.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                    {row.version ? <span>v{row.version}</span> : null}
                    {row.lastInstallLabel ? <span>Installs: {row.lastInstallLabel}</span> : null}
                  </div>
                  <a
                    href={row.storeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400 print:hidden"
                  >
                    Open in store
                  </a>
                  <p className="mt-1 hidden text-xs text-zinc-500 print:block">{row.storeUrl}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">All watchlisted apps</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                <th className="px-4 py-3">App</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Installs</th>
                <th className="px-4 py-3">Day score</th>
                <th className="px-4 py-3">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {allApps.map((row) => (
                <tr key={row.watchedAppId} className="bg-white dark:bg-zinc-950">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {row.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.iconUrl} alt="" className="h-8 w-8 rounded-lg border border-zinc-200 object-cover dark:border-zinc-700" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-[10px] text-zinc-500 dark:bg-zinc-900">
                          —
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">{row.title}</p>
                        <p className="truncate text-xs text-zinc-500">{row.externalId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {platformLabel(row.platform)}
                    {row.isGame ? <span className="ml-1 text-violet-600 dark:text-violet-400">· game</span> : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.category ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.version ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {row.platform === "ANDROID" ? row.lastInstallLabel ?? "—" : "n/a"}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{row.score}</td>
                  <td className="px-4 py-3">
                    {row.healthy ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                        OK
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-200" title={row.lastError ?? ""}>
                        Error
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {allApps.some((a) => !a.healthy) ? (
          <p className="mt-3 text-xs text-zinc-500">
            Hover or check the watchlist for full error text on rows marked Error.
          </p>
        ) : null}
      </section>
    </article>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
  warn,
}: {
  label: string;
  value: number;
  hint: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        accent
          ? "border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/40"
          : warn
            ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{hint}</p>
    </div>
  );
}
