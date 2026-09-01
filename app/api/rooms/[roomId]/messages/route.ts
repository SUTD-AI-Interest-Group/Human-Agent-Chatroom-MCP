import { NextResponse } from "next/server";
import {
  ApiError,
  consumeRateLimit,
  createAdminClient,
  errorResponse,
  getRoomSnapshot,
  readJson,
  requireActiveMembership,
  requireHuman,
  touchRoom,
} from "@/lib/api";
import { sendHumanMessageSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const admin = createAdminClient();

  try {
    const user = await requireHuman();
    const { roomId } = await context.params;
    const { room } = await requireActiveMembership(admin, roomId, user.id);
    const parsed = sendHumanMessageSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(400, "Messages must be between 1 and 4,000 characters.");
    await consumeRateLimit(admin, "human-message", `${roomId}:${user.id}`, 50, 60);

    const { body, replyToMessageId, mentionAgentIds } = parsed.data;
    if (replyToMessageId) {
      const { data: reply } = await admin
        .from("messages")
        .select("id")
        .eq("id", replyToMessageId)
        .eq("room_id", roomId)
        .maybeSingle();
      if (!reply) throw new ApiError(400, "The replied-to message is not in this room.");
    }

    let validAgentIds: string[] = [];
    if (mentionAgentIds.length) {
      const { data: agents } = await admin
        .from("agents")
        .select("id")
        .eq("room_id", roomId)
        .in("id", mentionAgentIds)
        .is("disconnected_at", null);
      validAgentIds = (agents ?? []).map((agent) => agent.id);
      if (validAgentIds.length !== new Set(mentionAgentIds).size) {
        throw new ApiError(400, "One of the mentioned agents is unavailable.");
      }
    }

    const { data: message, error } = await admin
      .from("messages")
      .insert({
        room_id: roomId,
        sender_user_id: user.id,
        sender_type: "human",
        body,
        reply_to_message_id: replyToMessageId ?? null,
        metadata: {},
      })
      .select("id")
      .single();
    if (error) throw error;

    if (validAgentIds.length) {
      await Promise.all([
        admin.from("message_mentions").insert(
          validAgentIds.map((agentId) => ({
            message_id: message.id,
            agent_id: agentId,
            mention_text: body,
            status: "pending",
          })),
        ),
        admin.from("agent_invocations").insert(
          validAgentIds.map((agentId) => ({
            agent_id: agentId,
            room_id: roomId,
            trigger_message_id: message.id,
            status: "pending",
          })),
        ),
      ]);
    }

    await Promise.all([
      touchRoom(admin, room),
      admin.from("experiment_events").insert({
        room_id: roomId,
        actor_user_id: user.id,
        event_name: validAgentIds.length ? "message_with_mention_sent" : "human_message_sent",
        properties: { mention_count: validAgentIds.length },
      }),
    ]);

    const snapshot = await getRoomSnapshot(admin, roomId, user.id);
    return NextResponse.json(
      { message: snapshot.messages.find((candidate) => candidate.id === Number(message.id)) },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
