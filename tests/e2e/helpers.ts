import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import type { Database } from "@/lib/database.types";
import { localSupabase } from "../support/supabase";

const { url, serviceKey, mailUrl } = localSupabase();

/** Service-role client to put seed rows into a known state before a test. */
export const admin = createClient<Database>(url, serviceKey, { auth: { persistSession: false } });

export async function latestMagicLink(email: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const search = await fetch(`${mailUrl}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    if (messages?.length) {
      const msg = (await (await fetch(`${mailUrl}/api/v1/message/${messages[0].ID}`)).json()) as {
        Text: string;
      };
      const link = msg.Text.match(/https?:\/\/\S+\/auth\/v1\/verify\S+/)?.[0];
      if (link) return link.replace(/[)\]>]+$/, "");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("magic link email not received");
}

export async function clearMailbox() {
  await fetch(`${mailUrl}/api/v1/messages`, { method: "DELETE" });
}

export async function signIn(page: Page, email: string) {
  await clearMailbox();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await page.getByText("Check your inbox").waitFor();
  await page.goto(await latestMagicLink(email));
  await page.waitForURL("http://localhost:3000/");
}

export async function seedLead(leadgenId: string) {
  const { data } = await admin.from("leads").select("*").eq("leadgen_id", leadgenId).single();
  return data!;
}
