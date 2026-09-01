"use client";

import { useState } from "react";
import { Bot, Check, Copy, KeyRound, LoaderCircle, PlugZap, ShieldCheck, X } from "lucide-react";
import type { AgentConnectionSecret } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [name, setName] = useState("Atlas");
  const [pending, setPending] = useState(false);
  const [secret, setSecret] = useState<AgentConnectionSecret | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (!open) return null;

  async function createConnection() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/rooms/${roomId}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not connect the agent.");
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
    onOpenChange(false);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/35 p-0 backdrop-blur-sm sm:place-items-center sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-label="Connect an agent" className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between border-b p-5 sm:p-6">
          <div className="flex gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <PlugZap className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Connect a personal agent</h2>
              <p className="mt-1 text-sm text-muted-foreground">Create a scoped MCP connection for this room only.</p>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        {!secret ? (
          <div className="space-y-5 p-5 sm:p-6">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agent display name</span>
              <Input value={name} maxLength={32} onChange={(event) => setName(event.target.value)} placeholder="Atlas" />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {["Read shared context", "Poll incremental messages", "Publish labeled findings", "Show working status"].map((capability) => (
                <div key={capability} className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs font-medium">
                  <Check className="size-3.5 text-emerald-600" /> {capability}
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              The setup token is displayed once. The server stores only its hash. Anyone holding the token can act as this agent until you revoke it.
            </div>
            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <Button size="lg" className="w-full" onClick={createConnection} disabled={pending || name.trim().length < 2}>
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Bot className="size-4" />}
              Create secure connection
            </Button>
          </div>
        ) : (
          <div className="space-y-5 p-5 sm:p-6">
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-900">Connection ready</p>
                <p className="mt-1 text-xs leading-5 text-emerald-800">Copy the configuration now. The token cannot be shown again.</p>
              </div>
            </div>

            <SecretField label="MCP endpoint" value={secret.endpoint} copied={copied === "endpoint"} onCopy={() => copy("endpoint", secret.endpoint)} />
            <SecretField label="One-time token" value={secret.token} secret copied={copied === "token"} onCopy={() => copy("token", secret.token)} />

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client configuration</span>
                <Button variant="ghost" size="sm" onClick={() => copy("config", JSON.stringify(secret.configuration, null, 2))}>
                  {copied === "config" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Copy JSON
                </Button>
              </div>
              <pre className="max-h-52 overflow-auto rounded-xl bg-slate-950 p-4 text-[11px] leading-5 text-slate-100 scrollbar-subtle">
                {JSON.stringify(secret.configuration, null, 2)}
              </pre>
            </div>

            <Button className="w-full" onClick={close}>Done</Button>
          </div>
        )}
      </div>
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
