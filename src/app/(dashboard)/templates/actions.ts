"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CATEGORIES } from "@/lib/labels";
import { db } from "@/server/db";
import { assertTeam } from "@/server/session";

const url = z
  .url()
  .max(500)
  .refine((u) => /^https?:\/\//.test(u), "http(s) only");

export async function addReel(formData: FormData) {
  await assertTeam();
  const data = z
    .object({ category: z.enum(CATEGORIES), title: z.string().trim().max(120), url })
    .parse(Object.fromEntries(formData));
  const { count } = await db()
    .from("sample_reels")
    .select("*", { count: "exact", head: true })
    .eq("category", data.category);
  await db()
    .from("sample_reels")
    .insert({ ...data, sort: count ?? 0 });
  revalidatePath("/templates");
}

export async function deleteReel(formData: FormData) {
  await assertTeam();
  const id = z.uuid().parse(formData.get("id"));
  await db().from("sample_reels").delete().eq("id", id);
  revalidatePath("/templates");
}

/** Swap a reel with its neighbour in the same category. */
export async function moveReel(formData: FormData) {
  await assertTeam();
  const { id, dir } = z
    .object({ id: z.uuid(), dir: z.enum(["up", "down"]) })
    .parse(Object.fromEntries(formData));
  const client = db();
  const { data: reel } = await client.from("sample_reels").select("id, category").eq("id", id).single();
  if (!reel) return;
  const { data: list } = await client
    .from("sample_reels")
    .select("id, sort")
    .eq("category", reel.category)
    .order("sort")
    .order("id");
  const ordered = list ?? [];
  const i = ordered.findIndex((r) => r.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ordered.length) return;
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  await Promise.all(ordered.map((r, sort) => client.from("sample_reels").update({ sort }).eq("id", r.id)));
  revalidatePath("/templates");
}

/** Case studies: one per line, "Title | https://url". */
export async function saveEmailContent(formData: FormData) {
  await assertTeam();
  const raw = z
    .object({
      showreel_url: z.union([url, z.literal("")]),
      starting_price_line: z.string().trim().max(300),
      case_studies: z.string().max(5000),
    })
    .parse(Object.fromEntries(formData));
  const case_studies = raw.case_studies
    .split("\n")
    .map((line) => line.split("|").map((s) => s.trim()))
    .filter(([title, link]) => title && link)
    .map(([title, link]) => ({ title: title.slice(0, 120), url: url.parse(link) }));
  await db()
    .from("settings")
    .update({
      value: { showreel_url: raw.showreel_url, starting_price_line: raw.starting_price_line, case_studies },
    })
    .eq("key", "email_content");
  revalidatePath("/templates");
}
