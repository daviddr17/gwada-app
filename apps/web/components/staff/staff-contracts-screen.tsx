"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StaffContractsSkeleton } from "@/components/staff/staff-contracts-skeleton";
import { StaffContractDrawer } from "@/components/staff/staff-contract-drawer";
import { useStaffModuleSelection } from "@/lib/contexts/staff-module-selection-context";
import { fetchStaffContracts } from "@/lib/supabase/staff-db";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { RestaurantStaffContractRow } from "@/lib/types/staff";
import {
  formatStaffContractDateDe,
  formatStaffContractEndDe,
} from "@/lib/staff/staff-contract-period";
import {
  STAFF_CONTRACT_PAY_LABELS,
  STAFF_EMPLOYMENT_LABELS,
  staffDisplayName,
} from "@/lib/types/staff";
import { StaffSelectEmployeeHint } from "@/components/staff/staff-select-employee-hint";
import { modulePrimaryAddButtonClassName } from "@/lib/ui/module-primary-add-button";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";

function formatEuro(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function StaffContractsScreen() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { selectedStaff, selectedStaffId } = useStaffModuleSelection();
  const [contracts, setContracts] = useState<RestaurantStaffContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editContract, setEditContract] =
    useState<RestaurantStaffContractRow | null>(null);
  const reload = useCallback(async () => {
    if (!restaurantId || !selectedStaffId) {
      setContracts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await fetchStaffContracts(
      restaurantId,
      selectedStaffId,
    );
    setLoading(false);
    if (error) toast.error(error);
    else setContracts(data);
  }, [restaurantId, selectedStaffId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openNew = () => {
    setEditContract(null);
    setDrawerOpen(true);
  };

  const openEdit = (c: RestaurantStaffContractRow) => {
    setEditContract(c);
    setDrawerOpen(true);
  };

  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  if (!selectedStaff) {
    return <StaffSelectEmployeeHint />;
  }

  return (
    <div className="pb-16">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Verträge für{" "}
          <span className="font-medium text-foreground">
            {staffDisplayName(selectedStaff)}
          </span>
        </p>
        <Button
          type="button"
          className={modulePrimaryAddButtonClassName}
          onClick={openNew}
        >
          <Plus className="size-4" />
          Neuer Vertrag
        </Button>
      </div>

      <div className="space-y-3">
        {loading && !showSkeleton ? (
          <div className="min-h-[14rem]" aria-busy="true" />
        ) : null}
        {showSkeleton ? <StaffContractsSkeleton /> : null}
        {!showSkeleton
          ? contracts.map((c) => (
          <Card
            key={c.id}
            className="cursor-pointer border-border/50 shadow-card"
            onClick={() => openEdit(c)}
          >
            <CardHeader className="pb-2">
              <div className="space-y-1">
                <p className="text-base leading-snug">
                  <span className="text-muted-foreground">Start </span>
                  <span className="font-medium text-foreground tabular-nums">
                    {formatStaffContractDateDe(c.valid_from)}
                  </span>
                </p>
                <p className="text-base leading-snug">
                  <span className="text-muted-foreground">Ende </span>
                  <span className="font-medium text-foreground tabular-nums">
                    {formatStaffContractEndDe(c.valid_to)}
                  </span>
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>
                {c.pay_type === "hourly"
                  ? `${STAFF_CONTRACT_PAY_LABELS.hourly}: ${formatEuro(c.hourly_rate_cents)}`
                  : `${STAFF_CONTRACT_PAY_LABELS.fixed}: ${formatEuro(c.fixed_salary_cents)}`}
              </p>
              {c.employment_type ? (
                <p>{STAFF_EMPLOYMENT_LABELS[c.employment_type]}</p>
              ) : null}
              {c.vacation_days_per_year != null ? (
                <p>{c.vacation_days_per_year} Urlaubstage/Jahr</p>
              ) : null}
              {c.note?.trim() ? (
                <p className="line-clamp-2 text-xs">{c.note.trim()}</p>
              ) : null}
            </CardContent>
          </Card>
            ))
          : null}
        {!showSkeleton && contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Verträge.</p>
        ) : null}
      </div>

      <StaffContractDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        restaurantId={restaurantId}
        staffId={selectedStaffId!}
        contract={editContract}
        existingContracts={contracts}
        onSaved={() => void reload()}
        onDeleted={() => {
          setEditContract(null);
          void reload();
        }}
      />
    </div>
  );
}
