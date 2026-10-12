import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { logEvent } from "@/server/leads";
import { requireTeam } from "@/server/session";

/** FR-32: cancel a pending job (e.g. a scheduled follow-up). */
export async function POST(_request: NextRequest, { params }: RouteContext<"/api/jobs/[id]/cancel">) {
  const auth = await requireTeam();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });

  const { data, error } = await db()
    .from("jobs")
    .update({ status: "cancelled", last_error: "cancelled by team" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id, lead_id, type");
  if (error) return NextResponse.json({ ok: false, error: "cancel failed" }, { status: 500 });
  if (!data.length) return NextResponse.json({ ok: false, error: "job is not pending" }, { status: 409 });

  await logEvent(data[0].lead_id, "job.cancelled", `${data[0].type} cancelled by ${auth.email}`);
  return NextResponse.json({ ok: true });
}
