# Changelog

## Unreleased

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
