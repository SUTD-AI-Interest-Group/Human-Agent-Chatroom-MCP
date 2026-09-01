"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, DoorOpen, LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ensureAnonymousSession } from "@/lib/supabase/client";

type Mode = "create" | "join";

export function HomeActions() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await ensureAnonymousSession();
      const response = await fetch(mode === "create" ? "/api/rooms" : "/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(mode === "join" ? { code } : {}),
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not open the room.");
      router.push(`/room/${payload.room.code}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open the room.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/80 bg-white/90 p-2 shadow-[0_24px_80px_-30px_rgba(41,44,95,0.42)] backdrop-blur-xl">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        <button
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
            mode === "create" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
          }`}
          onClick={() => setMode("create")}
        >
          Create a room
        </button>
        <button
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
            mode === "join" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
          }`}
          onClick={() => setMode("join")}
        >
          Join with code
        </button>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <h2 className="font-semibold">
            {mode === "create" ? "Start a shared workspace" : "Join your collaborators"}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {mode === "create"
              ? "No signup. Your room gets a six-digit invite code."
              : "Enter the code shown by the room creator."}
          </p>
        </div>

        {mode === "join" && (
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Room code
            </span>
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000 000"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="h-13 text-center font-mono text-xl tracking-[0.35em]"
              onKeyDown={(event) => event.key === "Enter" && code.length === 6 && submit()}
            />
          </label>
        )}

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Display name <span className="font-normal normal-case">(optional)</span>
          </span>
          <Input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value.slice(0, 32))}
            placeholder="We can pick one for you"
            onKeyDown={(event) => event.key === "Enter" && submit()}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button
          size="lg"
          className="w-full"
          onClick={submit}
          disabled={pending || (mode === "join" && code.length !== 6)}
        >
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : mode === "create" ? (
            <Plus className="size-4" />
          ) : (
            <DoorOpen className="size-4" />
          )}
          {mode === "create" ? "Create room" : "Join room"}
          {!pending && <ArrowRight className="ml-auto size-4" />}
        </Button>
      </div>
    </div>
  );
}
