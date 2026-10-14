"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { StaffDocumentsAllTable } from "@/components/staff/staff-documents-all-table";
import { StaffDocumentsList } from "@/components/staff/staff-documents-list";
import { StaffDocumentsSkeleton } from "@/components/staff/staff-documents-skeleton";
import { StaffTodosTableSkeleton } from "@/components/staff/todos/staff-todos-skeleton";
import { useStaffModuleSelection } from "@/lib/contexts/staff-module-selection-context";
import { uploadRestaurantDocumentClient } from "@/lib/documents/documents-api";
import { validateRestaurantDocumentFile } from "@/lib/documents/validate-restaurant-document-file";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { hasModuleCreate } from "@/lib/permissions/module-crud-permissions";
import {
  fetchStaffDocumentsForEmployee,
  fetchStaffDocumentsForRestaurant,
  staffDocumentsExportUrl,
  type StaffDocumentListItem,
} from "@/lib/staff/staff-documents-api";
import { staffDisplayName } from "@/lib/types/staff";
import { trackDashboardFileUpload } from "@/lib/uploads/dashboard-file-upload";
import { ListRangeCount } from "@/lib/ui/list-range-count";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";

function staffDocumentUploadErrorMessage(code: string | undefined): string {
  switch (code) {
    case "storage_quota_exceeded":
      return "Speicherlimit erreicht — bitte Speicher freigeben oder Plan upgraden.";
    case "forbidden":
    case "unauthorized":
      return "Keine Berechtigung zum Hochladen.";
    case "invalid_file":
      return "Diese Datei ist nicht erlaubt.";
    default:
      return "Upload fehlgeschlagen.";
  }
}

export function StaffDocumentsScreen() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has: hasPermission } = useRestaurantPermissions();
  const canUpload = hasModuleCreate(hasPermission, "documents");
  const {
    selectedStaff,
    selectedStaffId,
    selectedStaffIds,
    staffList,
    setSelectedStaffId,
  } = useStaffModuleSelection();
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

  const handleUploadForSelectedStaff = useCallback(
    async (file: File) => {
      if (!restaurantId || !selectedStaffId) return false;
      if (!canUpload) {
        toast.error("Keine Berechtigung zum Hochladen.");
        return false;
      }
      const validationError = validateRestaurantDocumentFile(file);
      if (validationError) {
        toast.error(validationError);
        return false;
      }
      const title =
        file.name.replace(/\.[^.]+$/, "").trim() || file.name.trim();
      const { documentId } = await trackDashboardFileUpload(
        () =>
          uploadRestaurantDocumentClient({
            restaurantId,
            file,
            title,
            staffId: selectedStaffId,
            visibleToStaff: true,
          }),
        {
          successMessage: "Dokument hochgeladen.",
          errorMessage: staffDocumentUploadErrorMessage,
        },
      );
      if (!documentId) return false;
      await reload();
      return true;
    },
    [canUpload, reload, restaurantId, selectedStaffId],
  );

  const overviewDocuments = useMemo(() => {
    if (selectedStaffIds.length <= 1) return documents;
    const allowed = new Set(selectedStaffIds);
    return documents.filter(
      (d) => d.staff_id != null && allowed.has(d.staff_id),
    );
  }, [documents, selectedStaffIds]);

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
            documents={overviewDocuments}
            staffList={staffList}
            onSelectStaff={setSelectedStaffId}
            uploadHint={
              canUpload
                ? "Mitarbeiter wählen, dann Dokument hochladen — oder unter Dokumente zuweisen."
                : null
            }
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
          allowUpload={canUpload}
          onUpload={canUpload ? handleUploadForSelectedStaff : undefined}
          emptyMessage={
            canUpload
              ? `Für ${staffDisplayName(selectedStaff)} liegen noch keine Dokumente vor — hier hochladen oder Vertrags-PDFs nach digitaler Vertragserstellung.`
              : `Für ${staffDisplayName(selectedStaff)} liegen noch keine Dokumente vor — Vertrags-PDFs erscheinen nach digitaler Vertragserstellung.`
          }
        />
      )}
    </div>
  );
}
