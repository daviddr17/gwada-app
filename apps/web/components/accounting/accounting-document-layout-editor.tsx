"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverPortal,
  PopoverPositioner,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  ACCOUNTING_LAYOUT_BLOCK_OPTIONS,
  accountingDocumentFontClassName,
  ACCOUNTING_PAGE_NUMBER_PREVIEW,
  addLayoutBlock,
  getValidLayoutDropCells,
  layoutBlockLabel,
  layoutBlockLogoIsSquare,
  layoutBlockTextAlignClassName,
  layoutBlockEffectiveAlign,
  layoutZoneRows,
  LAYOUT_GRID_COLS,
  moveLayoutBlock,
  removeLayoutBlock,
  resizeLayoutBlockToSpan,
  resolveLayoutBlockPreviewText,
  resolveMetaBlockPreviewText,
  isFixedMetaBlock,
} from "@/lib/accounting/accounting-document-layout";
import {
  ACCOUNTING_DOCUMENT_FONT_OPTIONS,
  type AccountingDocumentDesign,
  type AccountingDocumentFontFamily,
  type AccountingLayoutBlock,
  type AccountingLayoutBlockType,
  type AccountingLayoutZone,
} from "@/lib/types/accounting-settings";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

function cellDropId(zone: AccountingLayoutZone, col: number, row: number) {
  return `cell:${zone}:${col}:${row}`;
}

function parseCellDropId(id: string) {
  const parts = id.split(":");
  if (parts.length !== 4 || parts[0] !== "cell") return null;
  return {
    zone: parts[1] as AccountingLayoutZone,
    col: Number(parts[2]),
    row: Number(parts[3]),
  };
}

type GridSpan = {
  col: number;
  colSpan: number;
  row: number;
  rowSpan: number;
};

function pointerToGridColumn(clientX: number, gridRect: DOMRect): number {
  const colWidth = gridRect.width / LAYOUT_GRID_COLS;
  return Math.max(
    0,
    Math.min(LAYOUT_GRID_COLS - 1, Math.floor((clientX - gridRect.left) / colWidth)),
  );
}

function pointerToGridRow(
  clientY: number,
  gridRect: DOMRect,
  zone: AccountingLayoutZone,
): number {
  const rows = layoutZoneRows(zone);
  const rowHeight = gridRect.height / rows;
  return Math.max(
    0,
    Math.min(rows - 1, Math.floor((clientY - gridRect.top) / rowHeight)),
  );
}

function LayoutBlockResizeHandles({
  block,
  gridRef,
  disabled,
  onResizeStart,
  onResize,
  onResizeEnd,
}: {
  block: AccountingLayoutBlock;
  gridRef: React.RefObject<HTMLDivElement | null>;
  disabled?: boolean;
  onResizeStart: () => void;
  onResize: (span: GridSpan) => void;
  onResizeEnd: () => void;
}) {
  const anchorRef = useRef<GridSpan | null>(null);

  const beginResize = (
    edge: "west" | "east" | "north" | "south",
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();

    const grid = gridRef.current;
    if (!grid) return;

    anchorRef.current = {
      col: block.col,
      colSpan: block.colSpan,
      row: block.row,
      rowSpan: block.rowSpan,
    };

    onResizeStart();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);

    const onMove = (ev: PointerEvent) => {
      const anchor = anchorRef.current;
      const rect = grid.getBoundingClientRect();
      if (!anchor) return;

      if (edge === "east") {
        const pointerCol = pointerToGridColumn(ev.clientX, rect);
        const colEnd = Math.max(anchor.col, pointerCol);
        onResize({
          col: anchor.col,
          colSpan: colEnd - anchor.col + 1,
          row: anchor.row,
          rowSpan: anchor.rowSpan,
        });
        return;
      }

      if (edge === "west") {
        const pointerCol = pointerToGridColumn(ev.clientX, rect);
        const col = Math.min(anchor.col + anchor.colSpan - 1, pointerCol);
        onResize({
          col,
          colSpan: anchor.col + anchor.colSpan - col,
          row: anchor.row,
          rowSpan: anchor.rowSpan,
        });
        return;
      }

      if (edge === "north") {
        const pointerRow = pointerToGridRow(ev.clientY, rect, block.zone);
        const row = Math.min(anchor.row + anchor.rowSpan - 1, pointerRow);
        onResize({
          col: anchor.col,
          colSpan: anchor.colSpan,
          row,
          rowSpan: anchor.row + anchor.rowSpan - row,
        });
        return;
      }

      const pointerRow = pointerToGridRow(ev.clientY, rect, block.zone);
      const rowEnd = Math.max(anchor.row, pointerRow);
      onResize({
        col: anchor.col,
        colSpan: anchor.colSpan,
        row: anchor.row,
        rowSpan: rowEnd - anchor.row + 1,
      });
    };

    const onUp = (ev: PointerEvent) => {
      handle.releasePointerCapture(ev.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      anchorRef.current = null;
      onResizeEnd();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  if (disabled) return null;

  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Breite links anpassen"
        className="absolute inset-y-1 -left-1 z-30 w-2 cursor-ew-resize rounded-full opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent/30"
        onPointerDown={(e) => beginResize("west", e)}
      />
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Breite rechts anpassen"
        className="absolute inset-y-1 -right-1 z-30 w-2 cursor-ew-resize rounded-full opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent/30"
        onPointerDown={(e) => beginResize("east", e)}
      />
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Höhe oben anpassen"
        className="absolute -top-1 left-2 right-2 z-30 h-2 cursor-ns-resize rounded-full opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent/30"
        onPointerDown={(e) => beginResize("north", e)}
      />
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Höhe unten anpassen"
        className="absolute -bottom-1 left-2 right-2 z-30 h-2 cursor-ns-resize rounded-full opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent/30"
        onPointerDown={(e) => beginResize("south", e)}
      />
    </>
  );
}

function LayoutZoneGrid({
  zone,
  blocks,
  disabled,
  activeBlockId,
  activeBlock,
  resizingBlockId,
  fontFamily,
  onAdd,
  onRemove,
  onEditCustomText,
  onResizeBlock,
  onResizeStart,
  onResizeEnd,
  profile,
  allowAdd = true,
  allowRemove = true,
}: {
  zone: AccountingLayoutZone;
  blocks: AccountingLayoutBlock[];
  disabled?: boolean;
  activeBlockId: string | null;
  activeBlock: AccountingLayoutBlock | null;
  resizingBlockId: string | null;
  fontFamily: AccountingDocumentFontFamily;
  onAdd: (type: AccountingLayoutBlockType, col: number, row: number) => void;
  onRemove: (blockId: string) => void;
  onEditCustomText: (blockId: string, text: string) => void;
  onResizeBlock: (blockId: string, span: GridSpan) => void;
  onResizeStart: (blockId: string) => void;
  onResizeEnd: () => void;
  profile: ReturnType<typeof useRestaurantProfile>["profile"];
  allowAdd?: boolean;
  allowRemove?: boolean;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const rows = layoutZoneRows(zone);
  const zoneBlocks = blocks.filter((b) => b.zone === zone);
  const isDragging = Boolean(activeBlockId);
  const fontClassName = accountingDocumentFontClassName(fontFamily);

  const targetCells = useMemo(() => {
    if (!allowAdd && !activeBlock) return [];
    return getValidLayoutDropCells(blocks, zone, activeBlock);
  }, [activeBlock, allowAdd, blocks, zone]);

  return (
    <div
      ref={gridRef}
      className={cn("grid gap-1.5", fontClassName)}
      style={{
        gridTemplateColumns: `repeat(${LAYOUT_GRID_COLS}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(2.375rem, auto))`,
      }}
    >
      {targetCells.map(({ col, row }) => (
        <GridDropCell
          key={`${zone}-${col}-${row}`}
          zone={zone}
          col={col}
          row={row}
          disabled={disabled}
          isDragging={isDragging}
          onAdd={onAdd}
        />
      ))}

      {zoneBlocks.map((block) => (
        <LayoutBlockItem
          key={block.id}
          block={block}
          profile={profile}
          gridRef={gridRef}
          fontClassName={fontClassName}
          disabled={disabled}
          isDragging={activeBlockId === block.id}
          isResizing={resizingBlockId === block.id}
          onRemove={() => onRemove(block.id)}
          onEditCustomText={(text) => onEditCustomText(block.id, text)}
          onResizeStart={() => onResizeStart(block.id)}
          onResizeEnd={onResizeEnd}
          onResize={(span) => onResizeBlock(block.id, span)}
          allowRemove={allowRemove && !isFixedMetaBlock(block)}
        />
      ))}
    </div>
  );
}

function GridDropCell({
  zone,
  col,
  row,
  disabled,
  isDragging,
  onAdd,
}: {
  zone: AccountingLayoutZone;
  col: number;
  row: number;
  disabled?: boolean;
  isDragging: boolean;
  onAdd: (type: AccountingLayoutBlockType, col: number, row: number) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: cellDropId(zone, col, row),
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        gridColumn: col + 1,
        gridRow: row + 1,
      }}
      className={cn(
        "group relative min-h-10 rounded-md border border-dashed transition-colors",
        isDragging
          ? "z-30 border-border/50 bg-muted/10"
          : "z-0 border-transparent",
        isOver && "border-accent bg-accent/15 ring-1 ring-accent/30",
        !disabled &&
          !isDragging &&
          "hover:border-border/60 hover:bg-muted/20",
      )}
    >
      {!disabled && !isDragging ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="absolute inset-0 z-10 flex items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                aria-label="Element hinzufügen"
              />
            }
          >
            <Plus className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-70 group-focus-within:opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-56 max-h-64 overflow-y-auto">
            {ACCOUNTING_LAYOUT_BLOCK_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.type}
                onClick={() => onAdd(option.type, col, row)}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

function LayoutBlockItem({
  block,
  profile,
  gridRef,
  fontClassName,
  disabled,
  isDragging,
  isResizing,
  onRemove,
  onEditCustomText,
  onResizeStart,
  onResizeEnd,
  onResize,
  allowRemove = true,
}: {
  block: AccountingLayoutBlock;
  profile: ReturnType<typeof useRestaurantProfile>["profile"];
  gridRef: React.RefObject<HTMLDivElement | null>;
  fontClassName: string;
  disabled?: boolean;
  isDragging?: boolean;
  isResizing?: boolean;
  onRemove: () => void;
  onEditCustomText: (text: string) => void;
  onResizeStart: () => void;
  onResizeEnd: () => void;
  onResize: (span: GridSpan) => void;
  allowRemove?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: block.id,
    disabled: disabled || isResizing,
  });

  const preview =
    block.zone === "meta"
      ? resolveMetaBlockPreviewText(block)
      : resolveLayoutBlockPreviewText(block, profile);
  const titlePreview =
    block.type === "document_title" ? preview : null;
  const bodyPreview = block.type === "document_title" ? null : preview;
  const logoSquare = block.type === "logo" && layoutBlockLogoIsSquare(block);
  const textAlignClass = layoutBlockTextAlignClassName(block);
  const logoAlignRight = layoutBlockEffectiveAlign(block) === "right";
  const style = {
    gridColumn: `${block.col + 1} / span ${block.colSpan}`,
    gridRow: `${block.row + 1} / span ${block.rowSpan}`,
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative z-20 flex min-h-10 items-start gap-1 rounded-md border border-border/50 bg-card px-2 py-1 text-left shadow-sm transition-shadow",
        fontClassName,
        isDragging && "pointer-events-none opacity-35",
        isResizing && "border-accent/50 ring-2 ring-accent/25",
        !disabled && !isDragging && !isResizing && "hover:border-accent/40 hover:shadow-card",
      )}
    >
      <LayoutBlockResizeHandles
        block={block}
        gridRef={gridRef}
        disabled={disabled || isDragging}
        onResizeStart={onResizeStart}
        onResize={onResize}
        onResizeEnd={onResizeEnd}
      />

      {!disabled ? (
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          aria-label={`${layoutBlockLabel(block.type)} verschieben`}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-3.5" />
        </button>
      ) : null}

      <div className={cn("min-w-0 flex-1", textAlignClass)}>
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {layoutBlockLabel(block.type)}
        </p>
        {block.type === "logo" ? (
          <div
            className={cn(
              "mt-0.5 flex w-full text-muted-foreground",
              logoAlignRight ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-1.5 text-xs text-foreground",
                logoSquare
                  ? "aspect-square max-h-full max-w-full"
                  : "min-h-[2.375rem]",
              )}
            >
              <ImageIcon className="size-3.5 shrink-0" />
              {!logoSquare ? <span>Logo</span> : null}
            </div>
          </div>
        ) : titlePreview ? (
          <p className="mt-0 text-sm font-semibold leading-tight text-foreground">
            {titlePreview}
          </p>
        ) : (
          <p className="mt-0 line-clamp-4 whitespace-pre-line text-xs leading-tight text-foreground">
            {bodyPreview}
          </p>
        )}
      </div>

      {!disabled && allowRemove ? (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {block.type === "custom_text" ? (
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 rounded-full"
                    aria-label="Freitext bearbeiten"
                  />
                }
              >
                <Pencil className="size-3.5" />
              </PopoverTrigger>
              <PopoverPortal>
                <PopoverPositioner side="bottom" align="end">
                  <PopoverContent className="w-72 p-3">
                    <Textarea
                      rows={3}
                      defaultValue={block.customText ?? ""}
                      onBlur={(e) => onEditCustomText(e.target.value)}
                    />
                  </PopoverContent>
                </PopoverPositioner>
              </PopoverPortal>
            </Popover>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 rounded-full text-destructive hover:text-destructive"
            aria-label="Element entfernen"
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function DocumentBodyPreview({
  fontClassName,
  blocks,
  disabled,
  activeBlockId,
  activeBlock,
  resizingBlockId,
  fontFamily,
  profile,
  onRemove,
  onEditCustomText,
  onResizeBlock,
  onResizeStart,
  onResizeEnd,
}: {
  fontClassName: string;
  blocks: AccountingLayoutBlock[];
  disabled?: boolean;
  activeBlockId: string | null;
  activeBlock: AccountingLayoutBlock | null;
  resizingBlockId: string | null;
  fontFamily: AccountingDocumentFontFamily;
  profile: ReturnType<typeof useRestaurantProfile>["profile"];
  onRemove: (blockId: string) => void;
  onEditCustomText: (blockId: string, text: string) => void;
  onResizeBlock: (blockId: string, span: GridSpan) => void;
  onResizeStart: (blockId: string) => void;
  onResizeEnd: () => void;
}) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border border-border/40 bg-muted/15 p-4",
        fontClassName,
      )}
    >
      <LayoutZoneGrid
        zone="meta"
        blocks={blocks}
        disabled={disabled}
        activeBlockId={activeBlockId}
        activeBlock={activeBlock}
        resizingBlockId={resizingBlockId}
        fontFamily={fontFamily}
        profile={profile}
        allowAdd={false}
        allowRemove={false}
        onAdd={() => {}}
        onRemove={onRemove}
        onEditCustomText={onEditCustomText}
        onResizeBlock={onResizeBlock}
        onResizeStart={onResizeStart}
        onResizeEnd={onResizeEnd}
      />

      <div className="overflow-hidden rounded-md border border-border/40">
        <div className="grid grid-cols-5 gap-2 border-b border-border/40 bg-muted/30 px-2 py-1.5 text-[10px] font-medium text-muted-foreground">
          <span className="col-span-2">Bezeichnung</span>
          <span>Menge</span>
          <span>Preis</span>
          <span>Betrag</span>
        </div>
        <div className="space-y-1 px-2 py-2 text-[10px] text-muted-foreground">
          <div className="grid grid-cols-5 gap-2">
            <span className="col-span-2">Beispielposition</span>
            <span>1</span>
            <span>850 €</span>
            <span>850 €</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            <span className="col-span-2">Weitere Leistung</span>
            <span>20</span>
            <span>12,50 €</span>
            <span>250 €</span>
          </div>
        </div>
      </div>
      <p className="text-right text-xs font-medium text-foreground/70">
        Gesamt (brutto): 1.279,00 €
      </p>
    </div>
  );
}

export function AccountingDocumentLayoutEditor({
  design,
  onChange,
  disabled,
}: {
  design: AccountingDocumentDesign;
  onChange: (patch: Partial<AccountingDocumentDesign>) => void;
  disabled?: boolean;
}) {
  const { profile } = useRestaurantProfile();
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [resizingBlockId, setResizingBlockId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const fontClassName = accountingDocumentFontClassName(design.fontFamily);

  const activeBlock = useMemo(
    () => design.layoutBlocks.find((b) => b.id === activeBlockId) ?? null,
    [activeBlockId, design.layoutBlocks],
  );

  const updateBlocks = useCallback(
    (blocks: AccountingLayoutBlock[]) => {
      onChange({ layoutBlocks: blocks });
    },
    [onChange],
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (resizingBlockId) return;
    setActiveBlockId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveBlockId(null);
    const overId = event.over?.id;
    const blockId = String(event.active.id);
    if (!overId) return;
    const cell = parseCellDropId(String(overId));
    if (!cell) return;

    const nextBlocks = moveLayoutBlock(
      design.layoutBlocks,
      blockId,
      cell.zone,
      cell.col,
      cell.row,
    );
    if (nextBlocks === design.layoutBlocks) {
      toast.error("Element passt hier nicht.");
      return;
    }
    updateBlocks(nextBlocks);
  };

  const handleAdd = (
    type: AccountingLayoutBlockType,
    zone: AccountingLayoutZone,
    col: number,
    row: number,
  ) => {
    const nextBlocks = addLayoutBlock(design.layoutBlocks, type, zone, col, row);
    if (nextBlocks.length === design.layoutBlocks.length) {
      toast.error("Kein Platz an dieser Position.");
      return;
    }
    updateBlocks(nextBlocks);
  };

  const handleResizeBlock = useCallback(
    (blockId: string, span: GridSpan) => {
      const nextBlocks = resizeLayoutBlockToSpan(design.layoutBlocks, blockId, span);
      if (nextBlocks !== design.layoutBlocks) {
        updateBlocks(nextBlocks);
      }
    },
    [design.layoutBlocks, updateBlocks],
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Schriftart</Label>
        <SearchableSelect
          value={design.fontFamily}
          onValueChange={(v) =>
            onChange({
              fontFamily: v as AccountingDocumentDesign["fontFamily"],
            })
          }
          options={ACCOUNTING_DOCUMENT_FONT_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
          className={appSelectTriggerAccentCn("h-11 w-full max-w-md")}
          searchPlaceholder="Schriftart"
          aria-label="Schriftart"
          disabled={disabled}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        4-Spalten-Raster — verschieben, am Rand ziehen (auch oben/unten) für
        Breite/Höhe, beim Hovern hinzufügen oder entfernen.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          className={cn(
            "relative mx-auto w-full max-w-2xl rounded-2xl border border-border/50 bg-background p-4 pb-8 shadow-card",
            fontClassName,
          )}
        >
          <div className="mb-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Layout-Raster
            </p>
          </div>

          <div className="space-y-3">
            <LayoutZoneGrid
              zone="header"
              blocks={design.layoutBlocks}
              disabled={disabled}
              activeBlockId={activeBlockId}
              activeBlock={activeBlock}
              resizingBlockId={resizingBlockId}
              fontFamily={design.fontFamily}
              profile={profile}
              onAdd={(type, col, row) => handleAdd(type, "header", col, row)}
              onRemove={(id) =>
                updateBlocks(removeLayoutBlock(design.layoutBlocks, id))
              }
              onEditCustomText={(id, text) =>
                updateBlocks(
                  design.layoutBlocks.map((b) =>
                    b.id === id ? { ...b, customText: text.trim() || null } : b,
                  ),
                )
              }
              onResizeBlock={handleResizeBlock}
              onResizeStart={setResizingBlockId}
              onResizeEnd={() => setResizingBlockId(null)}
            />

            <DocumentBodyPreview
              fontClassName={fontClassName}
              blocks={design.layoutBlocks}
              disabled={disabled}
              activeBlockId={activeBlockId}
              activeBlock={activeBlock}
              resizingBlockId={resizingBlockId}
              fontFamily={design.fontFamily}
              profile={profile}
              onRemove={(id) =>
                updateBlocks(removeLayoutBlock(design.layoutBlocks, id))
              }
              onEditCustomText={(id, text) =>
                updateBlocks(
                  design.layoutBlocks.map((b) =>
                    b.id === id ? { ...b, customText: text.trim() || null } : b,
                  ),
                )
              }
              onResizeBlock={handleResizeBlock}
              onResizeStart={setResizingBlockId}
              onResizeEnd={() => setResizingBlockId(null)}
            />

            <LayoutZoneGrid
              zone="footer"
              blocks={design.layoutBlocks}
              disabled={disabled}
              activeBlockId={activeBlockId}
              activeBlock={activeBlock}
              resizingBlockId={resizingBlockId}
              fontFamily={design.fontFamily}
              profile={profile}
              onAdd={(type, col, row) => handleAdd(type, "footer", col, row)}
              onRemove={(id) =>
                updateBlocks(removeLayoutBlock(design.layoutBlocks, id))
              }
              onEditCustomText={(id, text) =>
                updateBlocks(
                  design.layoutBlocks.map((b) =>
                    b.id === id ? { ...b, customText: text.trim() || null } : b,
                  ),
                )
              }
              onResizeBlock={handleResizeBlock}
              onResizeStart={setResizingBlockId}
              onResizeEnd={() => setResizingBlockId(null)}
            />
          </div>

          <p
            className="pointer-events-none absolute bottom-3 right-4 text-[10px] tabular-nums text-muted-foreground"
            aria-hidden
          >
            {ACCOUNTING_PAGE_NUMBER_PREVIEW}
          </p>
          <p className="sr-only">Seitennummer unten rechts — im PDF automatisch 1/1, 1/2 …</p>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeBlock ? (
            <div
              className={cn(
                "rounded-md border border-accent/40 bg-card px-3 py-2 text-xs shadow-elevated",
                fontClassName,
              )}
            >
              {layoutBlockLabel(activeBlock.type)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
