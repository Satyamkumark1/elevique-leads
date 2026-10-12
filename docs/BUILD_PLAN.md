# Elevique Leads — Build Plan

Build one phase at a time. A phase is done only when **every item in its Definition of Done passes** and its tests in `TEST_PLAN.md` are green. Do not start the next phase until then.

Phase 0 is manual setup (owner). Phases 1–7 are for Claude Code.

---

## Phase 0 — Accounts and access (owner, manual)

| # | Task | Done when |
|---|---|---|
| 0.1 | Meta Business Manager: business verification submitted | Status shows "Verified" or "In review" |
| 0.2 | Meta developer app (type: Business) with Webhooks + WhatsApp products; Facebook Page connected | App ID + app secret saved |
| 0.3 | Long-lived Page access token with `leads_retrieval`, `pages_manage_metadata`, `pages_show_list`, `pages_read_engagement`, `ads_management` | Token works in Graph API Explorer: `GET /{page_id}/leadgen_forms` |
| 0.4 | WhatsApp Cloud API number registered; permanent system-user token created | Test template sends to your own phone |
| 0.5 | Submit WhatsApp templates (exact text + variables in `src/server/whatsapp/templates.ts`): `welcome_samples`, `followup_case_study`, `followup_free_sample`, `internal_hot_lead`, `internal_lead_replied` | All "Approved" |
| 0.6 | Meta Instant Form created with field keys from PRD §8 + privacy policy link | Form visible in Ads Manager |
| 0.7 | Resend: add `send.elevique.in`, DNS records (SPF, DKIM, DMARC) added | Domain "Verified" in Resend |
| 0.8 | Google Cloud: service account + JSON key; Sheet created with header row; Sheet shared with service account email | Service account has Editor access |
| 0.9 | Groq API key | `curl` test returns a completion |
| 0.10 | Supabase project (Mumbai region), Vercel project linked to GitHub repo, Sentry project | Env vars filled in Vercel (Preview + Production) |

## Phase 1 — Foundation (Day 1–2)

**Build**
- Next.js app, TypeScript strict, Tailwind, shadcn/ui, ESLint, Prettier, Vitest, Playwright.
- `src/server/env.ts` with Zod.
- Migration `0001_init.sql` (TECH_SPEC §5), `claim_jobs()`, RLS policies, `seed.sql`.
- Supabase local stack via CLI; typed client generated (`supabase gen types`).
- Auth: magic-link login, allowlist check in middleware; non-team users see "Not authorised".
- Dashboard shell: sidebar, top bar, empty pages with routes.
- CI (GitHub Actions): lint, typecheck, unit tests on every PR.

**Definition of Done**
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass locally and in CI
- [x] `supabase db reset` applies migrations + seed with no errors
- [x] Allowlisted email can log in; other emails are rejected (E2E test)
- [ ] Preview deploy on Vercel loads the dashboard shell — blocked on Phase 0.10 (Vercel + Supabase project)

## Phase 2 — Lead capture (Day 3–4)

**Build**
- `server/meta/verifySignature.ts`, `fetchLead.ts`, `mapFields.ts`
- `server/lib/phone.ts`, budget parser
- `/api/webhooks/meta` GET + POST
- Rule-based scoring (`server/ai/ruleScore.ts`)
- `server/jobs/enqueue.ts` (creates jobs; handlers stubbed to log only)
- Duplicate handling (leadgen_id + same phone within 30 days)

**Definition of Done**
- [x] Unit tests for signature, mapping, phone, budget, rule scoring pass (TC-U-01…U-20)
- [x] Integration tests TC-I-01…I-08 pass
- [ ] Meta "Lead Ads Testing Tool" lead appears in `leads` within 10 s on the Preview URL — needs Phase 0 (Meta app + Vercel preview)
- [x] Sending the same webhook twice creates one lead and one set of jobs (TC-I-05)
- [ ] Webhook responds in < 2 s (check Vercel logs) — locally ~35 ms; Vercel check needs preview deploy

## Phase 3 — Job runner + instant response (Day 5–7)

**Build**
- `/api/jobs/run` with `claim_jobs`, time budget, retry/backoff, dead state
- Handlers: `send_whatsapp`, `send_email` (React Email template), `sync_sheet`, `owner_alert`
- `pg_cron` schedule calling the runner (staging first)
- `after()` kick from the Meta webhook
- `AUTOMATION_ENABLED` kill switch

**Definition of Done**
- [x] Integration tests TC-I-09…I-20 pass (providers mocked with MSW)
- [ ] Test lead → WhatsApp template received on your own phone in < 30 s — needs Phase 0
- [ ] Test lead → email received in Gmail **inbox** (not spam), from `send.elevique.in` — needs Phase 0
- [ ] Test lead → row appears in the Google Sheet — needs Phase 0
- [x] Forced provider failure → job retries 3 times then shows `dead` (TC-I-13, I-14)
- [x] Two runner calls at the same time never send the same message twice (TC-I-16)

## Phase 4 — AI scoring + alerts (Day 8)

**Build**
- `server/ai/aiScore.ts` (Groq, JSON mode, Zod validation, 10 s timeout, one-level cap)
- `score_lead` handler, hot alert on upgrade

**Definition of Done**
- [x] Unit tests TC-U-21…U-28 pass (Groq mocked)
- [ ] AI eval set (TEST_PLAN §6) ≥ 90% agreement with expected scores — set ready (31 cases); run `pnpm test:ai-eval` with a real GROQ_API_KEY
- [x] Groq timeout → lead keeps rule score, `ai_status = failed`, messages still sent (TC-U-24 + score-lead integration test)
- [ ] Hot test lead → owner alert received on WhatsApp — needs Phase 0 (sending verified with mocks)

## Phase 5 — Replies, opt-out, follow-ups (Day 9–10)

**Build**
- `/api/webhooks/whatsapp` (statuses + inbound)
- Follow-up handler with skip rules and quiet hours
- Opt-out handling

**Definition of Done**
- [x] Integration tests TC-I-21…I-32 pass (I-31/32 delivered with the PATCH route in Phase 6)
- [ ] Reply from your phone → lead `replied`, follow-ups `cancelled`, owner alerted — needs Phase 0 (TC-I-24 green)
- [ ] "STOP" → `opted_out`, no further messages — needs Phase 0 (TC-I-25 green)
- [x] Message statuses update to delivered/read in the DB (TC-I-22, I-23; live check with Phase 0)
- [x] Follow-up due at 22:00 IST is sent at 09:00 IST (unit test with fake clock)

## Phase 6 — Dashboard (Day 11–14)

**Build** — per `UI_SPEC.md`: Overview, Leads table, Lead detail, Follow-ups, Templates, Integrations, Settings, CSV export, job retry.

**Definition of Done**
- [ ] E2E tests TC-E-01…E-12 pass
- [ ] Lighthouse (desktop) performance ≥ 85, accessibility ≥ 90 on Overview and Leads
- [ ] Lead list usable on a 375 px wide screen
- [ ] Status change in dashboard updates the Sheet row
- [ ] Dead job can be retried from Integrations page

## Phase 7 — Hardening + launch (Day 15)

**Build**
- Sentry, structured logging, PII scrub check
- Security checklist (`SECURITY.md`) walkthrough
- Production env vars, production `pg_cron`, Meta webhook pointed to production URL
- Runbook in README (how to pause automation, retry jobs, rotate tokens)

**Definition of Done**
- [ ] `docs/TEST_PLAN.md` launch checklist (§8) fully ticked
- [ ] End-to-end test on production with a real ₹ small-budget ad and 3 team members as test leads
- [ ] Kill switch tested on production
- [ ] Production URL documented in README

---

## Working rules for each phase

1. Read `CLAUDE.md`, the PRD section and TECH_SPEC section for the phase first.
2. Write tests for the phase alongside the code (not after the phase).
3. Commit small, with messages like `feat(webhook): verify meta signature`.
4. At the end of the phase, update the checklist in this file and add a short entry to `docs/CHANGELOG.md`.
