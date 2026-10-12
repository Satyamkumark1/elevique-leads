import "server-only";
import { z } from "zod";
import { db } from "./db";

/** Same allowlist that `is_team_member()` uses for RLS: settings.allowed_emails. */
export async function isAllowedEmail(email: string): Promise<boolean> {
  const { data, error } = await db().from("settings").select("value").eq("key", "allowed_emails").single();
  if (error) throw new Error(`settings lookup failed: ${error.code}`);
  const list = z.array(z.string()).parse(data.value);
  return list.some((e) => e.toLowerCase() === email.toLowerCase());
}
