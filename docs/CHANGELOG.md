# Changelog

## Unreleased

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
