import "server-only";
import { db } from "../../db";
import { getEnv } from "../../env";
import { sendEmail } from "../../email/sendEmail";
import { welcomeEmail } from "../../email/welcome";
import { blockedReason, getLead, logEvent } from "../../leads";
import { getSetting } from "../../settings";
import { PermanentJobError } from "../errors";
import type { Job } from "../runner";

/** send_email: branded welcome email from send.elevique.in (FR-11, FR-12, FR-13). */
export async function handleSendEmail(job: Job): Promise<void> {
  const lead = await getLead(job.lead_id);
  const blocked = blockedReason(lead, "email");
  if (blocked) return logEvent(lead.id, "message.skipped", `Welcome email skipped: ${blocked}`);

  const content = await getSetting("email_content");
  if (!content.showreel_url || !content.starting_price_line || content.case_studies.length === 0) {
    throw new PermanentJobError("email_content not filled in (showreel, price line, case studies)");
  }

  const { subject, html, text } = welcomeEmail(lead, content, getEnv().BOOKING_URL);
  const { id } = await sendEmail({ to: lead.email!, subject, html, text }, job.idempotency_key);

  const { error } = await db().from("messages").upsert(
    {
      lead_id: lead.id,
      job_id: job.id,
      channel: "email",
      direction: "out",
      template_name: "welcome",
      body: subject,
      provider_message_id: id,
      status: "sent",
    },
    { onConflict: "provider_message_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`message insert failed: ${error.code}`);
  await logEvent(lead.id, "message.sent", "Welcome email sent", { job_id: job.id });
}
