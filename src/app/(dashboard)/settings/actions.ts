"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TIMELINES } from "@/lib/labels";
import { db } from "@/server/db";

const budget = z.coerce.number().int().min(0).max(10_000_000);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

async function save(key: string, value: unknown) {
  const { error } = await db()
    .from("settings")
    .update({ value: value as never })
    .eq("key", key);
  if (error) throw new Error("Could not save settings");
  revalidatePath("/settings");
}

export async function saveScoring(formData: FormData) {
  const timelines = (name: string) => z.array(z.enum(TIMELINES)).parse(formData.getAll(name).map(String));
  await save("scoring_rules", {
    hot: {
      min_budget_inr: budget.parse(formData.get("hot_min")),
      timelines: timelines("hot_timelines"),
      requires_brand_link: formData.get("hot_requires_link") === "on",
    },
    warm: { min_budget_inr: budget.parse(formData.get("warm_min")), timelines: timelines("warm_timelines") },
  });
}

export async function saveQuietHours(formData: FormData) {
  await save("quiet_hours", {
    start: time.parse(formData.get("start")),
    end: time.parse(formData.get("end")),
    tz: "Asia/Kolkata",
  });
}
