import { NextResponse } from "next/server";

import { refreshRedditVideoItems } from "@/lib/videos-reddit";
import { refreshYouTubeVideoItems } from "@/lib/videos-youtube";

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
    const [reddit, youtube] = await Promise.all([refreshRedditVideoItems(), refreshYouTubeVideoItems()]);
    return NextResponse.json({ reddit, youtube });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
