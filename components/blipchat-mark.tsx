/**
 * BlipChat wordmark glyph: a pager/beeper with a signal blip.
 *
 * Drawn on lucide's 24x24 grid with stroke-width 2 and round caps so it sits
 * beside the lucide icons used elsewhere without looking imported from a
 * different set. Strokes use currentColor, so the mark inherits whatever the
 * surrounding tile sets (primary-foreground on the brand tile).
 */
export function BlipchatMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {/* pager body */}
      <rect x="2.5" y="6" width="13" height="15" rx="2.6" />
      {/* screen */}
      <path d="M5.5 9.5h7v4h-7z" />
      {/* keypad */}
      <path d="M6 17.2h6" />
      {/* antenna */}
      <path d="M15.9 8.4 18.4 5.9" />
      {/* signal blip */}
      <circle cx="20.4" cy="3.9" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
