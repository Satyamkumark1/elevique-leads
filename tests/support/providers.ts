import { generateKeyPairSync } from "node:crypto";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import { db } from "@/server/db";
import { resetSheetsToken } from "@/server/sheets/client";

// Real RSA key so the Google JWT can be signed; only MSW ever sees it.
process.env.GOOGLE_PRIVATE_KEY = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({
  type: "pkcs8",
  format: "pem",
}) as string;

type Fail = (() => Response) | null;

/** Recorded calls and failure switches for every external provider. Reset after each test. */
export const providers = {
  whatsapp: [] as { to: string; template: string; params: string[] }[],
  whatsappFail: null as Fail,
  emails: [] as { body: Record<string, unknown>; idempotencyKey: string | null }[],
  emailFail: null as Fail,
  sheet: [] as string[][],
  sheetFail: null as Fail,
  groq: null as
    ((body: { messages: { role: string; content: string }[] }) => Response | Promise<Response>) | null,
  groqCalls: [] as { messages: { role: string; content: string }[] }[],
  /** Graph lead responses keyed by leadgen_id; unknown ids → 404. */
  graphLeads: new Map<string, () => Response>(),
};

let waSeq = 0;
export const server = setupServer(
  http.get("https://graph.facebook.com/:version/:id", ({ params, request }) => {
    if (params.version !== process.env.META_GRAPH_VERSION) return HttpResponse.json({}, { status: 400 });
    if (request.headers.get("authorization") !== `Bearer ${process.env.META_PAGE_ACCESS_TOKEN}`) {
      return HttpResponse.json({ error: { code: 190 } }, { status: 401 });
    }
    return (
      providers.graphLeads.get(String(params.id))?.() ??
      HttpResponse.json({ error: { code: 100 } }, { status: 404 })
    );
  }),
  http.post("https://graph.facebook.com/:version/:phoneId/messages", async ({ request }) => {
    if (providers.whatsappFail) return providers.whatsappFail();
    const body = (await request.json()) as {
      to: string;
      template: { name: string; components: { parameters: { text: string }[] }[] };
    };
    providers.whatsapp.push({
      to: body.to,
      template: body.template.name,
      params: body.template.components[0]?.parameters.map((p) => p.text) ?? [],
    });
    return HttpResponse.json({ messages: [{ id: `wamid.test_${Date.now()}_${++waSeq}` }] });
  }),
  http.post("https://api.resend.com/emails", async ({ request }) => {
    if (providers.emailFail) return providers.emailFail();
    providers.emails.push({
      body: (await request.json()) as Record<string, unknown>,
      idempotencyKey: request.headers.get("idempotency-key"),
    });
    return HttpResponse.json({ id: `email_test_${Date.now()}_${providers.emails.length}` });
  }),
  http.post("https://oauth2.googleapis.com/token", () =>
    HttpResponse.json({ access_token: "google-test-token", expires_in: 3600 }),
  ),
  http.get("https://sheets.googleapis.com/v4/spreadsheets/:id/values/:range", () => {
    if (providers.sheetFail) return providers.sheetFail();
    return HttpResponse.json({ values: providers.sheet.map((r) => [r[0]]) });
  }),
  http.post("https://sheets.googleapis.com/v4/spreadsheets/:id/values/:range", async ({ request }) => {
    if (providers.sheetFail) return providers.sheetFail();
    const { values } = (await request.json()) as { values: string[][] };
    providers.sheet.push(values[0]);
    const row = providers.sheet.length;
    return HttpResponse.json({ updates: { updatedRange: `Leads!A${row}:M${row}` } });
  }),
  http.put("https://sheets.googleapis.com/v4/spreadsheets/:id/values/:range", async ({ request, params }) => {
    if (providers.sheetFail) return providers.sheetFail();
    const row = Number(String(params.range).match(/!A(\d+)/)![1]);
    providers.sheet[row - 1] = ((await request.json()) as { values: string[][] }).values[0];
    return HttpResponse.json({});
  }),
  http.post("https://api.groq.com/openai/v1/chat/completions", async ({ request }) => {
    const body = (await request.json()) as { messages: { role: string; content: string }[] };
    providers.groqCalls.push(body);
    if (!providers.groq) return HttpResponse.json({ error: "no groq mock" }, { status: 500 });
    return providers.groq(body);
  }),
);

export function mockProviders() {
  beforeAll(() =>
    server.listen({
      // Local Supabase passes through; any other real network call fails the test.
      onUnhandledFrame: ({ frame, defaults }) => {
        const { request } = frame.data as { request?: Request };
        if (request && !["127.0.0.1", "localhost"].includes(new URL(request.url).hostname)) defaults.error();
      },
    }),
  );
  afterEach(() => {
    providers.whatsapp = [];
    providers.whatsappFail = null;
    providers.emails = [];
    providers.emailFail = null;
    providers.sheet = [["Lead ID", "Received (IST)"]];
    providers.sheetFail = null;
    providers.groq = null;
    providers.groqCalls = [];
    providers.graphLeads.clear();
    resetSheetsToken();
  });
  afterAll(() => server.close());
}
providers.sheet = [["Lead ID", "Received (IST)"]];

const RUN = `t_${Date.now()}`;
let n = 0;
export const randomPhone = () => `+917${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;

/** Inserts a lead (fresh unique leadgen_id). Deleted with its jobs/messages by `cleanupTestLeads`. */
export async function createLead(fields: Record<string, unknown> = {}) {
  const { data, error } = await db()
    .from("leads")
    .insert({
      leadgen_id: `${RUN}_${++n}`,
      full_name: "Asha Verma",
      phone_e164: randomPhone(),
      phone_valid: true,
      email: `lead${n}@example.com`,
      brand_name: "Kesar Threads",
      brand_link: "https://instagram.com/kesar",
      category: "Fashion",
      budget_range: "₹50k–1L",
      budget_min_inr: 50000,
      start_timeline: "This month",
      score: "warm",
      score_source: "rules",
      ...fields,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function createJob(type: string, leadId: string | null, fields: Record<string, unknown> = {}) {
  const { data, error } = await db()
    .from("jobs")
    .insert({ type, lead_id: leadId, idempotency_key: `${type}:${RUN}:${++n}`, ...fields })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getJob(id: string) {
  return (await db().from("jobs").select("*").eq("id", id).single()).data!;
}

export async function cleanupTestLeads() {
  await db().from("leads").delete().like("leadgen_id", `${RUN}%`);
  await db().from("jobs").delete().like("idempotency_key", `%${RUN}%`);
}
