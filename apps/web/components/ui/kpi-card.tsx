import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
};

/** KPI-Zähler — vertikales Padding nur über Card (`py-4`), nicht doppelt in CardContent. */
export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
}: KpiCardProps) {
  return (
    <Card className={cn("border-border/50 shadow-card", className)}>
      <CardContent className={Icon ? "flex gap-3" : undefined}>
        {Icon ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Icon className="size-5" aria-hidden />
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p
            className={cn(
              "text-2xl font-semibold tracking-tight tabular-nums",
              Icon ? "mt-0.5" : "mt-1",
            )}
          >
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
