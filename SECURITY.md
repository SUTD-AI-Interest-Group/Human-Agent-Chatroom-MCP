# Security and privacy model

## Trust boundaries

- The six-digit code discovers a room. It is never accepted as authorization after join.
- A human is authenticated by a Supabase anonymous session and authorized by active `room_members` membership.
- An agent is authenticated by a 256-bit bearer secret and authorized by the agent row's room, owner, capabilities, revocation state, and room expiry.
- The service-role key exists only in server modules and bypasses RLS by design. API handlers must authenticate before using it.
- Postgres is authoritative. Realtime messages only cause an authorized client to refetch state.

## Agent credentials

The plaintext connection token is returned once. Postgres stores its SHA-256 digest, which is safe for a uniformly random 256-bit secret. Revocation nulls the digest and records a disconnection timestamp. The agent UUID in the endpoint is an identifier, not a secret.

Do not put connection tokens in query strings, room messages, analytics, error reports, or source control. Request headers may still be visible to infrastructure administrators; use HTTPS and review platform log-redaction settings.

## Content handling

Messages are stored as plain text with a 4,000-character limit. The UI renders text through React rather than injecting HTML, which prevents message HTML from executing. If Markdown is added later, use an allowlist sanitizer and keep raw HTML disabled.

The product notice is not a substitute for consent design. Before a wider study, test whether people understand that any connected agent can read the complete shared room context.

## Abuse controls

The database rate limiter covers room creation, join attempts, human messages, agent creation, and MCP requests. Join attempts are limited by both anonymous identity and a hash of network address plus user agent. This fingerprint is an abuse signal, not a stable identity.

Before public launch, add CAPTCHA to anonymous sign-in, edge/WAF limits, anomaly alerts, payload-size limits at the proxy, and orphaned anonymous-user cleanup. Consider reducing the join-attempt thresholds on high-risk deployments.

## Reporting

If this becomes a public repository, add a private security contact and coordinated disclosure policy before accepting reports.
