import type { RestaurantProfile } from "@/lib/types/restaurant";
import type {
  AccountingDocumentDesign,
  AccountingDocumentFontFamily,
  AccountingLayoutBlock,
  AccountingLayoutBlockType,
  AccountingLayoutZone,
} from "@/lib/types/accounting-settings";

export const LAYOUT_GRID_COLS = 4;
export const HEADER_GRID_ROWS = 4;
export const META_GRID_ROWS = 4;
export const FOOTER_GRID_ROWS = 3;
export const LAYOUT_MAX_COL_SPAN = 4;

/** A4-PDF — gemeinsame Maße für jsPDF und Layout-Editor-Vorschau. */
export const ACCOUNTING_PDF_PAGE_WIDTH_MM = 210;
export const ACCOUNTING_PDF_PAGE_HEIGHT_MM = 297;
export const ACCOUNTING_PDF_MARGIN_MM = 14;

/** Einheitlicher Zeilenabstand Kopf- und Meta-Bereich (mm). */
export const ACCOUNTING_PDF_TEXT_LINE_STRIDE_MM = 5.5;

export const ACCOUNTING_PDF_ROW_HEIGHT_MM: Record<
  AccountingLayoutZone,
  number
> = {
  header: ACCOUNTING_PDF_TEXT_LINE_STRIDE_MM,
  meta: ACCOUNTING_PDF_TEXT_LINE_STRIDE_MM,
  footer: 5.5,
};

export const ACCOUNTING_PDF_ZONE_GAP_MM = {
  afterHeader: 4,
  afterMeta: 4,
} as const;

/** Erste Textzeile — gleicher Abstand unter jeder Rasterzeile. */
export const ACCOUNTING_PDF_ROW_BASELINE_MM = 3.9;

export function accountingPdfContentWidthMm(): number {
  return ACCOUNTING_PDF_PAGE_WIDTH_MM - ACCOUNTING_PDF_MARGIN_MM * 2;
}

export function layoutZoneRowHeightMm(zone: AccountingLayoutZone): number {
  return ACCOUNTING_PDF_ROW_HEIGHT_MM[zone];
}

export function layoutBlockFontSizePt(
  block: AccountingLayoutBlock,
  zone: AccountingLayoutZone,
): number {
  if (block.type === "document_title") return 13;
  return 9;
}

export function accountingPdfLineHeightMm(): number {
  return ACCOUNTING_PDF_TEXT_LINE_STRIDE_MM;
}

export function accountingPdfTextBaselineY(rowTopY: number): number {
  return rowTopY + ACCOUNTING_PDF_ROW_BASELINE_MM;
}

export function layoutBlockCellMm(
  block: AccountingLayoutBlock,
  zone: AccountingLayoutZone,
  contentWidthMm: number,
): { width: number; height: number } {
  return {
    width: (block.colSpan / LAYOUT_GRID_COLS) * contentWidthMm,
    height: ACCOUNTING_PDF_ROW_HEIGHT_MM[zone] * (block.rowSpan ?? 1),
  };
}

export function layoutBlockLogoIsSquare(block: AccountingLayoutBlock): boolean {
  return block.colSpan === (block.rowSpan ?? 1);
}

/** Blöcke am rechten Rasterrand — rechtsbündig (nicht volle Breite). */
export function layoutBlockEffectiveAlign(
  block: AccountingLayoutBlock,
): "left" | "center" | "right" {
  if (block.align === "center") return "center";
  if (block.align === "right") return "right";

  const colSpan = block.colSpan ?? 1;
  if (block.col + colSpan === LAYOUT_GRID_COLS && block.col > 0) {
    return "right";
  }

  return "left";
}

export function layoutBlockTextAlignClassName(
  block: AccountingLayoutBlock,
): string {
  const align = layoutBlockEffectiveAlign(block);
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

export function formatCompanyVatLabel(vatNumber: string): string {
  const value = vatNumber.trim();
  return value ? `USt-IdNr. ${value}` : "USt-IdNr.:";
}

export function layoutBlockLogoDrawRect(
  block: AccountingLayoutBlock,
  zone: AccountingLayoutZone,
  contentWidthMm: number,
  align: "left" | "center" | "right",
  imageWidthPx: number,
  imageHeightPx: number,
): {
  drawWidth: number;
  drawHeight: number;
  offsetX: number;
  offsetY: number;
} {
  const { width: cellWidth, height: cellHeight } = layoutBlockCellMm(
    block,
    zone,
    contentWidthMm,
  );

  let boxWidth = cellWidth;
  let boxHeight = cellHeight;

  if (layoutBlockLogoIsSquare(block)) {
    const side = Math.min(cellWidth, cellHeight);
    boxWidth = side;
    boxHeight = side;
  }

  const imageAspect = Math.max(imageWidthPx, 1) / Math.max(imageHeightPx, 1);
  const boxAspect = boxWidth / boxHeight;

  let drawWidth: number;
  let drawHeight: number;
  if (imageAspect > boxAspect) {
    drawWidth = boxWidth;
    drawHeight = boxWidth / imageAspect;
  } else {
    drawHeight = boxHeight;
    drawWidth = boxHeight * imageAspect;
  }

  const boxOffsetX =
    align === "right"
      ? cellWidth - boxWidth
      : align === "center"
        ? (cellWidth - boxWidth) / 2
        : 0;
  const boxOffsetY = (cellHeight - boxHeight) / 2;

  const imageOffsetXInBox =
    align === "right"
      ? boxWidth - drawWidth
      : align === "center"
        ? (boxWidth - drawWidth) / 2
        : 0;
  const imageOffsetYInBox = (boxHeight - drawHeight) / 2;

  return {
    drawWidth,
    drawHeight,
    offsetX: boxOffsetX + imageOffsetXInBox,
    offsetY: boxOffsetY + imageOffsetYInBox,
  };
}

export function headerZoneEndMm(blocks: AccountingLayoutBlock[]): number {
  const headerBlocks = blocks.filter((b) => b.zone === "header");
  if (!headerBlocks.length) {
    return (
      ACCOUNTING_PDF_MARGIN_MM +
      4 +
      ACCOUNTING_PDF_ZONE_GAP_MM.afterHeader
    );
  }
  const maxRow = Math.max(
    ...headerBlocks.map((b) => b.row + (b.rowSpan ?? 1) - 1),
  );
  return (
    ACCOUNTING_PDF_MARGIN_MM +
    (maxRow + 1) * ACCOUNTING_PDF_ROW_HEIGHT_MM.header +
    ACCOUNTING_PDF_ZONE_GAP_MM.afterHeader
  );
}

/** Platzhalter in der Layout-Vorschau — im PDF pro Seite unten rechts. */
export const ACCOUNTING_PAGE_NUMBER_PREVIEW = "1/1";

export const ACCOUNTING_LAYOUT_BLOCK_OPTIONS: {
  type: AccountingLayoutBlockType;
  label: string;
  description: string;
  defaultColSpan?: number;
  defaultRowSpan?: number;
}[] = [
  {
    type: "logo",
    label: "Logo",
    description: "Profilbild aus Stammdaten",
    defaultColSpan: 1,
    defaultRowSpan: 2,
  },
  {
    type: "company_name",
    label: "Firmenname",
    description: "Name aus Stammdaten",
    defaultColSpan: 2,
  },
  {
    type: "company_street",
    label: "Straße",
    description: "Adresszeile",
    defaultColSpan: 2,
  },
  {
    type: "company_city",
    label: "PLZ & Ort",
    description: "Postleitzahl und Stadt",
    defaultColSpan: 2,
  },
  {
    type: "company_country",
    label: "Land",
    description: "Land aus Stammdaten",
    defaultColSpan: 2,
  },
  {
    type: "company_phone",
    label: "Telefon",
    description: "Telefonnummer",
    defaultColSpan: 2,
  },
  {
    type: "company_website",
    label: "Website",
    description: "Webadresse",
    defaultColSpan: 2,
  },
  {
    type: "company_vat",
    label: "USt-IdNr.",
    description: "Umsatzsteuer-ID",
    defaultColSpan: 2,
  },
  {
    type: "company_receipt_footer",
    label: "Quittungs-Fußtext",
    description: "Fußtext aus Stammdaten",
    defaultColSpan: 4,
  },
  {
    type: "custom_text",
    label: "Freitext",
    description: "Eigener Text",
    defaultColSpan: 4,
  },
];

export function layoutBlockLabel(type: AccountingLayoutBlockType): string {
  const metaLabel = META_LAYOUT_BLOCK_LABELS[type];
  if (metaLabel) return metaLabel;
  return (
    ACCOUNTING_LAYOUT_BLOCK_OPTIONS.find((o) => o.type === type)?.label ?? type
  );
}

export const META_LAYOUT_BLOCK_TYPES: AccountingLayoutBlockType[] = [
  "document_title",
  "voucher_number",
  "voucher_date",
  "recipient",
];

const META_LAYOUT_BLOCK_LABELS: Partial<
  Record<AccountingLayoutBlockType, string>
> = {
  document_title: "Überschrift",
  voucher_number: "Rechnungsnummer",
  voucher_date: "Datum",
  recipient: "Empfänger",
};

export function isFixedMetaBlockType(type: AccountingLayoutBlockType): boolean {
  return META_LAYOUT_BLOCK_TYPES.includes(type);
}

export function isFixedMetaBlock(block: AccountingLayoutBlock): boolean {
  return block.zone === "meta" && isFixedMetaBlockType(block.type);
}

export const DEFAULT_META_LAYOUT_BLOCKS: AccountingLayoutBlock[] = [
  {
    id: "meta-document-title",
    zone: "meta",
    type: "document_title",
    col: 0,
    row: 0,
    colSpan: 2,
    rowSpan: 1,
    align: "left",
  },
  {
    id: "meta-voucher-number",
    zone: "meta",
    type: "voucher_number",
    col: 0,
    row: 1,
    colSpan: 2,
    rowSpan: 1,
    align: "left",
  },
  {
    id: "meta-voucher-date",
    zone: "meta",
    type: "voucher_date",
    col: 2,
    row: 1,
    colSpan: 2,
    rowSpan: 1,
    align: "left",
  },
  {
    id: "meta-recipient",
    zone: "meta",
    type: "recipient",
    col: 0,
    row: 2,
    colSpan: 3,
    rowSpan: 2,
    align: "left",
  },
];

export function ensureMetaLayoutBlocks(
  blocks: AccountingLayoutBlock[],
): AccountingLayoutBlock[] {
  const other = blocks.filter((b) => b.zone !== "meta");
  const existingMeta = blocks.filter((b) => b.zone === "meta");
  const meta: AccountingLayoutBlock[] = [];

  for (const defaultBlock of DEFAULT_META_LAYOUT_BLOCKS) {
    const found =
      existingMeta.find((b) => b.type === defaultBlock.type) ??
      existingMeta.find((b) => b.id === defaultBlock.id);
    meta.push(
      clampLayoutBlockToGrid(
        found
          ? { ...found, zone: "meta", type: defaultBlock.type }
          : { ...defaultBlock },
        "meta",
      ),
    );
  }

  return [...other, ...meta];
}

export function resolveMetaBlockPreviewText(
  block: AccountingLayoutBlock,
): string {
  switch (block.type) {
    case "document_title":
      return "Rechnung";
    case "voucher_number":
      return "Nummer: M-2026-0042";
    case "voucher_date":
      return "Datum: 9.6.2026";
    case "recipient":
      return "Empfänger\nMusterfirma GmbH\nMusterstraße 12\n10115 Berlin";
    default:
      return "—";
  }
}

export function resolveMetaBlockPdfText(
  block: AccountingLayoutBlock,
  row: {
    voucher_number: string | null;
    voucher_date: string;
    recipient_snapshot: {
      name?: string;
      street?: string | null;
      zip?: string | null;
      city?: string | null;
    };
  },
  kind: "invoice" | "quotation",
): string {
  switch (block.type) {
    case "document_title":
      return kind === "invoice" ? "Rechnung" : "Angebot";
    case "voucher_number":
      return `Nummer: ${row.voucher_number ?? "—"}`;
    case "voucher_date":
      return `Datum: ${new Date(row.voucher_date).toLocaleDateString("de-DE")}`;
    case "recipient": {
      const recipient = row.recipient_snapshot;
      const lines = ["Empfänger", recipient.name ?? "—"];
      if (recipient.street?.trim()) lines.push(recipient.street.trim());
      const cityLine = [recipient.zip, recipient.city].filter(Boolean).join(" ");
      if (cityLine) lines.push(cityLine);
      return lines.join("\n");
    }
    default:
      return "";
  }
}

export function accountingDocumentFontClassName(
  font: AccountingDocumentFontFamily,
): string {
  switch (font) {
    case "times":
      return "font-serif";
    case "courier":
      return "font-mono";
    default:
      return "font-sans";
  }
}

export function clampLayoutBlockToGrid(
  block: AccountingLayoutBlock,
  zone: AccountingLayoutZone,
): AccountingLayoutBlock {
  const maxRow = layoutZoneRows(zone);
  const rowSpan = Math.max(
    1,
    Math.min(block.rowSpan ?? 1, maxRow),
  );
  const row = Math.max(0, Math.min(block.row, maxRow - rowSpan));
  const col = Math.max(0, Math.min(block.col, LAYOUT_GRID_COLS - 1));
  let colSpan = Math.max(1, block.colSpan ?? 1);
  colSpan = Math.min(colSpan, LAYOUT_GRID_COLS - col);
  return { ...block, zone, col, row, colSpan, rowSpan };
}

export function normalizeLayoutBlocksForGrid(
  blocks: AccountingLayoutBlock[],
): AccountingLayoutBlock[] {
  return blocks.map((block) => {
    let col = block.col;
    let colSpan = block.colSpan ?? 1;
    if (col > LAYOUT_GRID_COLS - 1 || colSpan > LAYOUT_GRID_COLS) {
      col = Math.min(Math.floor(col / 3), LAYOUT_GRID_COLS - 1);
      colSpan = Math.min(
        Math.max(1, Math.ceil(colSpan / 3)),
        LAYOUT_MAX_COL_SPAN,
      );
    }
    return clampLayoutBlockToGrid({ ...block, col, colSpan }, block.zone);
  });
}

export function getValidLayoutDropCells(
  blocks: AccountingLayoutBlock[],
  zone: AccountingLayoutZone,
  activeBlock: AccountingLayoutBlock | null,
): { col: number; row: number }[] {
  const rows = layoutZoneRows(zone);
  const cells: { col: number; row: number }[] = [];

  if (!activeBlock) {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < LAYOUT_GRID_COLS; col++) {
        if (!findBlockAtCell(blocks, zone, col, row)) {
          cells.push({ col, row });
        }
      }
    }
    return cells;
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < LAYOUT_GRID_COLS; col++) {
      const candidate = clampLayoutBlockToGrid(
        { ...activeBlock, zone, col, row },
        zone,
      );
      if (canPlaceLayoutBlock(blocks, zone, candidate, activeBlock.id)) {
        cells.push({ col, row });
      }
    }
  }
  return cells;
}

export function createLayoutBlock(
  type: AccountingLayoutBlockType,
  zone: AccountingLayoutZone,
  col: number,
  row: number,
): AccountingLayoutBlock {
  const option = ACCOUNTING_LAYOUT_BLOCK_OPTIONS.find((o) => o.type === type);
  return clampLayoutBlockToGrid(
    {
      id: crypto.randomUUID(),
      zone,
      type,
      col,
      row,
      colSpan: option?.defaultColSpan ?? 2,
      rowSpan: option?.defaultRowSpan ?? 1,
      align: "left",
      customText: type === "custom_text" ? "Freitext …" : null,
    },
    zone,
  );
}

function blockCells(block: AccountingLayoutBlock): { col: number; row: number }[] {
  const cells: { col: number; row: number }[] = [];
  const colSpan = block.colSpan ?? 1;
  const rowSpan = block.rowSpan ?? 1;
  for (let r = block.row; r < block.row + rowSpan; r++) {
    for (let c = block.col; c < block.col + colSpan; c++) {
      cells.push({ col: c, row: r });
    }
  }
  return cells;
}

export function layoutBlockOccupies(
  block: AccountingLayoutBlock,
  col: number,
  row: number,
): boolean {
  return blockCells(block).some((cell) => cell.col === col && cell.row === row);
}

export function layoutZoneRows(zone: AccountingLayoutZone): number {
  if (zone === "header") return HEADER_GRID_ROWS;
  if (zone === "meta") return META_GRID_ROWS;
  return FOOTER_GRID_ROWS;
}

export function canPlaceLayoutBlock(
  blocks: AccountingLayoutBlock[],
  zone: AccountingLayoutZone,
  candidate: AccountingLayoutBlock,
  ignoreId?: string,
): boolean {
  const maxRow = layoutZoneRows(zone);
  const colSpan = candidate.colSpan ?? 1;
  const rowSpan = candidate.rowSpan ?? 1;
  if (
    candidate.col < 0 ||
    candidate.row < 0 ||
    candidate.col + colSpan > LAYOUT_GRID_COLS ||
    candidate.row + rowSpan > maxRow
  ) {
    return false;
  }

  const others = blocks.filter(
    (b) => b.zone === zone && b.id !== ignoreId,
  );
  for (const other of others) {
    for (const cell of blockCells(candidate)) {
      if (layoutBlockOccupies(other, cell.col, cell.row)) {
        return false;
      }
    }
  }
  return true;
}

export function findBlockAtCell(
  blocks: AccountingLayoutBlock[],
  zone: AccountingLayoutZone,
  col: number,
  row: number,
): AccountingLayoutBlock | null {
  return (
    blocks.find(
      (b) => b.zone === zone && layoutBlockOccupies(b, col, row),
    ) ?? null
  );
}

export function moveLayoutBlock(
  blocks: AccountingLayoutBlock[],
  blockId: string,
  zone: AccountingLayoutZone,
  col: number,
  row: number,
): AccountingLayoutBlock[] {
  const block = blocks.find((b) => b.id === blockId);
  if (!block) return blocks;

  const next = clampLayoutBlockToGrid({ ...block, zone, col, row }, zone);
  if (!canPlaceLayoutBlock(blocks, zone, next, blockId)) {
    return blocks;
  }

  return blocks.map((b) => (b.id === blockId ? next : b));
}

export function resizeLayoutBlockToSpan(
  blocks: AccountingLayoutBlock[],
  blockId: string,
  span: {
    col: number;
    colSpan: number;
    row: number;
    rowSpan: number;
  },
): AccountingLayoutBlock[] {
  const block = blocks.find((b) => b.id === blockId);
  if (!block) return blocks;

  const next = clampLayoutBlockToGrid({ ...block, ...span }, block.zone);
  if (
    next.col === block.col &&
    next.colSpan === block.colSpan &&
    next.row === block.row &&
    next.rowSpan === block.rowSpan
  ) {
    return blocks;
  }
  if (!canPlaceLayoutBlock(blocks, block.zone, next, blockId)) {
    return blocks;
  }

  return blocks.map((b) => (b.id === blockId ? next : b));
}

export function removeLayoutBlock(
  blocks: AccountingLayoutBlock[],
  blockId: string,
): AccountingLayoutBlock[] {
  const block = blocks.find((b) => b.id === blockId);
  if (block && isFixedMetaBlock(block)) return blocks;
  return blocks.filter((b) => b.id !== blockId);
}

export function addLayoutBlock(
  blocks: AccountingLayoutBlock[],
  type: AccountingLayoutBlockType,
  zone: AccountingLayoutZone,
  col: number,
  row: number,
): AccountingLayoutBlock[] {
  const candidate = createLayoutBlock(type, zone, col, row);
  if (!canPlaceLayoutBlock(blocks, zone, candidate)) {
    const compact = clampLayoutBlockToGrid(
      { ...candidate, colSpan: 1, rowSpan: 1 },
      zone,
    );
    if (!canPlaceLayoutBlock(blocks, zone, compact)) {
      return blocks;
    }
    return [...blocks, compact];
  }
  return [...blocks, candidate];
}

export function resolveLayoutBlockPreviewText(
  block: AccountingLayoutBlock,
  profile: Pick<
    RestaurantProfile,
    | "name"
    | "street"
    | "postalCode"
    | "city"
    | "country"
    | "phone"
    | "website"
    | "vatNumber"
    | "receiptFooter"
  >,
): string {
  switch (block.type) {
    case "logo":
      return "Logo";
    case "company_name":
      return profile.name?.trim() || "Firmenname";
    case "company_street":
      return profile.street?.trim() || "Musterstraße 1";
    case "company_city": {
      const line = [profile.postalCode, profile.city].filter(Boolean).join(" ");
      return line || "12345 Musterstadt";
    }
    case "company_country":
      return profile.country?.trim() || "Deutschland";
    case "company_phone":
      return profile.phone?.trim()
        ? `Tel. ${profile.phone.trim()}`
        : "Tel. +49 30 123456";
    case "company_website":
      return profile.website?.trim() || "www.beispiel.de";
    case "company_vat":
      return formatCompanyVatLabel(profile.vatNumber ?? "");
    case "company_receipt_footer":
      return profile.receiptFooter?.trim() || "Quittungs-Fußtext";
    case "custom_text":
      return block.customText?.trim() || "Freitext …";
    default:
      return "—";
  }
}

export const DEFAULT_LAYOUT_BLOCKS: AccountingLayoutBlock[] = [
  {
    id: "default-logo",
    zone: "header",
    type: "logo",
    col: 3,
    row: 0,
    colSpan: 1,
    rowSpan: 2,
    align: "right",
  },
  {
    id: "default-company-name",
    zone: "header",
    type: "company_name",
    col: 0,
    row: 0,
    colSpan: 2,
    rowSpan: 1,
    align: "left",
  },
  {
    id: "default-company-street",
    zone: "header",
    type: "company_street",
    col: 0,
    row: 1,
    colSpan: 2,
    rowSpan: 1,
    align: "left",
  },
  {
    id: "default-company-city",
    zone: "header",
    type: "company_city",
    col: 0,
    row: 2,
    colSpan: 2,
    rowSpan: 1,
    align: "left",
  },
  {
    id: "default-company-phone",
    zone: "header",
    type: "company_phone",
    col: 2,
    row: 2,
    colSpan: 2,
    rowSpan: 1,
    align: "left",
  },
  {
    id: "default-footer-vat",
    zone: "footer",
    type: "company_vat",
    col: 0,
    row: 0,
    colSpan: 2,
    rowSpan: 1,
    align: "left",
  },
  {
    id: "default-footer-website",
    zone: "footer",
    type: "company_website",
    col: 2,
    row: 0,
    colSpan: 2,
    rowSpan: 1,
    align: "left",
  },
];

export function migrateLegacyDesignToBlocks(
  raw: Record<string, unknown>,
): AccountingLayoutBlock[] {
  const blocks: AccountingLayoutBlock[] = [];
  const showLogo = raw.showLogo !== false;
  const logoPosition = raw.logoPosition === "left" ? "left" : "right";
  const companyInHeader = raw.companyInHeader !== false;
  const companyInFooter = raw.companyInFooter !== false;
  const headerText =
    typeof raw.headerText === "string" && raw.headerText.trim()
      ? raw.headerText.trim()
      : null;
  const footerText =
    typeof raw.footerText === "string" && raw.footerText.trim()
      ? raw.footerText.trim()
      : null;
  const companyExtraLines =
    typeof raw.companyExtraLines === "string" && raw.companyExtraLines.trim()
      ? raw.companyExtraLines.trim()
      : null;

  let headerRow = 0;

  if (showLogo) {
    blocks.push({
      id: crypto.randomUUID(),
      zone: "header",
      type: "logo",
      col: logoPosition === "right" ? 3 : 0,
      row: 0,
      colSpan: 1,
      rowSpan: 2,
      align: logoPosition === "right" ? "right" : "left",
    });
  }

  if (companyInHeader) {
    const companyBlocks: AccountingLayoutBlockType[] = [
      "company_name",
      "company_street",
      "company_city",
    ];
    for (const type of companyBlocks) {
      if (headerRow >= HEADER_GRID_ROWS) break;
      blocks.push({
        id: crypto.randomUUID(),
        zone: "header",
        type,
        col: showLogo && logoPosition === "left" ? 1 : 0,
        row: headerRow,
        colSpan: showLogo ? 2 : 3,
        rowSpan: 1,
        align: "left",
      });
      headerRow += 1;
    }
  }

  if (headerText) {
    blocks.push({
      id: crypto.randomUUID(),
      zone: "header",
      type: "custom_text",
      col: 0,
      row: Math.min(headerRow, HEADER_GRID_ROWS - 1),
      colSpan: 4,
      rowSpan: 1,
      align: "left",
      customText: headerText,
    });
  }

  let footerRow = 0;
  if (footerText) {
    blocks.push({
      id: crypto.randomUUID(),
      zone: "footer",
      type: "custom_text",
      col: 0,
      row: footerRow,
      colSpan: 4,
      rowSpan: 1,
      align: "left",
      customText: footerText,
    });
    footerRow += 1;
  }

  if (companyInFooter) {
    const footerTypes: AccountingLayoutBlockType[] = [
      "company_name",
      "company_vat",
      "company_website",
    ];
    for (const type of footerTypes) {
      if (footerRow >= FOOTER_GRID_ROWS) break;
      blocks.push({
        id: crypto.randomUUID(),
        zone: "footer",
        type,
        col: footerRow % 2 === 0 ? 0 : 2,
        row: footerRow,
        colSpan: 2,
        rowSpan: 1,
        align: "left",
      });
      footerRow += 1;
    }
  }

  if (companyExtraLines) {
    for (const line of companyExtraLines.split("\n")) {
      const text = line.trim();
      if (!text || footerRow >= FOOTER_GRID_ROWS) continue;
      blocks.push({
        id: crypto.randomUUID(),
        zone: "footer",
        type: "custom_text",
        col: 0,
        row: footerRow,
        colSpan: 4,
        rowSpan: 1,
        align: "left",
        customText: text,
      });
      footerRow += 1;
    }
  }

  return blocks.length ? blocks : [...DEFAULT_LAYOUT_BLOCKS];
}

type CompanyBlock = {
  name: string;
  street: string;
  cityLine: string;
  country: string;
  phone: string;
  website: string;
  vatNumber: string;
  receiptFooter?: string;
};

export function resolveLayoutBlockPdfText(
  block: AccountingLayoutBlock,
  company: CompanyBlock,
): string {
  switch (block.type) {
    case "logo":
      return "";
    case "company_name":
      return company.name;
    case "company_street":
      return company.street;
    case "company_city":
      return company.cityLine;
    case "company_country":
      return company.country;
    case "company_phone":
      return company.phone ? `Tel. ${company.phone}` : "";
    case "company_website":
      return company.website;
    case "company_vat":
      return formatCompanyVatLabel(company.vatNumber);
    case "company_receipt_footer":
      return company.receiptFooter?.trim() ?? "";
    case "custom_text":
      return block.customText?.trim() ?? "";
    default:
      return "";
  }
}

export function metaZoneEndY(
  blocks: AccountingLayoutBlock[],
  startY: number,
): number {
  const metaBlocks = blocks.filter((b) => b.zone === "meta");
  if (!metaBlocks.length) return startY + 40;
  const maxRow = Math.max(
    ...metaBlocks.map((b) => b.row + (b.rowSpan ?? 1) - 1),
  );
  return (
    startY +
    (maxRow + 1) * ACCOUNTING_PDF_ROW_HEIGHT_MM.meta +
    ACCOUNTING_PDF_ZONE_GAP_MM.afterMeta
  );
}

export function normalizeDocumentDesign(
  design: AccountingDocumentDesign,
): AccountingDocumentDesign {
  const blocks =
    design.layoutBlocks.length > 0
      ? design.layoutBlocks.map((block) => ({
          ...block,
          colSpan: block.colSpan ?? 1,
          rowSpan: block.rowSpan ?? 1,
          align: block.align ?? "left",
        }))
      : [...DEFAULT_LAYOUT_BLOCKS];

  return {
    fontFamily: design.fontFamily,
    layoutBlocks: blocks,
  };
}

export function parseLayoutBlocks(raw: unknown): AccountingLayoutBlock[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const blocks: AccountingLayoutBlock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const type = o.type;
    const zone = o.zone;
    if (
      (zone !== "header" && zone !== "footer" && zone !== "meta") ||
      typeof type !== "string"
    ) {
      continue;
    }
    const blockType = type as AccountingLayoutBlockType;
    const zoneTyped = zone as AccountingLayoutZone;
    const typeAllowed =
      zoneTyped === "meta"
        ? isFixedMetaBlockType(blockType)
        : ACCOUNTING_LAYOUT_BLOCK_OPTIONS.some((opt) => opt.type === blockType);
    if (!typeAllowed) {
      continue;
    }
    blocks.push({
      id: typeof o.id === "string" ? o.id : crypto.randomUUID(),
      zone: zoneTyped,
      type: blockType,
      col: typeof o.col === "number" ? o.col : 0,
      row: typeof o.row === "number" ? o.row : 0,
      colSpan: typeof o.colSpan === "number" ? o.colSpan : 1,
      rowSpan: typeof o.rowSpan === "number" ? o.rowSpan : 1,
      align:
        o.align === "center" || o.align === "right" ? o.align : "left",
      customText:
        typeof o.customText === "string" ? o.customText : null,
    });
  }
  return blocks;
}

export function parseAccountingDocumentDesign(
  raw: unknown,
): AccountingDocumentDesign {
  if (!raw || typeof raw !== "object") {
    return {
      fontFamily: "helvetica",
      layoutBlocks: ensureMetaLayoutBlocks([...DEFAULT_LAYOUT_BLOCKS]),
    };
  }
  const o = raw as Record<string, unknown>;
  const font = o.fontFamily;

  let layoutBlocks = parseLayoutBlocks(o.layoutBlocks);
  if (layoutBlocks.length === 0) {
    layoutBlocks = migrateLegacyDesignToBlocks(o);
  }
  if (layoutBlocks.length === 0) {
    layoutBlocks = [...DEFAULT_LAYOUT_BLOCKS];
  }

  layoutBlocks = ensureMetaLayoutBlocks(
    normalizeLayoutBlocksForGrid(layoutBlocks),
  );

  return {
    fontFamily:
      font === "times" || font === "courier" ? font : "helvetica",
    layoutBlocks,
  };
}
