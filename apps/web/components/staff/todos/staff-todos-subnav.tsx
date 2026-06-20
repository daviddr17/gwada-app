"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard/mitarbeiter/todos", label: "Liste", exact: true },
  {
    href: "/dashboard/mitarbeiter/todos/protokoll",
    label: "Protokoll",
    exact: false,
  },
  {
    href: "/dashboard/mitarbeiter/todos/einstellungen",
    label: "Einstellungen",
    exact: true,
  },
] as const;

export function StaffTodosSubnav() {
  const pathname = usePathname();

  return (
    <nav
      className="mb-4 flex flex-wrap gap-2"
      aria-label="ToDo-Listen-Bereiche"
    >
      {ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-accent/50 bg-accent/10 text-foreground"
                : "border-border/60 bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
