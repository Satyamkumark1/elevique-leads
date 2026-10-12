import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as cancel } from "@/app/api/jobs/[id]/cancel/route";
import { POST as retry } from "@/app/api/jobs/[id]/retry/route";
import { DELETE, PATCH } from "@/app/api/leads/[id]/route";
import { GET as exportCsv } from "@/app/api/leads/export/route";
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
afterAll(cleanupTestLeads);

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const patch = (id: string, body: unknown) =>
  PATCH(
    new NextRequest(`http://localhost/api/leads/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    ctx(id) as never,
  );
const leadRow = async (id: string) => (await db().from("leads").select("*").eq("id", id).maybeSingle()).data;
const eventTypes = async (id: string) =>
  ((await db().from("events").select("type").eq("lead_id", id)).data ?? []).map((e) => e.type);

describe("PATCH /api/leads/[id]", () => {
  it("TC-I-31: status change → lead updated, event logged, sync_sheet queued and Sheet row updated", async () => {
    const lead = await createLead({ status: "contacted" });
    const res = await patch(lead.id, { status: "meeting_booked" });
    expect(res.status).toBe(200);
    expect((await leadRow(lead.id))!.status).toBe("meeting_booked");
    expect(await eventTypes(lead.id)).toContain("status.changed");
    const { data: jobs } = await db().from("jobs").select("type").eq("lead_id", lead.id);
    expect(jobs!.map((j) => j.type)).toContain("sync_sheet");

    await runJobs();
    const row = providers.sheet.find((r) => r[0] === lead.id)!;
    expect(row[10]).toBe("meeting_booked");
  });

  it("rejects fields other than status/notes/automation_paused", async () => {
    const lead = await createLead();
    expect((await patch(lead.id, { email: "x@example.com" })).status).toBe(400);
    expect((await patch(lead.id, { status: "bogus" })).status).toBe(400);
    expect((await patch(lead.id, {})).status).toBe(400);
  });

  it("notes persist and log an event", async () => {
    const lead = await createLead();
    await patch(lead.id, { notes: "Call Tuesday" });
    expect((await leadRow(lead.id))!.notes).toBe("Call Tuesday");
    expect(await eventTypes(lead.id)).toContain("note.updated");
  });

  it("pause cancels pending follow-ups; resume brings them back", async () => {
    const lead = await createLead({ status: "contacted" });
    const f = await createJob("followup", lead.id, {
      payload: { step: "day2", template: "followup_case_study" },
      run_at: new Date(Date.now() + 86400_000).toISOString(),
    });
    await patch(lead.id, { automation_paused: true });
    expect(await getJob(f.id)).toMatchObject({ status: "cancelled", last_error: "automation paused" });
    await patch(lead.id, { automation_paused: false });
    expect((await getJob(f.id)).status).toBe("pending");
  });
});

describe("DELETE /api/leads/[id]", () => {
  it("removes the lead and its messages", async () => {
    const lead = await createLead();
    await db()
      .from("messages")
      .insert({ lead_id: lead.id, channel: "whatsapp", direction: "out", status: "sent" });
    const res = await DELETE(
      new NextRequest("http://localhost", { method: "DELETE" }),
      ctx(lead.id) as never,
    );
    expect(res.status).toBe(200);
    expect(await leadRow(lead.id)).toBeNull();
    expect((await db().from("messages").select("id").eq("lead_id", lead.id)).data).toHaveLength(0);
  });
});

describe("jobs", () => {
  it("TC-I-34: retry dead job → pending, attempts 0", async () => {
    const lead = await createLead();
    const job = await createJob("send_email", lead.id, { status: "dead", attempts: 3, last_error: "boom" });
    const res = await retry(new NextRequest("http://localhost", { method: "POST" }), ctx(job.id) as never);
    expect(res.status).toBe(200);
    expect(await getJob(job.id)).toMatchObject({ status: "pending", attempts: 0, last_error: null });
  });

  it("retry on a non-dead job → 409", async () => {
    const lead = await createLead();
    const job = await createJob("send_email", lead.id, { status: "done" });
    const res = await retry(new NextRequest("http://localhost", { method: "POST" }), ctx(job.id) as never);
    expect(res.status).toBe(409);
  });

  it("cancel pending follow-up", async () => {
    const lead = await createLead();
    const job = await createJob("followup", lead.id, {
      run_at: new Date(Date.now() + 86400_000).toISOString(),
    });
    const res = await cancel(new NextRequest("http://localhost", { method: "POST" }), ctx(job.id) as never);
    expect(res.status).toBe(200);
    expect((await getJob(job.id)).status).toBe("cancelled");
  });
});

describe("GET /api/leads/export", () => {
  it("TC-I-35: filtered rows, headers, and formula-injection cells neutralised", async () => {
    const tag = `Zq${Date.now()}`;
    const hot = await createLead({ score: "hot", brand_name: `=HYPERLINK("http://evil","${tag}")` });
    await createLead({ score: "cold", brand_name: `${tag} cold` });
    await createLead({ score: "hot", brand_name: "Other brand", full_name: `+${tag} plus` });

    const res = await exportCsv(new NextRequest(`http://localhost/api/leads/export?score=hot&q=${tag}`));
    expect(res.headers.get("content-type")).toContain("text/csv");
    const lines = (await res.text()).trim().split("\r\n");
    expect(lines[0]).toBe(
      '"Lead ID","Received (IST)","Name","Phone","Email","Brand","Brand link","Category","Budget","Videos/month","Timeline","Score","Status","Campaign","Ad","AI summary"',
    );
    expect(lines).toHaveLength(3); // header + 2 hot leads matching the search
    const hotLine = lines.find((l) => l.startsWith(`"${hot.id}"`))!;
    expect(hotLine).toContain(`"'=HYPERLINK(""http://evil"",""${tag}"")"`);
    expect(lines.some((l) => l.includes(`"'+${tag} plus"`))).toBe(true);
    expect(lines.some((l) => l.includes("cold"))).toBe(false);
  });
});
