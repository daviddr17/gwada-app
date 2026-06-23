"use client";

import { STAFF_CONTRACT_PLACEHOLDER_GROUPS } from "@/lib/staff/staff-contract-placeholders";
import { cn } from "@/lib/utils";

export function StaffContractPlaceholderReference({
  className,
  onInsert,
}: {
  className?: string;
  /** Klick auf Platzhalter — z. B. in fokussiertes Textfeld einfügen. */
  onInsert?: (token: string) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/40 bg-muted/15 p-3 text-xs",
        className,
      )}
    >
      <p className="mb-2 font-medium text-foreground">Platzhalter</p>
      <div className="space-y-3">
        {STAFF_CONTRACT_PLACEHOLDER_GROUPS.map((group) => (
          <div key={group.id}>
            <p className="mb-1 text-muted-foreground">{group.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.placeholders.map((ph) =>
                onInsert ? (
                  <button
                    key={ph.token}
                    type="button"
                    className="rounded-md border border-border/50 bg-background px-2 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:border-accent/40 hover:bg-accent/5"
                    title={ph.label}
                    onClick={() => onInsert(ph.token)}
                  >
                    {ph.token}
                  </button>
                ) : (
                  <span
                    key={ph.token}
                    className="rounded-md border border-border/50 bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                    title={ph.label}
                  >
                    {ph.token}
                  </span>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
