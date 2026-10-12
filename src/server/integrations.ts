import "server-only";
import { getEnv } from "./env";
import { googleAccessToken } from "./sheets/client";

export const INTEGRATIONS = ["meta", "whatsapp", "resend", "sheets", "groq"] as const;
export type Integration = (typeof INTEGRATIONS)[number];

async function check(url: string, headers: Record<string, string>): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
    return { ok: res.ok, detail: res.ok ? "Connected" : `HTTP ${res.status}` };
  } catch {
    return { ok: false, detail: "Unreachable" };
  }
}

/** Read-only ping per integration (FR-34). Never sends a message. */
export async function testIntegration(name: Integration) {
  const env = getEnv();
  const graph = `https://graph.facebook.com/${env.META_GRAPH_VERSION}`;
  switch (name) {
    case "meta":
      return check(`${graph}/me?fields=id`, { Authorization: `Bearer ${env.META_PAGE_ACCESS_TOKEN}` });
    case "whatsapp":
      return check(`${graph}/${env.WHATSAPP_PHONE_NUMBER_ID}?fields=id`, {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      });
    case "resend":
      return check("https://api.resend.com/domains", { Authorization: `Bearer ${env.RESEND_API_KEY}` });
    case "sheets": {
      try {
        const token = await googleAccessToken();
        return check(
          `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}?fields=spreadsheetId`,
          {
            Authorization: `Bearer ${token}`,
          },
        );
      } catch {
        return { ok: false, detail: "Service account auth failed" };
      }
    }
    case "groq":
      return check("https://api.groq.com/openai/v1/models", { Authorization: `Bearer ${env.GROQ_API_KEY}` });
  }
}
