# Elevique Leads — Product Requirements Document (PRD)

| Field | Value |
|---|---|
| Product | Elevique Leads (internal lead automation system) |
| Owner | Elevique, New Delhi |
| Version | 1.0 |
| Date | 12 Oct 2026 |
| Status | Ready for build |

---

## 1. Summary

Elevique runs Meta (Facebook/Instagram) Lead Ads to sell **AI video ads** to Indian D2C and e-commerce brands. Today, leads sit in Meta's Leads Center until someone checks them, and first contact is manual and slow.

Elevique Leads captures every Meta lead within seconds, automatically sends a WhatsApp message and a branded email from `elevique.in`, scores the lead with AI, mirrors everything to Google Sheets, runs follow-ups until the lead replies, and gives the team a dashboard to track and take over conversations.

## 2. Problem

- Leads go cold within minutes; manual first response takes hours.
- No single place to see lead quality, status, and message history.
- No consistent follow-up — warm leads are forgotten.
- No data on which ads produce good leads (not just many leads).

## 3. Goals and success metrics

| Goal | Metric | Target (first 60 days) |
|---|---|---|
| Instant first response | Median time from form submit → WhatsApp sent | < 30 seconds |
| Nothing lost | Leads in Meta vs leads in system | 100% match |
| Reliable delivery | WhatsApp + email send success rate | ≥ 98% (after retries) |
| Better follow-up | Leads receiving full follow-up sequence (if no reply) | 100% |
| Engagement | Reply rate on WhatsApp | Tracked; baseline then +20% |
| Quality visibility | Leads with AI score + summary | 100% |

## 4. Non-goals (v1)

- Multi-client / multi-tenant SaaS (only Elevique's own leads).
- AI holding free-form conversations with leads (human takes over on reply). Planned for v2.
- Sending lead quality back to Meta (Conversions API). Planned for v2.
- Website forms and Click-to-WhatsApp as lead sources. Planned for v2 (schema supports them already).
- Mobile app. Dashboard is responsive web only.

## 5. Users

| User | Needs |
|---|---|
| Founder / owner | See hot leads instantly, take over chats, see which ads work |
| Sales / team member | Work the lead list, update status, add notes, book calls |
| Developer (intern / Claude Code) | Clear specs, logs, retry tools when integrations fail |

## 6. Core user flow

1. A brand owner sees an Elevique AI video ad on Instagram and submits the Instant Form.
2. Meta sends a `leadgen` webhook to Elevique Leads.
3. The system fetches the full lead from the Graph API and saves it (deduplicated).
4. Within seconds, in parallel:
   - WhatsApp template with category-matched sample reels is sent.
   - Branded email (showreel, case studies, booking link) is sent from `elevique.in`.
   - A row is appended to the Google Sheet.
   - AI scores the lead Hot / Warm / Cold with a one-line summary.
5. Hot leads trigger an instant WhatsApp alert to the owner.
6. If the lead replies on WhatsApp → status becomes **Replied**, follow-ups stop, team is alerted to take over.
7. If no reply → follow-ups on Day 2 (case study) and Day 4 (free 15-sec sample offer).
8. Team tracks everything in the dashboard and moves leads to Meeting booked → Won / Lost.

## 7. Functional requirements

Priority: **P0** = required for launch, **P1** = launch if time allows, **P2** = later.

### 7.1 Lead capture (Meta)
| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Expose a webhook endpoint that passes Meta's GET verification (`hub.challenge`). | P0 |
| FR-02 | Verify `X-Hub-Signature-256` on every POST; reject invalid signatures with 401. | P0 |
| FR-03 | Store every raw webhook payload in `events` before processing. | P0 |
| FR-04 | Fetch full lead data (field_data, ad, campaign, form) from the Graph API using the `leadgen_id`. | P0 |
| FR-05 | Map form fields to lead columns (name, phone, email, brand, instagram/website, category, budget, videos/month, timeline). Unknown fields are kept in `raw_fields`. | P0 |
| FR-06 | Deduplicate: `leadgen_id` is unique; a repeat webhook must not create a second lead or resend messages. | P0 |
| FR-07 | Same phone number within 30 days → mark as duplicate submission, link to the original, do not restart the sequence. | P1 |
| FR-08 | Normalise Indian phone numbers to E.164 (`+91XXXXXXXXXX`); flag invalid numbers. | P0 |
| FR-09 | Respond to Meta within 5 seconds regardless of downstream work. | P0 |

### 7.2 Instant response
| ID | Requirement | Priority |
|---|---|---|
| FR-10 | Send an approved WhatsApp template to the lead with name, brand and sample-reel link for their category. | P0 |
| FR-11 | Send a branded email from `elevique.in` with showreel, 3–4 case studies, starting price line, and booking link. | P0 |
| FR-12 | Skip a channel if the contact detail is missing/invalid; log the reason. | P0 |
| FR-13 | Log every outbound message in `messages` with provider message ID and status. | P0 |
| FR-14 | Update WhatsApp message status from status webhooks (sent → delivered → read / failed). | P0 |
| FR-15 | Update email status from Resend webhooks (delivered, bounced, complained). | P1 |

### 7.3 Google Sheets
| ID | Requirement | Priority |
|---|---|---|
| FR-16 | Append one row per new lead: date, name, phone, email, brand, category, budget, timeline, score, status, campaign, ad. | P0 |
| FR-17 | Update the lead's row when score or status changes (lookup by lead ID column). | P1 |

### 7.4 AI scoring
| ID | Requirement | Priority |
|---|---|---|
| FR-18 | Apply rule-based score first (budget, timeline, has website/Instagram). | P0 |
| FR-19 | Call Groq to produce a one-line summary and confirm/adjust the score, returning strict JSON. | P0 |
| FR-20 | If AI fails or times out, keep the rule-based score and mark `ai_status = failed`. Never block messaging on AI. | P0 |
| FR-21 | Hot lead → WhatsApp alert to the configured owner number with name, brand, budget, and dashboard link. | P0 |

### 7.5 Follow-ups and replies
| ID | Requirement | Priority |
|---|---|---|
| FR-22 | On lead creation, schedule follow-ups: Day 2 (case study), Day 4 (free sample offer). | P0 |
| FR-23 | A scheduler runs every 5 minutes and sends due follow-ups. | P0 |
| FR-24 | Inbound WhatsApp message from a lead → status `replied`, cancel pending follow-ups, alert owner. | P0 |
| FR-25 | Reply "STOP" (or similar opt-out words) → mark `opted_out`, cancel follow-ups, never message again. | P0 |
| FR-26 | Team can pause/resume automation per lead. | P0 |
| FR-27 | Follow-ups are not sent between 9 PM and 9 AM IST; they shift to 9 AM. | P1 |

### 7.6 Dashboard
| ID | Requirement | Priority |
|---|---|---|
| FR-28 | Login restricted to an allowlist of team emails (Supabase Auth, magic link). | P0 |
| FR-29 | Overview: leads today, hot leads this week, reply rate, median first-response time, charts. | P0 |
| FR-30 | Leads table with filters (score, status, category, campaign, date), search, CSV export. | P0 |
| FR-31 | Lead detail: form answers, AI summary, full timeline, status change, notes, quick actions (WhatsApp link, email, booking link, pause). | P0 |
| FR-32 | Follow-ups queue with cancel action. | P1 |
| FR-33 | Templates page: WhatsApp templates + approval status, email preview, sample reels per category. | P1 |
| FR-34 | Integrations page: connection health, last event, test buttons, failed jobs with retry. | P0 |
| FR-35 | Settings: scoring thresholds, alert number, quiet hours. | P1 |

### 7.7 Reliability
| ID | Requirement | Priority |
|---|---|---|
| FR-36 | Every downstream action (WhatsApp, email, sheet, AI, alert) runs as a job with status and attempts. | P0 |
| FR-37 | Failed jobs retry with backoff (+1 min, +5 min); the 3rd failure → `dead`, visible in dashboard. | P0 |
| FR-38 | Manual "Retry" for dead jobs from the dashboard. | P0 |
| FR-39 | Errors reported to Sentry with lead ID (no personal data in error messages). | P1 |

## 8. Lead form (Meta Instant Form) — required questions

| Field key (in Meta form) | Question | Type |
|---|---|---|
| `full_name` | Full name | Prefill |
| `phone_number` | Phone number | Prefill |
| `email` | Email | Prefill |
| `brand_name` | Brand name | Short answer |
| `brand_link` | Instagram handle or website | Short answer |
| `category` | Product category | Multiple choice: Fashion, Beauty & personal care, Food & beverage, Electronics, Home & living, Other |
| `monthly_budget` | Monthly ad budget | Multiple choice: Under ₹25k, ₹25k–50k, ₹50k–1L, ₹1L–2L, ₹2L+ |
| `videos_per_month` | Videos needed per month | Multiple choice: 1–2, 3–5, 6–10, 10+ |
| `start_timeline` | When do you want to start? | Multiple choice: This week, This month, In 1–3 months, Just exploring |

The form must include Elevique's privacy policy link (Meta requirement) and a consent line for WhatsApp/email contact.

## 9. Scoring rules (v1 defaults, editable in Settings)

| Score | Rule |
|---|---|
| **Hot** | Has brand link AND budget ≥ ₹50k AND timeline is "This week" or "This month" |
| **Warm** | Has brand name AND (budget ≥ ₹25k OR timeline within 3 months), not Hot |
| **Cold** | Everything else (no brand, "Just exploring" with low budget, invalid details) |

AI may move a lead by **one level only** and must give a reason (e.g. brand link is not a real brand).

## 10. Message content (v1)

| Step | Channel | Template / content |
|---|---|---|
| Day 0 | WhatsApp | `welcome_samples`: "Hi {{1}}, thanks for your interest in AI video ads for {{2}}! Here are a few samples we made for {{3}} brands: {{4}}. Want a quick call to plan yours?" |
| Day 0 | Email | "AI video ads for {{brand}}": showreel, case studies, starting price, Cal.com link |
| Day 2 | WhatsApp | `followup_case_study`: short case study + link |
| Day 4 | WhatsApp | `followup_free_sample`: offer a free 15-sec sample video for their product |
| Hot alert | WhatsApp (to owner) | `internal_hot_lead`: name, brand, budget, timeline, dashboard link |

All WhatsApp templates must be approved by Meta before launch. Exact text is final once approved.

## 11. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Webhook responds < 5 s; first messages sent < 30 s (p95) |
| Availability | Serverless (Vercel + Supabase); no single always-on server |
| Security | Signature verification on all webhooks; secrets only in env vars; Supabase RLS on all tables; service-role key server-side only |
| Privacy | Comply with India's DPDP Act: consent captured on form, opt-out honoured, lead data deletable on request, no personal data in logs |
| Cost | Run on free tiers at launch; main variable cost is WhatsApp per-message charges |
| Observability | Every lead has a full event timeline; failed jobs visible and retryable |
| Accessibility | Dashboard keyboard-navigable, WCAG AA contrast |

## 12. Dependencies and risks

| Risk | Impact | Mitigation |
|---|---|---|
| Meta business verification / template approval delays | Can't send WhatsApp at launch | Start Phase 0 immediately; email still works |
| WhatsApp number currently on Business app | Number conflict with Cloud API | Decide: coexistence, new number, or BSP (see Open questions) |
| Vercel Hobby crons run only once a day | Follow-ups late | Use Supabase `pg_cron` + `pg_net` to call the job runner every 5 minutes |
| Email lands in spam | Low reach | SPF, DKIM, DMARC on `send.elevique.in`; warm up volume |
| Meta API version changes | Broken fetch | Graph API version in env var; integration tests with fixtures |

## 13. Open questions

| # | Question | Default assumed in specs |
|---|---|---|
| Q1 | Which WhatsApp number setup? | New number on Cloud API (direct from Meta) |
| Q2 | Should AI chat with leads after they reply? | No in v1 — human takes over |
| Q3 | Who uses the dashboard? | Owner + 1–3 team members (email allowlist) |
| Q4 | Booking tool? | Cal.com link (static) in v1 |

## 14. Release plan

| Release | Scope |
|---|---|
| v1.0 (MVP) | Phases 0–6 in BUILD_PLAN.md |
| v1.1 | Website form source, Resend status webhooks, quiet hours |
| v2.0 | AI conversation + booking, Click-to-WhatsApp source, Conversions API feedback to Meta |
