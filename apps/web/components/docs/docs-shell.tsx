"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_NAV, type DocsNavItem } from "@/lib/docs/docs-navigation";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string): boolean {
  if (href === "/docs") return pathname === "/docs";
  if (href.startsWith("/docs/handbuch/") && pathname.startsWith("/docs/handbuch/")) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isSectionActive(pathname: string, section: DocsNavItem): boolean {
  if (isActive(pathname, section.href)) return true;
  if (section.items?.some((item) => pathname === item.href)) return true;
  if (
    section.href.startsWith("/docs/handbuch/") &&
    pathname.startsWith("/docs/handbuch/")
  ) {
    return true;
  }
  return false;
}

export function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/50 bg-[var(--app-chrome-fixed-zone)]/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <Link
              href="/"
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              ← gwada.app
            </Link>
            <p className="mt-1 text-lg font-semibold tracking-tight">Dokumentation</p>
          </div>
          <Link
            href="/login"
            className="shrink-0 rounded-lg border border-border/60 px-3 py-1.5 text-sm font-medium hover:bg-muted/30"
          >
            Anmelden
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <nav className="space-y-5" aria-label="Dokumentation">
            {DOCS_NAV.map((section) => (
              <div key={section.href}>
                <Link
                  href={section.href}
                  className={cn(
                    "block text-sm font-semibold",
                    isSectionActive(pathname, section)
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {section.title}
                </Link>
                {section.items ? (
                  <ul className="mt-2 space-y-1 border-l border-border/50 pl-3">
                    {section.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "block py-0.5 text-sm",
                            pathname === item.href
                              ? "font-medium text-accent"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {item.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 pb-16">{children}</main>
      </div>
    </div>
  );
}
