# Elevique Leads — Security and Privacy Checklist

## Threats and controls

| Threat | Control | Verified by |
|---|---|---|
| Fake webhooks creating leads / triggering messages | HMAC `X-Hub-Signature-256` on raw body, timing-safe compare; verify tokens on GET | TC-U-01…04, TC-I-03, I-21 |
| Anyone calling the job runner | `Authorization: Bearer CRON_SECRET`; constant-time compare | TC-I-09 |
| Dashboard access by outsiders | Supabase magic link + email allowlist in middleware and RLS | TC-E-02, TC-I-32, I-33 |
| Leaked service keys | Server-only modules (`src/server/**`, `import 'server-only'`); no `NEXT_PUBLIC_` prefix on secrets; secrets only in Vercel env | Code review + grep in CI |
| Prompt injection via form fields | Form values passed as data in a JSON block; strict output schema; one-level score cap; AI output never executed or sent to leads | TC-U-26 |
| CSV / Sheets formula injection | Prefix cells starting with `= + - @` with `'` | TC-I-35 |
| Spamming leads / double sends | Idempotency keys, `claim_jobs` with `SKIP LOCKED`, opt-out honoured, kill switch | TC-I-05, I-16, I-25 |
| PII in logs | Logger only takes IDs; Sentry scrubbing | Launch checklist |
| Token expiry | Use system-user (non-expiring) WhatsApp token and long-lived page token; Integrations page shows failures | TC-M-01 |

## Privacy (India DPDP Act)
- Consent line on the Meta form covering WhatsApp and email contact.
- Opt-out by replying STOP; honoured immediately and permanently.
- Delete lead on request (dashboard action, cascades messages/jobs, clears Sheet row).
- Data stored in Supabase Mumbai region.
- Only team members on the allowlist can view leads.

## Secret rotation
1. Create new secret in provider.
2. Update in Vercel env (Production + Preview), redeploy.
3. Revoke old secret.
4. Run integration "Test" buttons.

## Verification (Phase 7 walkthrough, 2026-10-12)
| Control | Status | Where |
|---|---|---|
| HMAC on raw body, timing-safe, both webhooks; verify tokens on GET | Done | `server/meta/verifySignature.ts`; TC-U-01…04, TC-I-01…03, I-21 |
| Runner bearer secret, constant-time | Done | `api/jobs/run`; TC-I-09 |
| Magic link + allowlist in proxy, server layout, route handlers and RLS | Done | `proxy.ts`, `server/session.ts`, `is_team_member()`; TC-E-01/02, TC-I-32/33 |
| `leads` writable columns limited by DB grant | Done | init migration; `rls.test.ts` |
| Secrets only in `src/server/**` with `server-only`; no secret `NEXT_PUBLIC_` | Done, enforced in CI | CI "Secret boundary check" |
| Prompt injection: data-only JSON block, strict schema, one-level cap, AI never sent to leads | Done | `server/ai/aiScore.ts`; TC-U-26 |
| CSV formula injection prefixed; Sheets written with `RAW` | Done | `lib/csv.ts`, `sheets/client.ts`; TC-I-35 |
| Idempotency keys, `SKIP LOCKED`, per-job message guard, Resend idempotency key, kill switch, opt-out | Done | TC-I-05, I-16, I-25, runner tests |
| No PII in logs/Sentry: logger drops PII fields + redacts; Sentry collects no request data and is scrubbed | Done | `server/lib/scrub.ts`; `scrub.test.ts` |
| Security headers (no framing, nosniff, HSTS, referrer policy) | Done | `next.config.ts` |
| Token expiry visible | Done | Integrations: failures + Test buttons |
| Anonymous access to API routes | 401 | TC-I-32 (E2E) |
| Webhook payloads with PII | WhatsApp events store counts only; Meta events store IDs only | routes |
