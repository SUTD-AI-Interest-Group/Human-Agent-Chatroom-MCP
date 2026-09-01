import { describe, expect, it } from "vitest";
import {
  BLIPCHAT_MCP_SERVER_NAME,
  buildMcpClientSetup,
  createMcpConnectionName,
  type McpClientId,
} from "@/lib/mcp/client-config";

const connection = {
  endpoint: "https://blipchat.example/api/mcp/agent-123",
  token: "room-secret",
  connectionName: "blipchat-atlas-agent1",
};

describe("BlipChat MCP client configuration", () => {
  it("uses a stable canonical name and unique BlipChat-prefixed connection keys", () => {
    expect(BLIPCHAT_MCP_SERVER_NAME).toBe("blipchat");
    expect(createMcpConnectionName("Research Atlas", "a1b2c3d4-e5f6")).toBe(
      "blipchat-research-atlas-a1b2c3",
    );
    expect(createMcpConnectionName("✨", "agent-42")).toBe("blipchat-agent-agent4");
  });

  it("includes Claude's required HTTP type", () => {
    const setup = buildMcpClientSetup("claude", connection);
    const configuration = JSON.parse(setup.code);
    expect(configuration.mcpServers[connection.connectionName]).toMatchObject({
      type: "http",
      url: connection.endpoint,
      headers: { Authorization: `Bearer ${connection.token}` },
    });
  });

  it("uses Gemini's Streamable HTTP key instead of its legacy SSE key", () => {
    const setup = buildMcpClientSetup("gemini", connection);
    const configuration = JSON.parse(setup.code);
    expect(configuration.mcpServers[connection.connectionName].httpUrl).toBe(connection.endpoint);
    expect(configuration.mcpServers[connection.connectionName].url).toBeUndefined();
  });

  it("uses OpenClaw's canonical Streamable HTTP transport", () => {
    const setup = buildMcpClientSetup("openclaw", connection);
    const configuration = JSON.parse(setup.code);
    expect(configuration.mcp.servers[connection.connectionName]).toMatchObject({
      url: connection.endpoint,
      transport: "streamable-http",
    });
  });

  it("includes the scoped endpoint and bearer token in every client setup", () => {
    const clients: McpClientId[] = ["chatgpt", "claude", "gemini", "hermes", "openclaw", "custom"];
    for (const client of clients) {
      const setup = buildMcpClientSetup(client, connection);
      expect(setup.code).toContain(connection.endpoint);
      expect(setup.code).toContain(connection.token);
      expect(setup.code).toContain(connection.connectionName);
    }
  });
});
