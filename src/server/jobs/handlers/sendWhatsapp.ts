import "server-only";
import { z } from "zod";
import { db } from "../../db";
import { getEnv } from "../../env";
import { blockedReason, getLead, logEvent, type Lead } from "../../leads";
import { sendTemplate } from "../../whatsapp/sendTemplate";
import {
  caseStudyParams,
  freeSampleParams,
  renderTemplate,
  welcomeParams,
  type TemplateName,
} from "../../whatsapp/templates";
import { getSetting } from "../../settings";
import { PermanentJobError } from "../errors";
import type { Job } from "../runner";

/** Sends a template to the lead once per job, logs it in `messages`, marks the lead contacted. */
export async function sendLeadTemplate(job: Job, lead: Lead, template: TemplateName, params: string[]) {
  const client = db();
  const { data: already } = await client.from("messages").select("id").eq("job_id", job.id).maybeSingle();
  if (already) return; // sent on an earlier attempt; only the bookkeeping after it failed

  const { id } = await sendTemplate(lead.phone_e164!, template, params);
  // ponytail: a crash between send and this insert can still resend on retry; narrow window, accepted.
  const { error } = await client.from("messages").insert({
    lead_id: lead.id,
    job_id: job.id,
    channel: "whatsapp",
    direction: "out",
    template_name: template,
    body: renderTemplate(template, params),
    provider_message_id: id,
    status: "sent",
  });
  if (error) throw new Error(`message insert failed: ${error.code}`);

  const now = new Date().toISOString();
  await client
    .from("leads")
    .update({ first_response_at: now })
    .eq("id", lead.id)
    .is("first_response_at", null);
  await client.from("leads").update({ status: "contacted" }).eq("id", lead.id).eq("status", "new");
  await logEvent(lead.id, "message.sent", `WhatsApp ${template} sent`, { job_id: job.id });
}

const payloadSchema = z.object({ template: z.literal("welcome_samples") });

/** send_whatsapp: the Day 0 welcome template (FR-10, FR-12, FR-13). */
export async function handleSendWhatsapp(job: Job): Promise<void> {
  payloadSchema.parse(job.payload);
  const lead = await getLead(job.lead_id);
  const blocked = blockedReason(lead, "whatsapp");
  if (blocked) return logEvent(lead.id, "message.skipped", `WhatsApp welcome skipped: ${blocked}`);

  const { data: reels } = await db().from("sample_reels").select("category, url, sort");
  const content = await getSetting("email_content");
  const fallback = content.showreel_url || getEnv().BOOKING_URL;
  await sendLeadTemplate(job, lead, "welcome_samples", welcomeParams(lead, reels ?? [], fallback));
}

/** Template + params for a follow-up step (used by the followup handler). */
export async function followupMessage(
  lead: Lead,
  template: string,
): Promise<{ template: TemplateName; params: string[] }> {
  if (template === "followup_case_study") {
    const content = await getSetting("email_content");
    const url = content.case_studies[0]?.url || content.showreel_url;
    if (!url)
      throw new PermanentJobError("email_content has no case study or showreel URL; fill it in Settings");
    return { template, params: caseStudyParams(lead, url) };
  }
  if (template === "followup_free_sample") return { template, params: freeSampleParams(lead) };
  throw new PermanentJobError(`unknown follow-up template ${template}`);
}
