export type RoomStatus = "active" | "closed" | "expired";
export type AgentStatus = "online" | "working" | "idle" | "unavailable";

export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  created_by: string;
  created_at: string;
  expires_at: string;
  last_activity_at: string;
  message_retention_seconds: number;
}

export interface Participant {
  id: string;
  display_name: string;
  joined_at: string;
  status: "online" | "offline";
  is_owner: boolean;
}

export interface Agent {
  id: string;
  display_name: string;
  owner_user_id: string;
  owner_display_name: string;
  connection_status: AgentStatus;
  capabilities: string[];
  created_at: string;
  last_seen_at: string | null;
  disconnected_at: string | null;
}

export interface Message {
  id: number;
  room_id: string;
  sender_user_id: string | null;
  sender_agent_id: string | null;
  sender_type: "human" | "agent" | "system";
  sender_name: string;
  owner_name?: string | null;
  body: string;
  reply_to_message_id: number | null;
  reply_to?: Pick<Message, "id" | "sender_name" | "body"> | null;
  created_at: string;
  metadata: Record<string, unknown>;
  mention_agent_ids?: string[];
}

export interface RoomSnapshot {
  room: Room;
  viewer: {
    id: string;
    display_name: string;
    is_owner: boolean;
  };
  participants: Participant[];
  agents: Agent[];
  messages: Message[];
}

export interface AgentConnectionSecret {
  agent: Agent;
  endpoint: string;
  token: string;
  mcpServer: {
    name: "blipchat";
    connectionName: string;
    transport: "streamable-http";
  };
  configuration: {
    mcpServers: Record<
      string,
      { type: "http"; url: string; headers: { Authorization: string } }
    >;
  };
}
