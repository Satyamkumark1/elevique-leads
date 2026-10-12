import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";
import { enqueue } from "@/server/jobs/enqueue";
import { runJobs } from "@/server/jobs/runner";
import { logger } from "@/server/lib/logger";
import { safeEqual, verifySignature } from "@/server/meta/verifySignature";

export const maxDuration = 60;

/** FR-01: Meta subscription verification. */
export function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  if (q.get("hub.mode") === "subscribe" && safeEqual(q.get("hub.verify_token"), getEnv().META_VERIFY_TOKEN)) {
    return new Response(q.get("hub.challenge") ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
}

const payloadSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      changes: z
        .array(
          z.object({ field: z.string(), value: z.looseObject({ leadgen_id: z.coerce.string().optional() }) }),
        )
        .default([]),
    }),
  ),
});

/** Verify → persist → enqueue → 200. Lead fetch and everything after runs as jobs (FR-02, 03, 09). */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"), getEnv().META_APP_SECRET)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const { error } = await db()
    .from("events")
    .insert({ type: "webhook.meta", payload: json as never });
  if (error) {
    logger.error("webhook.meta.persist_failed", { code: error.code });
    return NextResponse.json({ ok: false, error: "persist failed" }, { status: 500 }); // Meta retries
  }

  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    logger.warn("webhook.meta.unexpected_shape");
    return NextResponse.json({ ok: true });
  }

  const leadgenIds = parsed.data.entry
    .flatMap((e) => e.changes)
    .filter((c) => c.field === "leadgen" && c.value.leadgen_id)
    .map((c) => c.value.leadgen_id!);

  await enqueue(
    leadgenIds.map((id) => ({
      type: "fetch_lead",
      idempotency_key: `fetch_lead:${id}`,
      payload: { leadgen_id: id },
    })),
  );
  logger.info("webhook.meta.accepted", { leads: leadgenIds.length });

  if (leadgenIds.length > 0)
    after(() => runJobs().catch((e) => logger.error("runner.after_failed", { error: String(e) })));
  return NextResponse.json({ ok: true });
}
