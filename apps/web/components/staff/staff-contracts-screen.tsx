"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CategoryDrawer } from "@/components/menu/category-drawer";
import { CategoriesManageDrawer } from "@/components/menu/categories-manage-drawer";
import { StaffContractsSkeleton } from "@/components/staff/staff-contracts-skeleton";
import { StaffContractDrawer } from "@/components/staff/staff-contract-drawer";
import { useStaffModuleSelection } from "@/lib/contexts/staff-module-selection-context";
import { useStaffEmploymentTypesStorage } from "@/lib/hooks/use-staff-employment-types-storage";
import { fetchStaffContracts } from "@/lib/supabase/staff-db";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type {
  RestaurantStaffContractRow,
  StaffEmploymentTypeDefinition,
} from "@/lib/types/staff";
import {
  formatStaffContractDateDe,
  formatStaffContractEndDe,
} from "@/lib/staff/staff-contract-period";
import { staffEmploymentTypeLabel } from "@/lib/staff/staff-employment-type-label";
import { formatStaffContractPaySummary } from "@/lib/staff/staff-contract-pay";
import { staffDisplayName } from "@/lib/types/staff";
import { StaffSelectEmployeeHint } from "@/components/staff/staff-select-employee-hint";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { ListRangeCount } from "@/lib/ui/list-range-count";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";

const EMPLOYMENT_MANAGE_COPY = {
  title: "Beschäftigungsverhältnisse",
  description:
    "Reihenfolge per Ziehen ändern. Inaktive erscheinen nicht in der Vertragsauswahl.",
  newButton: "Neues Beschäftigungsverhältnis",
};

const EMPLOYMENT_DRAWER_LABELS = {
  titleCreate: "Neues Beschäftigungsverhältnis",
  titleEdit: "Beschäftigungsverhältnis bearbeiten",
  description: "Name und Sichtbarkeit — z. B. Vollzeit, Minijob, Werkstudent.",
  nameLabel: "Name",
  namePlaceholder: "z. B. Vollzeit",
  activeDescription:
    "Inaktive Beschäftigungsverhältnisse stehen bei neuen Verträgen nicht zur Auswahl.",
};

export function StaffContractsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const contractIdFromUrl = searchParams.get("contract");

  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { selectedStaff, selectedStaffId } = useStaffModuleSelection();
  const employmentTypes = useStaffEmploymentTypesStorage(restaurantId);
  const [contracts, setContracts] = useState<RestaurantStaffContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editContract, setEditContract] =
    useState<RestaurantStaffContractRow | null>(null);
  const [manageEmploymentOpen, setManageEmploymentOpen] = useState(false);
  const [employmentSheet, setEmploymentSheet] = useState<
    | { mode: "create" }
    | { mode: "edit"; item: StaffEmploymentTypeDefinition }
    | null
  >(null);

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

  const clearContractQuery = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has("contract")) return;
    params.delete("contract");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!contractIdFromUrl || loading || showSkeleton) return;

    const match = contracts.find((c) => c.id === contractIdFromUrl);
    clearContractQuery();

    if (match) {
      setEditContract(match);
      setDrawerOpen(true);
    }
  }, [
    contractIdFromUrl,
    loading,
    showSkeleton,
    contracts,
    clearContractQuery,
  ]);

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
      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full border-border/60"
          onClick={() => setManageEmploymentOpen(true)}
        >
          Beschäftigungsverhältnisse
        </Button>
      </div>

      <div className="mb-4 space-y-2">
        <p className="text-sm text-muted-foreground">
          Verträge für{" "}
          <span className="font-medium text-foreground">
            {staffDisplayName(selectedStaff)}
          </span>
        </p>
        {!showSkeleton ? (
          <ListRangeCount
            shown={contracts.length}
            total={contracts.length}
            itemLabel="Verträge"
          />
        ) : null}
        <Button
          type="button"
          size="lg"
          className={modulePrimaryAddButtonFullWidthClassName}
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
          ? contracts.map((c) => {
              const employmentLabel = staffEmploymentTypeLabel(
                c,
                employmentTypes.items,
              );
              return (
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
                    <p>{formatStaffContractPaySummary(c)}</p>
                    {employmentLabel ? <p>{employmentLabel}</p> : null}
                    {c.vacation_days_per_year != null ? (
                      <p>{c.vacation_days_per_year} Urlaubstage/Jahr</p>
                    ) : null}
                    {c.target_weekly_minutes != null ? (
                      <p>
                        Soll:{" "}
                        {Math.round((c.target_weekly_minutes / 60) * 10) / 10}{" "}
                        h/Woche
                      </p>
                    ) : null}
                    {c.note?.trim() ? (
                      <p className="line-clamp-2 text-xs">{c.note.trim()}</p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })
          : null}
        {!showSkeleton && contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Verträge.</p>
        ) : null}
      </div>

      <StaffContractDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setEditContract(null);
        }}
        restaurantId={restaurantId}
        staffId={selectedStaffId!}
        staffName={selectedStaff ? staffDisplayName(selectedStaff) : null}
        contract={editContract}
        existingContracts={contracts}
        employmentTypes={employmentTypes.items}
        onAddEmploymentType={employmentTypes.add}
        onSaved={() => void reload()}
        onDeleted={() => {
          setEditContract(null);
          void reload();
        }}
      />

      <CategoriesManageDrawer
        open={manageEmploymentOpen}
        onOpenChange={setManageEmploymentOpen}
        categories={employmentTypes.items.map((t) => ({
          id: t.id,
          name: t.name,
          active: t.active,
        }))}
        onReorder={(next) =>
          void employmentTypes.reorder(
            next.map((n) => {
              const full = employmentTypes.getById(n.id)!;
              return { ...full, name: n.name, active: n.active ?? true };
            }),
          )
        }
        onEdit={(row) => {
          const full = employmentTypes.getById(row.id);
          if (full) {
            setEmploymentSheet({ mode: "edit", item: full });
          }
          setManageEmploymentOpen(false);
        }}
        onNew={() => {
          setEmploymentSheet({ mode: "create" });
          setManageEmploymentOpen(false);
        }}
        copy={EMPLOYMENT_MANAGE_COPY}
      />

      <CategoryDrawer
        open={employmentSheet !== null}
        onOpenChange={(open) => {
          if (!open) setEmploymentSheet(null);
        }}
        mode={employmentSheet?.mode ?? "create"}
        initial={
          employmentSheet?.mode === "edit" ? employmentSheet.item : null
        }
        labels={EMPLOYMENT_DRAWER_LABELS}
        onSave={(payload) => {
          if ("id" in payload && payload.id) {
            void employmentTypes.update(payload.id, {
              name: payload.name,
              active: payload.active,
            });
          } else {
            void employmentTypes.add(payload.name, payload.active ?? true);
          }
          setEmploymentSheet(null);
        }}
      />
    </div>
  );
}
