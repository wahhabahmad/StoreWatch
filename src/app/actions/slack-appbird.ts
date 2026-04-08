"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ingestAppbirdChannels, parseSlackChannelIdsList } from "@/lib/slack-appbird";

export async function refreshSlackAppbirdNow(): Promise<void> {
  if (process.env.SLACK_APPBIRD_ENABLED !== "1") {
    redirect("/new-games?slack_err=disabled");
  }

  const botToken = process.env.SLACK_BOT_TOKEN;
  const channelIds = parseSlackChannelIdsList(process.env.SLACK_APPBIRD_CHANNEL_IDS);
  if (!botToken || channelIds.length === 0) {
    redirect("/new-games?slack_err=missing_config");
  }

  try {
    await ingestAppbirdChannels({
      botToken,
      channelIds,
      messageLimit: Number(process.env.SLACK_APPBIRD_MESSAGE_LIMIT ?? "100") || 100,
    });
  } catch {
    redirect("/new-games?slack_err=refresh_failed");
  }

  revalidatePath("/");
  revalidatePath("/new-games");
  revalidatePath("/alerts");
  redirect("/new-games?slack_ok=refreshed");
}

export async function refreshSlackAppbirdForFeed(): Promise<void> {
  if (process.env.SLACK_APPBIRD_ENABLED !== "1") {
    redirect("/?slack_err=disabled");
  }

  const botToken = process.env.SLACK_BOT_TOKEN;
  const channelIds = parseSlackChannelIdsList(process.env.SLACK_APPBIRD_CHANNEL_IDS);
  if (!botToken || channelIds.length === 0) {
    redirect("/?slack_err=missing_config");
  }

  try {
    await ingestAppbirdChannels({
      botToken,
      channelIds,
      messageLimit: Number(process.env.SLACK_APPBIRD_MESSAGE_LIMIT ?? "100") || 100,
    });
  } catch {
    redirect("/?slack_err=refresh_failed");
  }

  revalidatePath("/");
  revalidatePath("/new-games");
  revalidatePath("/alerts");
  redirect("/?slack_ok=refreshed");
}
