import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/** For route handlers and server actions: the signed-in team member, or an error response. */
export async function requireTeam(): Promise<{ email: string } | { response: NextResponse }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 }) };
  const { data: isTeam } = await supabase.rpc("is_team_member");
  if (!isTeam) return { response: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  return { email: user.email ?? "" };
}

/** Server-action variant: throws instead of returning a response. */
export async function assertTeam(): Promise<string> {
  const result = await requireTeam();
  if ("response" in result) throw new Error("Not authorised");
  return result.email;
}
