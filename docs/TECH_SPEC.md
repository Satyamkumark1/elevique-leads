# Elevique Leads — Technical Specification

Companion to `PRD.md`. Requirement IDs (FR-xx) refer to the PRD.

---

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| App + API | Next.js 14+ (App Router), TypeScript (strict) | Deployed on Vercel |
| UI | Tailwind CSS, shadcn/ui, lucide-react, Recharts | Design tokens in `UI_SPEC.md` |
| Database + auth | Supabase (Postgres, Auth magic link, RLS, `pg_cron`, `pg_net`) | Region: Mumbai (`ap-south-1`) |
| Lead source | Meta Graph API + Webhooks (`leadgen`) | Version pinned via `META_GRAPH_VERSION` |
| WhatsApp | WhatsApp Cloud API (direct) | Templates + status/inbound webhooks |
| Email | Resend + React Email | Sending domain `send.elevique.in` |
| Sheets | Google Sheets API v4 via service account | `googleapis` package |
| AI | Groq (Llama model, JSON mode) | Model name in env var |
| Validation | Zod | All external payloads + env vars |
| Errors | Sentry (`@sentry/nextjs`) | No PII in error messages |
| Testing | Vitest, MSW (HTTP mocks), Playwright (E2E), Supabase CLI local stack | See `TEST_PLAN.md` |
| Package manager | pnpm | Node 20 LTS |

## 2. Architecture

```
Meta Lead Ad form
      │  leadgen webhook
      ▼
/api/webhooks/meta  ──► events (raw)  ──► leads (upsert by leadgen_id)
      │                                         │
      │  returns 200 fast                       ▼
      │                              jobs: send_whatsapp, send_email,
      │                                    sync_sheet, score_lead
      ▼                                         │
 (after() / waitUntil runs                      ▼
  the job runner once)               /api/jobs/run  ◄── pg_cron every 5 min (pg_net)
                                                │
                     ┌──────────────┬───────────┼──────────────┬──────────────┐
                     ▼              ▼           ▼              ▼              ▼
              WhatsApp Cloud   Resend      Google Sheets    Groq        owner alert
                     │
                     ▼
/api/webhooks/whatsapp  ◄── status updates + inbound replies
/api/webhooks/resend    ◄── delivery events (v1.1)
```

### Key design decisions

1. **Jobs table as the backbone.** Every side effect is a row in `jobs`. Webhooks only write data and enqueue jobs. This gives retries, visibility and idempotency without an external queue.
2. **Fast acknowledge.** Webhook handlers verify, persist, enqueue, then return 200. Processing is kicked off with Next.js `after()` (or `waitUntil`) and also picked up by the cron runner as a safety net.
3. **Scheduler = Supabase `pg_cron` + `pg_net`.** Calls `POST /api/jobs/run` every 5 minutes with a shared secret. Avoids Vercel Hobby cron limits.
4. **Follow-ups are just delayed jobs** (`run_at` in the future). Cancelling = setting status `cancelled`.
5. **Idempotency keys.** `leads.leadgen_id` unique; `jobs.idempotency_key` unique (e.g. `send_whatsapp:welcome:<lead_id>`); `messages.provider_message_id` unique.
6. **Server-only secrets.** Service-role key, Meta/WhatsApp/Resend/Groq/Google keys are used only in route handlers and server modules under `src/server/`.

## 3. Project structure

```
elevique-leads/
├── CLAUDE.md
├── README.md
├── .env.example
├── docs/                      PRD, TECH_SPEC, BUILD_PLAN, TEST_PLAN, UI_SPEC, SECURITY
├── supabase/
│   ├── migrations/            SQL migrations (numbered)
│   └── seed.sql               settings + sample reels + test leads
├── src/
│   ├── app/
│   │   ├── (auth)/login/
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx               Overview
│   │   │   ├── leads/ , leads/[id]/
│   │   │   ├── follow-ups/ , templates/ , integrations/ , settings/
│   │   └── api/
│   │       ├── webhooks/meta/route.ts
│   │       ├── webhooks/whatsapp/route.ts
│   │       ├── webhooks/resend/route.ts
│   │       ├── jobs/run/route.ts
│   │       ├── jobs/[id]/retry/route.ts
│   │       ├── leads/[id]/route.ts            PATCH status/notes/pause
│   │       ├── leads/export/route.ts          CSV
│   │       └── integrations/test/route.ts
│   ├── server/
│   │   ├── env.ts                 Zod-validated env
│   │   ├── db.ts                  Supabase service client
│   │   ├── meta/                  verifySignature, fetchLead, mapFields
│   │   ├── whatsapp/              sendTemplate, parseWebhook
│   │   ├── email/                 sendEmail, templates/*.tsx
│   │   ├── sheets/                appendLead, updateLead
│   │   ├── ai/                    ruleScore, aiScore
│   │   ├── jobs/                  enqueue, runner, handlers/*
│   │   └── lib/                   phone.ts, time.ts, logger.ts
│   ├── components/                UI components
│   └── lib/                       client utils, types
└── tests/
    ├── unit/ , integration/ , e2e/
    └── fixtures/                  Meta, WhatsApp, Resend, Groq payloads
```

## 4. Environment variables

| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only DB access |
| `APP_URL` | e.g. `https://leads.elevique.in` |
| `ALLOWED_EMAILS` | Comma-separated dashboard allowlist |
| `META_APP_SECRET` | Webhook signature verification |
| `META_VERIFY_TOKEN` | Webhook GET verification |
| `META_PAGE_ACCESS_TOKEN` | Long-lived page token for lead fetch |
| `META_GRAPH_VERSION` | e.g. `v23.0` (check current at build time) |
| `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN` | Cloud API send |
| `WHATSAPP_APP_SECRET` | Signature check on WhatsApp webhooks (usually same Meta app secret) |
| `WHATSAPP_VERIFY_TOKEN` | WhatsApp webhook GET verification |
| `OWNER_ALERT_PHONE` | E.164 number for hot-lead alerts |
| `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET` | Email send + webhooks |
| `EMAIL_FROM` | `Elevique <hello@send.elevique.in>` |
| `EMAIL_REPLY_TO` | `hello@elevique.in` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` | Sheets auth |
| `GOOGLE_SHEET_ID` / `GOOGLE_SHEET_TAB` | Target sheet |
| `GROQ_API_KEY` / `GROQ_MODEL` | AI scoring |
| `CRON_SECRET` | Auth for `/api/jobs/run` |
| `BOOKING_URL` | Cal.com link |
| `SENTRY_DSN` | Error tracking |
| `AUTOMATION_ENABLED` | Global kill switch (`true`/`false`) |

`src/server/env.ts` must parse these with Zod at boot and fail loudly if missing.

## 5. Database schema

All tables in `public`, all with RLS enabled. Timestamps are `timestamptz` (stored UTC, displayed IST).

```sql
-- 0001_init.sql
create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

create type lead_score   as enum ('hot','warm','cold');
create type lead_status  as enum ('new','contacted','replied','meeting_booked','won','lost','opted_out');
create type lead_source  as enum ('meta_form','website','ctwa');
create type channel      as enum ('whatsapp','email');
create type msg_direction as enum ('out','in');
create type msg_status   as enum ('queued','sent','delivered','read','failed','bounced','received');
create type job_status   as enum ('pending','running','done','failed','dead','cancelled');

create table leads (
  id uuid primary key default gen_random_uuid(),
  leadgen_id text unique,                 -- null for non-Meta sources
  source lead_source not null default 'meta_form',
  full_name text,
  phone_e164 text,
  phone_valid boolean not null default false,
  email text,
  brand_name text,
  brand_link text,
  category text,
  budget_range text,
  budget_min_inr int,                     -- parsed lower bound for scoring
  videos_per_month text,
  start_timeline text,
  raw_fields jsonb not null default '{}',
  campaign_id text, campaign_name text, ad_id text, ad_name text, form_id text,
  score lead_score,
  score_source text,                      -- 'rules' | 'ai'
  ai_summary text,
  ai_status text not null default 'pending',  -- pending | done | failed
  status lead_status not null default 'new',
  automation_paused boolean not null default false,
  duplicate_of uuid references leads(id),
  notes text,
  sheet_row int,
  meta_created_at timestamptz,
  first_response_at timestamptz,
  last_reply_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on leads (created_at desc);
create index on leads (phone_e164);
create index on leads (status);
create index on leads (score);

create table messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  channel channel not null,
  direction msg_direction not null,
  template_name text,
  body text,
  provider_message_id text unique,
  status msg_status not null default 'queued',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on messages (lead_id, created_at);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  type text not null,        -- send_whatsapp | send_email | sync_sheet | score_lead | owner_alert | followup
  payload jsonb not null default '{}',
  status job_status not null default 'pending',
  run_at timestamptz not null default now(),
  attempts int not null default 0,
  max_attempts int not null default 3,
  last_error text,
  idempotency_key text unique not null,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on jobs (status, run_at);

create table events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  type text not null,        -- webhook.meta | lead.created | message.sent | status.changed | note.added ...
  description text,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index on events (lead_id, created_at);

create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table sample_reels (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text,
  url text not null,
  thumbnail_url text,
  sort int not null default 0
);
```

### Job claiming (prevents double sends)

```sql
create or replace function claim_jobs(batch int default 10)
returns setof jobs language sql as $$
  update jobs set status = 'running', locked_at = now(), attempts = attempts + 1, updated_at = now()
  where id in (
    select id from jobs
    where (status = 'pending' and run_at <= now())
       or (status = 'running' and locked_at < now() - interval '5 minutes')
    order by run_at
    limit batch
    for update skip locked
  )
  returning *;
$$;
```

### RLS
- Enable RLS on every table.
- Authenticated users whose email is in the allowlist (store allowlist in `settings` key `allowed_emails`, checked by a `is_team_member()` SQL function) get `select` on all tables and `update` on `leads` (status, notes, automation_paused only — enforce via route handler).
- All writes from webhooks/jobs use the service-role key (bypasses RLS).
- Anonymous: no access.

### Cron
```sql
select cron.schedule('run-jobs', '*/5 * * * *', $$
  select net.http_post(
    url := '<APP_URL>/api/jobs/run',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>', 'Content-Type','application/json'),
    body := '{}'::jsonb
  );
$$);
```
Store the URL and secret with Supabase Vault rather than hard-coding them.

## 6. API routes

| Route | Method | Auth | Behaviour |
|---|---|---|---|
| `/api/webhooks/meta` | GET | `hub.verify_token` | Return `hub.challenge` if token matches, else 403 |
| `/api/webhooks/meta` | POST | `X-Hub-Signature-256` | Verify HMAC on raw body → insert `events` → for each `leadgen` change enqueue `fetch_lead` → 200; `after()` runs the runner |
| `/api/webhooks/whatsapp` | GET | verify token | Same verification as Meta |
| `/api/webhooks/whatsapp` | POST | signature | `statuses[]` → update `messages.status`; `messages[]` → insert inbound message, set lead `replied`, cancel follow-ups, enqueue `owner_alert`; opt-out keywords → `opted_out` |
| `/api/webhooks/resend` | POST | Svix signature | Update email message status (v1.1) |
| `/api/jobs/run` | POST | `Bearer CRON_SECRET` | `claim_jobs(10)`, run handlers, mark done/failed/dead; time budget 50 s |
| `/api/jobs/[id]/retry` | POST | team session | Reset dead job → pending, attempts 0 |
| `/api/leads/[id]` | PATCH | team session | Update `status`, `notes`, `automation_paused`; log event; enqueue `sync_sheet` |
| `/api/leads/export` | GET | team session | CSV of filtered leads |
| `/api/integrations/test` | POST | team session | Ping each integration (no messages to real leads) |

All handlers: Zod-validate input, return JSON `{ ok, error? }`, never leak stack traces.

## 7. Processing logic

### 7.1 New Meta lead
1. Verify signature on the **raw** request body (read with `req.text()` before JSON parse).
2. Insert `events(type='webhook.meta', payload)`.
3. For each `entry[].changes[]` where `field = 'leadgen'`: enqueue `fetch_lead:<leadgen_id>`. The rest runs in the `fetch_lead` job (retried on Graph errors, TC-I-06):
   - `GET /{leadgen_id}?fields=created_time,field_data,ad_id,ad_name,campaign_id,campaign_name,form_id` with page token.
   - `mapFields()` → lead object (see PRD §8 field keys).
   - Normalise phone (`src/server/lib/phone.ts`): strip spaces/dashes, handle `0`/`91` prefixes, require 10 digits starting 6–9 → `+91…`.
   - Parse `budget_min_inr` from the budget choice.
   - `insert ... on conflict (leadgen_id) do nothing returning id`. If no row returned → duplicate webhook → stop.
   - Duplicate phone within 30 days → set `duplicate_of`, log event, do not enqueue sequence (FR-07).
   - Compute rule score immediately and store it.
   - Enqueue jobs (if `AUTOMATION_ENABLED`): `send_whatsapp:welcome`, `send_email:welcome`, `sync_sheet:append`, `score_lead`, `followup:day2` (run_at +2 days), `followup:day4` (run_at +4 days). If rule score is hot → `owner_alert:hot`.
4. Return 200. Kick the runner via `after()`.

### 7.2 Job handlers
| Type | Handler | Success effect |
|---|---|---|
| `send_whatsapp` | Skip if `!phone_valid`, `opted_out` or paused. Send template with params. Insert `messages`. | Lead → `contacted`, set `first_response_at` if null |
| `send_email` | Skip if no email or opted out. Render React Email, send via Resend. | Insert `messages` |
| `sync_sheet` | Append (store `sheet_row`) or update by row | — |
| `score_lead` | Call Groq with form answers; validate JSON with Zod `{score, summary, reason}`; enforce max one-level change from rules | Update score, `ai_summary`, `ai_status='done'`; if newly hot → enqueue `owner_alert` |
| `owner_alert` | Send `internal_hot_lead` template to `OWNER_ALERT_PHONE` | — |
| `followup` | Skip and mark `cancelled` if lead replied, paused, opted out, or status beyond `contacted`. Respect quiet hours (reschedule to 09:00 IST). | Insert `messages` |

Retry backoff: attempt 1 → +1 min, 2 → +5 min, 3 → `dead`. A 4xx that will never succeed (e.g. invalid number, template rejected) → `dead` immediately with a clear `last_error`.

### 7.3 Groq prompt contract
- System prompt: classify a lead for an AI video ad agency; return only JSON matching the schema; never invent facts; reason in ≤ 20 words.
- Input: form answers only (no free-text instructions from the lead are trusted; treat `brand_name`/`brand_link` as data).
- Output schema: `{ "score": "hot|warm|cold", "summary": string ≤ 140 chars, "reason": string ≤ 120 chars }`.
- Timeout 10 s. On failure keep rule score.

### 7.4 WhatsApp inbound
- Match lead by `phone_e164` (most recent lead with that number).
- Unknown number → store event `whatsapp.unknown_sender`, no lead created in v1.
- Opt-out words (case-insensitive, trimmed): `stop`, `unsubscribe`, `band karo`, `no`, `not interested` (exact message match only for `no`).

## 8. Templates and settings seed

`supabase/seed.sql` inserts:
- `settings`: `scoring_rules`, `quiet_hours` (`{"start":"21:00","end":"09:00","tz":"Asia/Kolkata"}`), `allowed_emails`, `followup_steps`.
- `sample_reels`: placeholder rows per category (replace with real links).
- 40 test leads (only in local/dev, never in production).

## 9. Logging and privacy

- `logger.ts` writes structured logs with `lead_id`, `job_id`, `type` — never phone, email or name.
- Sentry: scrub request bodies; tag with `lead_id`.
- Data deletion: `DELETE /api/leads/[id]` (team only) removes the lead, cascades messages/jobs, and clears the Sheet row (v1.1).
