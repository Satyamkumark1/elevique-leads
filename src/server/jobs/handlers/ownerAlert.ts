import "server-only";
import { z } from "zod";
import { getEnv } from "../../env";
import { getLead, logEvent } from "../../leads";
import { sendTemplate } from "../../whatsapp/sendTemplate";
import { hotLeadParams, replyAlertParams } from "../../whatsapp/templates";
import type { Job } from "../runner";

const payloadSchema = z.object({ reason: z.enum(["hot", "reply"]) });

/** owner_alert: WhatsApp to OWNER_ALERT_PHONE (FR-21, FR-24). Goes to the owner, never to the lead. */
export async function handleOwnerAlert(job: Job): Promise<void> {
  const { reason } = payloadSchema.parse(job.payload);
  const env = getEnv();
  const lead = await getLead(job.lead_id);
  if (reason === "hot") {
    await sendTemplate(env.OWNER_ALERT_PHONE, "internal_hot_lead", hotLeadParams(lead, env.APP_URL));
  } else {
    await sendTemplate(env.OWNER_ALERT_PHONE, "internal_lead_replied", replyAlertParams(lead, env.APP_URL));
  }
  await logEvent(
    lead.id,
    "alert.sent",
    reason === "hot" ? "Owner alerted: hot lead" : "Owner alerted: lead replied",
  );
}
