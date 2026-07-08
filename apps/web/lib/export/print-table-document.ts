/** DIN A4 Querformat (Breite × Höhe) — zuverlässiger als `A4 landscape` in Safari/iOS. */
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
  landscape = true,
}: PrintTableDocumentOptions): string {
  const pageSize = landscape ? A4_LANDSCAPE_PAGE_SIZE : A4_PORTRAIT_PAGE_SIZE;
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

/**
 * Öffnet den System-Druckdialog mit einer tabellarischen Vorschau (Display-Module).
 */
export function printTableDocument(options: PrintTableDocumentOptions): void {
  if (options.rows.length === 0) return;

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
