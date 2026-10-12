import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { localSupabase } from "../support/supabase";

const { url, serviceKey } = localSupabase();

/** Service-role client to put seed rows into a known state before a test. */
export const admin = createClient<Database>(url, serviceKey, { auth: { persistSession: false } });

export async function seedLead(leadgenId: string) {
  const { data } = await admin.from("leads").select("*").eq("leadgen_id", leadgenId).single();
  return data!;
}
