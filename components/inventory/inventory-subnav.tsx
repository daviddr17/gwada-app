"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/inventory", label: "Übersicht", match: (p: string) => p === "/inventory" || p === "/inventory/" },
  {
    href: "/inventory/bestellung",
    label: "Bestellung",
    match: (p: string) => p.startsWith("/inventory/bestellung"),
  },
] as const;

export function InventorySubnav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap gap-2 border-b border-border/50 pb-4"
      aria-label="Bestand-Bereiche"
    >
      {LINKS.map(({ href, label, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            prefetch
            className={cn(
              "inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors",
              active
                ? "border-accent bg-accent text-accent-foreground shadow-sm"
                : "border-border/60 bg-card text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
