import type { TableDocumentExportOptions } from "@/lib/export/table-document-export";

export type ModuleTableExportSource =
  | TableDocumentExportOptions
  | (() => TableDocumentExportOptions | Promise<TableDocumentExportOptions>);

export async function resolveModuleTableExport(
  source: ModuleTableExportSource,
): Promise<TableDocumentExportOptions> {
  if (typeof source === "function") {
    return await source();
  }
  return source;
}
