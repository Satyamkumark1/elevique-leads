import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { STATUSES, STATUS_LABEL } from "@/lib/labels";
import { db } from "@/server/db";
import { enqueue } from "@/server/jobs/enqueue";
import { logEvent } from "@/server/leads";
import { logger } from "@/server/lib/logger";

const patchSchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    notes: z.string().max(10_000).optional(),
    automation_paused: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "nothing to update");

/** FR-26, FR-31: team edits status / notes / automation pause; Sheet row follows (FR-17). */
export async function PATCH(request: NextRequest, { params }: RouteContext<"/api/leads/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });

  const body = patchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });

  const client = db();
  const { data: before } = await client
    .from("leads")
    .select("status, automation_paused")
    .eq("id", id)
    .maybeSingle();
  if (!before) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const { error } = await client.from("leads").update(body.data).eq("id", id);
  if (error) {
    logger.error("lead.patch_failed", { lead_id: id, code: error.code });
    return NextResponse.json({ ok: false, error: "update failed" }, { status: 500 });
  }

  const { status, notes, automation_paused } = body.data;
  if (status && status !== before.status) {
    await logEvent(
      id,
      "status.changed",
      `Status ${STATUS_LABEL[before.status]} → ${STATUS_LABEL[status]} from dashboard`,
    );
  }
  if (notes !== undefined) await logEvent(id, "note.updated", "Notes edited from dashboard");
  if (automation_paused !== undefined && automation_paused !== before.automation_paused) {
    if (automation_paused) {
      await client
        .from("jobs")
        .update({ status: "cancelled", last_error: "automation paused" })
        .eq("lead_id", id)
        .eq("status", "pending")
        .eq("type", "followup");
    } else {
      // Resume: bring back follow-ups that were cancelled only because of the pause (handler re-checks rules).
      await client
        .from("jobs")
        .update({ status: "pending", last_error: null })
        .eq("lead_id", id)
        .eq("status", "cancelled")
        .eq("type", "followup")
        .eq("last_error", "automation paused");
    }
    await logEvent(
      id,
      "automation.toggled",
      `Automation ${automation_paused ? "paused" : "resumed"} from dashboard`,
    );
  }
  if (status !== undefined) {
    await enqueue([
      {
        type: "sync_sheet",
        idempotency_key: `sync_sheet:patch:${id}:${Date.now()}`,
        lead_id: id,
        payload: { op: "update" },
      },
    ]);
  }
  return NextResponse.json({ ok: true });
}

/** DPDP deletion request: removes the lead, its messages and jobs (cascade). Sheet row clearing is v1.1. */
export async function DELETE(_request: NextRequest, { params }: RouteContext<"/api/leads/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });

  const { data, error } = await db().from("leads").delete().eq("id", id).select("id");
  if (error) return NextResponse.json({ ok: false, error: "delete failed" }, { status: 500 });
  if (!data.length) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  await logEvent(null, "lead.deleted", `Lead ${id} deleted from dashboard`);
  return NextResponse.json({ ok: true });
}
