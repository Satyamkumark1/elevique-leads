import "server-only";
import * as Sentry from "@sentry/nextjs";
import { scrubFields } from "./scrub";

// IDs and codes only. PII-named fields are dropped and PII-looking values redacted as a safety net.
type Fields = Record<string, string | number | boolean | null | undefined>;

function write(level: "info" | "warn" | "error", msg: string, fields: Fields = {}) {
  console[level](JSON.stringify({ level, msg, ...scrubFields(fields), ts: new Date().toISOString() }));
}

export const logger = {
  info: (msg: string, fields?: Fields) => write("info", msg, fields),
  warn: (msg: string, fields?: Fields) => write("warn", msg, fields),
  error: (msg: string, fields?: Fields) => write("error", msg, fields),
};

/** Error to Sentry (if configured) tagged with IDs only (FR-39). Scrubbed again in beforeSend. */
export function reportError(err: unknown, tags: { lead_id?: string | null; job_id?: string; type?: string }) {
  Sentry.captureException(err, {
    tags: Object.fromEntries(Object.entries(tags).filter(([, v]) => v)) as Record<string, string>,
  });
}
