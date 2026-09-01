import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateAgent } from "@/lib/mcp/auth";
import { buildMcpHandler } from "@/lib/mcp/server";
import { consumeRateLimit } from "@/lib/api";

async function handle(
  request: Request,
  context: { params: Promise<{ agentId: string }> },
) {
  const admin = createAdminClient();
  const { agentId } = await context.params;
  const agent = await authenticateAgent(admin, request, agentId);
  if (!agent) {
    return NextResponse.json(
      { error: "Invalid, revoked, or expired agent credential." },
      {
        status: 401,
        headers: { "WWW-Authenticate": 'Bearer realm="blipchat"' },
      },
    );
  }

  try {
    await consumeRateLimit(admin, "mcp-request", agent.id, 300, 60);
  } catch {
    return NextResponse.json({ error: "Agent request rate limit exceeded." }, { status: 429 });
  }

  const handler = buildMcpHandler(admin, agent);
  return handler.fetch(request);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
