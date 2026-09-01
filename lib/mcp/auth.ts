import type { SupabaseClient } from "@supabase/supabase-js";
import { hashAgentToken } from "@/lib/identity";

export interface AuthenticatedAgent {
  id: string;
  room_id: string;
  owner_user_id: string;
  display_name: string;
  capabilities: string[];
}

export async function authenticateAgent(
  admin: SupabaseClient,
  request: Request,
  agentId: string,
): Promise<AuthenticatedAgent | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (token.length < 32) return null;

  const { data: agent } = await admin
    .from("agents")
    .select("id, room_id, owner_user_id, display_name, capabilities")
    .eq("id", agentId)
    .eq("connection_token_hash", hashAgentToken(token))
    .is("disconnected_at", null)
    .maybeSingle();
  if (!agent) return null;

  const { data: room } = await admin
    .from("rooms")
    .select("id")
    .eq("id", agent.room_id)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!room) return null;

  await admin
    .from("agents")
    .update({
      last_seen_at: new Date().toISOString(),
      connection_status: "online",
    })
    .eq("id", agent.id);

  return agent as AuthenticatedAgent;
}
