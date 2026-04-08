import { addDays, format, parseISO } from "date-fns";
import { notFound } from "next/navigation";

import { DailyReportView } from "@/components/daily-report-view";
import {
  defaultReportTimezone,
  getReportForView,
  type ReportYmd,
  ymdFromDateInTimezone,
} from "@/lib/daily-report";

export const dynamic = "force-dynamic";

function isValidYmd(s: string): s is ReportYmd {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseISO(`${s}T12:00:00.000Z`);
  return format(d, "yyyy-MM-dd") === s;
}

export default async function ReportDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!isValidYmd(date)) notFound();

  const tz = defaultReportTimezone();
  const payload = await getReportForView(date, tz);

  const base = parseISO(`${date}T12:00:00.000Z`);
  const prevYmd = format(addDays(base, -1), "yyyy-MM-dd");
  const nextYmd = format(addDays(base, 1), "yyyy-MM-dd");
  const todayYmd = ymdFromDateInTimezone(new Date(), tz);
  const nextAllowed = nextYmd <= todayYmd ? nextYmd : null;

  return (
    <DailyReportView payload={payload} prevYmd={prevYmd} nextYmd={nextAllowed} />
  );
}
