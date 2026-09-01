-- Close the default PUBLIC execute grant that Postgres attaches to every new
-- function. Without this, `anon` reaches these SECURITY DEFINER routines through
-- PostgREST at /rest/v1/rpc/<name>, which the Supabase advisor flags as
-- 0028_anon_security_definer_function_executable.

-- Trigger-only function. It is never a legitimate RPC target, and EXECUTE is
-- checked when the trigger is defined rather than when it fires, so the existing
-- broadcast triggers keep working without any grant.
revoke all on function public.broadcast_room_row_changes() from public, anon, authenticated;

-- RLS helpers. These are called while evaluating policies as the querying role,
-- so `authenticated` still needs EXECUTE; `anon` never does.
revoke all on function public.is_room_member(uuid) from public, anon;
revoke all on function public.shares_room_with(uuid) from public, anon;
revoke all on function public.room_id_from_realtime_topic(text) from public, anon;

grant execute on function public.is_room_member(uuid) to authenticated;
grant execute on function public.shares_room_with(uuid) to authenticated;
grant execute on function public.room_id_from_realtime_topic(text) to authenticated;
