import "server-only";
import type { Json } from "@/lib/database.types";
import { db } from "../db";

export type NewJob = {
  type: string;
  idempotency_key: string;
  lead_id?: string | null;
  payload?: Json;
  run_at?: string;
};

/** Inserts jobs; an existing idempotency_key is silently kept (never a second send). */
export async function enqueue(jobs: NewJob[]): Promise<void> {
  if (jobs.length === 0) return;
  const { error } = await db()
    .from("jobs")
    .upsert(jobs, { onConflict: "idempotency_key", ignoreDuplicates: true, defaultToNull: false });
  if (error) throw new Error(`enqueue failed: ${error.code} ${error.message}`);
}
