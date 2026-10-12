import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { runJobs } from "@/server/jobs/runner";
import { logEvent } from "@/server/leads";
import { logger } from "@/server/lib/logger";

/** FR-38: dead job → pending with attempts reset. */
export async function POST(_request: NextRequest, { params }: RouteContext<"/api/jobs/[id]/retry">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });

  const { data, error } = await db()
    .from("jobs")
    .update({
      status: "pending",
      attempts: 0,
      last_error: null,
      locked_at: null,
      run_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "dead")
    .select("id, lead_id, type");
  if (error) return NextResponse.json({ ok: false, error: "retry failed" }, { status: 500 });
  if (!data.length) return NextResponse.json({ ok: false, error: "job is not dead" }, { status: 409 });

  await logEvent(data[0].lead_id, "job.retried", `${data[0].type} retried from dashboard`);
  after(() => runJobs().catch((e) => logger.error("runner.after_failed", { error: String(e) })));
  return NextResponse.json({ ok: true });
}
