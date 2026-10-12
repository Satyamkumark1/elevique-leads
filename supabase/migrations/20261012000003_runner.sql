-- Phase 3: job runner support.

-- Which job produced an outbound message: a retried job never sends twice.
alter table messages add column job_id uuid references jobs(id) on delete set null;
create unique index messages_job_id_key on messages (job_id);

-- Email copy the owner must fill in before launch. Empty values make send_email jobs go `dead` (visible), never send placeholders.
insert into settings (key, value) values
  ('email_content', '{"showreel_url": "", "starting_price_line": "", "case_studies": []}')
on conflict (key) do nothing;

-- Runner schedule: every 5 min (DECISIONS 2026-10-12). URL and secret come from Vault:
--   select vault.create_secret('https://leads.elevique.in', 'app_url');
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
-- Without those secrets the job is a no-op (local dev, CI).
select cron.schedule('run-jobs', '*/5 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/jobs/run',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'app_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'cron_secret');
$$);
