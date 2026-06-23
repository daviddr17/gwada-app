"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useMyRestaurantStaff } from "@/lib/hooks/use-my-restaurant-staff";
import { useStaffProfileVisibility } from "@/lib/hooks/use-staff-profile-visibility";
import { fetchMyStaffDocuments } from "@/lib/staff/staff-documents-api";

export function ProfileDocumentsSummaryCard() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { staff, loading: staffLoading } = useMyRestaurantStaff();
  const { visibility, loading: visibilityLoading } =
    useStaffProfileVisibility();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!restaurantId || !staff) {
      setCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await fetchMyStaffDocuments({ restaurantId });
    setLoading(false);
    setCount(data.length);
  }, [restaurantId, staff]);

  useEffect(() => {
    if (!staffLoading) void reload();
  }, [staffLoading, reload]);

  if (
    !workspaceReady ||
    !restaurantId ||
    !staff ||
    !visibility.profile_show_documents
  ) {
    return null;
  }

  return (
    <Link
      href="/profile/dokumente"
      className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/15 px-4 py-3 transition-colors hover:bg-muted/25"
    >
      <div className="flex min-w-0 items-center gap-3">
        <FileText className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Meine Dokumente</p>
          <p className="text-xs text-muted-foreground">
            {loading || visibilityLoading
              ? "Wird geladen …"
              : count === 0
                ? "Verträge und Dokumente"
                : `${count} Dokument${count === 1 ? "" : "e"}`}
          </p>
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
