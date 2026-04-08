import { NextResponse } from "next/server";

import {
  defaultReportTimezone,
  upsertDailyReportSnapshot,
  yesterdayYmd,
} from "@/lib/daily-report";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const vercelCron = request.headers.get("x-vercel-cron") === "1";
  if (secret) {
    const auth = request.headers.get("authorization");
    const ok = auth === `Bearer ${secret}` || vercelCron;
    if (!ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const tz = defaultReportTimezone();
    const ymd = yesterdayYmd(tz);
    const payload = await upsertDailyReportSnapshot(ymd, tz);
    return NextResponse.json({
      ok: true,
      reportDate: ymd,
      timezone: tz,
      summary: payload.summary,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
