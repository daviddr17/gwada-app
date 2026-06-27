import { Badge } from "@/components/ui/badge";
import {
  staffContractBadgeKind,
  type StaffContractBadgeKind,
} from "@/lib/staff/staff-contract-status";
import type { RestaurantStaffContractRow } from "@/lib/types/staff";
import { cn } from "@/lib/utils";

type StaffContractStatusBadgeProps = {
  contract: Pick<
    RestaurantStaffContractRow,
    | "signed_at"
    | "employee_signature_pending"
    | "contract_body_snapshot"
    | "signature_employer"
    | "contract_source"
    | "current_document_id"
  >;
  className?: string;
};

const BADGE_STYLES: Record<
  StaffContractBadgeKind,
  { label: string; className: string }
> = {
  pending_employee: {
    label: "Wartet auf MA",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-800",
  },
  signed: {
    label: "Unterschrieben",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800",
  },
  draft: {
    label: "Entwurf",
    className: "border-border/60 bg-muted/30 text-muted-foreground",
  },
  external_draft: {
    label: "Extern · Entwurf",
    className: "border-violet-500/40 bg-violet-500/10 text-violet-900",
  },
  external_open: {
    label: "Extern · offen",
    className: "border-violet-500/40 bg-violet-500/10 text-violet-900",
  },
  external_signed: {
    label: "Extern · unterschrieben",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800",
  },
};

export function StaffContractStatusBadge({
  contract,
  className,
}: StaffContractStatusBadgeProps) {
  const kind = staffContractBadgeKind(contract);
  const style = BADGE_STYLES[kind];

  return (
    <Badge
      variant="outline"
      className={cn("rounded-full", style.className, className)}
    >
      {style.label}
    </Badge>
  );
}
