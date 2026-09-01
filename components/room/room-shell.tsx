"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, X } from "lucide-react";
import type { Message, RoomSnapshot } from "@/lib/domain";
import { RoomHeader } from "@/components/room/room-header";
import { ParticipantPanel } from "@/components/room/participant-panel";
import { DetailsPanel } from "@/components/room/details-panel";
import { ChatFeed } from "@/components/room/chat-feed";
import { MessageComposer } from "@/components/room/message-composer";
import { ConnectAgentDialog } from "@/components/room/connect-agent-dialog";
import { Button } from "@/components/ui/button";

type MobilePanel = "people" | "details" | null;

export function RoomShell({
  snapshot,
  onlineUserIds,
  refresh,
  transientError,
  clearTransientError,
}: {
  snapshot: RoomSnapshot;
  onlineUserIds: Set<string>;
  refresh: () => Promise<void>;
  transientError: string | null;
  clearTransientError: () => void;
}) {
  const router = useRouter();
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  async function revokeAgent(agentId: string) {
    const agent = snapshot.agents.find((candidate) => candidate.id === agentId);
    if (!agent || !confirm(`Disconnect ${agent.display_name}? Its MCP token will stop working immediately.`)) return;
    const response = await fetch(`/api/rooms/${snapshot.room.id}/agents/${agentId}/revoke`, {
      method: "POST",
    });
    if (response.ok) await refresh();
  }

  async function closeRoom() {
    if (!confirm("Close this room and permanently delete its chat, memberships, and agent credentials?")) return;
    const response = await fetch(`/api/rooms/${snapshot.room.id}/close`, { method: "POST" });
    if (response.ok) router.replace("/");
  }

  const peoplePanel = (
    <ParticipantPanel
      snapshot={snapshot}
      onlineUserIds={onlineUserIds}
      onConnectAgent={() => setConnectOpen(true)}
      onRevokeAgent={revokeAgent}
    />
  );

  const detailsPanel = (
    <DetailsPanel
      snapshot={snapshot}
      onConnectAgent={() => setConnectOpen(true)}
      onCloseRoom={closeRoom}
    />
  );

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background/80">
      <RoomHeader
        snapshot={snapshot}
        onOpenPeople={() => setMobilePanel("people")}
        onOpenDetails={() => setMobilePanel("details")}
      />

      {transientError && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          <AlertCircle className="size-3.5" /> {transientError}
          <button className="ml-auto" onClick={clearTransientError} aria-label="Dismiss">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[248px_minmax(0,1fr)_286px]">
        <div className="hidden min-h-0 border-r lg:block">{peoplePanel}</div>
        <section className="flex min-h-0 min-w-0 flex-col">
          <ChatFeed snapshot={snapshot} onReply={setReplyTo} />
          <MessageComposer
            roomId={snapshot.room.id}
            agents={snapshot.agents}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            onSent={refresh}
          />
        </section>
        <div className="hidden min-h-0 border-l lg:block">{detailsPanel}</div>
      </div>

      {mobilePanel && (
        <div className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm lg:hidden" onMouseDown={(event) => event.target === event.currentTarget && setMobilePanel(null)}>
          <div className={`absolute inset-y-0 w-[min(86vw,340px)] bg-white shadow-2xl ${mobilePanel === "people" ? "left-0" : "right-0"}`}>
            <div className="absolute right-3 top-3 z-10">
              <Button variant="ghost" size="icon-sm" onClick={() => setMobilePanel(null)} aria-label="Close panel">
                <X className="size-4" />
              </Button>
            </div>
            {mobilePanel === "people" ? peoplePanel : detailsPanel}
          </div>
        </div>
      )}

      <ConnectAgentDialog
        roomId={snapshot.room.id}
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={refresh}
      />
    </main>
  );
}
