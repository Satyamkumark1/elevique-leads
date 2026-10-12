# CLAUDE.md — Elevique Leads

You are building Elevique Leads: Meta Lead Ads → instant WhatsApp + email → AI scoring → Google Sheets → follow-ups → dashboard. Internal tool for Elevique's own leads (not multi-tenant).

## Read first
- `docs/PRD.md` — what and why (requirement IDs FR-xx)
- `docs/TECH_SPEC.md` — architecture, schema, routes, logic
- `docs/BUILD_PLAN.md` — phases and Definitions of Done
- `docs/TEST_PLAN.md` — test cases (TC-xx) and traceability
- `docs/UI_SPEC.md` — design system and pages
- `docs/SECURITY.md` — controls you must keep

## How to work
1. Work **one phase at a time** from `BUILD_PLAN.md`. Before coding, state which phase and which FR/TC IDs you are covering.
2. Write tests with the code. A phase is not done until its DoD boxes are ticked and `pnpm lint && pnpm typecheck && pnpm test` pass.
3. Never call real external APIs in tests. Mock with MSW using fixtures in `tests/fixtures/`.
4. Small commits, conventional messages: `feat(jobs): add claim_jobs runner`.
5. When a spec is unclear or two docs disagree, stop and ask — do not guess. Note the decision in `docs/DECISIONS.md`.
6. Update `docs/CHANGELOG.md` and tick boxes in `BUILD_PLAN.md` at the end of each phase.

## Commands
- `pnpm dev` — app
- `supabase start` / `supabase db reset` — local DB with migrations + seed
- `pnpm test` — unit + integration (Vitest)
- `pnpm test:e2e` — Playwright
- `pnpm test:ai-eval` — real Groq eval (needs key; not in CI)
- `pnpm lint`, `pnpm typecheck`

## Hard rules
- Verify signatures on **raw** body for every webhook. Never skip in "dev mode".
- Webhooks: verify → persist → enqueue → return 200. No slow work before responding.
- Every side effect goes through the `jobs` table with an `idempotency_key`. No direct sends from webhook handlers.
- Secrets and the service-role key only in `src/server/**` with `import 'server-only'`. Never `NEXT_PUBLIC_` a secret.
- Validate every external payload and env var with Zod.
- No phone numbers, emails or names in logs or Sentry. Log IDs only.
- Respect `AUTOMATION_ENABLED`, `automation_paused`, `opted_out` and quiet hours before any outbound message.
- AI output never goes to a lead and never changes score by more than one level.
- RLS enabled on every table; add a policy test for any new table.
- Graph API version comes from `META_GRAPH_VERSION`; never hard-code it.
- Times stored UTC, shown IST (`Asia/Kolkata`).

## Don't
- Don't add dependencies without a reason in the commit message.
- Don't build v2 features (AI chat, CAPI, multi-tenant) unless asked.
- Don't use glassmorphism, gradients, glow, emoji, or default shadcn styling in the UI.
- Don't seed test leads in production.
- Don't mark a phase done with failing or skipped tests.
