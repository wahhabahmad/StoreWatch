import { NextResponse } from "next/server";

import {
  ingestAppbirdChannels,
  parseSlackChannelIdsList,
} from "@/lib/slack-appbird";

export const dynamic = "force-dynamic";

/**
 * Reads Appbird (or similar) Slack channel posts, parses App Store / Play identifiers,
 * adds new rows to WatchedApp and runs ingestion. Requires a Slack app bot token with
 * conversations.history and the bot invited to each channel.
 *
 * Env: SLACK_BOT_TOKEN, SLACK_APPBIRD_CHANNEL_IDS (comma-separated C ids), or legacy
 * SLACK_APPBIRD_CHANNEL_ID for a single channel.
 * Optional: SLACK_APPBIRD_ENABLED=1 to run (otherwise 503)
 */
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

  if (process.env.SLACK_APPBIRD_ENABLED !== "1") {
    return NextResponse.json(
      { skipped: true, reason: "Set SLACK_APPBIRD_ENABLED=1 to enable." },
      { status: 503 },
    );
  }

  const botToken = process.env.SLACK_BOT_TOKEN;
  const fromList = parseSlackChannelIdsList(process.env.SLACK_APPBIRD_CHANNEL_IDS);
  const legacy = process.env.SLACK_APPBIRD_CHANNEL_ID?.trim();
  const channelIds =
    fromList.length > 0 ? fromList : legacy ? [legacy] : [];

  if (!botToken || channelIds.length === 0) {
    return NextResponse.json(
      {
        error:
          "Missing SLACK_BOT_TOKEN or channel ids (set SLACK_APPBIRD_CHANNEL_IDS or SLACK_APPBIRD_CHANNEL_ID)",
      },
      { status: 500 },
    );
  }

  try {
    const result = await ingestAppbirdChannels({
      botToken,
      channelIds,
      messageLimit: Number(process.env.SLACK_APPBIRD_MESSAGE_LIMIT ?? "100") || 100,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
