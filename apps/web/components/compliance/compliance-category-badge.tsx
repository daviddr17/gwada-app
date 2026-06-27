"use client";

import { Badge } from "@/components/ui/badge";
import {
  COMPLIANCE_CATEGORY_LABELS,
  type ComplianceCategory,
} from "@/lib/types/compliance";
import { cn } from "@/lib/utils";

const CATEGORY_CLASS: Record<ComplianceCategory, string> = {
  temperature: "bg-sky-500/10 text-sky-800 dark:text-sky-200",
  cleaning: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  hot_hold: "bg-orange-500/10 text-orange-900 dark:text-orange-100",
  cooking: "bg-rose-500/10 text-rose-900 dark:text-rose-100",
  other: "bg-muted text-muted-foreground",
};

export function ComplianceCategoryBadge({
  category,
  className,
}: {
  category: ComplianceCategory;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("font-normal", CATEGORY_CLASS[category], className)}
    >
      {COMPLIANCE_CATEGORY_LABELS[category]}
    </Badge>
  );
}
