"use client";

import { useMemo, useRef, useState } from "react";
import { AtSign, Bot, CornerUpLeft, LoaderCircle, Send, X } from "lucide-react";
import type { Agent, Message } from "@/lib/domain";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function MessageComposer({
  roomId,
  agents,
  replyTo,
  onCancelReply,
  onSent,
}: {
  roomId: string;
  agents: Agent[];
  replyTo: Message | null;
  onCancelReply: () => void;
  onSent: () => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [mentionedAgentIds, setMentionedAgentIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeAgents = agents.filter((agent) => !agent.disconnected_at);

  const mentionMatch = body.match(/(?:^|\s)@([^\s@]*)$/);
  const mentionQuery = mentionMatch?.[1]?.toLowerCase() ?? null;
  const suggestions = useMemo(
    () =>
      mentionQuery === null
        ? []
        : activeAgents
            .filter((agent) => agent.display_name.toLowerCase().includes(mentionQuery))
            .slice(0, 5),
    [activeAgents, mentionQuery],
  );

  function chooseMention(agent: Agent) {
    if (!mentionMatch || mentionMatch.index === undefined) return;
    const atIndex = body.lastIndexOf("@", body.length - 1);
    setBody(`${body.slice(0, atIndex)}@${agent.display_name} `);
    setMentionedAgentIds((current) => new Set(current).add(agent.id));
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function send() {
    const trimmed = body.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    const validMentionIds = [...mentionedAgentIds].filter((id) => {
      const agent = activeAgents.find((candidate) => candidate.id === id);
      return agent && trimmed.includes(`@${agent.display_name}`);
    });

    try {
      const response = await fetch(`/api/rooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: trimmed,
          replyToMessageId: replyTo?.id ?? null,
          mentionAgentIds: validMentionIds,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not send the message.");
      setBody("");
      setMentionedAgentIds(new Set());
      onCancelReply();
      await onSent();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send the message.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="shrink-0 border-t bg-white/90 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:px-6 sm:pb-4">
      <div className="relative mx-auto max-w-3xl">
        {suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 z-20 mb-2 w-72 overflow-hidden rounded-2xl border bg-white p-1.5 shadow-xl">
            <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mention an agent</p>
            {suggestions.map((agent) => (
              <button
                key={agent.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseMention(agent)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-muted"
              >
                <Avatar name={agent.display_name} agent className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{agent.display_name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {agent.owner_display_name}’s agent · {agent.connection_status}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border bg-muted/70 px-3 py-2 text-xs">
            <CornerUpLeft className="size-3.5 text-primary" />
            <span className="font-medium">Replying to {replyTo.sender_name}</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{replyTo.body}</span>
            <Button variant="ghost" size="icon-sm" onClick={onCancelReply} aria-label="Cancel reply">
              <X className="size-3.5" />
            </Button>
          </div>
        )}

        <div className="relative rounded-2xl border bg-white shadow-sm focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(event) => setBody(event.target.value.slice(0, 4_000))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send();
              }
            }}
            className="min-h-12 border-0 pb-11 shadow-none focus:ring-0"
            placeholder={activeAgents.length ? "Message the room, or type @ to mention an agent…" : "Message the room…"}
          />
          <div className="absolute inset-x-2 bottom-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <AtSign className="size-3.5" />
              <span className="hidden sm:inline">Mention agents · Shift + Enter for a new line</span>
              {mentionedAgentIds.size > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-secondary-foreground">
                  <Bot className="size-3" /> {mentionedAgentIds.size}
                </span>
              )}
            </div>
            <Button size="icon-sm" onClick={send} disabled={!body.trim() || pending} aria-label="Send message">
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
