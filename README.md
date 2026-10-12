# Elevique Leads

Internal lead automation for Elevique: Meta Lead Ads → instant WhatsApp + email from elevique.in → AI scoring → Google Sheets → automatic follow-ups → team dashboard.

## Documents
| File | What's in it |
|---|---|
| `CLAUDE.md` | Rules for Claude Code |
| `docs/PRD.md` | Requirements, goals, scope |
| `docs/TECH_SPEC.md` | Architecture, database, API routes, logic |
| `docs/BUILD_PLAN.md` | Phases 0–7 with Definitions of Done |
| `docs/TEST_PLAN.md` | Unit, integration, E2E, AI eval, launch checklist |
| `docs/UI_SPEC.md` | Design system and page specs |
| `docs/SECURITY.md` | Threats, controls, privacy |

## Start building with Claude Code
1. Create a folder, copy these files in, run `git init`.
2. Finish Phase 0 in `docs/BUILD_PLAN.md` (accounts, tokens, templates, DNS).
3. Copy `.env.example` to `.env.local` and fill it in.
4. Open Claude Code in the folder and say:
   > Read CLAUDE.md and all files in docs/. Then start Phase 1 from BUILD_PLAN.md. List the FR and TC IDs you will cover before writing code.
5. After each phase, check its Definition of Done yourself before saying "start Phase N".

## Local development
```bash
pnpm install
supabase start              # local Postgres/Auth/Mailpit; applies migrations + seed
./scripts/dev-env.sh        # writes .env.local (local Supabase keys + fake provider values)
pnpm dev                    # http://localhost:3000 — sign in as you@elevique.in
```
The dashboard opens directly; application authentication is disabled.

Checks: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` (tests need `supabase start`).

## Production setup (once, after Phase 0)
1. **Supabase (Mumbai):** `supabase link --project-ref <ref>` → `supabase db push` (migrations only; seed is never pushed).
2. **Vercel env (Production + Preview):** every var in `.env.example` with real values; `AUTOMATION_ENABLED=false` until step 6. `CRON_SECRET`: `openssl rand -hex 32`.
3. **Runner schedule:** in the SQL editor:
   ```sql
   select vault.create_secret('https://<prod-domain>', 'app_url');
   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
   ```
   The `run-jobs` cron (every 5 min) is created by the migration and stays a no-op until both secrets exist. Check: `select * from cron.job_run_details order by start_time desc limit 5;`
4. **Meta webhook:** App → Webhooks → Page → callback `<prod>/api/webhooks/meta`, verify token = `META_VERIFY_TOKEN`, subscribe to `leadgen`; subscribe the Page to the app (`POST /{page_id}/subscribed_apps?subscribed_fields=leadgen`).
5. **WhatsApp webhook:** callback `<prod>/api/webhooks/whatsapp`, verify token = `WHATSAPP_VERIFY_TOKEN`, subscribe to `messages`.
6. **Content:** Templates page → fill the welcome email (showreel, price line, case studies) and sample reels per category. Integrations → press every **Test** button. Then set `AUTOMATION_ENABLED=true` and redeploy.

Sheet header row (row 1, tab `GOOGLE_SHEET_TAB`): `Lead ID | Received (IST) | Name | Phone | Email | Brand | Category | Budget | Timeline | Score | Status | Campaign | Ad`.

WhatsApp templates to submit (exact text and variable order): `src/server/whatsapp/templates.ts`, also shown on the Templates page.

**Production URL:** _not deployed yet: add it here after the first production deploy._

## Runbook
| Situation | Do this |
|---|---|
| **Stop all messages now** | Vercel → env `AUTOMATION_ENABLED=false` → redeploy. Leads keep being saved; outbound jobs wait as `pending` and resume when re-enabled (follow-ups re-check reply/pause rules before sending). |
| Pause one lead | Lead detail → **Automation** toggle. Pending follow-ups are cancelled; resuming restores them. |
| Messages failing | Integrations → **Dead** tab → read the error → fix the cause (token, template, content) → **Retry**. |
| Is the runner running? | Integrations shows last success per provider; SQL: `select * from cron.job_run_details order by start_time desc limit 5;` Manual run: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" <prod>/api/jobs/run`. |
| Rotate a token / secret | Create new in provider → update in Vercel (Production + Preview) → redeploy → revoke old → Integrations **Test**. For `CRON_SECRET` also update the Vault secret: `select vault.update_secret((select id from vault.secrets where name='cron_secret'), '<new>');` |
| Lead asks to be deleted (DPDP) | Lead detail → **Delete lead** (removes lead, messages, jobs). Remove their Sheet row by hand (automatic in v1.1). |
| Lead says STOP by email | Set status **Opted out** on the lead; nothing more is sent on any channel. |
| Errors | Sentry (no PII: bodies, headers, users stripped; IDs only). Logs in Vercel are JSON with IDs only. |
