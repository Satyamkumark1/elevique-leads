import "server-only";
import { z } from "zod";
import { getEnv } from "../env";
import { PermanentJobError } from "../jobs/errors";

/** Sends via Resend. `idempotencyKey` makes a retried job a no-op at Resend (no double email). */
export async function sendEmail(
  msg: { to: string; subject: string; html: string; text: string },
  idempotencyKey: string,
): Promise<{ id: string }> {
  const env = getEnv();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [msg.to],
      reply_to: env.EMAIL_REPLY_TO,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (res.ok) return z.object({ id: z.string() }).parse(json);

  const message = `resend send failed: HTTP ${res.status}`;
  throw res.status >= 500 || res.status === 429 ? new Error(message) : new PermanentJobError(message);
}
