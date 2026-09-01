import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Agent, Message, Participant, Room, RoomSnapshot } from "@/lib/domain";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "The request body must be valid JSON.");
  }
}

export async function requireHuman(): Promise<User> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ApiError(401, "An anonymous session is required.");
  return data.user;
}

export async function requireActiveMembership(
  admin: SupabaseClient,
  roomId: string,
  userId: string,
) {
  const { data: room } = await admin
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!room) throw new ApiError(404, "This room is unavailable or has expired.");

  const { data: membership } = await admin
    .from("room_members")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();
  if (!membership) throw new ApiError(403, "Join the room before accessing it.");

  return { room, membership };
}

export async function consumeRateLimit(
  admin: SupabaseClient,
  scope: string,
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_scope: scope,
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  if (!data) throw new ApiError(429, "Too many requests. Try again shortly.");
}

export async function touchRoom(admin: SupabaseClient, room: Room) {
  const now = new Date();
  const hardMaximum = new Date(new Date(room.created_at).getTime() + 7 * 86_400_000);
  const idleExpiry = new Date(now.getTime() + 86_400_000);
  const expiresAt = new Date(Math.min(hardMaximum.getTime(), idleExpiry.getTime()));

  await admin
    .from("rooms")
    .update({ last_activity_at: now.toISOString(), expires_at: expiresAt.toISOString() })
    .eq("id", room.id);
}

export async function getRoomSnapshot(
  admin: SupabaseClient,
  roomId: string,
  viewerId: string,
): Promise<RoomSnapshot> {
  const { room } = await requireActiveMembership(admin, roomId, viewerId);
  const [{ data: members }, { data: agents }, { data: messages }] = await Promise.all([
      admin
        .from("room_members")
        .select("user_id, joined_at, status")
        .eq("room_id", roomId)
        .is("left_at", null)
        .order("joined_at"),
      admin
        .from("agents")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at"),
      admin
        .from("messages")
        .select("*")
        .eq("room_id", roomId)
        .order("id", { ascending: false })
        .limit(100),
    ]);

  const profileIds = new Set<string>([
    viewerId,
    ...(members ?? []).map((member) => member.user_id),
    ...(agents ?? []).map((agent) => agent.owner_user_id),
    ...(messages ?? [])
      .map((message) => message.sender_user_id)
      .filter((id): id is string => Boolean(id)),
  ]);
  const { data: profiles } = await admin
    .from("users")
    .select("id, display_name")
    .in("id", [...profileIds]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const agentMap = new Map((agents ?? []).map((agent) => [agent.id, agent]));
  const orderedMessages = [...(messages ?? [])].reverse();
  const rawMessageMap = new Map(orderedMessages.map((message) => [message.id, message]));

  const participants: Participant[] = (members ?? []).map((member) => ({
    id: member.user_id,
    display_name: profileMap.get(member.user_id) ?? "Anonymous guest",
    joined_at: member.joined_at,
    status: member.status,
    is_owner: member.user_id === room.created_by,
  }));

  const hydratedAgents: Agent[] = (agents ?? []).map((agent) => ({
    id: agent.id,
    display_name: agent.display_name,
    owner_user_id: agent.owner_user_id,
    owner_display_name: profileMap.get(agent.owner_user_id) ?? "Anonymous guest",
    connection_status: agent.connection_status,
    capabilities: agent.capabilities ?? [],
    created_at: agent.created_at,
    last_seen_at: agent.last_seen_at,
    disconnected_at: agent.disconnected_at,
  }));

  const hydratedMessages: Message[] = orderedMessages.map((message) => {
    const senderAgent = message.sender_agent_id
      ? agentMap.get(message.sender_agent_id)
      : undefined;
    const reply = message.reply_to_message_id
      ? rawMessageMap.get(message.reply_to_message_id)
      : undefined;

    const senderName =
      message.sender_type === "system"
        ? "Room"
        : message.sender_type === "agent"
          ? senderAgent?.display_name ?? "Disconnected agent"
          : profileMap.get(message.sender_user_id) ?? "Anonymous guest";

    return {
      ...message,
      id: Number(message.id),
      sender_name: senderName,
      owner_name: senderAgent
        ? profileMap.get(senderAgent.owner_user_id) ?? "Anonymous guest"
        : null,
      reply_to: reply
        ? {
            id: Number(reply.id),
            sender_name:
              reply.sender_type === "agent"
                ? agentMap.get(reply.sender_agent_id)?.display_name ?? "Agent"
                : profileMap.get(reply.sender_user_id) ?? "Room",
            body: reply.body,
          }
        : null,
    } as Message;
  });

  return {
    room: room as Room,
    viewer: {
      id: viewerId,
      display_name: profileMap.get(viewerId) ?? "Anonymous guest",
      is_owner: viewerId === room.created_by,
    },
    participants,
    agents: hydratedAgents,
    messages: hydratedMessages,
  };
}

export async function insertSystemMessage(
  admin: SupabaseClient,
  roomId: string,
  body: string,
  metadata: Record<string, unknown> = {},
) {
  await admin.from("messages").insert({
    room_id: roomId,
    sender_type: "system",
    body,
    metadata,
  });
}

export { createAdminClient };
