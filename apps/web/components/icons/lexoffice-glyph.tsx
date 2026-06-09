import { cn } from "@/lib/utils";

/** Lexware Office (ehem. Lexoffice) — vereinfachtes Markenzeichen. */
export function LexofficeGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={cn("size-5 shrink-0", className)}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <rect width="24" height="24" rx="6" fill="#00A88F" />
      <path
        fill="#fff"
        d="M7.2 16.5V7.5h2.1l2.55 5.4 2.55-5.4H16.8v9H14.7v-5.5l-2.2 4.6h-1.4l-2.2-4.6v5.5H7.2z"
      />
    </svg>
  );
}
