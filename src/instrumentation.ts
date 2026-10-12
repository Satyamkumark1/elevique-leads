import * as Sentry from "@sentry/nextjs";

// Validate env once at server boot so a missing var fails loudly (TECH_SPEC §4); start Sentry if configured.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getEnv } = await import("./server/env");
  const { scrubEvent } = await import("./server/lib/scrub");
  const env = getEnv();
  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      // Collect nothing about requests/users; scrubEvent below is the second line of defence.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        databaseQueryData: false,
      },
      tracesSampleRate: 0,
      beforeSend: (event) => scrubEvent(event),
      beforeBreadcrumb: (b) => (b.category === "console" ? null : b), // console lines can carry request data
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
