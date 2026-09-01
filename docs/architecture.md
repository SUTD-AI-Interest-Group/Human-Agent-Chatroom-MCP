# Architecture decisions

## Identity and room authorization

Supabase anonymous auth provides the stable per-browser UUID without asking for PII. The signed auth session establishes who the browser is; `room_members` establishes which room that identity may enter. Every human API request verifies the user with Supabase before the service-role client performs a mutation.

This is stronger than treating the six-digit room code as a password. A leaked code can invite a new member, but it cannot be used as an existing member or agent credential.

## Realtime delivery

The `messages` and `agents` tables broadcast row changes to `room:<uuid>` through `realtime.broadcast_changes()`. Clients subscribe using a private channel. Policies on `realtime.messages` extract the room UUID from the topic and call `is_room_member`.

Broadcasts are treated as invalidation signals, not trusted records. This makes the client robust to missed or duplicate events and keeps one Postgres representation authoritative. Presence shares the same authorized topic but remains ephemeral.

## MCP serving model

The current MCP revision is stateless, which maps cleanly to Vercel functions. `createMcpHandler` builds a request-scoped server and also serves legacy stateless clients. Authentication happens before MCP dispatch, and the handler factory closes over an immutable authenticated agent identity.

No tool accepts `room_id`, `sender_agent_id`, `owner_user_id`, or timestamps from the model. Those values come from server state. Tool registration also follows each agent's declared capabilities.

The message identity cursor is a Postgres `bigint generated always as identity`, giving polling a stable total order. UUID message IDs would not safely encode insertion order.

## Expiry

Activity extends a room to the earlier of `now + 24 hours` or `created_at + 7 days`. The API rejects expired rooms immediately, even before physical deletion. An authenticated Vercel Cron route calls `cleanup_expired_rooms()` hourly; cascading foreign keys remove room content and credentials.

Anonymous, non-content experiment events deliberately keep random room and actor UUIDs without foreign keys. That preserves session grouping, response latency, and repeat-browser measurements after ephemeral content is deleted, without retaining names or message bodies.

## Why there is no native model yet

The experiment is specifically testing whether a shared room is a useful coordination layer for externally owned agents. A built-in model would introduce another actor and make the first result harder to interpret. The Vercel AI SDK belongs in a later, separate feature flag for synthesis or facilitation.

## Next experiments

1. Compare complete prior context with messages only after agent connection.
2. Add an explicit human-approved context window per invocation.
3. Measure mention delivery, acknowledgement, response latency, and abandonment.
4. Add MCP OAuth for hosted clients and short-lived rotated access tokens.
5. Test webhooks or a durable event gateway only if polling latency harms the core loop.
