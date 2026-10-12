import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import { localSupabase } from "../support/supabase";

// Every table must appear here (CLAUDE.md: policy test for any new table).
const TABLES = ["leads", "messages", "jobs", "events", "settings", "sample_reels"] as const;
const TEAM_EMAIL = "team@elevique.test"; // allowlisted in seed.sql
const OUTSIDER_EMAIL = "outsider@example.test";
const PASSWORD = "rls-test-password-123";

const { url, anonKey, serviceKey } = localSupabase();
const admin = createClient<Database>(url, serviceKey, { auth: { persistSession: false } });
const anon = () => createClient<Database>(url, anonKey, { auth: { persistSession: false } });

async function deleteUser(email: string) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.email === email);
  if (user) await admin.auth.admin.deleteUser(user.id);
}

async function signedIn(email: string): Promise<SupabaseClient<Database>> {
  await deleteUser(email);
  const { error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = anon();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return client;
}

let team: SupabaseClient<Database>;
let outsider: SupabaseClient<Database>;
let leadId: string;
let originalStatus: Database["public"]["Enums"]["lead_status"];

beforeAll(async () => {
  team = await signedIn(TEAM_EMAIL);
  outsider = await signedIn(OUTSIDER_EMAIL);
  const { data } = await admin.from("leads").select("id, status").limit(1).single();
  leadId = data!.id;
  originalStatus = data!.status;
});

afterAll(async () => {
  await admin.from("leads").update({ status: originalStatus, notes: null }).eq("id", leadId);
  await deleteUser(TEAM_EMAIL);
  await deleteUser(OUTSIDER_EMAIL);
});

describe("RLS (TC-I-33)", () => {
  it.each(TABLES)("anon key reads nothing from %s", async (table) => {
    const { data } = await anon().from(table).select("*");
    expect(data ?? []).toHaveLength(0);
  });

  it.each(TABLES)("signed-in non-team user reads nothing from %s", async (table) => {
    const { data } = await outsider.from(table).select("*");
    expect(data ?? []).toHaveLength(0);
  });

  it("team member can read seeded leads", async () => {
    const { data, error } = await team.from("leads").select("id");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it.each(TABLES)("team member can select from %s", async (table) => {
    const { error } = await team.from(table).select("*").limit(1);
    expect(error).toBeNull();
  });

  it("team member can update status/notes/automation_paused only", async () => {
    const ok = await team.from("leads").update({ status: "won", notes: "rls test" }).eq("id", leadId);
    expect(ok.error).toBeNull();
    const blocked = await team.from("leads").update({ email: "x@example.com" }).eq("id", leadId);
    expect(blocked.error).not.toBeNull();
  });

  it("non-team user cannot update leads", async () => {
    await outsider.from("leads").update({ status: "lost" }).eq("id", leadId);
    const { data } = await admin.from("leads").select("status").eq("id", leadId).single();
    expect(data!.status).not.toBe("lost");
  });

  it("team member cannot write to other tables", async () => {
    // No update policy on settings: the write is filtered out by RLS, never applied.
    await team.from("settings").update({ value: [] }).eq("key", "allowed_emails");
    const { data } = await admin.from("settings").select("value").eq("key", "allowed_emails").single();
    expect(data!.value).toContain(TEAM_EMAIL);
  });

  it("anon and team cannot call claim_jobs", async () => {
    expect((await anon().rpc("claim_jobs", { batch: 1 })).error).not.toBeNull();
    expect((await team.rpc("claim_jobs", { batch: 1 })).error).not.toBeNull();
  });
});
