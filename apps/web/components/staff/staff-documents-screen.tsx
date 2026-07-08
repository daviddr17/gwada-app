"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { StaffDocumentsAllTable } from "@/components/staff/staff-documents-all-table";
import { StaffDocumentsList } from "@/components/staff/staff-documents-list";
import { StaffDocumentsSkeleton } from "@/components/staff/staff-documents-skeleton";
import { StaffTodosTableSkeleton } from "@/components/staff/todos/staff-todos-skeleton";
import { useStaffModuleSelection } from "@/lib/contexts/staff-module-selection-context";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  fetchStaffDocumentsForEmployee,
  fetchStaffDocumentsForRestaurant,
  staffDocumentsExportUrl,
  type StaffDocumentListItem,
} from "@/lib/staff/staff-documents-api";
import { staffDisplayName } from "@/lib/types/staff";
import { ListRangeCount } from "@/lib/ui/list-range-count";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";

export function StaffDocumentsScreen() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { selectedStaff, selectedStaffId, staffList, setSelectedStaffId } =
    useStaffModuleSelection();
  const [documents, setDocuments] = useState<StaffDocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  const reload = useCallback(async () => {
    if (!restaurantId) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = selectedStaffId
      ? await fetchStaffDocumentsForEmployee({
          restaurantId,
          staffId: selectedStaffId,
        })
      : await fetchStaffDocumentsForRestaurant({ restaurantId });
    setLoading(false);
    if (error) {
      toast.error("Dokumente konnten nicht geladen werden.");
      setDocuments([]);
      return;
    }
    setDocuments(data);
  }, [restaurantId, selectedStaffId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  if (!selectedStaff) {
    return (
      <div className="pb-16">
        {showSkeleton ? (
          <StaffTodosTableSkeleton />
        ) : (
          <StaffDocumentsAllTable
            restaurantId={restaurantId}
            documents={documents}
            staffList={staffList}
            onSelectStaff={setSelectedStaffId}
          />
        )}
      </div>
    );
  }

  return (
    <div className="pb-16">
      <ListRangeCount
        shown={documents.length}
        total={documents.length}
        itemLabel="Dokumente"
        className="mb-4"
      />
      {showSkeleton ? (
        <StaffDocumentsSkeleton />
      ) : (
        <StaffDocumentsList
          restaurantId={restaurantId}
          documents={documents}
          exportZipUrl={
            selectedStaffId
              ? staffDocumentsExportUrl({
                  restaurantId,
                  staffId: selectedStaffId,
                })
              : null
          }
          emptyMessage={`Für ${staffDisplayName(selectedStaff)} liegen noch keine Dokumente vor — Vertrags-PDFs erscheinen nach digitaler Vertragserstellung.`}
        />
      )}
    </div>
  );
}
