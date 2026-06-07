import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type SuperadminKpi = {
  label: string;
  value: string;
  hint?: string;
};

export function SuperadminStatsKpiGrid({
  items,
  className,
}: {
  items: SuperadminKpi[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5",
        className,
      )}
    >
      {items.map((item) => (
        <Card
          key={item.label}
          className="border-border/50 shadow-card"
        >
          <CardHeader className="gap-1 pb-2">
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className="text-3xl tabular-nums tracking-tight">
              {item.value}
            </CardTitle>
            {item.hint ? (
              <p className="text-xs text-muted-foreground">{item.hint}</p>
            ) : null}
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
