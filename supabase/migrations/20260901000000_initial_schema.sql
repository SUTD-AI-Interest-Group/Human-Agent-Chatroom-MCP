create extension if not exists pgcrypto;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 32),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code char(6) not null unique check (code ~ '^\d{6}$'),
  status text not null default 'active' check (status in ('active', 'closed', 'expired')),
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  last_activity_at timestamptz not null default now(),
  message_retention_seconds integer not null default 604800
    check (message_retention_seconds between 3600 and 604800),
  constraint room_hard_maximum check (expires_at <= created_at + interval '7 days')
);

create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  status text not null default 'offline' check (status in ('online', 'offline')),
  primary key (room_id, user_id)
);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  owner_user_id uuid not null references public.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 32),
  connection_status text not null default 'unavailable'
    check (connection_status in ('online', 'working', 'idle', 'unavailable')),
  capabilities jsonb not null default '["read_context", "read_messages", "send_messages", "status"]'::jsonb,
  connection_token_hash text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  disconnected_at timestamptz,
  constraint agent_owner_is_room_member foreign key (room_id, owner_user_id)
    references public.room_members(room_id, user_id) on delete cascade
);

create unique index agents_active_token_hash_idx
  on public.agents(connection_token_hash)
  where connection_token_hash is not null;
create index agents_room_idx on public.agents(room_id, created_at);

create table public.messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_user_id uuid references public.users(id) on delete cascade,
  sender_agent_id uuid references public.agents(id) on delete cascade,
  sender_type text not null check (sender_type in ('human', 'agent', 'system')),
  body text not null check (char_length(body) between 1 and 4000),
  reply_to_message_id bigint references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint valid_message_sender check (
    (sender_type = 'human' and sender_user_id is not null and sender_agent_id is null)
    or (sender_type = 'agent' and sender_agent_id is not null and sender_user_id is null)
    or (sender_type = 'system' and sender_user_id is null and sender_agent_id is null)
  )
);

create index messages_room_cursor_idx on public.messages(room_id, id);
create index messages_room_created_idx on public.messages(room_id, created_at desc);

create table public.message_mentions (
  message_id bigint not null references public.messages(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  mention_text text not null,
  status text not null default 'pending' check (status in ('pending', 'seen', 'responded', 'failed')),
  created_at timestamptz not null default now(),
  primary key (message_id, agent_id)
);

create table public.agent_invocations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  trigger_message_id bigint not null references public.messages(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'working', 'completed', 'failed', 'cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique (agent_id, trigger_message_id)
);

create table public.experiment_events (
  id bigint generated always as identity primary key,
  room_id uuid,
  actor_user_id uuid,
  actor_agent_id uuid,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index experiment_events_name_created_idx
  on public.experiment_events(event_name, created_at desc);

create table public.audit_events (
  id bigint generated always as identity primary key,
  room_id uuid,
  actor_user_id uuid,
  actor_agent_id uuid,
  action text not null,
  outcome text not null check (outcome in ('success', 'failure')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.rate_limit_buckets (
  scope text not null,
  key text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1,
  primary key (scope, key)
);

create or replace function public.is_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_room_id is not null and exists (
    select 1
    from public.room_members member
    join public.rooms room on room.id = member.room_id
    where member.room_id = target_room_id
      and member.user_id = (select auth.uid())
      and member.left_at is null
      and room.status = 'active'
      and room.expires_at > now()
  );
$$;

create or replace function public.shares_room_with(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select other_user_id = (select auth.uid()) or exists (
    select 1
    from public.room_members mine
    join public.room_members theirs on theirs.room_id = mine.room_id
    join public.rooms room on room.id = mine.room_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = other_user_id
      and mine.left_at is null
      and theirs.left_at is null
      and room.status = 'active'
      and room.expires_at > now()
  );
$$;

create or replace function public.room_id_from_realtime_topic(topic text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when topic ~ '^room:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then substring(topic from 6)::uuid
    else null
  end;
$$;

create or replace function public.consume_rate_limit(
  p_scope text,
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  insert into public.rate_limit_buckets as bucket (
    scope, key, window_started_at, request_count
  ) values (
    p_scope, p_key, now(), 1
  )
  on conflict (scope, key) do update set
    window_started_at = case
      when bucket.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then now()
      else bucket.window_started_at
    end,
    request_count = case
      when bucket.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then 1
      else bucket.request_count + 1
    end
  returning request_count into current_count;

  return current_count <= p_limit;
end;
$$;

create or replace function public.cleanup_expired_rooms()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  insert into public.experiment_events (room_id, actor_user_id, event_name, properties)
  select
    room.id,
    room.created_by,
    'room_expired',
    jsonb_build_object(
      'lifetime_seconds', extract(epoch from (now() - room.created_at))::bigint,
      'idle_seconds', extract(epoch from (now() - room.last_activity_at))::bigint
    )
  from public.rooms room
  where room.expires_at <= now() or room.status in ('closed', 'expired');

  delete from public.rooms
  where expires_at <= now() or status in ('closed', 'expired');
  get diagnostics deleted_count = row_count;

  delete from public.rate_limit_buckets
  where window_started_at < now() - interval '2 days';

  return deleted_count;
end;
$$;

create or replace function public.broadcast_room_row_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room_id uuid;
begin
  target_room_id := coalesce(new.room_id, old.room_id);
  perform realtime.broadcast_changes(
    'room:' || target_room_id::text,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$$;

create trigger broadcast_message_changes
after insert or update or delete on public.messages
for each row execute function public.broadcast_room_row_changes();

create trigger broadcast_agent_changes
after insert or update or delete on public.agents
for each row execute function public.broadcast_room_row_changes();

alter table public.users enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.agents enable row level security;
alter table public.messages enable row level security;
alter table public.message_mentions enable row level security;
alter table public.agent_invocations enable row level security;
alter table public.experiment_events enable row level security;
alter table public.audit_events enable row level security;
alter table public.rate_limit_buckets enable row level security;

create policy "users can read shared-room profiles"
on public.users for select to authenticated
using (public.shares_room_with(id));

create policy "members can read rooms"
on public.rooms for select to authenticated
using (public.is_room_member(id));

create policy "members can read memberships"
on public.room_members for select to authenticated
using (public.is_room_member(room_id));

create policy "members can read room agents"
on public.agents for select to authenticated
using (public.is_room_member(room_id));

create policy "members can read room messages"
on public.messages for select to authenticated
using (public.is_room_member(room_id));

create policy "members can read room mentions"
on public.message_mentions for select to authenticated
using (
  exists (
    select 1 from public.messages message
    where message.id = message_id and public.is_room_member(message.room_id)
  )
);

create policy "members can read invocations"
on public.agent_invocations for select to authenticated
using (public.is_room_member(room_id));

create policy "room members can receive realtime events"
on realtime.messages for select to authenticated
using (
  extension in ('broadcast', 'presence')
  and public.is_room_member(public.room_id_from_realtime_topic((select realtime.topic())))
);

create policy "room members can send realtime presence"
on realtime.messages for insert to authenticated
with check (
  extension = 'presence'
  and public.is_room_member(public.room_id_from_realtime_topic((select realtime.topic())))
);

revoke all on function public.consume_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.cleanup_expired_rooms()
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer)
  to service_role;
grant execute on function public.cleanup_expired_rooms()
  to service_role;
grant execute on function public.is_room_member(uuid) to authenticated;
grant execute on function public.shares_room_with(uuid) to authenticated;
grant execute on function public.room_id_from_realtime_topic(text) to authenticated;

revoke all on public.experiment_events from anon, authenticated;
revoke all on public.audit_events from anon, authenticated;
revoke all on public.rate_limit_buckets from anon, authenticated;

comment on table public.rooms is 'Ephemeral rooms. Application code extends idle expiry up to the seven-day hard maximum.';
comment on column public.agents.connection_token_hash is 'SHA-256 hash of a high-entropy bearer secret; plaintext is returned exactly once.';
comment on function public.cleanup_expired_rooms() is 'Called hourly by the authenticated Vercel cron route.';
