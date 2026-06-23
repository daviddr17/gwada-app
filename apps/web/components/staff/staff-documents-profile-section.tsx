"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  fetchStaffDocumentsForEmployee,
  type StaffDocumentListItem,
} from "@/lib/staff/staff-documents-api";
import { staffDocumentsPageUrl } from "@/lib/staff/staff-documents-navigation";
import type { RestaurantStaffRow } from "@/lib/types/staff";

type StaffDocumentsProfileSectionProps = {
  restaurantId: string;
  staff: RestaurantStaffRow;
};

export function StaffDocumentsProfileSection({
  restaurantId,
  staff,
}: StaffDocumentsProfileSectionProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<StaffDocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchStaffDocumentsForEmployee({
      restaurantId,
      staffId: staff.id,
    });
    setLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    setDocuments(data);
  }, [restaurantId, staff.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const preview = documents.slice(0, 3);

  return (
    <button
      type="button"
      className="flex w-full flex-col gap-2 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5 text-left transition-colors hover:bg-muted/25"
      onClick={() => router.push(staffDocumentsPageUrl(staff.id))}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Dokumente</p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Wird geladen …</p>
      ) : documents.length === 0 ? (
        <p className="text-xs text-muted-foreground">Keine Dokumente</p>
      ) : (
        <ul className="space-y-1.5">
          {preview.map((doc) => (
            <li
              key={doc.id}
              className="truncate text-xs font-medium text-foreground"
            >
              {doc.title}
            </li>
          ))}
          {documents.length > preview.length ? (
            <li className="text-xs text-muted-foreground">
              +{documents.length - preview.length} weitere
            </li>
          ) : null}
        </ul>
      )}
    </button>
  );
}
