"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  Copy,
  KeyRound,
  LoaderCircle,
  PlugZap,
  RefreshCw,
  Server,
  ShieldCheck,
  X,
} from "lucide-react";
import type { AgentConnectionSecret } from "@/lib/domain";
import {
  buildMcpClientSetup,
  MCP_CLIENT_OPTIONS,
  type McpClientId,
} from "@/lib/mcp/client-config";
import {
  checkMcpConnection,
  type McpCheckStep,
  type McpConnectionCheckResult,
} from "@/lib/mcp/connection-check";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CheckState =
  | { status: "idle" }
  | { status: "checking"; step: McpCheckStep }
  | { status: "connected"; result: McpConnectionCheckResult }
  | { status: "failed"; message: string };

const CHECK_STEPS: Array<{ id: McpCheckStep; label: string }> = [
  { id: "initialize", label: "Authenticate" },
  { id: "initialized", label: "Initialize MCP" },
  { id: "tools/list", label: "Discover tools" },
];

export function ConnectAgentDialog({
  roomId,
  open,
  onOpenChange,
  onConnected,
}: {
  roomId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => Promise<void>;
}) {
  const [selectedClient, setSelectedClient] = useState<McpClientId>("chatgpt");
  const [name, setName] = useState("ChatGPT");
  const [pending, setPending] = useState(false);
  const [secret, setSecret] = useState<AgentConnectionSecret | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [checkState, setCheckState] = useState<CheckState>({ status: "idle" });
  const [checkAttempt, setCheckAttempt] = useState(0);

  const setup = useMemo(
    () =>
      secret
        ? buildMcpClientSetup(selectedClient, {
            endpoint: secret.endpoint,
            token: secret.token,
            connectionName: secret.mcpServer.connectionName,
          })
        : null,
    [secret, selectedClient],
  );

  useEffect(() => {
    if (!secret) return;
    const controller = new AbortController();
    checkMcpConnection(
      secret.endpoint,
      secret.token,
      (step) => setCheckState({ status: "checking", step }),
      controller.signal,
    )
      .then((result) => setCheckState({ status: "connected", result }))
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setCheckState({
          status: "failed",
          message: cause instanceof Error ? cause.message : "The MCP connection check failed.",
        });
      });
    return () => controller.abort();
  }, [checkAttempt, secret]);

  if (!open) return null;

  function chooseClient(clientId: McpClientId) {
    const current = MCP_CLIENT_OPTIONS.find((client) => client.id === selectedClient);
    const next = MCP_CLIENT_OPTIONS.find((client) => client.id === clientId);
    if (!secret && next && (!name.trim() || name === current?.defaultNickname)) {
      setName(next.defaultNickname);
    }
    setSelectedClient(clientId);
  }

  async function createConnection() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/rooms/${roomId}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      const payload = (await response.json()) as AgentConnectionSecret & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not connect the agent.");
      setCheckState({ status: "checking", step: "initialize" });
      setSecret(payload);
      await onConnected();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect the agent.");
    } finally {
      setPending(false);
    }
  }

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1_500);
  }

  function close() {
    setSecret(null);
    setError(null);
    setCheckState({ status: "idle" });
    onOpenChange(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-5"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Connect an agent"
        className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b bg-white/95 p-5 backdrop-blur-xl sm:p-6">
          <div className="flex gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <PlugZap className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Connect an agent to BlipChat</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Give a personal agent secure MCP access to this room.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        {!secret ? (
          <div className="space-y-6 p-5 sm:p-6">
            <section>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Where does your agent run?</p>
                  <p className="mt-1 text-xs text-muted-foreground">Choose a client for instructions that match its exact MCP format.</p>
                </div>
                <span className="hidden text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:block">Popular agents</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {MCP_CLIENT_OPTIONS.map((client) => {
                  const selected = selectedClient === client.id;
                  return (
                    <button
                      key={client.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => chooseClient(client.id)}
                      className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                        selected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/10"
                          : "bg-white hover:border-primary/35 hover:bg-muted/40"
                      }`}
                    >
                      <span className={`grid size-9 shrink-0 place-items-center rounded-xl text-[11px] font-black tracking-tight ${client.accent}`}>
                        {client.monogram}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{client.label}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{client.subtitle}</span>
                      </span>
                      {selected && <Check className="ml-auto size-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-[1fr_0.9fr]">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agent nickname</span>
                <Input value={name} maxLength={32} onChange={(event) => setName(event.target.value)} placeholder="Atlas" />
                <span className="block text-[11px] leading-4 text-muted-foreground">Shown in the room and editable for every connection.</span>
              </label>
              <div className="rounded-2xl border bg-muted/45 p-3.5">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Server className="size-4 text-primary" /> MCP server identity
                </div>
                <code className="mt-2 block text-sm font-bold text-primary">blipchat</code>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  Fixed across all connections for predictable tool discovery. Client entries receive unique BlipChat-prefixed names.
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {["Read shared context", "Poll incremental messages", "Publish labeled findings", "Show working status"].map((capability) => (
                <div key={capability} className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs font-medium">
                  <Check className="size-3.5 text-emerald-600" /> {capability}
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              The setup token is displayed once. BlipChat stores only its hash. Anyone holding the token can act as this agent until you revoke it.
            </div>
            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <Button size="lg" className="w-full" onClick={createConnection} disabled={pending || name.trim().length < 2}>
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Bot className="size-4" />}
              Create {name.trim() || "agent"} connection
            </Button>
          </div>
        ) : (
          <div className="space-y-6 p-5 sm:p-6">
            <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-start">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-emerald-950">{secret.agent.display_name} is ready to configure</p>
                <p className="mt-1 text-xs leading-5 text-emerald-800">Copy the selected client setup now. The room token cannot be shown again.</p>
              </div>
              <div className="flex shrink-0 gap-2 text-[10px] font-bold uppercase tracking-wider">
                <span className="rounded-full bg-white/75 px-2.5 py-1 text-emerald-800">blipchat</span>
                <span className="rounded-full bg-white/75 px-2.5 py-1 text-emerald-800">HTTP</span>
              </div>
            </div>

            <ConnectionCheck
              state={checkState}
              onRetry={() => {
                setCheckState({ status: "checking", step: "initialize" });
                setCheckAttempt((attempt) => attempt + 1);
              }}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <SecretField label="MCP endpoint" value={secret.endpoint} copied={copied === "endpoint"} onCopy={() => copy("endpoint", secret.endpoint)} />
              <SecretField label="One-time token" value={secret.token} secret copied={copied === "token"} onCopy={() => copy("token", secret.token)} />
            </div>

            <section>
              <p className="mb-3 text-sm font-semibold">Setup instructions</p>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                {MCP_CLIENT_OPTIONS.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    aria-pressed={selectedClient === client.id}
                    onClick={() => chooseClient(client.id)}
                    className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                      selectedClient === client.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-white hover:bg-muted"
                    }`}
                  >
                    {client.label}
                  </button>
                ))}
              </div>
            </section>

            {setup && (
              <section className="overflow-hidden rounded-2xl border">
                <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">{setup.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Connection key: <code>{secret.mcpServer.connectionName}</code></p>
                  </div>
                  <span className="rounded-md border bg-white px-2 py-1 text-[10px] font-bold text-muted-foreground">{setup.format}</span>
                </div>
                <ol className="space-y-2 px-4 py-4">
                  {setup.steps.map((step, index) => (
                    <li key={step} className="flex gap-3 text-xs leading-5 text-foreground">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-bold text-secondary-foreground">{index + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <div className="border-y bg-slate-950">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{setup.format} configuration</span>
                    <Button variant="ghost" size="sm" className="text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => copy("config", setup.code)}>
                      {copied === "config" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Copy
                    </Button>
                  </div>
                  <pre className="max-h-64 overflow-auto p-4 text-[11px] leading-5 text-slate-100 scrollbar-subtle">{setup.code}</pre>
                </div>
                <div className="space-y-2 px-4 py-3 text-[11px] leading-5">
                  <p className="font-medium text-emerald-700">✓ {setup.verification}</p>
                  {setup.note && <p className="text-muted-foreground">{setup.note}</p>}
                </div>
              </section>
            )}

            <Button className="w-full" onClick={close}>Done</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectionCheck({ state, onRetry }: { state: CheckState; onRetry: () => void }) {
  const activeIndex =
    state.status === "checking"
      ? CHECK_STEPS.findIndex((step) => step.id === state.step)
      : state.status === "connected"
        ? CHECK_STEPS.length
        : -1;

  return (
    <div className={`rounded-2xl border p-4 ${state.status === "failed" ? "border-red-200 bg-red-50" : "bg-muted/35"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {state.status === "connected" ? (
            <Check className="size-4 text-emerald-600" />
          ) : state.status === "failed" ? (
            <AlertCircle className="size-4 text-red-600" />
          ) : (
            <LoaderCircle className="size-4 animate-spin text-primary" />
          )}
          <p className="text-sm font-semibold">
            {state.status === "connected"
              ? "MCP handshake passed"
              : state.status === "failed"
                ? "Connection check failed"
                : "Testing the MCP connection…"}
          </p>
        </div>
        {state.status === "failed" && (
          <Button variant="ghost" size="sm" onClick={onRetry}>
            <RefreshCw className="size-3.5" /> Retry
          </Button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {CHECK_STEPS.map((step, index) => {
          const complete = activeIndex > index;
          const active = activeIndex === index;
          return (
            <div key={step.id} className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold ${complete ? "bg-emerald-100 text-emerald-800" : active ? "bg-primary/10 text-primary" : "bg-white text-muted-foreground"}`}>
              {complete ? <Check className="size-3" /> : active ? <LoaderCircle className="size-3 animate-spin" /> : <span className="size-3 rounded-full border" />}
              {step.label}
            </div>
          );
        })}
      </div>
      {state.status === "connected" && (
        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
          Server <code className="font-semibold text-foreground">{state.result.serverName}</code> returned {state.result.tools.length} tools: {state.result.tools.join(", ")}.
        </p>
      )}
      {state.status === "failed" && <p className="mt-3 text-xs leading-5 text-red-700">{state.message}</p>}
    </div>
  );
}

function SecretField({
  label,
  value,
  secret = false,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  secret?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <button className="flex w-full items-center gap-2 rounded-xl border bg-muted/50 p-3 text-left" onClick={onCopy}>
        {secret && <KeyRound className="size-4 shrink-0 text-primary" />}
        <code className="min-w-0 flex-1 truncate text-xs">{value}</code>
        {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4 text-muted-foreground" />}
      </button>
    </div>
  );
}
