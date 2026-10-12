-- 0001_init: schema from TECH_SPEC §5
create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

create type lead_score    as enum ('hot','warm','cold');
create type lead_status   as enum ('new','contacted','replied','meeting_booked','won','lost','opted_out');
create type lead_source   as enum ('meta_form','website','ctwa');
create type channel       as enum ('whatsapp','email');
create type msg_direction as enum ('out','in');
create type msg_status    as enum ('queued','sent','delivered','read','failed','bounced','received');
create type job_status    as enum ('pending','running','done','failed','dead','cancelled');

create table leads (
  id uuid primary key default gen_random_uuid(),
  leadgen_id text unique,
  source lead_source not null default 'meta_form',
  full_name text,
  phone_e164 text,
  phone_valid boolean not null default false,
  email text,
  brand_name text,
  brand_link text,
  category text,
  budget_range text,
  budget_min_inr int,
  videos_per_month text,
  start_timeline text,
  raw_fields jsonb not null default '{}',
  campaign_id text, campaign_name text, ad_id text, ad_name text, form_id text,
  score lead_score,
  score_source text,
  ai_summary text,
  ai_status text not null default 'pending',
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
  type text not null,
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
  type text not null,
  description text,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index on events (lead_id, created_at);
create index on events (type, created_at desc);

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

-- updated_at
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger leads_updated_at    before update on leads    for each row execute function set_updated_at();
create trigger messages_updated_at before update on messages for each row execute function set_updated_at();
create trigger jobs_updated_at     before update on jobs     for each row execute function set_updated_at();
create trigger settings_updated_at before update on settings for each row execute function set_updated_at();

-- Job claiming (prevents double sends)
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
revoke execute on function claim_jobs(int) from public, anon, authenticated;

-- Team allowlist lives in settings.allowed_emails (jsonb array of emails)
create or replace function is_team_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from settings s, jsonb_array_elements_text(s.value) e(email)
    where s.key = 'allowed_emails'
      and lower(e.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke execute on function is_team_member() from public, anon;
grant execute on function is_team_member() to authenticated;

-- RLS: team members read everything; only leads.status/notes/automation_paused are updatable.
-- Webhooks and jobs use the service role, which bypasses RLS.
alter table leads        enable row level security;
alter table messages     enable row level security;
alter table jobs         enable row level security;
alter table events       enable row level security;
alter table settings     enable row level security;
alter table sample_reels enable row level security;

create policy team_select on leads        for select to authenticated using (is_team_member());
create policy team_select on messages     for select to authenticated using (is_team_member());
create policy team_select on jobs         for select to authenticated using (is_team_member());
create policy team_select on events       for select to authenticated using (is_team_member());
create policy team_select on settings     for select to authenticated using (is_team_member());
create policy team_select on sample_reels for select to authenticated using (is_team_member());

create policy team_update on leads for update to authenticated
  using (is_team_member()) with check (is_team_member());
revoke update on leads from authenticated;
grant update (status, notes, automation_paused) on leads to authenticated;

-- Default settings (production too). Dev allowlist + test data live in seed.sql.
insert into settings (key, value) values
  ('allowed_emails', '[]'),
  ('scoring_rules', '{
     "hot":  {"min_budget_inr": 50000, "timelines": ["This week", "This month"], "requires_brand_link": true},
     "warm": {"min_budget_inr": 25000, "timelines": ["This week", "This month", "In 1–3 months"]}
   }'),
  ('quiet_hours', '{"start": "21:00", "end": "09:00", "tz": "Asia/Kolkata"}'),
  ('followup_steps', '[
     {"step": "day2", "template": "followup_case_study",  "delay_hours": 48},
     {"step": "day4", "template": "followup_free_sample", "delay_hours": 96}
   ]')
on conflict (key) do nothing;
