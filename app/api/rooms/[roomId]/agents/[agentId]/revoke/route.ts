import { NextResponse } from "next/server";
import {
  ApiError,
  createAdminClient,
  errorResponse,
  insertSystemMessage,
  requireActiveMembership,
  requireHuman,
} from "@/lib/api";

export async function POST(
  _request: Request,
  context: { params: Promise<{ roomId: string; agentId: string }> },
) {
  const admin = createAdminClient();

  try {
    const user = await requireHuman();
    const { roomId, agentId } = await context.params;
    const { room } = await requireActiveMembership(admin, roomId, user.id);
    const { data: agent } = await admin
      .from("agents")
      .select("id, display_name, owner_user_id, disconnected_at, created_at")
      .eq("id", agentId)
      .eq("room_id", roomId)
      .maybeSingle();
    if (!agent) throw new ApiError(404, "Agent not found.");
    if (agent.owner_user_id !== user.id && room.created_by !== user.id) {
      throw new ApiError(403, "Only the agent owner or room creator can revoke it.");
    }
    if (agent.disconnected_at) return NextResponse.json({ ok: true });

    await admin
      .from("agents")
      .update({
        disconnected_at: new Date().toISOString(),
        connection_status: "unavailable",
        connection_token_hash: null,
      })
      .eq("id", agentId);
    await Promise.all([
      insertSystemMessage(admin, roomId, `${agent.display_name} was disconnected.`, {
        event: "agent_revoked",
        agent_id: agentId,
      }),
      admin.from("experiment_events").insert({
        room_id: roomId,
        actor_user_id: user.id,
        actor_agent_id: agentId,
        event_name: "agent_revoked",
        properties: {
          active_duration_ms: Date.now() - new Date(agent.created_at).getTime(),
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
