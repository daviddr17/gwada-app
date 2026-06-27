"use client";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { DrawerFormBody, DrawerFormSection } from "@/components/ui/drawer-form-section";
import { ComplianceCategoryBadge } from "@/components/compliance/compliance-category-badge";
import { resolveComplianceRecordActorLabel } from "@/lib/supabase/compliance-db";
import type { RestaurantComplianceRecordRow } from "@/lib/types/compliance";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";

const whenFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatValue(value: unknown): string {
  if (value === true) return "Ja";
  if (value === false) return "Nein";
  if (value == null || value === "") return "—";
  if (typeof value === "number") return `${value} °C`;
  return String(value);
}

type ComplianceRecordDetailDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: RestaurantComplianceRecordRow | null;
};

export function ComplianceRecordDetailDrawer({
  open,
  onOpenChange,
  record,
}: ComplianceRecordDetailDrawerProps) {
  if (!record) return null;

  const checklist = record.checklist as
    | (RestaurantComplianceRecordRow["checklist"] & { items?: { id: string; label: string }[] })
    | null;

  const itemLabels = new Map(
    (checklist?.items ?? []).map((item) => [item.id, item.label] as const),
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={drawerContentClassName("overview")}>
        <DrawerHeader>
          <DrawerTitle>{checklist?.name ?? "Eintrag"}</DrawerTitle>
        </DrawerHeader>
        <DrawerFormBody>
          <DrawerFormSection title="Meta">
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Zeitpunkt: </span>
                {whenFmt.format(new Date(record.performed_at))}
              </p>
              <p>
                <span className="text-muted-foreground">Erfasst von: </span>
                {resolveComplianceRecordActorLabel(record)}
              </p>
              <p>
                <span className="text-muted-foreground">Quelle: </span>
                {record.source === "display" ? "Display" : "Dashboard"}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {checklist?.category ? (
                  <ComplianceCategoryBadge category={checklist.category} />
                ) : null}
                {record.has_deviation ? (
                  <Badge variant="destructive">Abweichung</Badge>
                ) : (
                  <Badge variant="secondary">OK</Badge>
                )}
              </div>
            </div>
          </DrawerFormSection>

          <DrawerFormSection title="Werte">
            <div className="space-y-2">
              {Object.entries(record.values).map(([itemId, entry]) => (
                <div
                  key={itemId}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border/40 px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground">
                    {itemLabels.get(itemId) ?? itemId}
                  </span>
                  <span className="text-end font-medium">
                    {formatValue(entry.value)}
                    {entry.withinLimits === false ? (
                      <span className="ms-2 text-destructive">!</span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </DrawerFormSection>

          {record.corrective_action?.trim() ? (
            <DrawerFormSection title="Korrekturmaßnahme">
              <p className="text-sm">{record.corrective_action.trim()}</p>
            </DrawerFormSection>
          ) : null}

          {record.notes?.trim() ? (
            <DrawerFormSection title="Notiz">
              <p className="text-sm">{record.notes.trim()}</p>
            </DrawerFormSection>
          ) : null}
        </DrawerFormBody>
      </DrawerContent>
    </Drawer>
  );
}
