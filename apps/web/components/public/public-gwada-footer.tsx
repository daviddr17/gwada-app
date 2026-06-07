import { cn } from "@/lib/utils";

/** Dezentes Gwada-Logo für öffentliche Gast-Seiten (Bewertung, …). */
export function PublicGwadaFooter({
  logoSrc,
  appName,
  className,
}: {
  logoSrc: string | null;
  appName: string;
  className?: string;
}) {
  const label = appName.trim() || "gwada";

  return (
    <footer
      className={cn(
        "shrink-0 px-4 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]",
        className,
      )}
      aria-label="Gwada"
    >
      <div className="mx-auto flex max-w-md justify-center">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt={label}
            decoding="async"
            className="h-6 w-auto max-w-[7rem] object-contain"
          />
        ) : (
          <span className="text-xs font-medium tracking-tight text-muted-foreground/80">
            {label}
          </span>
        )}
      </div>
    </footer>
  );
}
