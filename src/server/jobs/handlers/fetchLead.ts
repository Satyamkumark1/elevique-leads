import "server-only";
import { z } from "zod";
import { ruleScore } from "../../ai/ruleScore";
import { db } from "../../db";
import { getEnv } from "../../env";
import { duplicateWindowStart } from "../../lib/duplicate";
import { logger } from "../../lib/logger";
import { fetchLead } from "../../meta/fetchLead";
import { mapFields } from "../../meta/mapFields";
import { getSetting } from "../../settings";
import { enqueue } from "../enqueue";
import { sequenceJobs } from "../sequence";
import type { Job } from "../runner";

const payloadSchema = z.object({ leadgen_id: z.string().min(1) });

/** fetch → map → score → upsert → enqueue sequence. Safe to re-run: every write is idempotent. */
export async function handleFetchLead(job: Job, now = new Date()): Promise<void> {
  const { leadgen_id } = payloadSchema.parse(job.payload);
  const client = db();

  const mapped = mapFields(await fetchLead(leadgen_id));
  const score = ruleScore(mapped, await getSetting("scoring_rules"));

  let duplicateOf: string | null = null;
  if (mapped.phone_e164) {
    const { data } = await client
      .from("leads")
      .select("id")
      .eq("phone_e164", mapped.phone_e164)
      .is("duplicate_of", null)
      .gte("created_at", duplicateWindowStart(now).toISOString())
      .order("created_at")
      .limit(1)
      .maybeSingle();
    duplicateOf = data?.id ?? null;
  }

  const { data: inserted, error: insertError } = await client
    .from("leads")
    .upsert(
      { ...mapped, score, score_source: "rules", duplicate_of: duplicateOf },
      { onConflict: "leadgen_id", ignoreDuplicates: true },
    )
    .select("id");
  if (insertError) throw new Error(`lead insert failed: ${insertError.code}`);

  // Re-read so a retry after a partial failure uses the stored row, not a recomputed one.
  const { data: lead, error } = await client
    .from("leads")
    .select("id, score, duplicate_of")
    .eq("leadgen_id", leadgen_id)
    .single();
  if (error) throw new Error(`lead read failed: ${error.code}`);

  if (inserted.length > 0) {
    await client.from("events").insert([
      {
        lead_id: lead.id,
        type: "lead.created",
        description: `Lead received from Meta form (rule score: ${lead.score})`,
      },
      ...(lead.duplicate_of
        ? [
            {
              lead_id: lead.id,
              type: "lead.duplicate",
              description: "Same phone within 30 days; sequence not restarted",
              payload: { original_id: lead.duplicate_of },
            },
          ]
        : []),
    ]);
    logger.info("lead.created", { lead_id: lead.id, job_id: job.id, duplicate: !!lead.duplicate_of });
  }

  if (!getEnv().AUTOMATION_ENABLED) {
    logger.warn("automation.disabled", { lead_id: lead.id });
    return;
  }
  await enqueue(sequenceJobs(lead, await getSetting("followup_steps"), now));
}
