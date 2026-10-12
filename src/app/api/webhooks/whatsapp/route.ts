import { after, NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";
import { runJobs } from "@/server/jobs/runner";
import { logger } from "@/server/lib/logger";
import { safeEqual, verifySignature } from "@/server/meta/verifySignature";
import { applyStatus, handleInbound } from "@/server/whatsapp/inbound";
import { whatsappWebhookSchema } from "@/server/whatsapp/parseWebhook";

export const maxDuration = 60;

export function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  if (
    q.get("hub.mode") === "subscribe" &&
    safeEqual(q.get("hub.verify_token"), getEnv().WHATSAPP_VERIFY_TOKEN)
  ) {
    return new Response(q.get("hub.challenge") ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
}

/** Statuses → messages.status; inbound → replied / opted out; alerts and sheet updates go through jobs. */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"), getEnv().WHATSAPP_APP_SECRET)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const parsed = whatsappWebhookSchema.safeParse(json);
  if (!parsed.success) {
    logger.warn("webhook.whatsapp.unexpected_shape");
    return NextResponse.json({ ok: true });
  }

  const values = parsed.data.entry.flatMap((e) => e.changes.map((c) => c.value));
  const statuses = values.flatMap((v) => v.statuses ?? []);
  const messages = values.flatMap((v) => v.messages ?? []);
  // Counts only: the raw payload holds phone numbers and message text.
  await db()
    .from("events")
    .insert({ type: "webhook.whatsapp", payload: { statuses: statuses.length, messages: messages.length } });

  try {
    for (const s of statuses) await applyStatus(s);
    for (const m of messages) await handleInbound(m);
  } catch (err) {
    logger.error("webhook.whatsapp.failed", { error: err instanceof Error ? err.message : "unknown" });
    return NextResponse.json({ ok: false, error: "processing failed" }, { status: 500 }); // Meta retries
  }

  if (messages.length > 0)
    after(() => runJobs().catch((e) => logger.error("runner.after_failed", { error: String(e) })));
  return NextResponse.json({ ok: true });
}
