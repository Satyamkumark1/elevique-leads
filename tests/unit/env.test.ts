import { describe, expect, it } from "vitest";
import { parseEnv } from "@/server/env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  APP_URL: "http://localhost:3000",
  AUTOMATION_ENABLED: "false",
  CRON_SECRET: "0123456789abcdef",
  BOOKING_URL: "https://cal.com/elevique/intro",
  META_APP_SECRET: "s",
  META_VERIFY_TOKEN: "v",
  META_PAGE_ACCESS_TOKEN: "t",
  META_GRAPH_VERSION: "v23.0",
  WHATSAPP_PHONE_NUMBER_ID: "1",
  WHATSAPP_ACCESS_TOKEN: "t",
  WHATSAPP_APP_SECRET: "s",
  WHATSAPP_VERIFY_TOKEN: "v",
  OWNER_ALERT_PHONE: "+919876543210",
  RESEND_API_KEY: "re_x",
  EMAIL_FROM: "Elevique <hello@send.elevique.in>",
  EMAIL_REPLY_TO: "hello@elevique.in",
  GOOGLE_SERVICE_ACCOUNT_EMAIL: "sa@proj.iam.gserviceaccount.com",
  GOOGLE_PRIVATE_KEY: "-----BEGIN-----\\nabc\\n-----END-----",
  GOOGLE_SHEET_ID: "sheet",
  GOOGLE_SHEET_TAB: "Leads",
  GROQ_API_KEY: "gsk",
  GROQ_MODEL: "llama",
};

describe("env (TC-U-34)", () => {
  it("parses a complete environment", () => {
    const env = parseEnv(valid);
    expect(env.AUTOMATION_ENABLED).toBe(false);
    expect(env.GOOGLE_PRIVATE_KEY).toContain("\n");
  });

  it("throws naming the missing var", () => {
    expect(() => parseEnv({ ...valid, GROQ_API_KEY: undefined })).toThrow(/GROQ_API_KEY/);
  });

  it("treats empty strings as missing", () => {
    expect(() => parseEnv({ ...valid, META_APP_SECRET: "" })).toThrow(/META_APP_SECRET/);
  });

  it("never echoes secret values in the error", () => {
    expect(() => parseEnv({ ...valid, CRON_SECRET: "short-secret" })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining("short-secret") }),
    );
  });

  it("rejects a malformed Graph version and kill switch", () => {
    expect(() => parseEnv({ ...valid, META_GRAPH_VERSION: "23" })).toThrow(/META_GRAPH_VERSION/);
    expect(() => parseEnv({ ...valid, AUTOMATION_ENABLED: "yes" })).toThrow(/AUTOMATION_ENABLED/);
  });
});
