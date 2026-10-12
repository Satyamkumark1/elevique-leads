import "server-only";
import type { Tables } from "@/lib/database.types";
import { db } from "../db";
import { getEnv } from "../env";
import { logger } from "../lib/logger";
import { nextRetry } from "./backoff";
import { PermanentJobError } from "./errors";
import { handleFetchLead } from "./handlers/fetchLead";
import { handleFollowup } from "./handlers/followup";
import { handleOwnerAlert } from "./handlers/ownerAlert";
import { handleScoreLead } from "./handlers/scoreLead";
import { handleSendEmail } from "./handlers/sendEmail";
import { handleSendWhatsapp } from "./handlers/sendWhatsapp";
import { handleSyncSheet } from "./handlers/syncSheet";

export type Job = Tables<"jobs">;

/** A handler finishes the job (void), cancels it, or asks to run it later (quiet hours). */
export type Outcome = void | { cancelled: string } | { rescheduleAt: Date };

const HANDLERS: Record<string, (job: Job) => Promise<Outcome>> = {
  fetch_lead: handleFetchLead,
  send_whatsapp: handleSendWhatsapp,
  send_email: handleSendEmail,
  sync_sheet: handleSyncSheet,
  owner_alert: handleOwnerAlert,
  score_lead: handleScoreLead,
  followup: handleFollowup,
};

/** Message-sending job types. With AUTOMATION_ENABLED=false they are not claimed and stay pending. */
export const OUTBOUND_TYPES = new Set(["send_whatsapp", "send_email", "owner_alert", "followup"]);

export function claimableTypes(automationEnabled: boolean): string[] {
  return Object.keys(HANDLERS).filter((t) => automationEnabled || !OUTBOUND_TYPES.has(t));
}

/** Claims and runs due jobs until none are left or the time budget is spent. */
export async function runJobs({ batch = 10, budgetMs = 50_000 } = {}): Promise<{ processed: number }> {
  const started = Date.now();
  let processed = 0;
  while (Date.now() - started < budgetMs) {
    const only_types = claimableTypes(getEnv().AUTOMATION_ENABLED);
    const { data: jobs, error } = await db().rpc("claim_jobs", { batch, only_types });
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
  const update = (fields: Partial<Job>) =>
    client
      .from("jobs")
      .update({ locked_at: null, ...fields })
      .eq("id", job.id);
  try {
    const outcome = await HANDLERS[job.type](job);
    if (outcome && "cancelled" in outcome) {
      await update({ status: "cancelled", last_error: outcome.cancelled });
    } else if (outcome && "rescheduleAt" in outcome) {
      // Not a failure: give back the attempt claim_jobs counted.
      await update({
        status: "pending",
        run_at: outcome.rescheduleAt.toISOString(),
        attempts: job.attempts - 1,
      });
    } else {
      await update({ status: "done", last_error: null });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const next =
      err instanceof PermanentJobError
        ? ({ status: "dead" } as const)
        : nextRetry(job.attempts, job.max_attempts, new Date());
    await update({ ...next, last_error: message });
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
