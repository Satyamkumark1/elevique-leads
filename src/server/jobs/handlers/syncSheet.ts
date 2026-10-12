import "server-only";
import { db } from "../../db";
import { getLead } from "../../leads";
import { upsertLeadRow } from "../../sheets/client";
import type { Job } from "../runner";

/** sync_sheet: append or update the lead's row from current DB state (FR-16, FR-17). */
export async function handleSyncSheet(job: Job): Promise<void> {
  const lead = await getLead(job.lead_id);
  const row = await upsertLeadRow(lead);
  if (row !== lead.sheet_row) await db().from("leads").update({ sheet_row: row }).eq("id", lead.id);
}
