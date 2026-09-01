"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, LoaderCircle, MessageCircleMore, RefreshCw } from "lucide-react";
import type { RoomSnapshot } from "@/lib/domain";
import { createClient, ensureAnonymousSession } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { RoomShell } from "@/components/room/room-shell";

export function RoomClient({ code }: { code: string }) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRoomId = snapshot?.room.id;
  const viewerId = snapshot?.viewer.id;
  const viewerDisplayName = snapshot?.viewer.display_name;

  const refresh = useCallback(async (roomId: string) => {
    const response = await fetch(`/api/rooms/${roomId}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Could not refresh the room.");
    setSnapshot(payload);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function enterRoom() {
      try {
        await ensureAnonymousSession();
        const join = await fetch("/api/rooms/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const joined = await join.json();
        if (!join.ok) throw new Error(joined.error ?? "Could not join this room.");
        if (!cancelled) await refresh(joined.room.id);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not join this room.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    enterRoom();
    return () => {
      cancelled = true;
    };
  }, [code, refresh]);

  useEffect(() => {
    if (!activeRoomId || !viewerId || !viewerDisplayName) return;
    const supabase = createClient();
    const roomId = activeRoomId;
    const channel = supabase.channel(`room:${roomId}`, {
      config: { private: true, presence: { key: viewerId } },
    });

    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        refresh(roomId).catch((cause) =>
          setError(cause instanceof Error ? cause.message : "Realtime refresh failed."),
        );
      }, 120);
    };

    channel
      .on("broadcast", { event: "INSERT" }, scheduleRefresh)
      .on("broadcast", { event: "UPDATE" }, scheduleRefresh)
      .on("broadcast", { event: "DELETE" }, scheduleRefresh)
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>();
        Object.values(state)
          .flat()
          .forEach((presence) => {
            const userId = (presence as { user_id?: string }).user_id;
            if (userId) ids.add(userId);
          });
        setOnlineUserIds(ids);
      })
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: viewerId,
            display_name: viewerDisplayName,
            online_at: new Date().toISOString(),
          });
        }
      });

    const interval = setInterval(() => refresh(roomId).catch(() => undefined), 30_000);
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      clearInterval(interval);
      channel.untrack().catch(() => undefined);
      supabase.removeChannel(channel);
    };
  }, [activeRoomId, refresh, viewerDisplayName, viewerId]);

  if (loading) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-4 text-sm text-muted-foreground">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <MessageCircleMore className="size-6" />
          </span>
          <span className="flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin" /> Joining room {code}…
          </span>
        </div>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="grid min-h-dvh place-items-center px-5">
        <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-xl shadow-slate-900/5">
          <AlertTriangle className="mx-auto size-9 text-amber-500" />
          <h1 className="mt-4 text-xl font-semibold">This room is unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{error}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => location.reload()}>
              <RefreshCw className="size-4" /> Try again
            </Button>
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              Go home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <RoomShell
      snapshot={snapshot}
      onlineUserIds={onlineUserIds}
      refresh={() => refresh(snapshot.room.id)}
      transientError={error}
      clearTransientError={() => setError(null)}
    />
  );
}
