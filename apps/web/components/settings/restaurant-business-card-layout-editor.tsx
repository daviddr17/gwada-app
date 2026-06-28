"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { GripVertical, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  BusinessCardElementContent,
  BusinessCardFaceAccentLayer,
  businessCardElementHasContent,
  shouldHideBusinessCardWebsiteElement,
} from "@/components/settings/business-card-element-content";
import {
  businessCardPresetArtDirection,
  businessCardPresetStructureLine,
  BUSINESS_CARD_CONTENT_W,
  BUSINESS_CARD_MARGIN_X,
} from "@/lib/restaurant/business-card-art-direction";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BusinessCardDecorationVisual } from "@/components/settings/business-card-decoration-visual";
import {
  BUSINESS_CARD_SHAPE_DRAG_MIME,
  BUSINESS_CARD_SHAPE_OPTIONS,
  createBusinessCardShapeDecoration,
  decorationClampMins,
  isBusinessCardImageDecoration,
  isBusinessCardShapeDecoration,
  type BusinessCardShapeKind,
} from "@/lib/restaurant/business-card-shape-decoration";
import {
  createBusinessCardDecorationFromFile,
} from "@/lib/restaurant/business-card-decoration-document";
import {
  isBusinessCardDecorationFile,
} from "@/lib/restaurant/business-card-decoration-file";
import {
  BUSINESS_CARD_DECORATION_MINS,
  BUSINESS_CARD_DECORATION_LIMIT,
  BUSINESS_CARD_ELEMENT_DEFS,
  activeDecorationsForSide,
  activeElementsForSide,
  addBusinessCardDecoration,
  businessCardDecorationStackClassName,
  businessCardElementStackClassName,
  businessCardFormatAspect,
  businessCardVisualOpacity,
  clampBusinessCardRect,
  isBusinessCardSquareElement,
  normalizeSquareBusinessCardRect,
  removeBusinessCardDecoration,
  updateBusinessCardDecoration,
  updateBusinessCardElement,
  setBusinessCardElementEnabled,
  type BusinessCardDecoration,
  type BusinessCardDesign,
  type BusinessCardElement,
  type BusinessCardRect,
  type BusinessCardSide,
} from "@/lib/restaurant/business-card-design";
import type { BusinessCardContent } from "@/lib/restaurant/business-card-layout";
import { normalizeHex } from "@/lib/theme/color-utils";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { cn } from "@/lib/utils";

const shapeToolbarChipClassName =
  "inline-flex items-center gap-1 rounded-lg border border-border/50 bg-background/80 px-2.5 py-1.5 text-[0.65rem] font-medium text-foreground shadow-sm transition-colors hover:border-accent/40 hover:bg-accent/5";

const CARD_PREVIEW_TILT_MAX_DEG = 9;
const CARD_PREVIEW_HOVER_SCALE = 1.014;

type CardPreviewTilt = {
  rotateX: number;
  rotateY: number;
};

function businessCardPreviewShadow(
  tilt: CardPreviewTilt,
  active: boolean,
): string {
  if (!active) {
    return "0 6px 28px -10px rgba(15,23,42,0.22)";
  }

  const offsetX = tilt.rotateY * -0.85;
  const offsetY = 12 + tilt.rotateX * -0.65;
  const blur = 26 + Math.abs(tilt.rotateY) * 0.35 + Math.abs(tilt.rotateX) * 0.25;
  return `${offsetX}px ${offsetY}px ${blur}px -10px rgba(15,23,42,0.3)`;
}

type RestaurantBusinessCardLayoutEditorProps = {
  design: BusinessCardDesign;
  onDesignChange: (design: BusinessCardDesign) => void;
  content: BusinessCardContent;
  coverUrl: string | null;
  logoUrl: string | null;
  gwadaFaviconUrl: string | null;
  qrCodeUrl: string | null;
  restaurantId: string;
  className?: string;
};

type DragTarget =
  | { kind: "element"; id: string }
  | { kind: "decoration"; id: string };

type DragMode = {
  mode: "move" | "resize" | "resize-e" | "resize-s";
  target: DragTarget;
  startX: number;
  startY: number;
  rect: BusinessCardRect;
};

function isDecorationTarget(
  target: DragTarget,
): target is { kind: "decoration"; id: string } {
  return target.kind === "decoration";
}

export function RestaurantBusinessCardLayoutEditor({
  design,
  onDesignChange,
  content,
  coverUrl,
  logoUrl,
  gwadaFaviconUrl,
  qrCodeUrl,
  restaurantId,
  className,
}: RestaurantBusinessCardLayoutEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const fitAreaRef = useRef<HTMLDivElement>(null);
  const decorationFileInputRef = useRef<HTMLInputElement>(null);
  const [side, setSide] = useState<BusinessCardSide>("front");
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedDecorationId, setSelectedDecorationId] = useState<string | null>(
    null,
  );
  const [fileDragOver, setFileDragOver] = useState(false);
  const [canvasHovered, setCanvasHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<DragMode | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [previewHover, setPreviewHover] = useState(false);
  const [cardTilt, setCardTilt] = useState<CardPreviewTilt>({
    rotateX: 0,
    rotateY: 0,
  });
  const reduceMotion = useReducedMotion() ?? false;

  const aspect = businessCardFormatAspect(design.formatId);
  const sideElements = activeElementsForSide(design, side);
  const cardAtmosphere = useMemo(() => {
    const art = businessCardPresetArtDirection(design.presetId);
    return art.faceAtmosphere(design.colors.accent, design.colors.background);
  }, [design.presetId, design.colors.accent, design.colors.background]);
  const structureLine = businessCardPresetStructureLine(design.presetId, side);
  const sideDecorations = activeDecorationsForSide(design, side);
  const coverElements = sideElements.filter((element) => element.type === "cover");
  const contentElements = sideElements.filter((element) => element.type !== "cover");
  const selectedVisualTarget = useMemo(() => {
    if (selectedDecorationId) {
      const decoration = design.decorations.find((d) => d.id === selectedDecorationId);
      if (!decoration || decoration.side !== side) return null;
      if (isBusinessCardShapeDecoration(decoration)) {
        return {
          kind: "shape" as const,
          id: decoration.id,
          color: decoration.color,
          opacity: decoration.opacity,
        };
      }
      if (isBusinessCardImageDecoration(decoration)) {
        return {
          kind: "imageDecoration" as const,
          id: decoration.id,
          opacity: businessCardVisualOpacity(decoration.opacity),
        };
      }
      return null;
    }

    if (selectedElementId) {
      const element = design.elements.find((el) => el.id === selectedElementId);
      if (
        !element
        || element.side !== side
        || (element.type !== "cover" && element.type !== "logo")
      ) {
        return null;
      }
      return {
        kind: "element" as const,
        id: element.id,
        type: element.type,
        opacity: businessCardVisualOpacity(element.opacity),
      };
    }

    return null;
  }, [
    design.decorations,
    design.elements,
    selectedDecorationId,
    selectedElementId,
    side,
  ]);

  const patchSelectedVisual = useCallback(
    (patch: { color?: string; opacity?: number }) => {
      if (!selectedVisualTarget) return;

      if (
        selectedVisualTarget.kind === "shape"
        || selectedVisualTarget.kind === "imageDecoration"
      ) {
        onDesignChange(
          updateBusinessCardDecoration(design, selectedVisualTarget.id, patch),
        );
        return;
      }

      if (patch.opacity !== undefined) {
        onDesignChange(
          updateBusinessCardElement(design, selectedVisualTarget.id, {
            opacity: patch.opacity,
          }),
        );
      }
    },
    [design, onDesignChange, selectedVisualTarget],
  );

  const clearSelection = useCallback(() => {
    setSelectedElementId(null);
    setSelectedDecorationId(null);
  }, []);

  const patchElement = useCallback(
    (elementId: string, rect: BusinessCardRect) => {
      const el = design.elements.find((e) => e.id === elementId);
      if (!el) return;
      const def = BUSINESS_CARD_ELEMENT_DEFS[el.type];
      const nextRect = isBusinessCardSquareElement(el.type)
        ? normalizeSquareBusinessCardRect(rect, design.formatId, def)
        : clampBusinessCardRect(rect, def);
      onDesignChange(updateBusinessCardElement(design, elementId, { rect: nextRect }));
    },
    [design, onDesignChange],
  );

  const patchDecoration = useCallback(
    (decorationId: string, rect: BusinessCardRect) => {
      const decoration = design.decorations.find((d) => d.id === decorationId);
      const mins = decoration
        ? decorationClampMins(decoration)
        : BUSINESS_CARD_DECORATION_MINS;
      onDesignChange(
        updateBusinessCardDecoration(design, decorationId, {
          rect: clampBusinessCardRect(rect, mins),
        }),
      );
    },
    [design, onDesignChange],
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      const canvas = canvasRef.current;
      if (!drag || !canvas) return;

      const bounds = canvas.getBoundingClientRect();
      const dx = ((event.clientX - drag.startX) / bounds.width) * 100;
      const dy = ((event.clientY - drag.startY) / bounds.height) * 100;

      if (drag.mode === "move") {
        const next = {
          ...drag.rect,
          x: drag.rect.x + dx,
          y: drag.rect.y + dy,
        };
        if (isDecorationTarget(drag.target)) {
          patchDecoration(drag.target.id, next);
        } else {
          patchElement(drag.target.id, next);
        }
        return;
      }

      if (isDecorationTarget(drag.target)) {
        const next = { ...drag.rect };
        if (drag.mode === "resize-e") {
          next.w = drag.rect.w + dx;
        } else if (drag.mode === "resize-s") {
          next.h = drag.rect.h + dy;
        } else {
          next.w = drag.rect.w + dx;
          next.h = drag.rect.h + dy;
        }
        patchDecoration(drag.target.id, next);
        return;
      }

      const el = design.elements.find((e) => e.id === drag.target.id);
      if (el && isBusinessCardSquareElement(el.type)) {
        const cardAspect = businessCardFormatAspect(design.formatId);
        const dw = dx;
        const dh = dy * cardAspect;
        const delta = (dw + dh) / 2;
        const newW = drag.rect.w + delta;
        patchElement(drag.target.id, {
          ...drag.rect,
          w: newW,
          h: newW * cardAspect,
        });
      } else {
        patchElement(drag.target.id, {
          ...drag.rect,
          w: drag.rect.w + dx,
          h: drag.rect.h + dy,
        });
      }
    };

    const onPointerUp = () => {
      if (!dragRef.current) return;
      const drag = dragRef.current;

      if (isDecorationTarget(drag.target)) {
        const dec = design.decorations.find((d) => d.id === drag.target.id);
        if (dec) {
          onDesignChange(
            updateBusinessCardDecoration(design, dec.id, {
              rect: clampBusinessCardRect(dec.rect, decorationClampMins(dec)),
            }),
          );
        }
      } else {
        const el = design.elements.find((e) => e.id === drag.target.id);
        if (el) {
          const def = BUSINESS_CARD_ELEMENT_DEFS[el.type];
          onDesignChange(
            updateBusinessCardElement(design, el.id, {
              rect: isBusinessCardSquareElement(el.type)
                ? normalizeSquareBusinessCardRect(el.rect, design.formatId, def)
                : clampBusinessCardRect(el.rect, def),
            }),
          );
        }
      }

      dragRef.current = null;
      setDragging(false);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [design, onDesignChange, patchDecoration, patchElement]);

  useEffect(() => {
    const area = fitAreaRef.current;
    if (!area) return;

      const updateSize = () => {
      const areaW = area.clientWidth;
      const areaH = area.clientHeight;
      if (areaW <= 0 || areaH <= 0) return;

      let width = areaW;
      let height = width / aspect;
      if (height > areaH) {
        height = areaH;
        width = height * aspect;
      }

      setCanvasSize({
        width: Math.max(0, Math.floor(width)),
        height: Math.max(0, Math.floor(height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(area);
    return () => observer.disconnect();
  }, [aspect, side]);

  const startDrag = (
    event: React.PointerEvent,
    target: DragTarget,
    rect: BusinessCardRect,
    mode: DragMode["mode"],
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (isDecorationTarget(target)) {
      setSelectedDecorationId(target.id);
      setSelectedElementId(null);
    } else {
      setSelectedElementId(target.id);
      setSelectedDecorationId(null);
    }
    dragRef.current = {
      mode,
      target,
      startX: event.clientX,
      startY: event.clientY,
      rect: { ...rect },
    };
    setCardTilt({ rotateX: 0, rotateY: 0 });
    setDragging(true);
  };

  const resetCardTilt = useCallback(() => {
    setCardTilt({ rotateX: 0, rotateY: 0 });
    setPreviewHover(false);
  }, []);

  const handlePreviewPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (reduceMotion || dragging || fileDragOver || event.pointerType !== "mouse") {
        return;
      }

      const area = fitAreaRef.current;
      if (!area) return;

      const rect = area.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const nx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

      setCardTilt({
        rotateY: nx * CARD_PREVIEW_TILT_MAX_DEG,
        rotateX: -ny * CARD_PREVIEW_TILT_MAX_DEG,
      });
    },
    [dragging, fileDragOver, reduceMotion],
  );

  const cardTiltActive =
    !reduceMotion && previewHover && !dragging && !fileDragOver;

  const cardPreviewTransform = useMemo(() => {
    if (!cardTiltActive) return undefined;
    return `rotateX(${cardTilt.rotateX}deg) rotateY(${cardTilt.rotateY}deg) scale3d(${CARD_PREVIEW_HOVER_SCALE}, ${CARD_PREVIEW_HOVER_SCALE}, ${CARD_PREVIEW_HOVER_SCALE})`;
  }, [cardTilt, cardTiltActive]);

  const cardPreviewShadow = useMemo(
    () => businessCardPreviewShadow(cardTilt, cardTiltActive),
    [cardTilt, cardTiltActive],
  );

  const handleRemoveDecoration = (
    event: React.MouseEvent,
    decorationId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    onDesignChange(removeBusinessCardDecoration(design, decorationId));
    if (selectedDecorationId === decorationId) {
      setSelectedDecorationId(null);
    }
  };

  const handleRemoveElement = (
    event: React.MouseEvent,
    element: BusinessCardElement,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    onDesignChange(setBusinessCardElementEnabled(design, element.type, false));
    if (selectedElementId === element.id) {
      setSelectedElementId(null);
    }
  };

  const addShape = useCallback(
    (kind: BusinessCardShapeKind, dropPosition?: { xPct: number; yPct: number }) => {
      if (design.decorations.length >= BUSINESS_CARD_DECORATION_LIMIT) {
        toast.error(`Maximal ${BUSINESS_CARD_DECORATION_LIMIT} Dekorationen.`);
        return;
      }
      const shape = createBusinessCardShapeDecoration({
        kind,
        side,
        formatId: design.formatId,
        accentHex: design.colors.accent,
        dropPosition,
      });
      onDesignChange(addBusinessCardDecoration(design, shape));
      setSelectedDecorationId(shape.id);
      setSelectedElementId(null);
    },
    [design, onDesignChange, side],
  );

  const handleDecorationFile = async (
    file: File,
    dropPosition?: { xPct: number; yPct: number },
  ) => {
    if ((design.decorations ?? []).length >= BUSINESS_CARD_DECORATION_LIMIT) {
      toast.error(`Maximal ${BUSINESS_CARD_DECORATION_LIMIT} Dekorbilder.`);
      return;
    }

    const result = await createBusinessCardDecorationFromFile({
      restaurantId,
      file,
      design,
      side,
      dropPosition,
    });

    if (!result.ok) {
      if (!result.alreadyNotified) {
        toast.error(result.error);
      }
      return;
    }

    onDesignChange(addBusinessCardDecoration(design, result.decoration));
  };

  const handleCanvasDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setFileDragOver(false);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const bounds = canvas.getBoundingClientRect();
    const xPct = ((event.clientX - bounds.left) / bounds.width) * 100;
    const yPct = ((event.clientY - bounds.top) / bounds.height) * 100;

    const shapeKind = event.dataTransfer.getData(BUSINESS_CARD_SHAPE_DRAG_MIME);
    if (
      shapeKind === "rect"
      || shapeKind === "circle"
      || shapeKind === "line"
    ) {
      addShape(shapeKind, { xPct, yPct });
      return;
    }

    const file = [...event.dataTransfer.files].find(isBusinessCardDecorationFile);
    if (!file) {
      return;
    }

    await handleDecorationFile(file, { xPct, yPct });
  };

  const handleDecorationFilePick = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await handleDecorationFile(file, { xPct: 50, yPct: 50 });
  };

  const showHandles = (activeDuringDrag: boolean) =>
    canvasHovered || (dragging && activeDuringDrag);

  const handleChromeClassName = (activeDuringDrag: boolean) =>
    showHandles(activeDuringDrag) ? "opacity-100" : "opacity-0";

  const elementRingClassName =
    "ring-0 group-hover/canvas:ring-1 group-hover/canvas:ring-accent/30";

  const renderEditableElement = (element: BusinessCardElement) => {
    if (
      shouldHideBusinessCardWebsiteElement(
        element.type,
        design,
        side,
        content,
      )
    ) {
      return null;
    }

    if (!businessCardElementHasContent(element.type, content, { coverUrl })) {
      return null;
    }

    const def = BUSINESS_CARD_ELEMENT_DEFS[element.type];
    const isCoverFull =
      element.type === "cover" &&
      element.rect.w >= 99 &&
      element.rect.h >= 99;

    return (
      <div
        key={element.id}
        className={cn(
          "group/element absolute touch-none overflow-visible transition-[box-shadow] duration-150",
          elementRingClassName,
          element.type === "cover" ? "" : "rounded-sm",
          businessCardElementStackClassName(element.type, design, {
            isCoverFull,
          }),
        )}
        style={{
          left: `${element.rect.x}%`,
          top: `${element.rect.y}%`,
          width: `${element.rect.w}%`,
          height: `${element.rect.h}%`,
        }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedElementId(element.id);
          setSelectedDecorationId(null);
        }}
      >
        <BusinessCardCanvasRemoveButton
          label={`${def.label} entfernen`}
          visibleClassName={handleChromeClassName(
            selectedElementId === element.id,
          )}
          onClick={(e) => handleRemoveElement(e, element)}
        />

        <div
          className={cn(
            "size-full",
            element.type === "logo" || element.type === "qrCode"
              ? "overflow-visible"
              : "overflow-hidden",
          )}
        >
          <Tooltip>
            <TooltipTrigger
              delay={300}
              render={
                <button
                  type="button"
                  className={cn(
                    "absolute left-0 top-0 z-10 flex size-3.5 cursor-grab items-center justify-center rounded-br-md bg-background/90 text-muted-foreground shadow-sm transition-opacity duration-150 active:cursor-grabbing",
                    handleChromeClassName(selectedElementId === element.id),
                  )}
                  aria-label={`${def.label} verschieben`}
                  onPointerDown={(e) =>
                    startDrag(
                      e,
                      { kind: "element", id: element.id },
                      element.rect,
                      "move",
                    )
                  }
                />
              }
            >
              <GripVertical className="size-2" />
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              {def.label} — verschieben
            </TooltipContent>
          </Tooltip>

          <BusinessCardElementContent
            type={element.type}
            content={content}
            colors={design.colors}
            rect={element.rect}
            canvasHeightPx={canvasSize.height}
            canvasWidthPx={canvasSize.width}
            typographyId={design.typographyId}
            presetId={design.presetId}
            accentStyle={design.accentStyle}
            coverUrl={coverUrl}
            logoUrl={logoUrl}
            gwadaFaviconUrl={gwadaFaviconUrl}
            qrCodeUrl={qrCodeUrl}
            imageOpacity={
              element.type === "cover" || element.type === "logo"
                ? businessCardVisualOpacity(element.opacity)
                : undefined
            }
            className="pointer-events-none size-full"
          />
        </div>

        <button
          type="button"
          className={cn(
            "absolute bottom-0 right-0 z-10 size-3.5 cursor-se-resize rounded-tl-sm bg-accent/90 transition-opacity duration-150",
            handleChromeClassName(selectedElementId === element.id),
          )}
          aria-label={`${def.label} Größe ändern`}
          onPointerDown={(e) =>
            startDrag(
              e,
              { kind: "element", id: element.id },
              element.rect,
              "resize",
            )
          }
        />
      </div>
    );
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="flex w-full shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-1 pb-4 pt-0 sm:flex-nowrap sm:justify-between lg:pb-5">
        <div className="flex shrink-0 justify-start gap-1.5">
          <Button
            type="button"
            variant={side === "front" ? "secondary" : "outline"}
            size="sm"
            className="h-8 rounded-full border-border/60 px-3.5 text-xs"
            onClick={() => setSide("front")}
          >
            Vorderseite
          </Button>
          <Button
            type="button"
            variant={side === "back" ? "secondary" : "outline"}
            size="sm"
            className="h-8 rounded-full border-border/60 px-3.5 text-xs"
            onClick={() => setSide("back")}
          >
            Rückseite
          </Button>
        </div>

        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 sm:ml-0 sm:flex-nowrap">
          <span className="shrink-0 text-[0.65rem] text-muted-foreground">
            Formen oder Bild auf die Karte ziehen
          </span>
          <div className="flex flex-wrap items-center justify-end gap-1">
            {BUSINESS_CARD_SHAPE_OPTIONS.map((option) => (
              <button
                key={option.kind}
                type="button"
                draggable
                title={option.description}
                onClick={() => addShape(option.kind)}
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    BUSINESS_CARD_SHAPE_DRAG_MIME,
                    option.kind,
                  );
                  event.dataTransfer.effectAllowed = "copy";
                }}
                className={shapeToolbarChipClassName}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              title="JPG oder PNG hochladen"
              onClick={() => decorationFileInputRef.current?.click()}
              className={shapeToolbarChipClassName}
            >
              <ImagePlus className="size-3 opacity-70" />
              Bild
            </button>
            <input
              ref={decorationFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              className="sr-only"
              onChange={(event) => void handleDecorationFilePick(event)}
            />
          </div>
        </div>
      </div>

      <div
        ref={fitAreaRef}
        className={cn(
          "relative flex min-h-0 flex-1 items-center justify-center px-4 pt-6 pb-12 lg:px-6 lg:pt-8 lg:pb-14",
          !reduceMotion && "motion-safe:[perspective:1200px]",
        )}
        onPointerMove={handlePreviewPointerMove}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setPreviewHover(true);
        }}
        onPointerLeave={resetCardTilt}
      >
        {selectedVisualTarget ? (
          <div className="pointer-events-auto absolute left-4 top-3 z-30 flex w-full max-w-md flex-wrap items-center justify-start gap-2 rounded-xl border border-border/50 bg-background/95 px-3 py-2 shadow-card backdrop-blur-sm lg:left-6 lg:top-4">
            {selectedVisualTarget.kind === "shape" ? (
              <>
                <Label className="sr-only" htmlFor="bc-shape-color">
                  Formfarbe
                </Label>
                <input
                  id="bc-shape-color"
                  type="color"
                  value={
                    normalizeHex(selectedVisualTarget.color) ?? DEFAULT_ACCENT_HEX
                  }
                  onChange={(event) =>
                    patchSelectedVisual({ color: event.target.value })
                  }
                  className="size-8 shrink-0 cursor-pointer rounded-lg border border-border/60 bg-background p-0 shadow-none"
                  aria-label="Formfarbe wählen"
                />
              </>
            ) : null}
            <div className="flex min-w-[9rem] flex-1 items-center gap-2">
              <Label
                htmlFor="bc-visual-opacity"
                className="shrink-0 text-[0.65rem] text-muted-foreground"
              >
                Deckkraft
              </Label>
              <Slider
                id="bc-visual-opacity"
                min={0}
                max={100}
                step={1}
                value={[Math.round(selectedVisualTarget.opacity * 100)]}
                onValueChange={(value) => {
                  const pct = Array.isArray(value) ? value[0] : value;
                  patchSelectedVisual({ opacity: pct / 100 });
                }}
                className="min-w-0 flex-1 py-1"
              />
              <span className="w-8 shrink-0 text-right text-[0.65rem] tabular-nums text-muted-foreground">
                {Math.round(selectedVisualTarget.opacity * 100)}%
              </span>
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "will-change-transform motion-safe:[transform-style:preserve-3d]",
            cardTiltActive
              ? "motion-safe:transition-[transform] motion-safe:duration-200 motion-safe:ease-out"
              : "motion-safe:transition-[transform] motion-safe:duration-300 motion-safe:ease-out",
            dragging && "motion-safe:transition-none",
          )}
          style={
            cardPreviewTransform ? { transform: cardPreviewTransform } : undefined
          }
        >
        <div
          ref={canvasRef}
          className={cn(
            "group/canvas relative overflow-hidden rounded-xl",
            cardTiltActive
              ? "motion-safe:transition-[box-shadow] motion-safe:duration-200 motion-safe:ease-out"
              : "motion-safe:transition-[box-shadow] motion-safe:duration-300 motion-safe:ease-out",
            dragging && "motion-safe:transition-none",
          )}
          style={{
              width: canvasSize.width > 0 ? canvasSize.width : "100%",
              height: canvasSize.height > 0 ? canvasSize.height : undefined,
              aspectRatio: canvasSize.width > 0 ? undefined : String(aspect),
              backgroundColor: design.colors.background,
              ...(cardAtmosphere ? { background: cardAtmosphere } : {}),
              boxShadow: cardPreviewShadow,
            }}
          onClick={clearSelection}
          onMouseEnter={() => setCanvasHovered(true)}
          onMouseLeave={() => setCanvasHovered(false)}
          onDragEnter={(event) => {
            const types = [...event.dataTransfer.types];
            if (
              types.includes("Files")
              || types.includes(BUSINESS_CARD_SHAPE_DRAG_MIME)
            ) {
              setFileDragOver(true);
            }
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setFileDragOver(false);
            }
          }}
          onDragOver={(event) => {
            const types = [...event.dataTransfer.types];
            if (
              types.includes("Files")
              || types.includes(BUSINESS_CARD_SHAPE_DRAG_MIME)
            ) {
              event.preventDefault();
              setFileDragOver(true);
            }
          }}
          onDrop={(event) => void handleCanvasDrop(event)}
        >
          <BusinessCardFaceAccentLayer design={design} />

          {structureLine ? (
            <div
              aria-hidden
              className="pointer-events-none absolute z-[2]"
              style={{
                left: `${BUSINESS_CARD_MARGIN_X}%`,
                top: `${structureLine.topPct}%`,
                width: `${BUSINESS_CARD_CONTENT_W}%`,
                height: 1,
                opacity: structureLine.opacity,
                backgroundColor: design.colors.text,
              }}
            />
          ) : null}

          {fileDragOver ? (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-accent/10">
              <p className="rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
                Hier ablegen
              </p>
            </div>
          ) : null}

          {coverElements.map(renderEditableElement)}

          {sideDecorations.map((decoration) => (
              <DecorationLayerItem
                key={decoration.id}
                decoration={decoration}
                restaurantId={restaurantId}
                stackClassName={businessCardDecorationStackClassName}
                elementRingClassName={elementRingClassName}
                handleChromeClassName={handleChromeClassName(
                  selectedDecorationId === decoration.id,
                )}
                onSelect={() => {
                  setSelectedDecorationId(decoration.id);
                  setSelectedElementId(null);
                }}
                onRemove={(e) => handleRemoveDecoration(e, decoration.id)}
                onMove={(e) =>
                  startDrag(
                    e,
                    { kind: "decoration", id: decoration.id },
                    decoration.rect,
                    "move",
                  )
                }
                onResize={(e, axis) =>
                  startDrag(
                    e,
                    { kind: "decoration", id: decoration.id },
                    decoration.rect,
                    axis === "e"
                      ? "resize-e"
                      : axis === "s"
                        ? "resize-s"
                        : "resize",
                  )
                }
              />
          ))}

          {contentElements.map(renderEditableElement)}
        </div>
        </div>
      </div>
    </div>
  );
}

function DecorationLayerItem({
  decoration,
  restaurantId,
  stackClassName,
  elementRingClassName,
  handleChromeClassName,
  onSelect,
  onRemove,
  onMove,
  onResize,
}: {
  decoration: BusinessCardDecoration;
  restaurantId: string;
  stackClassName: string;
  elementRingClassName: string;
  handleChromeClassName: string;
  onSelect: () => void;
  onRemove: (event: React.MouseEvent) => void;
  onMove: (event: React.PointerEvent) => void;
  onResize: (event: React.PointerEvent, axis: "both" | "e" | "s") => void;
}) {
  const label = isBusinessCardShapeDecoration(decoration)
    ? BUSINESS_CARD_SHAPE_OPTIONS.find((o) => o.kind === decoration.kind)?.label
    : decoration.fileName;
  const axisResize =
    isBusinessCardShapeDecoration(decoration)
    && (decoration.kind === "rect" || decoration.kind === "circle");

  return (
    <div
      className={cn(
        "group/decoration absolute touch-none overflow-visible transition-[box-shadow] duration-150",
        stackClassName,
        elementRingClassName,
      )}
      style={{
        left: `${decoration.rect.x}%`,
        top: `${decoration.rect.y}%`,
        width: `${decoration.rect.w}%`,
        height: `${decoration.rect.h}%`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <BusinessCardCanvasRemoveButton
        label={`${label ?? "Dekoration"} entfernen`}
        visibleClassName={handleChromeClassName}
        onClick={onRemove}
      />

      <Tooltip>
        <TooltipTrigger
          delay={300}
          render={
            <button
              type="button"
              className={cn(
                "absolute left-0 top-0 z-10 flex size-3.5 cursor-grab items-center justify-center rounded-br-md bg-background/90 text-muted-foreground shadow-sm transition-opacity duration-150 active:cursor-grabbing",
                handleChromeClassName,
              )}
              aria-label={`${label ?? "Dekoration"} verschieben`}
              onPointerDown={onMove}
            />
          }
        >
          <GripVertical className="size-2" />
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          {label ?? "Dekoration"} — verschieben
        </TooltipContent>
      </Tooltip>

      <BusinessCardDecorationVisual
        decoration={decoration}
        restaurantId={restaurantId}
      />

      {axisResize ? (
        <>
          <button
            type="button"
            className={cn(
              "absolute right-0 top-1/2 z-10 h-4 w-2 -translate-y-1/2 cursor-e-resize rounded-l-sm bg-accent/90 transition-opacity duration-150",
              handleChromeClassName,
            )}
            aria-label={`${label ?? "Dekoration"} Breite ändern`}
            onPointerDown={(e) => onResize(e, "e")}
          />
          <button
            type="button"
            className={cn(
              "absolute bottom-0 left-1/2 z-10 h-2 w-4 -translate-x-1/2 cursor-s-resize rounded-t-sm bg-accent/90 transition-opacity duration-150",
              handleChromeClassName,
            )}
            aria-label={`${label ?? "Dekoration"} Höhe ändern`}
            onPointerDown={(e) => onResize(e, "s")}
          />
        </>
      ) : null}

      <button
        type="button"
        className={cn(
          "absolute bottom-0 right-0 z-10 size-3.5 cursor-se-resize rounded-tl-sm bg-accent/90 transition-opacity duration-150",
          handleChromeClassName,
        )}
        aria-label={`${label ?? "Dekoration"} Größe ändern`}
        onPointerDown={(e) => onResize(e, "both")}
      />
    </div>
  );
}

function BusinessCardCanvasRemoveButton({
  label,
  visibleClassName,
  onClick,
}: {
  label: string;
  visibleClassName: string;
  onClick: (event: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "absolute -right-1.5 -top-1.5 z-20 flex size-5 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm transition-opacity duration-150 hover:bg-destructive hover:text-destructive-foreground",
        visibleClassName,
      )}
      aria-label={label}
      onClick={onClick}
    >
      <X className="size-3" />
    </button>
  );
}
