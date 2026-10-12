# Elevique Leads — UI Specification

## 1. Design system (strict)

Dark, editorial, premium — a luxury creative studio, not a generic SaaS template.

### Tokens (define in `globals.css` as CSS variables, map in Tailwind config)
| Token | Value | Use |
|---|---|---|
| `--bg` | `#0B0B0C` | Page background |
| `--surface` | `#141416` | Cards, sidebar |
| `--surface-2` | `#1C1C1F` | Hover, inputs, table header |
| `--border` | `#2A2A2E` | All borders (1px) |
| `--text` | `#F4F1EA` | Primary text (warm off-white) |
| `--text-muted` | `#8E8B85` | Secondary text |
| `--accent` | `#C9A96E` | Primary buttons, key numbers, focus ring — use sparingly |
| `--hot` | `#D9735B` | Hot score |
| `--warm` | `#D8A657` | Warm score |
| `--cold` | `#6B8BA4` | Cold score |
| `--success` | `#7FA77A` | Delivered/read, connected |
| `--error` | `#C85A5A` | Failed, dead, disconnected |

Badges: tinted background (token at ~15% opacity) with the token as text colour.

### Type
- Display: **Instrument Serif** (fallback Fraunces) — page titles, big stat numbers.
- UI/body: **Inter** — 14px base, 13px table text, 12px labels.
- Weights: 400 and 500 only.

### Layout and shape
- 8px spacing grid. Card radius 12px, controls 8px. 1px borders instead of shadows.
- Max content width 1440px; 24px page padding desktop, 16px mobile.

### Do NOT
Glassmorphism, blur, gradients, glow, neon, emoji, drop shadows, rainbow charts, default shadcn grey look, more than one accent-coloured button per view.

## 2. Shell
- **Sidebar** (240px, collapsible to 64px; becomes bottom tab bar under 768px): Overview, Leads, Follow-ups, Templates, Integrations, Settings. Active item: accent left border (no radius) + `--text`.
- **Top bar**: page title (serif, 28px), global search (by name, brand, phone), "Live" dot (green if a webhook arrived in the last 24h, grey otherwise, tooltip with time), user menu.

## 3. Pages

### 3.1 Overview `/`
- Stat cards (4): Leads today · Hot leads this week · Reply rate (7d) · Median first response (e.g. "8s").
- Charts (Recharts, 2–3 muted colours max): leads per day (30d line), leads by campaign (horizontal bar), score split (stacked bar).
- **Needs your attention**: leads with status `replied` and no outbound human message since the reply — name, brand, time since reply, "Open in WhatsApp" button.
- **Activity feed**: latest 20 events with icon, text, relative time.

### 3.2 Leads `/leads`
- Table columns: Name · Brand · Category · Budget · Score · Status · Source ad · WhatsApp · Email · Received.
- WhatsApp/Email columns: small icon with state colour (queued/sent/delivered/read/failed) + tooltip.
- Filters: score, status, category, campaign, date range. Search box. Filters stored in URL query params.
- Bulk select → change status, export CSV.
- Pagination 25 per page, sorted newest first.
- Row click → detail as right side sheet (desktop) or full page (mobile).
- Duplicate leads show a "Duplicate" tag linking to the original.

### 3.3 Lead detail `/leads/[id]`
- Header: name (serif), brand + link, score badge, status dropdown, "Automation: On/Paused" toggle.
- Cards: **Form answers** · **AI summary** (summary + reason + "scored by rules/AI") · **Contact** (phone with wa.me link, email).
- **Timeline**: all events, messages (in/out, with status) and follow-ups, newest at bottom, inbound messages visually distinct.
- Actions: Open in WhatsApp · Send email (mailto) · Copy booking link · Delete lead (confirm dialog).
- Notes: textarea, save on blur, shows last edited time.

### 3.4 Follow-ups `/follow-ups`
- Sequence strip: Day 0 → Day 2 → Day 4 with channel and template name.
- Queue table: lead, step, channel, scheduled time (IST), status, Cancel button.
- Note: "Sequences stop automatically when a lead replies or is paused."

### 3.5 Templates `/templates`
- WhatsApp template cards: name, category, approval status badge, preview with `{{n}}` variables highlighted.
- Email template: rendered preview in an iframe.
- Sample reels: grid grouped by category; add (URL + title), reorder, delete.

### 3.6 Integrations `/integrations`
- Cards: Meta Page · WhatsApp Cloud API · Resend (elevique.in) · Google Sheets · Groq — each with status, last successful event, "Test" button.
- Webhook health: last webhook time, 24h success rate.
- Jobs: tabs for Pending / Dead; dead rows show error and "Retry".
- Global "Automation enabled" indicator (reads env, not editable here).

### 3.7 Settings `/settings`
- Scoring rules: budget threshold per score, timeline options per score.
- Alerts: owner alert number, quiet hours.
- Team: allowlisted emails (add/remove).

## 4. States
- Every page: loading skeletons, empty state (e.g. "No leads yet — connect your Meta Page to start receiving leads" with link to Integrations), error state with retry.
- Toasts (bottom-right) for saves, status changes, retries.
- Times shown in IST, relative ("4 min ago") with absolute time on hover.

## 5. Accessibility
- WCAG AA contrast on all text against its background.
- Full keyboard navigation; visible focus ring in `--accent`.
- Icon-only buttons have `aria-label`. Status never shown by colour alone (always icon or text too).
