"use client";

import { ProfilePendingContractsSection } from "@/components/profile/profile-pending-contracts-section";
import { StaffDocumentsList } from "@/components/staff/staff-documents-list";
import { StaffDocumentsSkeleton } from "@/components/staff/staff-documents-skeleton";
import { useMyRestaurantStaff } from "@/lib/hooks/use-my-restaurant-staff";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  fetchMyStaffDocuments,
  uploadMyStaffDocument,
  type StaffDocumentListItem,
} from "@/lib/staff/staff-documents-api";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";

export function ProfileDocumentsScreen() {
  const { profile } = useRestaurantProfile();
  const {
    restaurantId,
    workspaceReady,
    staff,
    loading: staffLoading,
    showSkeleton: staffSkeleton,
  } = useMyRestaurantStaff();
  const [documents, setDocuments] = useState<StaffDocumentListItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!restaurantId || !staff) {
      setDocuments([]);
      setDocsLoading(false);
      return;
    }
    setDocsLoading(true);
    const { data, error } = await fetchMyStaffDocuments({ restaurantId });
    setDocsLoading(false);
    if (error) {
      toast.error("Dokumente konnten nicht geladen werden.");
      setDocuments([]);
      return;
    }
    setDocuments(data);
  }, [restaurantId, staff]);

  useEffect(() => {
    if (!staffLoading && staff) {
      void reload();
    } else if (!staffLoading && !staff) {
      setDocuments([]);
      setDocsLoading(false);
    }
  }, [staffLoading, staff, reload]);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!restaurantId) return false;
      const { error } = await uploadMyStaffDocument({ restaurantId, file });
      if (error) {
        toast.error("Upload fehlgeschlagen.");
        return false;
      }
      toast.success("Dokument hochgeladen.");
      await reload();
      return true;
    },
    [restaurantId, reload],
  );

  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  if (staffLoading && !staffSkeleton) {
    return <div className="min-h-[20rem]" aria-busy="true" />;
  }

  if (staffSkeleton || docsLoading) {
    return <StaffDocumentsSkeleton />;
  }

  if (!staff) {
    const restaurantLabel = profile.name?.trim() || "diesem Restaurant";
    return (
      <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3.5 text-sm text-muted-foreground">
        Für{" "}
        <span className="font-medium text-foreground">{restaurantLabel}</span>{" "}
        bist du keinem Mitarbeiterprofil zugeordnet. Verträge und Dokumente
        werden hier angezeigt, sobald dein Konto mit einem Mitarbeiter
        verknüpft ist.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProfilePendingContractsSection
        restaurantId={restaurantId}
        staffGivenName={staff.given_name}
        staffFamilyName={staff.family_name}
        onSigned={() => void reload()}
      />
      <StaffDocumentsList
        restaurantId={restaurantId}
        documents={documents}
        allowUpload
        onUpload={handleUpload}
        emptyMessage="Noch keine Dokumente — unterschriebene Arbeitsverträge erscheinen hier als PDF zum Download."
      />
    </div>
  );
}
