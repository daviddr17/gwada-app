"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StaffCollapsibleCardProps = {
  title: string;
  /** Kurzinfo in der Kopfzeile wenn eingeklappt. */
  collapsedSummary?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
};

/** Einklappbare Modul-Karte — Kopfzeile klickbar, standardmäßig zu. */
export function StaffCollapsibleCard({
  title,
  collapsedSummary,
  defaultOpen = false,
  className,
  children,
}: StaffCollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card
      className={cn(
        "mb-4 gap-0 overflow-hidden border-border/50 py-0 shadow-card",
        className,
      )}
    >
      <button
        type="button"
        className={cn(
          "flex w-full items-start gap-3 px-4 py-3.5 text-left outline-none transition-colors",
          "hover:bg-muted/40 focus-visible:bg-muted/40",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          open && "border-b border-border/40",
        )}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <CardTitle className="text-base font-semibold leading-tight">
            {title}
          </CardTitle>
          {!open && collapsedSummary ? (
            <div className="text-sm text-muted-foreground">{collapsedSummary}</div>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform duration-200",
            !open && "-rotate-90",
          )}
          aria-hidden
        />
      </button>
      {open ? <CardContent className="px-4 pb-4 pt-3">{children}</CardContent> : null}
    </Card>
  );
}
