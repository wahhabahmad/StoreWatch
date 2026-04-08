import { NextResponse } from "next/server";

import { runAllIngestion } from "@/lib/ingest";

export const dynamic = "force-dynamic";

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
    const result = await runAllIngestion();
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
