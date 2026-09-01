const LEGACY_MCP_PROTOCOL_VERSION = "2025-06-18";

type JsonRpcResponse = {
  result?: Record<string, unknown>;
  error?: { code?: number; message?: string };
};

export type McpCheckStep = "initialize" | "initialized" | "tools/list";

export interface McpConnectionCheckResult {
  serverName: string;
  protocolVersion: string;
  tools: string[];
}

async function readMcpResponse(response: Response): Promise<JsonRpcResponse | null> {
  const body = await response.text();
  if (!response.ok) {
    let detail = body;
    try {
      const parsed = JSON.parse(body) as { error?: string | { message?: string } };
      detail =
        typeof parsed.error === "string"
          ? parsed.error
          : parsed.error?.message ?? body;
    } catch {
      // Keep the plain-text response when it is not JSON.
    }
    throw new Error(detail || `MCP request failed with HTTP ${response.status}.`);
  }
  if (!body.trim()) return null;

  if (response.headers.get("content-type")?.includes("application/json")) {
    return JSON.parse(body) as JsonRpcResponse;
  }

  const payloads = body
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== "[DONE]");
  if (!payloads.length) throw new Error("BlipChat returned an unreadable MCP response.");
  return JSON.parse(payloads.at(-1)!) as JsonRpcResponse;
}

async function postMcp(
  endpoint: string,
  token: string,
  body: Record<string, unknown>,
  options: { protocolVersion?: string; sessionId?: string; signal?: AbortSignal } = {},
) {
  const headers: Record<string, string> = {
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (options.protocolVersion) headers["MCP-Protocol-Version"] = options.protocolVersion;
  if (options.sessionId) headers["Mcp-Session-Id"] = options.sessionId;

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });
  return {
    payload: await readMcpResponse(response),
    sessionId: response.headers.get("Mcp-Session-Id") ?? options.sessionId,
  };
}

export async function checkMcpConnection(
  endpoint: string,
  token: string,
  onStep?: (step: McpCheckStep) => void,
  signal?: AbortSignal,
): Promise<McpConnectionCheckResult> {
  onStep?.("initialize");
  const initialized = await postMcp(
    endpoint,
    token,
    {
      jsonrpc: "2.0",
      id: "blipchat-initialize",
      method: "initialize",
      params: {
        protocolVersion: LEGACY_MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "blipchat-connection-check", version: "1.0.0" },
      },
    },
    { signal },
  );
  if (initialized.payload?.error) {
    throw new Error(initialized.payload.error.message ?? "MCP initialize failed.");
  }
  const initializeResult = initialized.payload?.result;
  const serverInfo = initializeResult?.serverInfo as { name?: string } | undefined;
  const protocolVersion = String(
    initializeResult?.protocolVersion ?? LEGACY_MCP_PROTOCOL_VERSION,
  );
  if (serverInfo?.name !== "blipchat") {
    throw new Error(`Expected the blipchat MCP server, received ${serverInfo?.name ?? "an unnamed server"}.`);
  }

  onStep?.("initialized");
  await postMcp(
    endpoint,
    token,
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { protocolVersion, sessionId: initialized.sessionId, signal },
  );

  onStep?.("tools/list");
  const listed = await postMcp(
    endpoint,
    token,
    { jsonrpc: "2.0", id: "blipchat-tools", method: "tools/list", params: {} },
    { protocolVersion, sessionId: initialized.sessionId, signal },
  );
  if (listed.payload?.error) {
    throw new Error(listed.payload.error.message ?? "MCP tools/list failed.");
  }
  const tools = Array.isArray(listed.payload?.result?.tools)
    ? (listed.payload.result.tools as Array<{ name?: string }>)
        .map((tool) => tool.name)
        .filter((name): name is string => Boolean(name))
    : [];
  if (!tools.length) throw new Error("BlipChat connected, but tools/list returned no tools.");

  return {
    serverName: serverInfo.name,
    protocolVersion,
    tools,
  };
}
