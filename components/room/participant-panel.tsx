"use client";

import { Bot, Circle, MoreHorizontal, PlugZap, UserRound } from "lucide-react";
import type { RoomSnapshot } from "@/lib/domain";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const statusCopy = {
  online: { label: "Online", className: "text-emerald-600" },
  working: { label: "Working", className: "text-violet-600" },
  idle: { label: "Idle", className: "text-amber-600" },
  unavailable: { label: "Unavailable", className: "text-slate-400" },
} as const;

export function ParticipantPanel({
  snapshot,
  onlineUserIds,
  onConnectAgent,
  onRevokeAgent,
}: {
  snapshot: RoomSnapshot;
  onlineUserIds: Set<string>;
  onConnectAgent: () => void;
  onRevokeAgent: (agentId: string) => Promise<void>;
}) {
  const activeAgents = snapshot.agents.filter((agent) => !agent.disconnected_at);

  return (
    <aside className="flex h-full flex-col bg-white/65">
      <div className="flex items-center justify-between px-4 pb-2 pt-5">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
          <UserRound className="size-3.5" /> People
        </p>
        <span className="text-xs tabular-nums text-muted-foreground">{snapshot.participants.length}</span>
      </div>
      <div className="space-y-1 px-2">
        {snapshot.participants.map((person) => {
          const online = onlineUserIds.has(person.id) || person.id === snapshot.viewer.id;
          return (
            <div key={person.id} className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-muted/70">
              <div className="relative">
                <Avatar name={person.display_name} />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white ${
                    online ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {person.display_name}
                  {person.id === snapshot.viewer.id && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">you</span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {person.is_owner ? "Room creator" : online ? "Here now" : "Offline"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <Separator className="my-4" />

      <div className="flex items-center justify-between px-4 pb-2">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
          <Bot className="size-3.5" /> Agents
        </p>
        <span className="text-xs tabular-nums text-muted-foreground">{activeAgents.length}</span>
      </div>
      <div className="space-y-1 px-2">
        {activeAgents.length === 0 && (
          <div className="mx-2 rounded-xl border border-dashed p-4 text-center">
            <Bot className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-xs leading-5 text-muted-foreground">No agents are connected yet.</p>
          </div>
        )}
        {activeAgents.map((agent) => {
          const status = statusCopy[agent.connection_status];
          const canRevoke = agent.owner_user_id === snapshot.viewer.id || snapshot.viewer.is_owner;
          return (
            <div key={agent.id} className="group flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-muted/70">
              <div className="relative">
                <Avatar name={agent.display_name} agent />
                <Circle className={`absolute -bottom-0.5 -right-0.5 size-3 fill-current ${status.className}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-medium">{agent.display_name}</p>
                  <Badge className="px-1.5 py-0.5 text-[9px]">AI</Badge>
                </div>
                <p className="truncate text-[11px] text-muted-foreground">
                  {agent.owner_display_name}’s agent · {status.label}
                </p>
              </div>
              {canRevoke && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                  onClick={() => onRevokeAgent(agent.id)}
                  aria-label={`Disconnect ${agent.display_name}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-auto p-3">
        <Button variant="outline" className="w-full justify-start" onClick={onConnectAgent}>
          <PlugZap className="size-4 text-primary" /> Connect your agent
        </Button>
      </div>
    </aside>
  );
}
