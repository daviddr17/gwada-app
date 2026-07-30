import { cn } from "@/lib/utils";

/** Statischer Platzhalter — gleiche Mindesthöhe, kein Client-JS (CLS/LCP). */
export function LandingHeroAppPreviewPlaceholder({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn("landing-hero-rise-preview w-full", className)}
      aria-hidden
    >
      <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-[#e8e9ed]/95 ring-1 ring-black/[0.03] dark:border-white/10 dark:bg-[#1c1f2a]/95 dark:ring-white/[0.05]">
        <div className="h-8 border-b border-black/5 dark:border-white/10" />
        <div className="h-9 border-b border-black/5 bg-[#dfe1e6]/80 dark:border-white/10 dark:bg-black/25" />
        <div className="h-8 border-b border-border/40 bg-card dark:bg-[#121826]" />
        <div className="h-[12.5rem] bg-card dark:bg-[#121826] sm:h-[14rem] md:h-[15rem]" />
      </div>
    </div>
  );
}
