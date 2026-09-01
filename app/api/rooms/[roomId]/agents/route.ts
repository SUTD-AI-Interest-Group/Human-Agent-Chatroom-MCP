import { NextResponse } from "next/server";
import {
  ApiError,
  consumeRateLimit,
  createAdminClient,
  errorResponse,
  insertSystemMessage,
  readJson,
  requireActiveMembership,
  requireHuman,
} from "@/lib/api";
import { createAgentToken, hashAgentToken } from "@/lib/identity";
import {
  BLIPCHAT_MCP_SERVER_NAME,
  createMcpConnectionName,
} from "@/lib/mcp/client-config";
import { createAgentSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const admin = createAdminClient();

  try {
    const user = await requireHuman();
    const { roomId } = await context.params;
    await requireActiveMembership(admin, roomId, user.id);
    const parsed = createAgentSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Give the agent a valid display name.");
    await consumeRateLimit(admin, "create-agent", `${roomId}:${user.id}`, 10, 3_600);

    const token = createAgentToken();
    const { data: agent, error } = await admin
      .from("agents")
      .insert({
        room_id: roomId,
        owner_user_id: user.id,
        display_name: parsed.data.displayName,
        capabilities: parsed.data.capabilities,
        connection_token_hash: hashAgentToken(token),
        connection_status: "unavailable",
      })
      .select("*")
      .single();
    if (error) throw error;

    const { data: owner } = await admin
      .from("users")
      .select("display_name")
      .eq("id", user.id)
      .single();
    const endpoint = `${new URL(request.url).origin}/api/mcp/${agent.id}`;
    const connectionName = createMcpConnectionName(agent.display_name, agent.id);

    await Promise.all([
      insertSystemMessage(
        admin,
        roomId,
        `${agent.display_name} was connected by ${owner?.display_name ?? "a participant"}.`,
        { event: "agent_connected", agent_id: agent.id },
      ),
      admin.from("experiment_events").insert({
        room_id: roomId,
        actor_user_id: user.id,
        actor_agent_id: agent.id,
        event_name: "agent_connection_created",
      }),
    ]);

    return NextResponse.json(
      {
        agent: {
          ...agent,
          owner_display_name: owner?.display_name ?? "Anonymous guest",
        },
        endpoint,
        token,
        mcpServer: {
          name: BLIPCHAT_MCP_SERVER_NAME,
          connectionName,
          transport: "streamable-http",
        },
        configuration: {
          mcpServers: {
            [connectionName]: {
              type: "http",
              url: endpoint,
              headers: { Authorization: `Bearer ${token}` },
            },
          },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
