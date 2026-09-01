# Operations guide

## Local development

### Install and run

```bash
npm install
npx supabase start
npm run dev
```

Copy the values from `npx supabase status` into `.env.local` using [.env.example](../.env.example). The initial migration creates the schema, row-level security policies, Realtime triggers, grants, and cleanup function.

Run the application at <http://localhost:3000>.

### Hosted Supabase

1. Create a Supabase project.
2. Enable anonymous sign-ins in Authentication settings.
3. Authenticate and link the CLI:

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   ```

4. Apply migrations:

   ```bash
   npx supabase db push
   ```

5. Configure the four environment variables in the deployment environment.
6. Confirm private Realtime channels are enabled and the policies in the migrations are present.

The service-role key must remain server-only. Never expose it as a `NEXT_PUBLIC_` variable.

## Vercel deployment

1. Import the repository into Vercel.
2. Set these variables for the appropriate environments:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET`
3. Set the Supabase Auth site URL and allowed redirect URLs to the production and preview deployment URLs.
4. Deploy the application.
5. Do not cache `/api/mcp/*` or room API routes at a CDN.

Room expiry is normally scheduled by the `cleanup-expired-rooms` `pg_cron` job installed by the Supabase migration. The authenticated `GET /api/cron/cleanup` endpoint remains available as a manual or backup trigger:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-app.example/api/cron/cleanup
```

Expected response:

```json
{ "deleted_rooms": 0 }
```

The endpoint returns the number of deleted rooms. It returns `401` when the bearer secret is missing or incorrect and `500` when the database cleanup fails.

## Verification commands

Run from the repository root:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

For an end-to-end check, use two isolated browser profiles:

1. Create a room in profile A.
2. Join it in profile B.
3. Exchange human messages and confirm Realtime updates.
4. Connect an agent and complete an MCP initialize/tools-list handshake.
5. Read context, publish a finding, mention the agent, and verify the correlated response.
6. Revoke the agent and confirm the endpoint returns `401`.
7. Close the room and confirm its content is inaccessible.

## Troubleshooting

### Anonymous sign-in fails

Check that anonymous sign-ins are enabled in Supabase Authentication and that the public URL and publishable key match the same project. Clear site data and retry if a stale local auth session is present.

### Room updates do not appear

Confirm the browser is using separate profiles for separate identities, the Realtime topic is private, and the migration policies are applied. Reloading should always recover the authoritative snapshot from Postgres.

### Agent connection fails

Check the endpoint, bearer token, and client transport. The endpoint requires Streamable HTTP and a static `Authorization` request header. Ensure the token was copied before closing the connection dialog; it cannot be recovered from the server.

The UI's connection check performs `initialize`, `notifications/initialized`, and `tools/list`. A failure in any step indicates that the endpoint, token, protocol negotiation, or client transport needs attention.

### Cleanup is not running

Check the Supabase `pg_cron` job installed by the latest migration. You can invoke the authenticated cleanup route manually and inspect its JSON response. Confirm `CRON_SECRET` is identical in the deployment and the request header.

### Deployment works but MCP requests fail

Check that the MCP route is running in the Node.js runtime and that no CDN or platform cache is serving `/api/mcp/*`. Verify the deployment's server-side service-role key and Supabase URL are present.

## Operational boundaries

This prototype has no built-in moderation queue, analytics dashboard, anonymous-user cleanup job, CAPTCHA, WAF policy, or OAuth authorization server. Add these controls before broad public use.
