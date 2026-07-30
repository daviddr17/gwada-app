import Link from "next/link";
import { cn } from "@/lib/utils";

const LEGAL_NAV = [
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/agb", label: "AGB" },
  { href: "/avv", label: "AVV" },
  { href: "/datenloeschung", label: "Datenlöschung" },
] as const;

type Props = {
  title: string;
  description?: string;
  updatedLabel?: string;
  activePath?: (typeof LEGAL_NAV)[number]["href"];
  children: React.ReactNode;
};

export function MarketingStaticPage({
  title,
  description,
  updatedLabel,
  activePath,
  children,
}: Props) {
  return (
    <div className="min-h-dvh bg-background px-6 py-16 text-foreground antialiased md:py-24">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Startseite
        </Link>

        <nav
          aria-label="Rechtliches"
          className="mt-8 flex flex-wrap gap-x-4 gap-y-2 border-b border-border/50 pb-4 text-sm"
        >
          {LEGAL_NAV.map((item) => {
            const active = activePath === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "font-medium underline-offset-4 hover:underline",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <h1 className="mt-8 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 text-pretty text-muted-foreground md:text-lg">
            {description}
          </p>
        ) : null}
        {updatedLabel ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Stand: {updatedLabel}
          </p>
        ) : null}

        <div
          className={cn(
            "mt-8 space-y-5 text-pretty text-sm leading-relaxed text-muted-foreground md:text-base",
            "[&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground",
            "[&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground",
            "[&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5",
            "[&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5",
            "[&_a]:font-medium [&_a]:text-foreground [&_a]:underline-offset-4 hover:[&_a]:underline",
            "[&_strong]:font-semibold [&_strong]:text-foreground/90",
            "[&_address]:not-italic",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
