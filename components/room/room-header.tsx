"use client";

import { useState } from "react";
import { Bot, Check, Clock3, Copy, Info, Users } from "lucide-react";
import { BlipchatMark } from "@/components/blipchat-mark";
import type { RoomSnapshot } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";

export function RoomHeader({
  snapshot,
  onOpenPeople,
  onOpenDetails,
}: {
  snapshot: RoomSnapshot;
  onOpenPeople: () => void;
  onOpenDetails: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyInvite() {
    await navigator.clipboard.writeText(`${location.origin}/room/${snapshot.room.code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-white/90 px-3 backdrop-blur-xl sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/15">
          <BlipchatMark className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">BlipChat</p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock3 className="size-3" /> Expires {formatRelativeTime(snapshot.room.expires_at)}
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={copyInvite}
          className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 font-mono text-sm font-bold tracking-[0.15em] transition hover:bg-muted"
          aria-label="Copy invite link"
        >
          {snapshot.room.code.slice(0, 3)} {snapshot.room.code.slice(3)}
          {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5 text-muted-foreground" />}
        </button>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenPeople} aria-label="Show people">
          <Users className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenDetails} aria-label="Show room details">
          <Info className="size-4" />
        </Button>
        <div className="hidden items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1.5 text-xs font-medium text-secondary-foreground sm:flex">
          <Bot className="size-3.5" /> {snapshot.agents.filter((agent) => !agent.disconnected_at).length} agents
        </div>
      </div>
    </header>
  );
}
