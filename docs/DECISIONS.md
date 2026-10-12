# Decisions

| Date | Decision | Why |
|---|---|---|
| 2026-10-12 | Internal tool for Elevique only (not multi-tenant) | Faster launch; no Meta App Review for other Pages |
| 2026-10-12 | Human takes over after lead replies | Keep v1 simple; AI chat in v2 |
| 2026-10-12 | Supabase pg_cron drives job runner | Vercel Hobby cron too infrequent |
| 2026-10-12 | Team allowlist source of truth is `settings.allowed_emails` (DB), not the `ALLOWED_EMAILS` env var. Proxy calls `is_team_member()`; login refuses non-team emails before sending a link | One list shared by proxy and RLS, editable from Settings (UI_SPEC 3.7) without a redeploy. Production: insert team emails into `settings` once |
| 2026-10-12 | Default `settings` rows live in the init migration; dev allowlist, sample reels and 40 test leads live in `seed.sql` | Production needs settings but must never get test leads (`db push` skips seeds) |
| 2026-10-12 | `leads` update restricted to `status, notes, automation_paused` by column grant as well as in route handlers | DB enforces it even if a handler is wrong |
| 2026-10-12 | Next.js 16: `src/proxy.ts` (renamed middleware); `cacheComponents` off | Every page is per-user behind auth; caching adds Suspense ceremony for no gain |
| 2026-10-12 | CI on Node 22 | Node 20 reached end of life in April 2026 |
| 2026-10-12 | Local Supabase `[analytics]` disabled | Its log container fails under Colima; not used by the app |
| 2026-10-12 | pg_cron runs the job runner every 5 min (FR-23) | Owner decision. `after()` still kicks the runner on each webhook, so first messages stay instant |
| 2026-10-12 | Backoff: +1 min, +5 min, dead on 3rd failure (TECH_SPEC/TC-U-19); FR-37 updated | Owner decision |
| 2026-10-12 | Lead fetch is a `fetch_lead` job, not inline in the webhook. The kill switch never blocks `fetch_lead` (ingest), only outbound/sequence jobs | Owner decision. Graph failures retry instead of losing leads (TC-I-06); webhook stays fast |
| 2026-10-12 | Quiet hours built in Phase 5 (v1) | Owner decision |
| 2026-10-12 | `claim_jobs(batch, only_types)` claims only job types the runner has handlers for | Lets handlers ship phase by phase without stubs marking real jobs `done` |
| 2026-10-12 | Duplicate-phone leads (FR-07) get only `sync_sheet` (Sheet mirrors every submission), no messages/score/follow-ups | "Do not restart the sequence" |
| 2026-10-12 | Welcome email is a plain HTML string with inline styles + escaping, not React Email | No extra deps or react-dom/server in route bundles; email clients need table HTML anyway |
| 2026-10-12 | Google Sheets via `fetch` + service-account JWT signed with `node:crypto`, not `googleapis` | ~40 lines vs a very large dependency; only 3 endpoints used |
| 2026-10-12 | Sheet writes use `valueInputOption=RAW` (text stored literally) instead of `'`-prefixing | RAW never evaluates formulas, and doesn't show a stray apostrophe; CSV export still prefixes (TC-I-35) |
| 2026-10-12 | Sheet row found by lead ID in column A before update/append | Survives people sorting the Sheet; a retried append never duplicates a row |
| 2026-10-12 | `AUTOMATION_ENABLED=false` → runner does not claim outbound job types; they stay `pending`, nothing is lost. Sheet sync and scoring keep running | Kill switch stops messages, not bookkeeping |
| 2026-10-12 | 5th WhatsApp template `internal_lead_replied` for reply alerts to the owner | `internal_hot_lead` text says "hot lead"; owner alerts outside the 24h window need an approved template |
| 2026-10-12 | Email copy (showreel, price line, case studies) lives in `settings.email_content`; empty → `send_email` jobs go dead | Never send invented prices or placeholders to real leads |
| 2026-10-12 | `messages.job_id` (unique) guards against resending on retry; Resend gets `Idempotency-Key` = job key | Idempotency per side effect (CLAUDE.md) |
