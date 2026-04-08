import Link from "next/link";
import { addDays, format } from "date-fns";

import { DailyReportView } from "@/components/daily-report-view";
import { defaultReportTimezone, getReportForView, ymdFromDateInTimezone } from "@/lib/daily-report";
import { fetchUnifiedFeedBoard } from "@/lib/feed-unified";

export const dynamic = "force-dynamic";
export const revalidate = 600;

export default async function ReportIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const tz = defaultReportTimezone();
  const today = ymdFromDateInTimezone(new Date(), tz);
  const days = Math.max(3, Math.min(30, Number(sp.days ?? "7") || 7));

  const [todayReport, board] = await Promise.all([getReportForView(today, tz), fetchUnifiedFeedBoard(12)]);
  const trendRows = await Promise.all(
    Array.from({ length: days }).map(async (_, idx) => {
      const date = addDays(new Date(`${today}T12:00:00.000Z`), -idx);
      const ymd = format(date, "yyyy-MM-dd");
      const payload = await getReportForView(ymd, tz);
      return {
        ymd,
        alerts: payload.summary.alertsThatDay,
        feedEvents: payload.summary.feedEventsThatDay,
      };
    }),
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Report v2</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            KPI + trends + source tables. Auto-refreshes every 10 minutes.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          {[7, 14, 30].map((d) => (
            <Link
              key={d}
              href={`/report?days=${d}`}
              className={`rounded-full px-3 py-1 font-medium ${
                d === days
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              {d}d
            </Link>
          ))}
        </div>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">Daily trend</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-2 py-1">Date</th>
                <th className="px-2 py-1">Alerts</th>
                <th className="px-2 py-1">Feed events</th>
                <th className="px-2 py-1">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {trendRows.map((r) => (
                <tr key={r.ymd}>
                  <td className="px-2 py-1">{r.ymd}</td>
                  <td className="px-2 py-1">{r.alerts}</td>
                  <td className="px-2 py-1">{r.feedEvents}</td>
                  <td className="px-2 py-1">
                    <Link href={`/report/${r.ymd}`} className="text-blue-600 underline dark:text-blue-400">
                      Open day
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Column title="Top downloads" rows={board.topDownloads} />
        <Column title="Top grossing" rows={board.topGrossing} />
        <Column title="New games" rows={board.newGames} />
      </section>

      <DailyReportView payload={todayReport} prevYmd={trendRows[1]?.ymd ?? null} nextYmd={null} />
    </div>
  );
}

function Column({
  title,
  rows,
}: {
  title: string;
  rows: Awaited<ReturnType<typeof fetchUnifiedFeedBoard>>["topDownloads"];
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <h3 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</h3>
      <ul className="space-y-2 text-sm">
        {rows.slice(0, 10).map((r) => (
          <li key={r.id} className="truncate text-zinc-700 dark:text-zinc-300">
            {r.rank ? `#${r.rank} ` : ""}{r.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
