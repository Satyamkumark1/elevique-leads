# Changelog

## Unreleased

### Phase 7 — Hardening (code complete; launch steps need production)
- Sentry (server, only when `SENTRY_DSN` set): no request/user data collected, `beforeSend` scrubbing, dead jobs and runner failures reported with IDs only
- Logger drops PII-named fields and redacts emails/phones (never IDs); unit tests
- Security headers; CI guard that secret-reading modules import `server-only`
- WCAG fixes from Lighthouse: text-on-tint colour variants for cold/error, labelled icons, 24px targets
- README: production setup, runbook; SECURITY.md verification table

### Phase 6 — Dashboard
- Overview: 4 stat cards, leads/day line, leads by campaign, score split, needs-attention list, activity feed
- Leads: URL filters (score, status, category, campaign, IST date range), search, 25/page, WhatsApp/email delivery icons, bulk status, CSV export (formula-safe), mobile card list
- Lead detail: answers, AI summary + reason, contact + quick actions, ordered timeline (inbound highlighted), status, automation pause/resume, notes on blur, delete (cascade)
- Follow-ups queue with cancel; Templates (WA texts, email preview + copy editor, sample reels add/reorder/delete); Integrations (health, test pings, webhook health, pending/dead jobs with retry); Settings (scoring rules, quiet hours, team allowlist)
- Routes: `PATCH/DELETE /api/leads/[id]`, `GET /api/leads/export`, `POST /api/jobs/[id]/retry|cancel`, `POST /api/integrations/test`
- Tests TC-I-31…35, TC-E-03…12; dev seed now includes messages, follow-ups, a dead job and a duplicate

### Phase 5 — Replies, opt-out, follow-ups
- `/api/webhooks/whatsapp`: signature check; statuses only move forward (`failed` records the error); inbound → message row, lead `replied`, follow-ups cancelled, one owner alert per lead per day
- Opt-out (STOP, unsubscribe, band karo, not interested, exact "no") → `opted_out` on every lead with that phone, all pending outbound jobs cancelled
- `followup` handler: cancels if replied / moved past contacted / paused / opted out; quiet hours 21:00–09:00 IST reschedule without using an attempt
- Tests TC-U-29…32, TC-I-21…30

### Phase 4 — AI scoring
- `aiScore` (Groq JSON mode, Zod-validated, 10 s timeout, form answers only, one-level cap); `score_lead` handler stores summary + reason (`leads.ai_reason`), queues owner alert when newly hot and a Sheet update when the score changes
- AI failure never fails the job or blocks messages (FR-20)
- Tests TC-U-21…28; 31-case labelled eval set (`tests/fixtures/ai-eval.json`) + `pnpm test:ai-eval`

### Phase 3 — Job runner + instant response
- `POST /api/jobs/run` (Bearer `CRON_SECRET`, 50 s budget); pg_cron every 5 min via Vault secrets `app_url`, `cron_secret`
- Handlers: `send_whatsapp` (welcome template, category reel), `send_email` (Resend, idempotency key), `sync_sheet` (append/update by lead ID), `owner_alert`
- Skip rules: invalid phone / no email / opted out / paused → logged `message.skipped`, job done (FR-12)
- Kill switch holds outbound jobs pending; retries with backoff; permanent 4xx → dead
- Tests: TC-I-09…20, TC-U-33; shared MSW provider mocks

### Phase 2 — Lead capture
- `/api/webhooks/meta` GET (verify token) + POST (raw-body HMAC → store event → enqueue `fetch_lead` → 200; `after()` kicks the runner) (FR-01…03, FR-09)
- `fetch_lead` job: Graph fetch (version from env, Bearer token), field mapping, phone normalisation, budget parsing, rule score, idempotent upsert, duplicate-phone detection, sequence enqueue (FR-04…08, FR-18)
- Runner core: `claim_jobs(batch, only_types)`, retry backoff (+1 min, +5 min, dead), permanent 4xx → dead, `job.dead` event
- Kill switch: `AUTOMATION_ENABLED=false` still saves leads, queues no outbound jobs
- Tests: TC-U-01…20, TC-I-01…08 (+ Graph 4xx and fast-ack cases); MSW mocks the Graph API

### Phase 1 — Foundation
- Next.js 16 app (TypeScript strict, Tailwind v4, shadcn/ui tokens mapped to UI_SPEC, ESLint, Prettier, Vitest, Playwright)
- `src/server/env.ts`: Zod-validated env, checked at boot via `instrumentation.ts` (TC-U-34)
- Migration `init`: schema, `claim_jobs()`, `is_team_member()`, RLS on all tables, `updated_at` triggers, default settings
- `seed.sql`: dev allowlist, sample reels, 40 test leads
- Magic-link login with allowlist check; proxy gates every page; "Not authorised" page (FR-28, TC-E-01, TC-E-02)
- Dashboard shell: collapsible sidebar / mobile tab bar, top bar with search, Live dot, sign out; empty pages for all routes
- RLS policy tests for every table (TC-I-33)
- GitHub Actions CI: secret boundary check, lint, typecheck, unit + integration, E2E

- Project docs created (PRD, tech spec, build plan, test plan, UI spec, security)
