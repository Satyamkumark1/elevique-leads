-- Claim only job types the runner can handle (handlers ship phase by phase).
drop function claim_jobs(int);

create or replace function claim_jobs(batch int default 10, only_types text[] default null)
returns setof jobs language sql as $$
  update jobs set status = 'running', locked_at = now(), attempts = attempts + 1, updated_at = now()
  where id in (
    select id from jobs
    where ((status = 'pending' and run_at <= now())
        or (status = 'running' and locked_at < now() - interval '5 minutes'))
      and (only_types is null or type = any(only_types))
    order by run_at
    limit batch
    for update skip locked
  )
  returning *;
$$;
revoke execute on function claim_jobs(int, text[]) from public, anon, authenticated;
