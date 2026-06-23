"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  downloadStaffDocument,
  formatStaffDocumentMeta,
  type StaffDocumentListItem,
} from "@/lib/staff/staff-documents-api";
import { StaffDocumentPdfPreviewDialog } from "@/components/staff/staff-document-pdf-preview-dialog";
import type { StaffContractDocumentVersionRow } from "@/lib/staff/staff-contract-versions-types";

type StaffContractVersionsListProps = {
  restaurantId: string;
  contractId: string | null | undefined;
};

export function StaffContractVersionsList({
  restaurantId,
  contractId,
}: StaffContractVersionsListProps) {
  const [versions, setVersions] = useState<StaffContractDocumentVersionRow[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<StaffDocumentListItem | null>(null);

  const reload = useCallback(async () => {
    if (!contractId) {
      setVersions([]);
      return;
    }
    setLoading(true);
    const q = new URLSearchParams({ restaurantId, contractId });
    const res = await fetch(`/api/staff/contracts/document-versions?${q}`);
    const body = (await res.json().catch(() => ({}))) as {
      versions?: StaffContractDocumentVersionRow[];
    };
    setLoading(false);
    setVersions(body.versions ?? []);
  }, [restaurantId, contractId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!contractId) return null;

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground">PDF-Versionen werden geladen …</p>
    );
  }

  if (versions.length === 0) return null;

  return (
    <>
      <div className="space-y-2 rounded-xl border border-border/40 bg-muted/10 p-3">
        <p className="text-sm font-medium">PDF-Versionen</p>
        <ul className="space-y-2">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/30 bg-background px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  Version {v.version}
                  {v.is_current ? (
                    <Badge variant="outline" className="ml-2 rounded-full">
                      Aktuell
                    </Badge>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {v.title} · {formatStaffDocumentMeta({
                    id: v.document_id,
                    restaurant_id: restaurantId,
                    tag_id: null,
                    staff_id: null,
                    title: v.title,
                    file_name: v.file_name,
                    mime_type: v.mime_type,
                    size_bytes: v.size_bytes,
                    created_at: v.created_at,
                  })}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {v.mime_type === "application/pdf" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() =>
                      setPreview({
                        id: v.document_id,
                        restaurant_id: restaurantId,
                        tag_id: null,
                        staff_id: null,
                        title: v.title,
                        file_name: v.file_name,
                        mime_type: v.mime_type,
                        size_bytes: v.size_bytes,
                        created_at: v.created_at,
                      })
                    }
                  >
                    <Eye className="size-4" />
                    Vorschau
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() =>
                    downloadStaffDocument({
                      restaurantId,
                      documentId: v.document_id,
                    })
                  }
                >
                  <Download className="size-4" />
                  Download
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {preview ? (
        <StaffDocumentPdfPreviewDialog
          open={preview !== null}
          onOpenChange={(open) => {
            if (!open) setPreview(null);
          }}
          restaurantId={restaurantId}
          documentId={preview.id}
          title={preview.title}
        />
      ) : null}
    </>
  );
}
