import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMcpHandler } from "@/lib/mcp/server";
import type { AuthenticatedAgent } from "@/lib/mcp/auth";

vi.mock("server-only", () => ({}));

function request(body: Record<string, unknown>, protocolVersion?: string) {
  return new Request("https://blipchat.example/api/mcp/agent-1", {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      ...(protocolVersion ? { "MCP-Protocol-Version": protocolVersion } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function payload(response: Response) {
  const text = await response.text();
  if (response.headers.get("content-type")?.includes("application/json")) {
    return JSON.parse(text);
  }
  const data = text
    .split(/\r?\n/)
    .findLast((line) => line.startsWith("data:"))
    ?.slice(5)
    .trim();
  return data ? JSON.parse(data) : null;
}

describe("BlipChat MCP handshake", () => {
  it("initializes with the canonical server name and discovers all room tools", async () => {
    const agent: AuthenticatedAgent = {
      id: "agent-1",
      room_id: "room-1",
      owner_user_id: "owner-1",
      display_name: "Atlas",
      capabilities: ["read_context", "read_messages", "send_messages", "status"],
    };
    const handler = buildMcpHandler({} as SupabaseClient, agent);

    const initializedResponse = await handler.fetch(
      request({
        jsonrpc: "2.0",
        id: "init",
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    );
    expect(initializedResponse.ok).toBe(true);
    const initialized = await payload(initializedResponse);
    expect(initialized.result.serverInfo.name).toBe("blipchat");
    expect(initialized.result.instructions).toContain("BlipChat");

    const protocolVersion = initialized.result.protocolVersion as string;
    const notificationResponse = await handler.fetch(
      request(
        { jsonrpc: "2.0", method: "notifications/initialized" },
        protocolVersion,
      ),
    );
    expect(notificationResponse.ok).toBe(true);

    const toolsResponse = await handler.fetch(
      request(
        { jsonrpc: "2.0", id: "tools", method: "tools/list", params: {} },
        protocolVersion,
      ),
    );
    expect(toolsResponse.ok).toBe(true);
    const tools = await payload(toolsResponse);
    expect(tools.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "get_room_context",
      "list_participants",
      "read_messages",
      "send_message",
      "set_agent_status",
    ]);
  });
});
