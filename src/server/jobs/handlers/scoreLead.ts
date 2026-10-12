import "server-only";
import { aiScore } from "../../ai/aiScore";
import type { Score } from "../../ai/ruleScore";
import { db } from "../../db";
import { getLead, logEvent } from "../../leads";
import { logger } from "../../lib/logger";
import { enqueue } from "../enqueue";
import type { Job } from "../runner";

/** score_lead: Groq confirms/adjusts the rule score by ≤ 1 level (FR-19…21). AI failure never fails the job. */
export async function handleScoreLead(job: Job): Promise<void> {
  const lead = await getLead(job.lead_id);
  if (lead.ai_status === "done") return;
  const ruleScore = (lead.score ?? "cold") as Score;

  const result = await aiScore(lead, ruleScore);
  const client = db();
  if (result.status === "failed") {
    await client.from("leads").update({ ai_status: "failed" }).eq("id", lead.id);
    logger.warn("ai.failed", { lead_id: lead.id, error: result.error });
    await logEvent(lead.id, "ai.failed", `AI scoring failed (${result.error}); kept rule score`);
    return;
  }

  await client
    .from("leads")
    .update({
      score: result.score,
      score_source: "ai",
      ai_summary: result.summary,
      ai_reason: result.reason,
      ai_status: "done",
    })
    .eq("id", lead.id);

  if (result.score !== ruleScore) {
    await logEvent(lead.id, "score.changed", `AI changed score ${ruleScore} → ${result.score}`);
    await enqueue([
      {
        type: "sync_sheet",
        idempotency_key: `sync_sheet:ai_score:${lead.id}`,
        lead_id: lead.id,
        payload: { op: "update" },
      },
    ]);
  } else {
    await logEvent(lead.id, "ai.scored", `AI confirmed ${result.score}`);
  }
  if (result.shouldAlert) {
    await enqueue([
      {
        type: "owner_alert",
        idempotency_key: `owner_alert:hot:${lead.id}`,
        lead_id: lead.id,
        payload: { reason: "hot" },
      },
    ]);
  }
}
