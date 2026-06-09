import "server-only";

type PDFDocumentConstructor = typeof import("pdfkit");

/**
 * pdfkit is CJS; Turbopack/Next may wrap `require("pdfkit")` as `{ default: ctor }`.
 */
export function loadPDFDocument(): PDFDocumentConstructor {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("pdfkit") as PDFDocumentConstructor & {
    default?: PDFDocumentConstructor;
  };
  const ctor = mod.default ?? mod;
  if (typeof ctor !== "function") {
    throw new Error("pdfkit did not export a PDFDocument constructor");
  }
  return ctor;
}
