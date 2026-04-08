"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import {
  normalizeWishlistedDeveloperInput,
  runDeveloperDiscovery,
} from "@/lib/developer-discovery";

export async function addWishlistedDeveloper(formData: FormData): Promise<void> {
  const from = String(formData.get("from") ?? "").trim().toLowerCase();
  const base = from === "watchlist" ? "/watchlist" : "/developers";
  const platform = String(formData.get("platform") ?? "").trim();
  const identifier = String(formData.get("identifier") ?? "").trim();
  if (platform !== "IOS" && platform !== "ANDROID") {
    redirect(`${base}?err=invalid_platform`);
  }
  const normalized = normalizeWishlistedDeveloperInput(platform, identifier);
  if (!normalized) {
    redirect(`${base}?err=invalid_identifier`);
  }

  try {
    await prisma.wishlistedDeveloper.create({
      data: {
        platform,
        externalDeveloperId: normalized.externalDeveloperId,
        storeUrl: normalized.storeUrl,
      },
    });
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2002") {
      redirect(`${base}?err=duplicate`);
    }
    redirect(`${base}?err=unknown`);
  }

  revalidatePath("/watchlist");
  revalidatePath("/developers");
  redirect(`${base}?ok=added`);
}

export async function removeWishlistedDeveloper(formData: FormData): Promise<void> {
  const from = String(formData.get("from") ?? "").trim().toLowerCase();
  const base = from === "watchlist" ? "/watchlist" : "/developers";
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect(`${base}?err=missing_id`);
  await prisma.wishlistedDeveloper.delete({ where: { id } });
  revalidatePath("/watchlist");
  revalidatePath("/developers");
  redirect(`${base}?ok=removed`);
}

export async function runDeveloperDiscoveryNow(formData?: FormData): Promise<void> {
  const from = String(formData?.get("from") ?? "").trim().toLowerCase();
  const base = from === "watchlist" ? "/watchlist" : "/developers";
  await runDeveloperDiscovery();
  revalidatePath("/");
  revalidatePath("/watchlist");
  revalidatePath("/developers");
  revalidatePath("/alerts");
  redirect(`${base}?ok=discovered`);
}
