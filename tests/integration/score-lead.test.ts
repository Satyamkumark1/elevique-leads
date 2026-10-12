import { HttpResponse } from "msw";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
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

mockProviders();
beforeEach(() => {
  process.env.AUTOMATION_ENABLED = "true";
});
afterAll(cleanupTestLeads);

const groqReturns = (content: object) => () =>
  HttpResponse.json({ choices: [{ message: { content: JSON.stringify(content) } }] });

async function leadAfter(id: string) {
  return (await db().from("leads").select("*").eq("id", id).single()).data!;
}
async function jobKeys(leadId: string) {
  const { data } = await db().from("jobs").select("idempotency_key").eq("lead_id", leadId);
  return data!.map((j) => j.idempotency_key);
}

describe("score_lead", () => {
  it("AI upgrade warm → hot: stores summary/reason, queues owner alert and sheet update", async () => {
    providers.groq = groqReturns({
      score: "hot",
      summary: "Fashion brand, ₹50k+, this month",
      reason: "Real brand, ready now",
    });
    const lead = await createLead({ score: "warm" });
    const job = await createJob("score_lead", lead.id);
    await runJobs();

    expect((await getJob(job.id)).status).toBe("done");
    expect(await leadAfter(lead.id)).toMatchObject({
      score: "hot",
      score_source: "ai",
      ai_status: "done",
      ai_summary: "Fashion brand, ₹50k+, this month",
      ai_reason: "Real brand, ready now",
    });
    const keys = await jobKeys(lead.id);
    expect(keys).toContain(`owner_alert:hot:${lead.id}`);
    expect(keys).toContain(`sync_sheet:ai_score:${lead.id}`);
    // Alert job ran in the same runner pass and reached the owner.
    expect(providers.whatsapp.map((m) => m.template)).toContain("internal_hot_lead");
  });

  it("AI cannot move a score more than one level", async () => {
    providers.groq = groqReturns({ score: "hot", summary: "s", reason: "r" });
    const lead = await createLead({ score: "cold" });
    await createJob("score_lead", lead.id);
    await runJobs();
    expect((await leadAfter(lead.id)).score).toBe("warm");
  });

  it("Groq failure → rule score kept, ai_status failed, welcome WhatsApp still sent", async () => {
    providers.groq = () => HttpResponse.json({}, { status: 500 });
    const lead = await createLead({ score: "warm" });
    const score = await createJob("score_lead", lead.id);
    await createJob("send_whatsapp", lead.id, { payload: { template: "welcome_samples" } });
    await runJobs();

    expect((await getJob(score.id)).status).toBe("done");
    expect(await leadAfter(lead.id)).toMatchObject({
      score: "warm",
      score_source: "rules",
      ai_status: "failed",
    });
    expect(providers.whatsapp).toHaveLength(1);
  });

  it("re-running a scored lead does not call Groq again", async () => {
    const lead = await createLead({ ai_status: "done" });
    await createJob("score_lead", lead.id);
    await runJobs();
    expect(providers.groqCalls).toHaveLength(0);
  });
});
