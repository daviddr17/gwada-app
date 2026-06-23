"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { StaffDocumentsList } from "@/components/staff/staff-documents-list";
import { StaffDocumentsSkeleton } from "@/components/staff/staff-documents-skeleton";
import { StaffSelectEmployeeHint } from "@/components/staff/staff-select-employee-hint";
import { useStaffModuleSelection } from "@/lib/contexts/staff-module-selection-context";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  fetchStaffDocumentsForEmployee,
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
  const { selectedStaff, selectedStaffId } = useStaffModuleSelection();
  const [documents, setDocuments] = useState<StaffDocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  const reload = useCallback(async () => {
    if (!restaurantId || !selectedStaffId) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await fetchStaffDocumentsForEmployee({
      restaurantId,
      staffId: selectedStaffId,
    });
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
  if (!selectedStaff) return <StaffSelectEmployeeHint />;

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
