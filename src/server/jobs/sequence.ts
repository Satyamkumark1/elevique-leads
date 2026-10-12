import type { NewJob } from "./enqueue";

type Step = { step: string; template: string; delay_hours: number };

/** Jobs queued for a newly captured lead (TECH_SPEC §7.1). Duplicates only mirror to the Sheet (FR-07). */
export function sequenceJobs(
  lead: { id: string; score: string | null; duplicate_of: string | null },
  followups: Step[],
  now: Date,
): NewJob[] {
  const id = lead.id;
  const sheet: NewJob = {
    type: "sync_sheet",
    idempotency_key: `sync_sheet:append:${id}`,
    lead_id: id,
    payload: { op: "append" },
  };
  if (lead.duplicate_of) return [sheet];

  const jobs: NewJob[] = [
    {
      type: "send_whatsapp",
      idempotency_key: `send_whatsapp:welcome:${id}`,
      lead_id: id,
      payload: { template: "welcome_samples" },
    },
    {
      type: "send_email",
      idempotency_key: `send_email:welcome:${id}`,
      lead_id: id,
      payload: { template: "welcome" },
    },
    sheet,
    { type: "score_lead", idempotency_key: `score_lead:${id}`, lead_id: id },
    ...followups.map((f) => ({
      type: "followup",
      idempotency_key: `followup:${f.step}:${id}`,
      lead_id: id,
      payload: { step: f.step, template: f.template },
      run_at: new Date(now.getTime() + f.delay_hours * 3600 * 1000).toISOString(),
    })),
  ];
  if (lead.score === "hot") {
    jobs.push({
      type: "owner_alert",
      idempotency_key: `owner_alert:hot:${id}`,
      lead_id: id,
      payload: { reason: "hot" },
    });
  }
  return jobs;
}
