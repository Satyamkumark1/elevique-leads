import "server-only";
import type { Database } from "@/lib/database.types";
import { db } from "../db";
import { enqueue } from "../jobs/enqueue";
import { logEvent } from "../leads";
import { logger } from "../lib/logger";
import { isOptOut } from "./optOut";
import { messageText, type InboundMessage, type StatusUpdate } from "./parseWebhook";

type MsgStatus = Database["public"]["Enums"]["msg_status"];
const ORDER: MsgStatus[] = ["queued", "sent", "delivered", "read"];

/** FR-14: statuses only move forward (a late `delivered` never overwrites `read`). */
export async function applyStatus(s: StatusUpdate): Promise<void> {
  const client = db();
  if (s.status === "failed") {
    await client
      .from("messages")
      .update({ status: "failed", error: s.errors?.[0]?.title ?? `code ${s.errors?.[0]?.code ?? "unknown"}` })
      .eq("provider_message_id", s.id)
      .in("status", ["queued", "sent"]);
    return;
  }
  const rank = ORDER.indexOf(s.status as MsgStatus);
  if (rank < 0) return;
  await client
    .from("messages")
    .update({ status: s.status as MsgStatus })
    .eq("provider_message_id", s.id)
    .in("status", ORDER.slice(0, rank));
}

/** FR-24, FR-25: inbound message from a lead → replied (or opted out), follow-ups stop, owner alerted. */
export async function handleInbound(m: InboundMessage, now = new Date()): Promise<void> {
  const client = db();
  const phone = `+${m.from.replace(/\D/g, "")}`;
  const { data: leads } = await client
    .from("leads")
    .select("id, status")
    .eq("phone_e164", phone)
    .order("created_at", { ascending: false });
  if (!leads?.length) {
    await logEvent(null, "whatsapp.unknown_sender", "WhatsApp message from a number with no lead", {
      wa_message_id: m.id,
    });
    return;
  }
  const lead = leads[0];
  const ids = leads.map((l) => l.id); // every lead for this phone (originals and duplicates)
  const text = messageText(m);

  const { data: inserted, error } = await client
    .from("messages")
    .upsert(
      {
        lead_id: lead.id,
        channel: "whatsapp",
        direction: "in",
        body: text ?? `[${m.type}]`,
        provider_message_id: m.id,
        status: "received",
      },
      { onConflict: "provider_message_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(`inbound insert failed: ${error.code}`);
  if (!inserted.length) return; // WhatsApp redelivered the same message

  const nowIso = now.toISOString();
  if (isOptOut(text)) {
    await client.from("leads").update({ status: "opted_out", last_reply_at: nowIso }).in("id", ids);
    await client
      .from("jobs")
      .update({ status: "cancelled", last_error: "lead opted out" })
      .in("lead_id", ids)
      .eq("status", "pending")
      .neq("type", "sync_sheet");
    await logEvent(lead.id, "lead.opted_out", "Lead opted out on WhatsApp; all automation stopped");
    logger.info("lead.opted_out", { lead_id: lead.id });
  } else {
    await client.from("leads").update({ last_reply_at: nowIso }).in("id", ids);
    await client.from("leads").update({ status: "replied" }).in("id", ids).in("status", ["new", "contacted"]);
    await client
      .from("jobs")
      .update({ status: "cancelled", last_error: "lead replied" })
      .in("lead_id", ids)
      .eq("status", "pending")
      .eq("type", "followup");
    await logEvent(lead.id, "message.received", "Lead replied on WhatsApp; follow-ups stopped");
    const istDay = new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
    await enqueue([
      {
        type: "owner_alert",
        idempotency_key: `owner_alert:reply:${lead.id}:${istDay}`, // at most one reply alert per lead per day
        lead_id: lead.id,
        payload: { reason: "reply" },
      },
    ]);
  }
  await enqueue([
    {
      type: "sync_sheet",
      idempotency_key: `sync_sheet:inbound:${m.id}`,
      lead_id: lead.id,
      payload: { op: "update" },
    },
  ]);
}
