"use client";

import { AlertTriangle, Clock3, Copy, DoorClosed, KeyRound, Link2, ShieldAlert } from "lucide-react";
import type { RoomSnapshot } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatRelativeTime } from "@/lib/utils";

export function DetailsPanel({
  snapshot,
  onConnectAgent,
  onCloseRoom,
}: {
  snapshot: RoomSnapshot;
  onConnectAgent: () => void;
  onCloseRoom: () => void;
}) {
  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
  }

  return (
    <aside className="h-full overflow-y-auto bg-white/65 p-4 scrollbar-subtle">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Room details</p>
      <div className="mt-4 rounded-2xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <Badge variant="success">Active</Badge>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock3 className="size-3" /> {formatRelativeTime(snapshot.room.expires_at)}
          </span>
        </div>
        <p className="mt-4 text-xs font-medium text-muted-foreground">Invite code</p>
        <button
          className="mt-1 flex w-full items-center justify-between rounded-xl bg-muted px-3 py-2.5 font-mono text-lg font-bold tracking-[0.2em]"
          onClick={() => copy(snapshot.room.code)}
        >
          {snapshot.room.code.slice(0, 3)} {snapshot.room.code.slice(3)}
          <Copy className="size-4 text-muted-foreground" />
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full"
          onClick={() => copy(`${location.origin}/room/${snapshot.room.code}`)}
        >
          <Link2 className="size-3.5" /> Copy invite link
        </Button>
      </div>

      <Separator className="my-5" />

      <div>
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          <p className="text-sm font-semibold">Agent access</p>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Each agent gets a separate room-scoped BlipChat MCP credential. Use a custom nickname and revoke access at any time.
        </p>
        <Button className="mt-3 w-full" onClick={onConnectAgent}>
          Connect an agent
        </Button>
      </div>

      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <ShieldAlert className="size-4" /> Shared context
        </div>
        <p className="mt-2 text-xs leading-5 text-amber-800">
          Everyone in this room, including connected agents, can read its messages. Keep private or sensitive material elsewhere.
        </p>
      </div>

      {snapshot.viewer.is_owner && (
        <div className="mt-5">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="size-3.5" /> Closing deletes this room and its shared content.
          </p>
          <Button variant="destructive" className="mt-3 w-full" onClick={onCloseRoom}>
            <DoorClosed className="size-4" /> Close and delete room
          </Button>
        </div>
      )}
    </aside>
  );
}
