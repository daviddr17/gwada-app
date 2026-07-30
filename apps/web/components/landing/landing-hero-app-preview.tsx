import { cn } from "@/lib/utils";

const SIDEBAR_DOTS = [
  "bg-primary",
  "bg-muted-foreground/35",
  "bg-muted-foreground/35",
  "bg-muted-foreground/25",
  "bg-muted-foreground/25",
  "bg-muted-foreground/20",
] as const;

const KPI_TILES = [
  { label: "Reservierungen", value: "12", hint: "heute" },
  { label: "Offene Nachrichten", value: "3", hint: "neu" },
  { label: "Team im Dienst", value: "5", hint: "jetzt" },
] as const;

const FEED_ROWS = [
  { title: "Tisch 4 · 19:30", meta: "4 Personen · bestätigt", tone: "ok" },
  { title: "Tagliatelle al limone", meta: "Speisekarte · aktiv", tone: "muted" },
  { title: "WhatsApp · Anna M.", meta: "„Haben Sie noch Platz?“", tone: "accent" },
] as const;

/**
 * Leichter App-Shell-Mock für den Hero — kein Framer, nur CSS.
 * Zeigt Dashboard-Feeling statt Modul-Chip-Wolke.
 */
export function LandingHeroAppPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "landing-hero-rise-preview w-full max-w-3xl px-1",
        className,
      )}
      aria-hidden
    >
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-neutral-200/80 bg-card/95 shadow-[0_28px_80px_-28px_rgba(0,0,0,0.28)]",
          "ring-1 ring-black/[0.04] backdrop-blur-md",
          "dark:border-white/10 dark:bg-[#121826]/95 dark:shadow-[0_28px_80px_-28px_rgba(0,0,0,0.65)] dark:ring-white/[0.06]",
        )}
      >
        <div className="flex h-[13.5rem] sm:h-[15.5rem] md:h-[17rem]">
          {/* Sidebar */}
          <aside className="flex w-11 shrink-0 flex-col items-center gap-2.5 border-r border-border/50 bg-muted/40 py-3 dark:bg-black/30 sm:w-14 sm:gap-3 sm:py-4">
            <div className="landing-hero-preview-pulse mb-1 size-6 rounded-lg bg-primary/90 shadow-sm sm:size-7" />
            {SIDEBAR_DOTS.map((tone, i) => (
              <span
                key={i}
                className={cn(
                  "size-2 rounded-full sm:size-2.5",
                  tone,
                  i === 0 && "landing-hero-preview-dot",
                )}
              />
            ))}
          </aside>

          {/* Main */}
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center justify-between border-b border-border/40 px-3 py-2.5 sm:px-4">
              <div className="min-w-0 text-left">
                <p className="truncate text-[11px] font-semibold tracking-tight text-foreground sm:text-xs">
                  Dashboard
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  Heute · euer Restaurant
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="hidden rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent sm:inline">
                  Live
                </span>
                <span className="size-6 rounded-full bg-muted ring-1 ring-border/60" />
              </div>
            </header>

            <div className="grid flex-1 grid-cols-3 gap-1.5 p-2.5 sm:gap-2 sm:p-3">
              {KPI_TILES.map((tile, i) => (
                <div
                  key={tile.label}
                  className={cn(
                    "rounded-xl border border-border/50 bg-background/80 p-2 text-left shadow-sm dark:bg-background/40 sm:p-2.5",
                    i === 0 && "landing-hero-preview-kpi",
                  )}
                >
                  <p className="truncate text-[9px] font-medium text-muted-foreground sm:text-[10px]">
                    {tile.label}
                  </p>
                  <p className="mt-0.5 text-base font-semibold tracking-tight tabular-nums text-foreground sm:text-lg">
                    {tile.value}
                  </p>
                  <p className="text-[9px] text-muted-foreground sm:text-[10px]">
                    {tile.hint}
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 border-t border-border/40 px-2.5 py-2 sm:px-3 sm:py-2.5">
              {FEED_ROWS.map((row) => (
                <div
                  key={row.title}
                  className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-left"
                >
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      row.tone === "ok" && "bg-emerald-500",
                      row.tone === "accent" && "bg-accent",
                      row.tone === "muted" && "bg-muted-foreground/40",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-foreground sm:text-xs">
                      {row.title}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {row.meta}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
