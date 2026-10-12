import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/server/env";
import { runJobs } from "@/server/jobs/runner";
import { logger, reportError } from "@/server/lib/logger";
import { safeEqual } from "@/server/meta/verifySignature";

export const maxDuration = 60;

/** Called by pg_cron every 5 min (and kicked by webhooks via after()). */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!safeEqual(auth, `Bearer ${getEnv().CRON_SECRET}`)) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  try {
    const result = await runJobs({ budgetMs: 50_000 });
    logger.info("runner.done", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    reportError(err, {});
    logger.error("runner.failed", { error: err instanceof Error ? err.message : "unknown" });
    return NextResponse.json({ ok: false, error: "runner failed" }, { status: 500 });
  }
}
