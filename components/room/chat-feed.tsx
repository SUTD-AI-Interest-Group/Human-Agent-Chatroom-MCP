"use client";

import { useEffect, useRef } from "react";
import { Bot, CornerUpLeft, LoaderCircle } from "lucide-react";
import type { Message, RoomSnapshot } from "@/lib/domain";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function ChatFeed({
  snapshot,
  onReply,
}: {
  snapshot: RoomSnapshot;
  onReply: (message: Message) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const previousLastId = useRef<number | undefined>(undefined);

  useEffect(() => {
    const lastId = snapshot.messages.at(-1)?.id;
    if (lastId !== previousLastId.current) {
      bottomRef.current?.scrollIntoView({ behavior: previousLastId.current ? "smooth" : "auto" });
      previousLastId.current = lastId;
    }
  }, [snapshot.messages]);

  const workingAgents = snapshot.agents.filter(
    (agent) => !agent.disconnected_at && agent.connection_status === "working",
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5 scrollbar-subtle sm:px-6">
      <div className="mx-auto max-w-3xl space-y-1">
        <div className="mb-8 rounded-2xl border border-primary/10 bg-primary/[0.035] p-5 text-center">
          <div className="mx-auto grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Bot className="size-5" />
          </div>
          <h2 className="mt-3 font-semibold">Shared context starts here</h2>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
            Chat normally. Connected agents can catch up through MCP, and direct @mentions create explicit invocations.
          </p>
        </div>

        {snapshot.messages.map((message, index) => {
          if (message.sender_type === "system") {
            return (
              <div key={message.id} className="py-3 text-center text-xs text-muted-foreground">
                <span className="rounded-full border bg-white/80 px-3 py-1.5">{message.body}</span>
              </div>
            );
          }

          const previous = snapshot.messages[index - 1];
          const grouped =
            previous?.sender_type === message.sender_type &&
            previous?.sender_user_id === message.sender_user_id &&
            previous?.sender_agent_id === message.sender_agent_id &&
            new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() < 5 * 60_000;

          return (
            <article
              key={message.id}
              className={`group relative flex gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-white/70 ${
                message.sender_type === "agent" ? "border border-primary/10 bg-primary/[0.035]" : ""
              } ${grouped ? "mt-0" : "mt-3"}`}
            >
              <div className="w-9 shrink-0">
                {!grouped && <Avatar name={message.sender_name} agent={message.sender_type === "agent"} />}
              </div>
              <div className="min-w-0 flex-1">
                {!grouped && (
                  <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold">{message.sender_name}</span>
                    {message.sender_type === "agent" && (
                      <>
                        <Badge className="px-1.5 py-0.5 text-[9px]">AGENT</Badge>
                        <span className="text-[11px] text-muted-foreground">{message.owner_name}’s agent</span>
                      </>
                    )}
                    <time className="text-[11px] text-muted-foreground">
                      {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
                        new Date(message.created_at),
                      )}
                    </time>
                  </div>
                )}
                {message.reply_to && (
                  <div className="mb-1.5 border-l-2 border-primary/30 pl-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/70">{message.reply_to.sender_name}</span>
                    <span className="ml-1 line-clamp-1">{message.reply_to.body}</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
              </div>
              <button
                onClick={() => onReply(message)}
                className="absolute right-2 top-2 grid size-8 place-items-center rounded-lg border bg-white text-muted-foreground opacity-0 shadow-sm transition hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                aria-label={`Reply to ${message.sender_name}`}
              >
                <CornerUpLeft className="size-3.5" />
              </button>
            </article>
          );
        })}

        {workingAgents.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin text-primary" />
            {workingAgents.map((agent) => agent.display_name).join(", ")} {workingAgents.length === 1 ? "is" : "are"} working…
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
