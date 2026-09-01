import { LoaderCircle, MessageCircleMore } from "lucide-react";

export default function RoomLoading() {
  return (
    <main className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-4 text-sm text-muted-foreground">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <MessageCircleMore className="size-6" />
        </span>
        <span className="flex items-center gap-2">
          <LoaderCircle className="size-4 animate-spin" /> Opening the room…
        </span>
      </div>
    </main>
  );
}
