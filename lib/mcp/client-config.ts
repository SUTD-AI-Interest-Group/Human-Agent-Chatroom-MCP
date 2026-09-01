export const BLIPCHAT_MCP_SERVER_NAME = "blipchat";

export type McpClientId =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "hermes"
  | "openclaw"
  | "custom";

export interface McpClientOption {
  id: McpClientId;
  label: string;
  subtitle: string;
  monogram: string;
  accent: string;
  defaultNickname: string;
}

export const MCP_CLIENT_OPTIONS: McpClientOption[] = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    subtitle: "Desktop / Codex",
    monogram: "CG",
    accent: "bg-emerald-950 text-white",
    defaultNickname: "ChatGPT",
  },
  {
    id: "claude",
    label: "Claude",
    subtitle: "Claude Code",
    monogram: "CL",
    accent: "bg-[#D97757] text-white",
    defaultNickname: "Claude",
  },
  {
    id: "gemini",
    label: "Gemini",
    subtitle: "Gemini CLI",
    monogram: "GE",
    accent: "bg-blue-600 text-white",
    defaultNickname: "Gemini",
  },
  {
    id: "hermes",
    label: "Hermes",
    subtitle: "Hermes Agent",
    monogram: "HE",
    accent: "bg-violet-700 text-white",
    defaultNickname: "Hermes",
  },
  {
    id: "openclaw",
    label: "OpenClaw",
    subtitle: "CLI / Control UI",
    monogram: "OC",
    accent: "bg-rose-600 text-white",
    defaultNickname: "OpenClaw",
  },
  {
    id: "custom",
    label: "Custom",
    subtitle: "Any HTTP MCP client",
    monogram: "++",
    accent: "bg-slate-700 text-white",
    defaultNickname: "Atlas",
  },
];

export interface McpConnectionValues {
  endpoint: string;
  token: string;
  connectionName: string;
}

export interface McpClientSetup {
  title: string;
  format: "TOML" | "JSON" | "YAML";
  code: string;
  steps: string[];
  verification: string;
  note?: string;
}

export function createMcpConnectionName(displayName: string, agentId: string) {
  const nickname = displayName
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const suffix = agentId.replace(/[^a-z0-9]/gi, "").slice(0, 6).toLowerCase();
  return `${BLIPCHAT_MCP_SERVER_NAME}-${nickname || "agent"}-${suffix || "local"}`;
}

function jsonConfiguration(connectionName: string, definition: Record<string, unknown>) {
  return JSON.stringify({ mcpServers: { [connectionName]: definition } }, null, 2);
}

export function buildMcpClientSetup(
  client: McpClientId,
  values: McpConnectionValues,
): McpClientSetup {
  const { endpoint, token, connectionName } = values;
  const authorization = `Bearer ${token}`;

  switch (client) {
    case "chatgpt":
      return {
        title: "ChatGPT Desktop / Codex",
        format: "TOML",
        code: [
          `[mcp_servers.${JSON.stringify(connectionName)}]`,
          `url = ${JSON.stringify(endpoint)}`,
          `http_headers = { Authorization = ${JSON.stringify(authorization)} }`,
        ].join("\n"),
        steps: [
          "Open ~/.codex/config.toml and paste this block.",
          "Restart ChatGPT Desktop or Codex, then open Settings → MCP servers.",
          `Enable ${connectionName} and type /mcp to confirm the BlipChat tools are listed.`,
        ],
        verification: "Look for get_room_context, read_messages, and send_message under the BlipChat server.",
        note: "ChatGPT web plugins require OAuth discovery. This room-scoped bearer setup is for ChatGPT Desktop and Codex.",
      };
    case "claude":
      return {
        title: "Claude Code",
        format: "JSON",
        code: jsonConfiguration(connectionName, {
          type: "http",
          url: endpoint,
          headers: { Authorization: authorization },
        }),
        steps: [
          "Paste this into your project .mcp.json, merging it with any existing mcpServers entries.",
          'Keep "type": "http" exactly as shown. Without it, Claude assumes a local stdio server.',
          "Restart Claude Code and run /mcp to check the connection.",
        ],
        verification: `Claude should show ${connectionName} as connected with the BlipChat tools.`,
        note: "Claude’s hosted custom-connector form normally expects OAuth. Use this static-header setup in Claude Code.",
      };
    case "gemini":
      return {
        title: "Gemini CLI",
        format: "JSON",
        code: jsonConfiguration(connectionName, {
          httpUrl: endpoint,
          headers: { Authorization: authorization },
          timeout: 10_000,
        }),
        steps: [
          "Open ~/.gemini/settings.json and merge this mcpServers entry into the file.",
          "Keep httpUrl as shown; Gemini uses url for legacy SSE instead.",
          "Restart Gemini CLI and run /mcp.",
        ],
        verification: `Gemini should report ${connectionName} as connected and list its tools and room resource.`,
      };
    case "hermes":
      return {
        title: "Hermes Agent",
        format: "YAML",
        code: [
          "mcp_servers:",
          `  ${connectionName}:`,
          `    url: ${JSON.stringify(endpoint)}`,
          "    headers:",
          `      Authorization: ${JSON.stringify(authorization)}`,
        ].join("\n"),
        steps: [
          "Open ~/.hermes/config.yaml and merge this entry under mcp_servers.",
          "Restart Hermes with hermes chat so it runs MCP tool discovery.",
          "Ask Hermes to get the current BlipChat room context.",
        ],
        verification: `Hermes prefixes the tools with mcp_${connectionName.replaceAll("-", "_")}_... .`,
      };
    case "openclaw":
      return {
        title: "OpenClaw",
        format: "JSON",
        code: JSON.stringify(
          {
            mcp: {
              servers: {
                [connectionName]: {
                  url: endpoint,
                  transport: "streamable-http",
                  headers: { Authorization: authorization },
                  connectionTimeoutMs: 10_000,
                  requestTimeoutMs: 30_000,
                },
              },
            },
          },
          null,
          2,
        ),
        steps: [
          "Merge this object into your OpenClaw configuration, or paste its server entry in Settings → MCP.",
          "Save and publish the configuration, then reload the agent runtime.",
          `Run openclaw mcp doctor ${connectionName} --probe for a live tools/list check.`,
        ],
        verification: `OpenClaw should report ${connectionName} as healthy and show the BlipChat tools.`,
      };
    case "custom":
      return {
        title: "Custom MCP client",
        format: "JSON",
        code: jsonConfiguration(connectionName, {
          type: "http",
          url: endpoint,
          headers: { Authorization: authorization },
        }),
        steps: [
          "Choose the Streamable HTTP transport in your MCP client.",
          "Use the URL and Authorization header from this configuration.",
          "Reconnect or restart the client so it runs initialize and tools/list.",
        ],
        verification: "The initialized server name must be blipchat and tools/list should return the room tools.",
        note: "Configuration keys differ between clients. If generic JSON is rejected, enter the endpoint and bearer header in the client UI.",
      };
  }
}
