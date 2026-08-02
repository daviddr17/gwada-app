"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  DOCS_NAV,
  docsNavActiveSectionHref,
  isDocsNavItemActive,
  isDocsNavSectionActive,
  type DocsNavItem,
} from "@/lib/docs/docs-navigation";
import { cn } from "@/lib/utils";

type DocsNavProps = {
  pathname: string;
  /** Drawer: Abschnitte einklappbar; Sidebar: immer ausgeklappt. */
  collapsible?: boolean;
  onNavigate?: () => void;
  className?: string;
};

export function DocsNav({
  pathname,
  collapsible = false,
  onNavigate,
  className,
}: DocsNavProps) {
  const activeSectionHref = docsNavActiveSectionHref(pathname);
  const [expandedHref, setExpandedHref] = useState<string | null>(
    activeSectionHref,
  );

  useEffect(() => {
    if (!collapsible) return;
    setExpandedHref(activeSectionHref);
  }, [pathname, collapsible, activeSectionHref]);

  return (
    <nav className={cn("space-y-1", className)} aria-label="Dokumentation">
      {DOCS_NAV.map((section) => (
        <DocsNavSection
          key={section.href}
          section={section}
          pathname={pathname}
          collapsible={collapsible}
          expanded={
            !collapsible ||
            expandedHref === section.href ||
            (!section.items && isDocsNavSectionActive(pathname, section))
          }
          onToggle={() => {
            if (!collapsible || !section.items) return;
            setExpandedHref((prev) =>
              prev === section.href ? null : section.href,
            );
          }}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function DocsNavSection({
  section,
  pathname,
  collapsible,
  expanded,
  onToggle,
  onNavigate,
}: {
  section: DocsNavItem;
  pathname: string;
  collapsible: boolean;
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const sectionActive = isDocsNavSectionActive(pathname, section);
  const hasItems = Boolean(section.items?.length);

  return (
    <div className="rounded-xl">
      {hasItems && collapsible ? (
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition-colors",
            sectionActive
              ? "bg-muted/50 text-foreground"
              : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
          )}
          aria-expanded={expanded}
        >
          <span>{section.title}</span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 transition-transform",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      ) : (
        <Link
          href={section.href}
          onClick={onNavigate}
          className={cn(
            "block rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors",
            sectionActive
              ? "bg-muted/50 text-foreground"
              : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
          )}
        >
          {section.title}
        </Link>
      )}

      {hasItems && expanded ? (
        <ul className="mt-1 space-y-0.5 border-l border-border/50 py-1 pl-3 ml-2.5">
          {section.items!.map((item) => {
            const active = isDocsNavItemActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "block rounded-md px-2 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-accent/10 font-medium text-accent"
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {item.title}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
