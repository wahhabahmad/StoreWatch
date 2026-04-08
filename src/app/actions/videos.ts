"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { refreshRedditVideoItems } from "@/lib/videos-reddit";
import { refreshYouTubeVideoItems } from "@/lib/videos-youtube";

export async function refreshInspirationNow(): Promise<void> {
  try {
    await Promise.all([refreshRedditVideoItems(), refreshYouTubeVideoItems()]);
  } catch {
    redirect("/inspiration?videos_err=refresh_failed");
  }

  revalidatePath("/inspiration");
  redirect("/inspiration?videos_ok=refreshed");
}
