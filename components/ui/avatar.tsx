import * as React from "react";
import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  agent = false,
  className,
}: {
  name: string;
  agent?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-label={name}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-xs font-bold text-secondary-foreground",
        agent && "rounded-lg bg-primary text-primary-foreground",
        className,
      )}
    >
      {agent ? "✦" : initials(name)}
    </span>
  );
}
