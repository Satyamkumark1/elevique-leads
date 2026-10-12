import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/webhooks/whatsapp/route";
import { db } from "@/server/db";
import { runJobs } from "@/server/jobs/runner";
import {
  cleanupTestLeads,
  createJob,
  createLead,
  getJob,
  mockProviders,
  providers,
} from "../support/providers";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));

mockProviders();
beforeEach(() => {
  process.env.AUTOMATION_ENABLED = "true";
});
afterEach(() => vi.useRealTimers());
afterAll(cleanupTestLeads);

let seq = 0;
const wamid = () => `wamid.in_${Date.now()}_${++seq}`;

function post(value: object, secret = process.env.WHATSAPP_APP_SECRET!) {
  const body = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      { id: "WABA", changes: [{ field: "messages", value: { messaging_product: "whatsapp", ...value } }] },
    ],
  });
  return POST(
    new NextRequest("http://localhost/api/webhooks/whatsapp", {
      method: "POST",
      body,
      headers: { "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}` },
    }),
  );
}
const inbound = (fromE164: string, text: string, id = wamid()) =>
  post({
    messages: [{ id, from: fromE164.slice(1), timestamp: "1791800000", type: "text", text: { body: text } }],
  });

async function outboundMessage(leadId: string) {
  const id = wamid();
  await db().from("messages").insert({
    lead_id: leadId,
    channel: "whatsapp",
    direction: "out",
    provider_message_id: id,
    status: "sent",
  });
  return id;
}
const messageStatus = async (id: string) =>
  (await db().from("messages").select("status").eq("provider_message_id", id).single()).data!.status;
const lead = async (id: string) => (await db().from("leads").select("*").eq("id", id).single()).data!;

describe("GET /api/webhooks/whatsapp", () => {
  it("verifies with WHATSAPP_VERIFY_TOKEN", async () => {
    const url = (t: string) =>
      `http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${t}&hub.challenge=9`;
    expect(await (await GET(new NextRequest(url(process.env.WHATSAPP_VERIFY_TOKEN!)))).text()).toBe("9");
    expect((await GET(new NextRequest(url("nope")))).status).toBe(403);
  });
});

describe("POST /api/webhooks/whatsapp", () => {
  it("TC-I-21: invalid signature → 401", async () => {
    expect((await post({ statuses: [] }, "wrong-secret")).status).toBe(401);
  });

  it("TC-I-22: delivered then read → status updated in order", async () => {
    const l = await createLead();
    const id = await outboundMessage(l.id);
    await post({ statuses: [{ id, status: "delivered", timestamp: "1", recipient_id: "x" }] });
    expect(await messageStatus(id)).toBe("delivered");
    await post({ statuses: [{ id, status: "read", timestamp: "2", recipient_id: "x" }] });
    expect(await messageStatus(id)).toBe("read");
  });

  it("TC-I-23: read before delivered → stays read", async () => {
    const l = await createLead();
    const id = await outboundMessage(l.id);
    await post({ statuses: [{ id, status: "read", timestamp: "2", recipient_id: "x" }] });
    await post({ statuses: [{ id, status: "delivered", timestamp: "1", recipient_id: "x" }] });
    expect(await messageStatus(id)).toBe("read");
  });

  it("failed status records the error", async () => {
    const l = await createLead();
    const id = await outboundMessage(l.id);
    await post({
      statuses: [{ id, status: "failed", errors: [{ code: 131026, title: "Message undeliverable" }] }],
    });
    const { data } = await db()
      .from("messages")
      .select("status, error")
      .eq("provider_message_id", id)
      .single();
    expect(data).toEqual({ status: "failed", error: "Message undeliverable" });
  });

  it("TC-I-24: inbound text → message row, lead replied, follow-ups cancelled, owner alerted", async () => {
    const l = await createLead({ status: "contacted" });
    const day2 = await createJob("followup", l.id, {
      payload: { step: "day2", template: "followup_case_study" },
      run_at: new Date(Date.now() + 86400_000).toISOString(),
    });
    const res = await inbound(l.phone_e164!, "Hi, yes interested. Call me?");
    expect(res.status).toBe(200);

    const { data: msgs } = await db().from("messages").select("*").eq("lead_id", l.id).eq("direction", "in");
    expect(msgs).toHaveLength(1);
    expect(msgs![0]).toMatchObject({ status: "received", body: "Hi, yes interested. Call me?" });
    expect(await lead(l.id)).toMatchObject({ status: "replied" });
    expect((await lead(l.id)).last_reply_at).not.toBeNull();
    expect((await getJob(day2.id)).status).toBe("cancelled");

    await runJobs();
    expect(providers.whatsapp).toEqual([
      expect.objectContaining({
        to: process.env.OWNER_ALERT_PHONE!.slice(1),
        template: "internal_lead_replied",
      }),
    ]);
  });

  it("redelivered inbound message is processed once", async () => {
    const l = await createLead({ status: "contacted" });
    const id = wamid();
    await inbound(l.phone_e164!, "hello", id);
    await inbound(l.phone_e164!, "hello", id);
    const { data } = await db().from("messages").select("id").eq("provider_message_id", id);
    expect(data).toHaveLength(1);
  });

  it("TC-I-25: STOP → opted_out and every pending job cancelled", async () => {
    const l = await createLead({ status: "contacted" });
    const jobs = [
      await createJob("followup", l.id, {
        payload: { step: "day2", template: "followup_case_study" },
        run_at: new Date(Date.now() + 86400_000).toISOString(),
      }),
      await createJob("send_email", l.id, { run_at: new Date(Date.now() + 3600_000).toISOString() }),
    ];
    await inbound(l.phone_e164!, "STOP");
    expect((await lead(l.id)).status).toBe("opted_out");
    for (const j of jobs) expect((await getJob(j.id)).status).toBe("cancelled");

    await runJobs();
    expect(providers.whatsapp.filter((m) => m.to === l.phone_e164!.slice(1))).toHaveLength(0);
    const { data: alerts } = await db()
      .from("jobs")
      .select("id")
      .eq("lead_id", l.id)
      .eq("type", "owner_alert");
    expect(alerts).toHaveLength(0); // opt-out is not a reply to take over
  });

  it("TC-I-26: unknown sender → event logged, no lead change", async () => {
    const before = await db()
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("type", "whatsapp.unknown_sender");
    const res = await inbound("+916000000001", "who is this");
    expect(res.status).toBe(200);
    const after = await db()
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("type", "whatsapp.unknown_sender");
    expect(after.count).toBe(before.count! + 1);
  });
});

describe("followup jobs", () => {
  // Pin the clock to 10:00 IST so quiet hours never interfere (only Date is faked).
  const at10IST = () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-14T10:00:00+05:30"));
  };
  const followup = (leadId: string, fields: Record<string, unknown> = {}) =>
    createJob("followup", leadId, { payload: { step: "day2", template: "followup_case_study" }, ...fields });

  it("TC-I-27: Day 2 due, no reply → sent", async () => {
    at10IST();
    const l = await createLead({ status: "contacted" });
    const job = await followup(l.id);
    await runJobs();
    expect((await getJob(job.id)).status).toBe("done");
    expect(providers.whatsapp).toEqual([
      {
        to: l.phone_e164!.slice(1),
        template: "followup_case_study",
        params: ["Asha", "Kesar Threads", "https://elevique.in/work/1"],
      },
    ]);
  });

  it.each([
    ["TC-I-28: lead replied", { status: "replied", last_reply_at: new Date().toISOString() }],
    ["TC-I-29: lead paused", { status: "contacted", automation_paused: true }],
    ["TC-I-30: status meeting_booked", { status: "meeting_booked" }],
    ["opted out", { status: "opted_out" }],
  ])("%s → cancelled, not sent", async (_name, fields) => {
    at10IST();
    const l = await createLead(fields);
    const job = await followup(l.id);
    await runJobs();
    expect((await getJob(job.id)).status).toBe("cancelled");
    expect(providers.whatsapp).toHaveLength(0);
  });

  it("FR-27: due at 22:00 IST → rescheduled to 09:00 IST, not sent, attempt not counted", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-14T22:00:00+05:30"));
    const l = await createLead({ status: "contacted" });
    const job = await followup(l.id); // run_at = DB now(): due
    await runJobs();
    const after = await getJob(job.id);
    expect(after).toMatchObject({ status: "pending", attempts: 0 });
    expect(new Date(after.run_at)).toEqual(new Date("2026-10-15T09:00:00+05:30"));
    expect(providers.whatsapp).toHaveLength(0);
  });
});
