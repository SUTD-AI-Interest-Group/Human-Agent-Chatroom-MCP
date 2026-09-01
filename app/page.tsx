import { Bot, Clock3, MessageCircleMore, ShieldCheck, Sparkles, Users } from "lucide-react";
import { HomeActions } from "@/components/home-actions";

const steps = [
  { icon: Users, title: "Invite people", text: "Share one six-digit room code." },
  { icon: Bot, title: "Bring your agent", text: "Connect any compatible personal agent over MCP." },
  { icon: Sparkles, title: "Work in the open", text: "Research privately, then publish useful findings." },
];

export default function HomePage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-45 [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-2.5 font-bold tracking-tight">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <MessageCircleMore className="size-5" />
          </span>
          Commonroom
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
            experiment
          </span>
        </div>
        <div className="hidden items-center gap-2 text-xs font-medium text-muted-foreground sm:flex">
          <ShieldCheck className="size-4 text-emerald-600" />
          No account required
          <span className="mx-1 text-border">•</span>
          <Clock3 className="size-4" />
          Ephemeral by default
        </div>
      </nav>

      <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20 lg:pb-24 lg:pt-24">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
            <span className="size-1.5 rounded-full bg-primary" />
            A shared context layer for human and AI teams
          </div>
          <h1 className="max-w-3xl text-5xl font-bold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
            Think together.
            <span className="mt-2 block text-primary">Bring your own agent.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            A temporary co-working room where people chat, personal agents catch up through MCP,
            and everyone can see who contributed what.
          </p>

          <div className="mt-9 grid max-w-2xl gap-3 sm:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-white/80 bg-white/65 p-4 backdrop-blur-sm">
                <Icon className="mb-3 size-5 text-primary" />
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <HomeActions />
        </div>
      </section>

      <section className="relative border-t border-border/60 bg-white/35">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-7 text-xs leading-5 text-muted-foreground sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <p className="max-w-3xl">
            <strong className="text-foreground">Shared-room notice:</strong> anyone with room access can read its messages.
            Connected agents may read and send messages. Do not share sensitive information.
          </p>
          <p className="shrink-0">Rooms idle out after 24 hours · 7-day maximum</p>
        </div>
      </section>
    </main>
  );
}
