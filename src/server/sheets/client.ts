import "server-only";
import { createSign } from "node:crypto";
import { z } from "zod";
import { getEnv } from "../env";
import { PermanentJobError } from "../jobs/errors";
import { formatIST } from "@/lib/time";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

/** Column order of the Sheet (FR-16). Column A = lead ID, used to find a lead's row (FR-17). */
export const SHEET_HEADER = [
  "Lead ID",
  "Received (IST)",
  "Name",
  "Phone",
  "Email",
  "Brand",
  "Category",
  "Budget",
  "Timeline",
  "Score",
  "Status",
  "Campaign",
  "Ad",
] as const;

export type SheetLead = {
  id: string;
  created_at: string;
  full_name: string | null;
  phone_e164: string | null;
  email: string | null;
  brand_name: string | null;
  category: string | null;
  budget_range: string | null;
  start_timeline: string | null;
  score: string | null;
  status: string;
  campaign_name: string | null;
  ad_name: string | null;
};

export function leadRow(l: SheetLead): string[] {
  return [
    l.id,
    formatIST(l.created_at),
    l.full_name ?? "",
    l.phone_e164 ?? "",
    l.email ?? "",
    l.brand_name ?? "",
    l.category ?? "",
    l.budget_range ?? "",
    l.start_timeline ?? "",
    l.score ?? "",
    l.status,
    l.campaign_name ?? "",
    l.ad_name ?? "",
  ];
}

// ponytail: per-instance token cache; fine for serverless (one token fetch per cold start / hour).
let token: { value: string; expires: number } | undefined;

export async function googleAccessToken(): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const env = getEnv();
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(env.GOOGLE_PRIVATE_KEY, "base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const message = `google token failed: HTTP ${res.status}`;
    throw res.status >= 500 ? new Error(message) : new PermanentJobError(message);
  }
  const json = z.object({ access_token: z.string(), expires_in: z.number() }).parse(await res.json());
  token = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return token.value;
}

async function sheets(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SHEETS}/${getEnv().GOOGLE_SHEET_ID}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await googleAccessToken()}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const message = `sheets request failed: HTTP ${res.status}`;
    throw res.status >= 500 || res.status === 429 ? new Error(message) : new PermanentJobError(message);
  }
  return res.json() as Promise<unknown>;
}

/** Writes the lead's row: updates it if column A already has the lead ID, else appends. Returns the row number. */
export async function upsertLeadRow(lead: SheetLead): Promise<number> {
  const tab = encodeURIComponent(getEnv().GOOGLE_SHEET_TAB);
  const ids = z
    .object({ values: z.array(z.array(z.string())).optional() })
    .parse(await sheets(`/values/${tab}!A:A`));
  const index = (ids.values ?? []).findIndex((r) => r[0] === lead.id);
  // RAW: values are stored as literal text, so "=HYPERLINK(...)" in a form answer is never evaluated.
  const body = JSON.stringify({ values: [leadRow(lead)] });

  if (index >= 0) {
    const row = index + 1;
    await sheets(`/values/${tab}!A${row}:M${row}?valueInputOption=RAW`, { method: "PUT", body });
    return row;
  }
  const appended = z.object({ updates: z.object({ updatedRange: z.string() }) }).parse(
    await sheets(`/values/${tab}!A:M:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body,
    }),
  );
  const row = Number(appended.updates.updatedRange.match(/!A(\d+)/)?.[1]);
  if (!row) throw new Error("sheets append returned no row");
  return row;
}

/** Test hook: forget the cached token. */
export function resetSheetsToken() {
  token = undefined;
}
