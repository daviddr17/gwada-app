/** DIN A4 Querformat (Breite × Höhe) — Fallback für HTML-Druck. */
export const A4_LANDSCAPE_PAGE_SIZE = "297mm 210mm";

/** DIN A4 Hochformat (Breite × Höhe). */
export const A4_PORTRAIT_PAGE_SIZE = "210mm 297mm";

export type PrintTableDocumentOptions = {
  documentTitle: string;
  headers: readonly string[];
  rows: string[][];
  restaurantName?: string;
  summaryLine?: string;
  /** Querformat für breite Tabellen (Standard). */
  landscape?: boolean;
  columnStyles?: Record<
    number,
    { cellWidth?: number; halign?: "left" | "center" | "right" }
  >;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPrintHtml({
  documentTitle,
  headers,
  rows,
  restaurantName,
  summaryLine,
}: PrintTableDocumentOptions): string {
  const pageSize = A4_PORTRAIT_PAGE_SIZE;
  const headCells = headers
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join("");
  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
    )
    .join("");

  const metaParts: string[] = [];
  if (restaurantName?.trim()) {
    metaParts.push(escapeHtml(restaurantName.trim()));
  }
  if (summaryLine?.trim()) {
    metaParts.push(escapeHtml(summaryLine.trim()));
  }
  metaParts.push(
    `Gedruckt ${new Date().toLocaleString("de-DE")}`,
  );

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(documentTitle)}</title>
  <style>
    @page {
      size: ${pageSize};
      margin: 12mm;
    }
    @media print {
      html, body {
        width: ${pageSize.split(" ")[0]};
        margin: 0;
        padding: 0;
      }
    }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      color: #111;
      font-size: 11px;
      line-height: 1.35;
      margin: 0;
      padding: 0;
    }
    h1 {
      font-size: 18px;
      font-weight: 700;
      margin: 0 0 6px;
    }
    .meta {
      color: #444;
      font-size: 10px;
      margin-bottom: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #ccc;
      padding: 6px 5px;
      text-align: left;
      vertical-align: top;
      word-break: break-word;
    }
    th {
      background: #282828;
      color: #fff;
      font-weight: 600;
    }
    tr:nth-child(even) td {
      background: #f8f8f8;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(documentTitle)}</h1>
  <div class="meta">${metaParts.join(" · ")}</div>
  <table>
    <thead><tr>${headCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;
}

function printTableHtml(options: PrintTableDocumentOptions): void {
  const html = buildPrintHtml(options);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const cleanup = () => {
    window.setTimeout(() => {
      frame.remove();
    }, 1000);
  };

  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    throw new Error("print_frame_unavailable");
  }

  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    win.focus();
    win.print();
    cleanup();
  };

  if (doc.readyState === "complete") {
    window.setTimeout(triggerPrint, 150);
  } else {
    frame.onload = () => {
      window.setTimeout(triggerPrint, 150);
    };
  }
}

/**
 * Öffnet den System-Druckdialog. Querformat läuft über jsPDF (zuverlässig auf iOS),
 * Hochformat weiterhin über HTML.
 */
export async function printTableDocument(
  options: PrintTableDocumentOptions,
): Promise<void> {
  if (options.rows.length === 0) return;

  if (options.landscape !== false) {
    const { printTablePdf } = await import("@/lib/export/table-document-export");
    await printTablePdf({
      documentTitle: options.documentTitle,
      filenamePrefix: "druck",
      headers: options.headers,
      rows: options.rows,
      restaurantName: options.restaurantName,
      summaryLine: options.summaryLine,
      orientation: "landscape",
      columnStyles: options.columnStyles,
    });
    return;
  }

  printTableHtml(options);
}
