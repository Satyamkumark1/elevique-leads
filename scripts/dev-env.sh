#!/usr/bin/env bash
# Writes .env.local for local dev/CI from the running local Supabase stack.
# Provider values are fakes; tests mock every external API (MSW). Real keys go in Vercel.
set -euo pipefail
eval "$(supabase status -o env 2>/dev/null)"
cat > .env.local <<EOF
APP_URL=http://localhost:3000
AUTOMATION_ENABLED=false
CRON_SECRET=local-dev-cron-secret-0123456789
BOOKING_URL=https://cal.com/elevique/intro
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
META_APP_SECRET=local-meta-secret
META_VERIFY_TOKEN=local-meta-verify
META_PAGE_ACCESS_TOKEN=local-page-token
META_GRAPH_VERSION=v23.0
WHATSAPP_PHONE_NUMBER_ID=000000000000000
WHATSAPP_ACCESS_TOKEN=local-wa-token
WHATSAPP_APP_SECRET=local-meta-secret
WHATSAPP_VERIFY_TOKEN=local-wa-verify
OWNER_ALERT_PHONE=+919000000000
RESEND_API_KEY=re_local
EMAIL_FROM="Elevique <hello@send.elevique.in>"
EMAIL_REPLY_TO=hello@elevique.in
GOOGLE_SERVICE_ACCOUNT_EMAIL=local@example.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=local-key
GOOGLE_SHEET_ID=local-sheet
GOOGLE_SHEET_TAB=Leads
GROQ_API_KEY=gsk_local
GROQ_MODEL=llama-3.3-70b-versatile
EOF
echo "Wrote .env.local"
