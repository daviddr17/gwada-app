import { cn } from "@/lib/utils";

export function MicrosoftGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={cn("size-5 shrink-0", className)}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path fill="#F25022" d="M3 3h8.5v8.5H3V3z" />
      <path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5V3z" />
      <path fill="#00A4EF" d="M3 12.5h8.5V21H3v-8.5z" />
      <path fill="#FFB900" d="M12.5 12.5H21V21h-8.5v-8.5z" />
    </svg>
  );
}
