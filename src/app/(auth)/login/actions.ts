"use server";

import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/server/auth";
import { getEnv } from "@/server/env";
import { logger } from "@/server/lib/logger";

export type LoginState = { status: "idle" | "sent" | "not_authorised" | "error"; message?: string };

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = z.email().safeParse(
    String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
  );
  if (!parsed.success) return { status: "error", message: "Enter a valid email address." };
  const email = parsed.data;

  if (!(await isAllowedEmail(email))) return { status: "not_authorised" };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${getEnv().APP_URL}/auth/callback` },
  });
  if (error) {
    logger.error("auth.magic_link_failed", { code: error.code });
    return { status: "error", message: "Could not send the link. Try again in a minute." };
  }
  return { status: "sent" };
}
