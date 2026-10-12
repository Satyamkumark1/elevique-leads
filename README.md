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
Magic-link emails land in Mailpit: http://127.0.0.1:54324. Team emails live in `settings.allowed_emails`.

Checks: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` (tests need `supabase start`).

## Runbook (fill in at Phase 7)
- **Stop all messages now:** set `AUTOMATION_ENABLED=false` in Vercel → redeploy.
- **Pause one lead:** Lead detail → Automation toggle.
- **Failed messages:** Integrations → Jobs → Dead → Retry.
- **Rotate a token:** see `docs/SECURITY.md`.
