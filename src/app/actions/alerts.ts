"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";

export async function markAlertRead(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await prisma.alert.update({ where: { id }, data: { read: true } });
  revalidatePath("/alerts");
}

export async function markAllAlertsRead(): Promise<void> {
  await prisma.alert.updateMany({ where: { read: false }, data: { read: true } });
  revalidatePath("/alerts");
}
