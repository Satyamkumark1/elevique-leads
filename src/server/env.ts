import "server-only";
import { z } from "zod";

const required = z.string().min(1);

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required,
  SUPABASE_SERVICE_ROLE_KEY: required,

  APP_URL: z.url(),
  AUTOMATION_ENABLED: z.enum(["true", "false"]).transform((v) => v === "true"),
  CRON_SECRET: z.string().min(16),
  BOOKING_URL: z.url(),

  META_APP_SECRET: required,
  META_VERIFY_TOKEN: required,
  META_PAGE_ACCESS_TOKEN: required,
  META_GRAPH_VERSION: z.string().regex(/^v\d+\.\d+$/),

  WHATSAPP_PHONE_NUMBER_ID: required,
  WHATSAPP_ACCESS_TOKEN: required,
  WHATSAPP_APP_SECRET: required,
  WHATSAPP_VERIFY_TOKEN: required,
  OWNER_ALERT_PHONE: z.string().regex(/^\+91[6-9]\d{9}$/),
  WHATSAPP_TEMPLATE_LANG: z.string().default("en"), // language code the templates were approved in

  RESEND_API_KEY: required,
  RESEND_WEBHOOK_SECRET: z.string().optional(), // v1.1
  EMAIL_FROM: required,
  EMAIL_REPLY_TO: z.email(),

  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.email(),
  GOOGLE_PRIVATE_KEY: required.transform((v) => v.replace(/\\n/g, "\n")),
  GOOGLE_SHEET_ID: required,
  GOOGLE_SHEET_TAB: required,

  GROQ_API_KEY: required,
  GROQ_MODEL: required,

  SENTRY_DSN: z.url().optional(), // Phase 7
});

export type Env = z.infer<typeof schema>;

/** Throws with the names (never values) of missing/invalid vars. Empty strings count as missing. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ""));
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((i) => i.path.join(".")))];
    throw new Error(`Invalid environment variables: ${names.join(", ")}`);
  }
  return result.data;
}

/** Parsed per call (cheap) so a changed kill switch or test override is never stale. */
export function getEnv(): Env {
  return parseEnv(process.env);
}
