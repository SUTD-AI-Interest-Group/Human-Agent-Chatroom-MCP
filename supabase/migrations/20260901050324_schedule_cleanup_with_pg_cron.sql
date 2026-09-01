-- Move hourly room expiry off Vercel Cron and into Postgres.
--
-- Vercel's Hobby plan allows at most one cron run per day, which is too coarse
-- for rooms that expire on a 24-hour idle timer. pg_cron runs the cleanup inside
-- the database on the intended hourly cadence with no network hop and no plan
-- limit. /api/cron/cleanup stays in the app as a manual and backup trigger.

create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Idempotent reschedule: the select yields no rows the first time, so nothing
-- is unscheduled, and re-running the migration replaces the job cleanly.
select cron.unschedule('cleanup-expired-rooms')
from cron.job
where jobname = 'cleanup-expired-rooms';

-- The job runs as postgres, which owns public.cleanup_expired_rooms() and can
-- execute it despite the revoke from public/anon/authenticated.
select cron.schedule(
  'cleanup-expired-rooms',
  '17 * * * *',
  $$select public.cleanup_expired_rooms();$$
);

comment on function public.cleanup_expired_rooms() is
  'Called hourly by the pg_cron job cleanup-expired-rooms. /api/cron/cleanup calls it manually.';
