import { cn } from "@/lib/utils";

/** TripAdvisor „Owl“-Markenzeichen (vereinfacht). */
export function TripadvisorGlyph({ className }: { className?: string }) {
  return (
    <svg className={cn("size-5 shrink-0", className)} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#34E0A1" />
      <circle cx="8.5" cy="11" r="2.8" fill="#fff" />
      <circle cx="15.5" cy="11" r="2.8" fill="#fff" />
      <circle cx="8.5" cy="11" r="1.4" fill="#000" />
      <circle cx="15.5" cy="11" r="1.4" fill="#000" />
      <path
        fill="#000"
        d="M12 15.2c-1.4 0-2.6.6-3.4 1.6l1.2 1c.5-.7 1.3-1.1 2.2-1.1s1.7.4 2.2 1.1l1.2-1c-.8-1-2-1.6-3.4-1.6z"
      />
    </svg>
  );
}
