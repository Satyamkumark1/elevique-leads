// No phone numbers, emails or names in logs or Sentry (CLAUDE.md, SECURITY.md).
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Standalone digit runs only: never inside UUIDs or other IDs.
const PHONE = /(?<![\w-])(?![0-9a-f]{8}-[0-9a-f]{4}-)\+?\d[\d\s-]{8,}\d(?![\w-])/gi;
const PII_KEY = /phone|email|name|body|text|notes|address|brand/i;

export function scrubText(s: string): string {
  return s.replace(EMAIL, "[email]").replace(PHONE, "[phone]");
}

/** Log fields: drop PII-named keys, redact PII-looking values. */
export function scrubFields<T extends Record<string, unknown>>(fields: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([k]) => !PII_KEY.test(k))
      .map(([k, v]) => [k, typeof v === "string" && !k.endsWith("_id") ? scrubText(v) : v]),
  );
}

type SentryLikeEvent = {
  message?: string;
  user?: unknown;
  request?: { data?: unknown; cookies?: unknown; headers?: unknown; query_string?: unknown; url?: string };
  exception?: { values?: { value?: string }[] };
  breadcrumbs?: { message?: string; data?: unknown }[];
  extra?: unknown;
};

/** Sentry beforeSend: strip request bodies, cookies, headers, user and PII-looking text. */
export function scrubEvent<E extends SentryLikeEvent>(event: E): E {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
  }
  delete event.user;
  delete event.extra;
  if (event.message) event.message = scrubText(event.message);
  for (const v of event.exception?.values ?? []) if (v.value) v.value = scrubText(v.value);
  for (const b of event.breadcrumbs ?? []) {
    if (b.message) b.message = scrubText(b.message);
    delete b.data;
  }
  return event;
}
