import { HttpResponse } from "msw";
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/jobs/run/route";
import { db } from "@/server/db";
import { runJobs } from "@/server/jobs/runner";
import {
  cleanupTestLeads,
  createJob,
  createLead,
  getJob,
  providers,
  mockProviders,
} from "../support/providers";

mockProviders();
beforeEach(() => {
  process.env.AUTOMATION_ENABLED = "true";
});
afterAll(cleanupTestLeads);

const runRoute = (auth?: string) =>
  POST(
    new NextRequest("http://localhost/api/jobs/run", {
      method: "POST",
      headers: auth ? { authorization: auth } : {},
    }),
  );

describe("/api/jobs/run", () => {
  it("TC-I-09: no auth header → 401", async () => {
    expect((await runRoute()).status).toBe(401);
    expect((await runRoute("Bearer wrong")).status).toBe(401);
  });

  it("runs jobs with the cron secret", async () => {
    const res = await runRoute(`Bearer ${process.env.CRON_SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });
});

describe("send_whatsapp", () => {
  it("TC-I-10: sends welcome with correct params, logs message, marks lead contacted", async () => {
    const lead = await createLead();
    const job = await createJob("send_whatsapp", lead.id, { payload: { template: "welcome_samples" } });
    await runJobs();

    expect(providers.whatsapp).toEqual([
      {
        to: lead.phone_e164!.slice(1),
        template: "welcome_samples",
        params: ["Asha", "Kesar Threads", "fashion", "https://elevique.in/samples/fashion"],
      },
    ]);
    expect((await getJob(job.id)).status).toBe("done");
    const { data: msgs } = await db().from("messages").select("*").eq("lead_id", lead.id);
    expect(msgs).toHaveLength(1);
    expect(msgs![0]).toMatchObject({ channel: "whatsapp", direction: "out", status: "sent", job_id: job.id });
    expect(msgs![0].provider_message_id).toMatch(/^wamid\./);
    const { data: after } = await db()
      .from("leads")
      .select("status, first_response_at")
      .eq("id", lead.id)
      .single();
    expect(after!.status).toBe("contacted");
    expect(after!.first_response_at).not.toBeNull();
  });

  it("TC-I-13: WhatsApp 500 → pending, run_at +1 min, attempts 1", async () => {
    providers.whatsappFail = () => HttpResponse.json({ error: { message: "oops" } }, { status: 500 });
    const lead = await createLead();
    const job = await createJob("send_whatsapp", lead.id, { payload: { template: "welcome_samples" } });
    await runJobs();
    const after = await getJob(job.id);
    expect(after).toMatchObject({ status: "pending", attempts: 1 });
    const delay = new Date(after.run_at).getTime() - Date.now();
    expect(delay).toBeGreaterThan(50_000);
    expect(delay).toBeLessThan(70_000);
  });

  it("TC-I-14: third failure → dead, last_error set, event logged", async () => {
    providers.whatsappFail = () => HttpResponse.json({ error: { message: "oops" } }, { status: 503 });
    const lead = await createLead();
    const job = await createJob("send_whatsapp", lead.id, {
      payload: { template: "welcome_samples" },
      attempts: 2,
    });
    await runJobs();
    const after = await getJob(job.id);
    expect(after.status).toBe("dead");
    expect(after.last_error).toContain("HTTP 503");
    const { data: events } = await db().from("events").select("type").eq("lead_id", lead.id);
    expect(events!.map((e) => e.type)).toContain("job.dead");
  });

  it("TC-I-15: 400 invalid recipient → dead immediately", async () => {
    providers.whatsappFail = () =>
      HttpResponse.json({ error: { code: 131026, message: "Message undeliverable" } }, { status: 400 });
    const lead = await createLead();
    const job = await createJob("send_whatsapp", lead.id, { payload: { template: "welcome_samples" } });
    await runJobs();
    expect(await getJob(job.id)).toMatchObject({ status: "dead", attempts: 1 });
  });

  it("TC-I-16: two runners at once process each job exactly once", async () => {
    const jobs = [];
    for (let i = 0; i < 6; i++) {
      const lead = await createLead();
      jobs.push(await createJob("send_whatsapp", lead.id, { payload: { template: "welcome_samples" } }));
    }
    await Promise.all([runJobs({ batch: 2 }), runJobs({ batch: 2 })]);
    expect(providers.whatsapp).toHaveLength(6);
    expect(new Set(providers.whatsapp.map((m) => m.to)).size).toBe(6);
  });

  it("TC-I-17: a job stuck in running for > 5 min is re-claimed", async () => {
    const lead = await createLead();
    const job = await createJob("send_whatsapp", lead.id, {
      payload: { template: "welcome_samples" },
      status: "running",
      attempts: 1,
      locked_at: new Date(Date.now() - 10 * 60_000).toISOString(),
    });
    await runJobs();
    expect(await getJob(job.id)).toMatchObject({ status: "done", attempts: 2 });
  });

  it("does not resend when the message was already sent by an earlier attempt", async () => {
    const lead = await createLead();
    const job = await createJob("send_whatsapp", lead.id, { payload: { template: "welcome_samples" } });
    await db()
      .from("messages")
      .insert({
        lead_id: lead.id,
        job_id: job.id,
        channel: "whatsapp",
        direction: "out",
        provider_message_id: `wamid.prior_${job.id}`,
        status: "sent",
      });
    await runJobs();
    expect(providers.whatsapp).toHaveLength(0);
    expect((await getJob(job.id)).status).toBe("done");
  });

  it("TC-I-18: invalid phone → WhatsApp skipped (done), email still sent", async () => {
    const lead = await createLead({ phone_e164: null, phone_valid: false });
    const wa = await createJob("send_whatsapp", lead.id, { payload: { template: "welcome_samples" } });
    const email = await createJob("send_email", lead.id);
    await runJobs();
    expect(providers.whatsapp).toHaveLength(0);
    expect((await getJob(wa.id)).status).toBe("done");
    expect((await getJob(email.id)).status).toBe("done");
    expect(providers.emails).toHaveLength(1);
    const { data: events } = await db().from("events").select("type, description").eq("lead_id", lead.id);
    expect(events!.find((e) => e.type === "message.skipped")?.description).toContain(
      "invalid or missing phone",
    );
  });

  it("opted-out or paused lead gets nothing", async () => {
    const opted = await createLead({ status: "opted_out" });
    const paused = await createLead({ automation_paused: true });
    for (const l of [opted, paused]) {
      await createJob("send_whatsapp", l.id, { payload: { template: "welcome_samples" } });
      await createJob("send_email", l.id);
    }
    await runJobs();
    expect(providers.whatsapp).toHaveLength(0);
    expect(providers.emails).toHaveLength(0);
  });
});

describe("send_email", () => {
  it("TC-I-11: Resend called with from/reply-to and an idempotency key; message row", async () => {
    const lead = await createLead();
    const job = await createJob("send_email", lead.id);
    await runJobs();
    expect(providers.emails).toHaveLength(1);
    const { body, idempotencyKey } = providers.emails[0];
    expect(body).toMatchObject({
      from: process.env.EMAIL_FROM,
      reply_to: process.env.EMAIL_REPLY_TO,
      to: [lead.email],
      subject: "AI video ads for Kesar Threads",
    });
    expect(String(body.html)).toContain(process.env.BOOKING_URL);
    expect(idempotencyKey).toBe(job.idempotency_key);
    const { data: msgs } = await db().from("messages").select("*").eq("lead_id", lead.id);
    expect(msgs![0]).toMatchObject({ channel: "email", status: "sent", template_name: "welcome" });
  });

  it("escapes lead-supplied text in the HTML", async () => {
    const lead = await createLead({ brand_name: '<script>alert("x")</script>' });
    await createJob("send_email", lead.id);
    await runJobs();
    expect(String(providers.emails[0].body.html)).not.toContain("<script>");
  });
});

describe("sync_sheet", () => {
  it("TC-I-12: appends the row in column order and saves sheet_row; later sync updates the same row", async () => {
    const lead = await createLead({ campaign_name: "Diwali", ad_name: "Reel 1" });
    await createJob("sync_sheet", lead.id, { payload: { op: "append" } });
    await runJobs();

    expect(providers.sheet).toHaveLength(2);
    const row = providers.sheet[1];
    expect(row[0]).toBe(lead.id);
    expect(row.slice(2)).toEqual([
      "Asha Verma",
      lead.phone_e164,
      lead.email,
      "Kesar Threads",
      "Fashion",
      "₹50k–1L",
      "This month",
      "warm",
      "new",
      "Diwali",
      "Reel 1",
    ]);
    expect(row[1]).toMatch(/IST$/);
    expect((await db().from("leads").select("sheet_row").eq("id", lead.id).single()).data!.sheet_row).toBe(2);

    await db().from("leads").update({ status: "won" }).eq("id", lead.id);
    await createJob("sync_sheet", lead.id, { payload: { op: "update" } });
    await runJobs();
    expect(providers.sheet).toHaveLength(2);
    expect(providers.sheet[1][10]).toBe("won");
  });
});

describe("owner_alert", () => {
  it("TC-I-19: hot lead → internal_hot_lead sent to OWNER_ALERT_PHONE", async () => {
    const lead = await createLead({ score: "hot" });
    await createJob("owner_alert", lead.id, { payload: { reason: "hot" } });
    await runJobs();
    expect(providers.whatsapp).toEqual([
      {
        to: process.env.OWNER_ALERT_PHONE!.slice(1),
        template: "internal_hot_lead",
        params: [
          "Asha Verma",
          "Kesar Threads",
          "₹50k–1L",
          "This month",
          `${process.env.APP_URL}/leads/${lead.id}`,
        ],
      },
    ]);
  });
});

describe("scheduling and kill switch", () => {
  it("TC-I-20: a job with future run_at is not claimed", async () => {
    const lead = await createLead();
    const job = await createJob("send_whatsapp", lead.id, {
      payload: { template: "welcome_samples" },
      run_at: new Date(Date.now() + 3600_000).toISOString(),
    });
    await runJobs();
    expect(await getJob(job.id)).toMatchObject({ status: "pending", attempts: 0 });
  });

  it("AUTOMATION_ENABLED=false → outbound jobs stay pending, sheet sync still runs", async () => {
    process.env.AUTOMATION_ENABLED = "false";
    const lead = await createLead();
    const wa = await createJob("send_whatsapp", lead.id, { payload: { template: "welcome_samples" } });
    const sheet = await createJob("sync_sheet", lead.id);
    await runJobs();
    expect(providers.whatsapp).toHaveLength(0);
    expect(await getJob(wa.id)).toMatchObject({ status: "pending", attempts: 0 });
    expect((await getJob(sheet.id)).status).toBe("done");
    await db().from("jobs").delete().eq("id", wa.id);
  });
});
