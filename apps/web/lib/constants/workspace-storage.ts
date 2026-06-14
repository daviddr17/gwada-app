/** 3 GB Workspace-Speicher gesamt (Dokumente, Galerie, News, Buchführung). */
export const RESTAURANT_WORKSPACE_QUOTA_BYTES = 3 * 1024 * 1024 * 1024;

export type WorkspaceStorageBreakdown = {
  documentsBytes: number;
  galleryBytes: number;
  newsBytes: number;
  accountingBytes: number;
  totalBytes: number;
  quotaBytes: number;
};

export const WORKSPACE_STORAGE_MODULE_LABELS: Record<
  keyof Omit<WorkspaceStorageBreakdown, "totalBytes" | "quotaBytes">,
  string
> = {
  documentsBytes: "Dokumente",
  galleryBytes: "Galerie",
  newsBytes: "News",
  accountingBytes: "Buchführung",
};
