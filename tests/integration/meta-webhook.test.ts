import { createHmac } from "node:crypto";
import { HttpResponse } from "msw";
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/webhooks/meta/route";
import { db } from "@/server/db";
import { runJobs } from "@/server/jobs/runner";
import graphLeadFixture from "../fixtures/meta/graph-lead.json";
import webhookFixture from "../fixtures/meta/leadgen-webhook.json";
import { providers, mockProviders } from "../support/providers";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(), // tests call runJobs() explicitly
}));

const RUN = `it_${Date.now()}`;
let seq = 0;
const newLeadgenId = () => `${RUN}_${++seq}`;
const randomPhone = () => `7${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;

const graph = providers.graphLeads;
mockProviders();

function graphLead(id: string, fields: Record<string, string> = {}) {
  const field_data = graphLeadFixture.field_data.map((f) =>
    f.name in fields ? { name: f.name, values: [fields[f.name]] } : f,
  );
  return { ...graphLeadFixture, id, field_data };
}

function webhookBody(leadgenId: string) {
  const body = structuredClone(webhookFixture);
  body.entry[0].changes[0].value.leadgen_id = leadgenId;
  return JSON.stringify(body);
}

function post(body: string, signature?: string) {
  const sig =
    signature ?? `sha256=${createHmac("sha256", process.env.META_APP_SECRET!).update(body).digest("hex")}`;
  return POST(
    new NextRequest("http://localhost/api/webhooks/meta", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "x-hub-signature-256": sig },
    }),
  );
}

async function leadsFor(leadgenId: string) {
  const { data } = await db().from("leads").select("*").eq("leadgen_id", leadgenId);
  return data!;
}
async function jobsFor(leadId: string) {
  const { data } = await db().from("jobs").select("*").eq("lead_id", leadId);
  return data!;
}
async function fetchJob(leadgenId: string) {
  const { data } = await db().from("jobs").select("*").eq("idempotency_key", `fetch_lead:${leadgenId}`);
  return data!;
}
async function countWebhookEvents() {
  const { count } = await db()
    .from("events")
    .select("*", { count: "exact", head: true })
    .eq("type", "webhook.meta");
  return count!;
}

beforeEach(() => {
  process.env.AUTOMATION_ENABLED = "true";
});
afterAll(async () => {
  await db().from("leads").delete().like("leadgen_id", `${RUN}%`);
  await db().from("jobs").delete().like("idempotency_key", `fetch_lead:${RUN}%`);
});

describe("GET /api/webhooks/meta", () => {
  const get = (token: string) =>
    GET(
      new NextRequest(
        `http://localhost/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=12345`,
      ),
    );

  it("TC-I-01: correct verify token → 200 + challenge", async () => {
    const res = await get(process.env.META_VERIFY_TOKEN!);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("12345");
  });

  it("TC-I-02: wrong verify token → 403", async () => {
    expect((await get("wrong")).status).toBe(403);
  });
});

describe("POST /api/webhooks/meta", () => {
  it("TC-I-03: invalid signature → 401, nothing written", async () => {
    const id = newLeadgenId();
    const before = await countWebhookEvents();
    const res = await post(webhookBody(id), "sha256=" + "0".repeat(64));
    expect(res.status).toBe(401);
    expect(await countWebhookEvents()).toBe(before);
    expect(await fetchJob(id)).toHaveLength(0);
  });

  it("TC-I-04: valid leadgen → 1 event, 1 lead, 6 jobs (warm)", async () => {
    const id = newLeadgenId();
    graph.set(id, () =>
      HttpResponse.json(graphLead(id, { phone_number: randomPhone(), start_timeline: "Just exploring" })),
    );
    const before = await countWebhookEvents();

    const res = await post(webhookBody(id));
    expect(res.status).toBe(200);
    expect(await countWebhookEvents()).toBe(before + 1);

    await runJobs();
    const [lead] = await leadsFor(id);
    expect(lead).toMatchObject({
      score: "warm",
      score_source: "rules",
      brand_name: "Kesar Threads",
      phone_valid: true,
    });
    expect((await fetchJob(id))[0].status).toBe("done");

    const jobs = await jobsFor(lead.id);
    expect(jobs.map((j) => j.idempotency_key).sort()).toEqual(
      [
        `followup:day2:${lead.id}`,
        `followup:day4:${lead.id}`,
        `score_lead:${lead.id}`,
        `send_email:welcome:${lead.id}`,
        `send_whatsapp:welcome:${lead.id}`,
        `sync_sheet:append:${lead.id}`,
      ].sort(),
    );
    const day2 = jobs.find((j) => j.type === "followup" && j.idempotency_key.includes("day2"))!;
    expect(new Date(day2.run_at).getTime() - Date.now()).toBeGreaterThan(47 * 3600 * 1000);
  });

  it("TC-I-04: hot lead → 7 jobs including owner_alert", async () => {
    const id = newLeadgenId();
    graph.set(id, () => HttpResponse.json(graphLead(id, { phone_number: randomPhone() })));
    await post(webhookBody(id));
    await runJobs();
    const [lead] = await leadsFor(id);
    expect(lead.score).toBe("hot");
    const jobs = await jobsFor(lead.id);
    expect(jobs).toHaveLength(7);
    expect(jobs.some((j) => j.idempotency_key === `owner_alert:hot:${lead.id}`)).toBe(true);
  });

  it("TC-I-05: same payload twice → still 1 lead and 6 jobs", async () => {
    const id = newLeadgenId();
    graph.set(id, () =>
      HttpResponse.json(graphLead(id, { phone_number: randomPhone(), start_timeline: "Just exploring" })),
    );
    await post(webhookBody(id));
    await runJobs();
    await post(webhookBody(id));
    await runJobs();

    const leads = await leadsFor(id);
    expect(leads).toHaveLength(1);
    expect(await jobsFor(leads[0].id)).toHaveLength(6);
    expect(await fetchJob(id)).toHaveLength(1);
  });

  it("TC-I-06: Graph 500 → webhook 200, event stored, fetch retried later (no data lost)", async () => {
    const id = newLeadgenId();
    graph.set(id, () => HttpResponse.json({ error: { message: "boom" } }, { status: 500 }));
    const before = await countWebhookEvents();

    expect((await post(webhookBody(id))).status).toBe(200);
    expect(await countWebhookEvents()).toBe(before + 1);
    await runJobs();

    let [job] = await fetchJob(id);
    expect(job).toMatchObject({ status: "pending", attempts: 1 });
    expect(new Date(job.run_at).getTime()).toBeGreaterThan(Date.now() + 30_000);
    expect(await leadsFor(id)).toHaveLength(0);

    // Graph recovers; retry becomes due.
    graph.set(id, () => HttpResponse.json(graphLead(id, { phone_number: randomPhone() })));
    await db().from("jobs").update({ run_at: new Date().toISOString() }).eq("id", job.id);
    await runJobs();
    [job] = await fetchJob(id);
    expect(job).toMatchObject({ status: "done", attempts: 2 });
    expect(await leadsFor(id)).toHaveLength(1);
  });

  it("Graph 4xx (e.g. expired token) → fetch job dead at once with last_error", async () => {
    const id = newLeadgenId();
    graph.set(id, () => HttpResponse.json({ error: { code: 190 } }, { status: 400 }));
    await post(webhookBody(id));
    await runJobs();
    const [job] = await fetchJob(id);
    expect(job.status).toBe("dead");
    expect(job.last_error).toContain("HTTP 400");
  });

  it("TC-I-07: same phone as a lead from 5 days ago → duplicate_of set, no message jobs", async () => {
    const phone = randomPhone();
    const originalId = newLeadgenId();
    const { data: original } = await db()
      .from("leads")
      .insert({
        leadgen_id: originalId,
        phone_e164: `+91${phone}`,
        phone_valid: true,
        created_at: new Date(Date.now() - 5 * 86400_000).toISOString(),
      })
      .select("id")
      .single();

    const id = newLeadgenId();
    graph.set(id, () => HttpResponse.json(graphLead(id, { phone_number: phone })));
    await post(webhookBody(id));
    await runJobs();

    const [lead] = await leadsFor(id);
    expect(lead.duplicate_of).toBe(original!.id);
    const jobs = await jobsFor(lead.id);
    expect(jobs.map((j) => j.type)).toEqual(["sync_sheet"]);
    const { data: events } = await db().from("events").select("type").eq("lead_id", lead.id);
    expect(events!.map((e) => e.type)).toContain("lead.duplicate");
  });

  it("TC-I-08: AUTOMATION_ENABLED=false → lead saved, no jobs", async () => {
    process.env.AUTOMATION_ENABLED = "false";
    const id = newLeadgenId();
    graph.set(id, () => HttpResponse.json(graphLead(id, { phone_number: randomPhone() })));
    await post(webhookBody(id));
    await runJobs();

    const [lead] = await leadsFor(id);
    expect(lead).toBeDefined();
    expect(await jobsFor(lead.id)).toHaveLength(0);
  });

  it("responds fast: no Graph call happens before the 200 (FR-09)", async () => {
    const id = newLeadgenId();
    let called = false;
    graph.set(id, () => {
      called = true;
      return HttpResponse.json(graphLead(id));
    });
    const started = performance.now();
    expect((await post(webhookBody(id))).status).toBe(200);
    expect(performance.now() - started).toBeLessThan(2000);
    expect(called).toBe(false);
  });
});
