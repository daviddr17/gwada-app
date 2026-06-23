import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StaffContractStatusBadgeProps = {
  signedAt?: string | null;
  employeeSignaturePending?: boolean;
  className?: string;
};

export function StaffContractStatusBadge({
  signedAt,
  employeeSignaturePending,
  className,
}: StaffContractStatusBadgeProps) {
  if (employeeSignaturePending) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "rounded-full border-amber-500/40 bg-amber-500/10 text-amber-800",
          className,
        )}
      >
        Wartet auf MA
      </Badge>
    );
  }
  if (signedAt) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-800",
          className,
        )}
      >
        Unterschrieben
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full border-border/60 bg-muted/30 text-muted-foreground",
        className,
      )}
    >
      Entwurf
    </Badge>
  );
}
