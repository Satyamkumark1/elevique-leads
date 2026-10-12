import "server-only";
import type { Tables } from "@/lib/database.types";
import { db } from "./db";
import { PermanentJobError } from "./jobs/errors";

export type Lead = Tables<"leads">;

export async function getLead(id: string | null): Promise<Lead> {
  if (!id) throw new PermanentJobError("job has no lead_id");
  const { data, error } = await db().from("leads").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`lead read failed: ${error.code}`);
  if (!data) throw new PermanentJobError("lead not found");
  return data;
}

export async function logEvent(
  leadId: string | null,
  type: string,
  description: string,
  payload?: Record<string, string | number | boolean | null>,
) {
  await db()
    .from("events")
    .insert({ lead_id: leadId, type, description, payload: payload ?? null });
}

/** Why a lead must not get an automated message right now, or null if it may (CLAUDE.md hard rules). */
export function blockedReason(lead: Lead, channel: "whatsapp" | "email"): string | null {
  if (lead.status === "opted_out") return "opted out";
  if (lead.automation_paused) return "automation paused";
  if (channel === "whatsapp" && (!lead.phone_valid || !lead.phone_e164)) return "invalid or missing phone";
  if (channel === "email" && !lead.email) return "no email";
  return null;
}
