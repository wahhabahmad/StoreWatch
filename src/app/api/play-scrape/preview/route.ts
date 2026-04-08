import { NextRequest, NextResponse } from "next/server";

import { fetchPlayStoreSnapshot } from "@/lib/play-store";

const PKG =
  /^([a-zA-Z_][a-zA-Z0-9_]*\.)+[a-zA-Z0-9_]+$/;

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!PKG.test(id)) {
    return NextResponse.json({ error: "Invalid package id." }, { status: 400 });
  }

  const snap = await fetchPlayStoreSnapshot(id, { revalidateSeconds: 3600 });
  if (!snap.ok) {
    return NextResponse.json({ error: snap.error }, { status: 502 });
  }

  return NextResponse.json(
    {
      iconUrl: snap.iconUrl,
      screenshots: snap.screenshots ?? [],
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
