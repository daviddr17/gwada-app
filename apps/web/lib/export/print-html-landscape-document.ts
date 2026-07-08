import {
  shouldAutoTriggerPrintDialog,
  type PrintJsPdfResult,
} from "@/lib/export/print-host";

export type PrintHtmlLandscapeDocumentOptions = {
  documentTitle: string;
  headers: readonly string[];
  rows: string[][];
  restaurantName?: string;
  summaryLine?: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildLandscapePrintHtml(
  options: PrintHtmlLandscapeDocumentOptions,
  autoPrint: boolean,
): string {
  const { documentTitle, headers, rows, restaurantName, summaryLine } = options;
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
  metaParts.push(`Gedruckt ${new Date().toLocaleString("de-DE")}`);

  const printScript = autoPrint
    ? `<script>
    window.addEventListener("load", function () {
      window.setTimeout(function () {
        window.focus();
        window.print();
      }, 350);
    });
  </script>`
    : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(documentTitle)}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      color: #111;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      font-size: 10px;
      line-height: 1.3;
    }
    h1 {
      font-size: 16px;
      font-weight: 700;
      margin: 0 0 4px;
    }
    .meta {
      color: #444;
      font-size: 9px;
      margin-bottom: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #ccc;
      padding: 4px 3px;
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
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
  ${printScript}
</body>
</html>`;
}

/**
 * HTML-Druck in neuem Fenster — Fallback auf iOS, wenn PDF-Druck/Share scheitert.
 */
export function printHtmlLandscapeDocument(
  options: PrintHtmlLandscapeDocumentOptions,
): PrintJsPdfResult {
  if (options.rows.length === 0) return "printed";

  const autoPrint = shouldAutoTriggerPrintDialog();
  const html = buildLandscapePrintHtml(options, autoPrint);
  const printWin = window.open("", "_blank");
  if (!printWin) {
    throw new Error("print_popup_blocked");
  }

  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();

  return autoPrint ? "printed" : "opened_tab";
}
