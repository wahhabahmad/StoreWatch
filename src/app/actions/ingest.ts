"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { runAllIngestion } from "@/lib/ingest";

export async function runIngestionNow(_formData: FormData): Promise<void> {
  void _formData;
  await runAllIngestion();
  revalidatePath("/");
  revalidatePath("/alerts");
  redirect("/?ok=ingested");
}
