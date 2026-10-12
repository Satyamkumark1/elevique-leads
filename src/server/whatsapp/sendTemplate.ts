import "server-only";
import { z } from "zod";
import { getEnv } from "../env";
import { PermanentJobError } from "../jobs/errors";
import type { TemplateName } from "./templates";

// WhatsApp Cloud API error codes worth retrying (rate limits, temporary service errors).
const RETRYABLE_CODES = new Set([1, 2, 4, 80007, 130429, 131000, 131016, 131048, 131056, 133004]);

const responseSchema = z.object({ messages: z.array(z.object({ id: z.string() })).min(1) });
const errorSchema = z.object({
  error: z.object({ code: z.number().optional(), message: z.string().optional() }),
});

/** Sends an approved template. 4xx that will never succeed → PermanentJobError (job goes dead). */
export async function sendTemplate(
  toE164: string,
  name: TemplateName,
  params: string[],
): Promise<{ id: string }> {
  const env = getEnv();
  const res = await fetch(
    `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toE164.replace(/^\+/, ""),
        type: "template",
        template: {
          name,
          language: { code: env.WHATSAPP_TEMPLATE_LANG },
          components: params.length
            ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }]
            : [],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  const json: unknown = await res.json().catch(() => ({}));
  if (res.ok) return { id: responseSchema.parse(json).messages[0].id };

  const err = errorSchema.safeParse(json);
  const code = err.success ? err.data.error.code : undefined;
  const message = `whatsapp send failed: HTTP ${res.status}${code ? ` code ${code}` : ""}${
    err.success && err.data.error.message ? ` ${err.data.error.message}` : ""
  }`;
  const retryable =
    res.status >= 500 || res.status === 429 || (code !== undefined && RETRYABLE_CODES.has(code));
  throw retryable ? new Error(message) : new PermanentJobError(message);
}
