import "server-only";
import { z } from "zod";
import { blockedReason, getLead, logEvent, type Lead } from "../../leads";
import { nextAllowedTime } from "../../lib/quietHours";
import { getSetting } from "../../settings";
import type { Job, Outcome } from "../runner";
import { followupMessage, sendLeadTemplate } from "./sendWhatsapp";

const payloadSchema = z.object({ step: z.string(), template: z.string() });

function cancelReason(lead: Lead): string | null {
  if (lead.last_reply_at || lead.status === "replied") return "lead replied";
  if (!["new", "contacted"].includes(lead.status)) return `lead status is ${lead.status}`;
  return blockedReason(lead, "whatsapp");
}

/** followup: Day 2 / Day 4 template unless the lead replied, moved on, paused or opted out (FR-22…27). */
export async function handleFollowup(job: Job, now = new Date()): Promise<Outcome> {
  const { step, template } = payloadSchema.parse(job.payload);
  const lead = await getLead(job.lead_id);

  const reason = cancelReason(lead);
  if (reason) {
    await logEvent(lead.id, "followup.cancelled", `Follow-up ${step} cancelled: ${reason}`);
    return { cancelled: reason };
  }

  const allowed = nextAllowedTime(now, await getSetting("quiet_hours"));
  if (allowed > now) return { rescheduleAt: allowed };

  const msg = await followupMessage(lead, template);
  await sendLeadTemplate(job, lead, msg.template, msg.params);
}
