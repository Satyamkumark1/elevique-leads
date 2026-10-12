import "server-only";
import type { Tables } from "@/lib/database.types";
import { db } from "../db";
import { logger } from "../lib/logger";
import { nextRetry } from "./backoff";
import { PermanentJobError } from "./errors";
import { handleFetchLead } from "./handlers/fetchLead";

export type Job = Tables<"jobs">;

// Phase 2: only fetch_lead. Other job types stay `pending` until their handler ships (claim_jobs filters by type).
const HANDLERS: Record<string, (job: Job) => Promise<void>> = {
  fetch_lead: handleFetchLead,
};

/** Claims and runs due jobs until none are left or the time budget is spent. */
export async function runJobs({ batch = 10, budgetMs = 50_000 } = {}): Promise<{ processed: number }> {
  const started = Date.now();
  let processed = 0;
  while (Date.now() - started < budgetMs) {
    const { data: jobs, error } = await db().rpc("claim_jobs", { batch, only_types: Object.keys(HANDLERS) });
    if (error) throw new Error(`claim_jobs failed: ${error.code}`);
    if (jobs.length === 0) break;
    for (const job of jobs) {
      await runOne(job);
      processed++;
    }
  }
  return { processed };
}

async function runOne(job: Job) {
  const client = db();
  try {
    await HANDLERS[job.type](job);
    await client.from("jobs").update({ status: "done", last_error: null, locked_at: null }).eq("id", job.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const next =
      err instanceof PermanentJobError
        ? ({ status: "dead" } as const)
        : nextRetry(job.attempts, job.max_attempts, new Date());
    await client
      .from("jobs")
      .update({ ...next, last_error: message, locked_at: null })
      .eq("id", job.id);
    logger.error("job.failed", {
      job_id: job.id,
      lead_id: job.lead_id,
      type: job.type,
      attempts: job.attempts,
      status: next.status,
    });
    if (next.status === "dead") {
      await client.from("events").insert({
        lead_id: job.lead_id,
        type: "job.dead",
        description: `${job.type} failed permanently: ${message}`,
        payload: { job_id: job.id },
      });
    }
  }
}
