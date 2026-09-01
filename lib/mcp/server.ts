import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { AgentStatus } from "@/lib/domain";
import { getRoomSnapshot, touchRoom } from "@/lib/api";
import { messageBodySchema, safeSearchTerm } from "@/lib/validation";
import type { AuthenticatedAgent } from "@/lib/mcp/auth";

function result(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}

function toolError(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

async function readRoomMessages(
  admin: SupabaseClient,
  agent: AuthenticatedAgent,
  input: { after?: number; before?: number; limit: number; query?: string },
) {
  let query = admin
    .from("messages")
    .select("*")
    .eq("room_id", agent.room_id)
    .order("id", { ascending: !input.before })
    .limit(input.limit);
  if (input.after) query = query.gt("id", input.after);
  if (input.before) query = query.lt("id", input.before);
  if (input.query) {
    const term = safeSearchTerm(input.query);
    if (term) query = query.ilike("body", `%${term}%`);
  }

  const { data: messages, error } = await query;
  if (error) throw error;
  const rows = input.before ? [...(messages ?? [])].reverse() : (messages ?? []);
  const messageIds = rows.map((message) => message.id);
  const [{ data: agents }, mentionResult, invocationResult] = await Promise.all([
    admin.from("agents").select("id, display_name, owner_user_id").eq("room_id", agent.room_id),
    messageIds.length
      ? admin
          .from("message_mentions")
          .select("message_id, status")
          .eq("agent_id", agent.id)
          .in("message_id", messageIds)
      : Promise.resolve({ data: [] }),
    messageIds.length
      ? admin
          .from("agent_invocations")
          .select("id, trigger_message_id, status, started_at, completed_at")
          .eq("agent_id", agent.id)
          .in("trigger_message_id", messageIds)
      : Promise.resolve({ data: [] }),
  ]);
  const profileIds = new Set<string>([
    agent.owner_user_id,
    ...(agents ?? []).map((row) => row.owner_user_id),
    ...rows
      .map((message) => message.sender_user_id)
      .filter((id): id is string => Boolean(id)),
  ]);
  const { data: profiles } = await admin
    .from("users")
    .select("id, display_name")
    .in("id", [...profileIds]);

  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  const agentRows = new Map((agents ?? []).map((row) => [row.id, row]));
  const mentions = new Map((mentionResult.data ?? []).map((row) => [row.message_id, row.status]));
  const invocations = new Map(
    (invocationResult.data ?? []).map((row) => [row.trigger_message_id, row]),
  );
  const newlySeen = (mentionResult.data ?? [])
    .filter((row) => row.status === "pending")
    .map((row) => row.message_id);
  if (newlySeen.length) {
    await admin
      .from("message_mentions")
      .update({ status: "seen" })
      .eq("agent_id", agent.id)
      .in("message_id", newlySeen);
  }

  return rows.map((message) => {
    const senderAgent = message.sender_agent_id
      ? agentRows.get(message.sender_agent_id)
      : undefined;
    return {
      id: Number(message.id),
      sender: {
        type: message.sender_type,
        id: message.sender_user_id ?? message.sender_agent_id,
        display_name:
          message.sender_type === "system"
            ? "Room"
            : senderAgent?.display_name ?? names.get(message.sender_user_id) ?? "Anonymous guest",
        owner_user_id: senderAgent?.owner_user_id ?? null,
        owner_display_name: senderAgent ? names.get(senderAgent.owner_user_id) ?? null : null,
      },
      body: message.body,
      reply_to_message_id: message.reply_to_message_id
        ? Number(message.reply_to_message_id)
        : null,
      created_at: message.created_at,
      metadata: message.metadata,
      mentions_me: mentions.has(message.id),
      mention_status: mentions.get(message.id) ?? null,
      invocation: invocations.get(message.id) ?? null,
    };
  });
}

export function buildMcpHandler(admin: SupabaseClient, agent: AuthenticatedAgent) {
  return createMcpHandler(
    () => {
      const server = new McpServer(
        { name: "blipchat", version: "0.2.0" },
        {
          capabilities: { tools: {}, resources: {} },
          instructions:
            "BlipChat is a shared human-agent chat room. Start with get_room_context, poll read_messages with its cursor, use send_message only for content appropriate for everyone in the room, and correlate replies to direct mentions.",
        },
      );

      if (agent.capabilities.includes("read_context")) {
        server.registerTool(
          "get_room_context",
          {
            title: "Get BlipChat room context",
            description:
              "BlipChat: get this agent's room metadata, people, connected agents, recent discussion, and polling cursor.",
            inputSchema: z.object({
              message_limit: z.number().int().min(1).max(100).default(40),
            }),
          },
          async ({ message_limit }) => {
            const snapshot = await getRoomSnapshot(admin, agent.room_id, agent.owner_user_id);
            const messages = snapshot.messages.slice(-message_limit);
            return result({
              room: snapshot.room,
              requesting_agent: {
                id: agent.id,
                display_name: agent.display_name,
                owner_user_id: agent.owner_user_id,
              },
              participants: snapshot.participants,
              agents: snapshot.agents,
              messages,
              cursor: messages.at(-1)?.id ?? 0,
              privacy_notice:
                "This is a shared room. Publish only findings appropriate for all participants.",
            });
          },
        );

        server.registerTool(
          "list_participants",
          {
            title: "List BlipChat participants",
            description: "BlipChat: list humans and agents in the room, including agent ownership and status.",
            inputSchema: z.object({}),
          },
          async () => {
            const snapshot = await getRoomSnapshot(admin, agent.room_id, agent.owner_user_id);
            return result({ humans: snapshot.participants, agents: snapshot.agents });
          },
        );

        server.registerResource(
          "current-room-context",
          "room://current/context",
          {
            title: "Current shared room context",
            description: "A snapshot of the shared discussion available to this agent.",
            mimeType: "application/json",
          },
          async (uri) => {
            const snapshot = await getRoomSnapshot(admin, agent.room_id, agent.owner_user_id);
            return {
              contents: [
                {
                  uri: uri.href,
                  mimeType: "application/json",
                  text: JSON.stringify(snapshot),
                },
              ],
            };
          },
        );
      }

      if (agent.capabilities.includes("read_messages")) {
        server.registerTool(
          "read_messages",
          {
            title: "Read BlipChat messages",
            description:
              "BlipChat: read ordered room messages. Poll with after=<last cursor>; messages directly mentioning this agent include invocation data.",
            inputSchema: z.object({
              after: z.number().int().positive().optional(),
              before: z.number().int().positive().optional(),
              limit: z.number().int().min(1).max(100).default(50),
              query: z.string().max(120).optional(),
            }),
          },
          async (input) => {
            const messages = await readRoomMessages(admin, agent, input);
            return result({
              messages,
              cursor: messages.at(-1)?.id ?? input.after ?? 0,
              has_more: messages.length === input.limit,
            });
          },
        );
      }

      if (agent.capabilities.includes("send_messages")) {
        server.registerTool(
          "send_message",
          {
            title: "Send a BlipChat message",
            description:
              "BlipChat: publish an agent-labeled message to the room. Supply mention_correlation when replying to a direct mention.",
            inputSchema: z.object({
              body: z.string().trim().min(1).max(4_000),
              reply_to_message_id: z.number().int().positive().optional(),
              mention_correlation: z.number().int().positive().optional(),
              metadata: z.record(z.string(), z.unknown()).default({}),
            }),
          },
          async ({ body, reply_to_message_id, mention_correlation, metadata }) => {
            const validatedBody = messageBodySchema.safeParse(body);
            if (!validatedBody.success) return toolError("Message body is invalid.");

            const { data: room } = await admin
              .from("rooms")
              .select("*")
              .eq("id", agent.room_id)
              .eq("status", "active")
              .gt("expires_at", new Date().toISOString())
              .maybeSingle();
            if (!room) return toolError("The room has expired or closed.");

            if (reply_to_message_id) {
              const { data: reply } = await admin
                .from("messages")
                .select("id")
                .eq("room_id", agent.room_id)
                .eq("id", reply_to_message_id)
                .maybeSingle();
              if (!reply) return toolError("The reply target is not in this room.");
            }

            let invocationId: string | null = null;
            if (mention_correlation) {
              const { data: invocation } = await admin
                .from("agent_invocations")
                .select("id, created_at")
                .eq("agent_id", agent.id)
                .eq("room_id", agent.room_id)
                .eq("trigger_message_id", mention_correlation)
                .maybeSingle();
              if (!invocation) return toolError("That mention correlation does not belong to this agent.");
              invocationId = invocation.id;
              metadata = {
                ...metadata,
                mention_response_latency_ms:
                  Date.now() - new Date(invocation.created_at).getTime(),
              };
            }

            const { data: message, error } = await admin
              .from("messages")
              .insert({
                room_id: agent.room_id,
                sender_agent_id: agent.id,
                sender_type: "agent",
                body: validatedBody.data,
                reply_to_message_id: reply_to_message_id ?? mention_correlation ?? null,
                metadata: {
                  ...metadata,
                  invocation_id: invocationId,
                },
              })
              .select("id, created_at")
              .single();
            if (error) throw error;

            if (mention_correlation && invocationId) {
              await Promise.all([
                admin
                  .from("message_mentions")
                  .update({ status: "responded" })
                  .eq("agent_id", agent.id)
                  .eq("message_id", mention_correlation),
                admin
                  .from("agent_invocations")
                  .update({ status: "completed", completed_at: new Date().toISOString() })
                  .eq("id", invocationId),
              ]);
            }

            await Promise.all([
              touchRoom(admin, room),
              admin.from("experiment_events").insert({
                room_id: agent.room_id,
                actor_agent_id: agent.id,
                event_name: mention_correlation ? "agent_mention_response" : "agent_finding_published",
                properties: {
                  message_id: Number(message.id),
                  ...(mention_correlation
                    ? { latency_ms: metadata.mention_response_latency_ms }
                    : {}),
                },
              }),
            ]);

            return result({
              message_id: Number(message.id),
              created_at: message.created_at,
              sender_agent_id: agent.id,
              room_id: agent.room_id,
            });
          },
        );
      }

      if (agent.capabilities.includes("status")) {
        server.registerTool(
          "set_agent_status",
          {
            title: "Set BlipChat agent status",
            description: "BlipChat: set the agent's visible room status.",
            inputSchema: z.object({
              status: z.enum(["online", "working", "idle", "unavailable"]),
            }),
          },
          async ({ status }) => {
            const now = new Date().toISOString();
            await Promise.all([
              admin
                .from("agents")
                .update({
                  connection_status: status as AgentStatus,
                  last_seen_at: now,
                })
                .eq("id", agent.id),
              status === "working"
                ? admin
                    .from("agent_invocations")
                    .update({ status: "working", started_at: now })
                    .eq("agent_id", agent.id)
                    .eq("room_id", agent.room_id)
                    .eq("status", "pending")
                : Promise.resolve(),
            ]);
            return result({ status });
          },
        );
      }

      return server;
    },
    { legacy: "stateless" },
  );
}
