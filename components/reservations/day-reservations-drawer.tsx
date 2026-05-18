"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Pause, Pencil, Play, Plus, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { formatDayHeadingDe } from "@/lib/reservations/month-range";
import {
  fallbackSlotRangeFromReservations,
  localDateAtSlotMinutes,
  localDateStringForDate,
  minutesToHHmm,
  openingDaySlotStartsMinutes,
  reservationActiveAtInstant,
  resolveHoursForLocalCalendarDay,
} from "@/lib/reservations/day-opening-slots";
import {
  fetchDiningAreas,
  fetchDiningTables,
  formatDiningTableLabel,
  type DiningAreaRow,
  type DiningTableRow,
} from "@/lib/supabase/dining-floor-db";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";
import {
  GuestReservationBadge,
  pickFloorTableCaption,
} from "@/components/reservations/guest-reservation-badge";
import {
  parseTableHex,
  tablePlanMutedClass,
  tablePlanTextClass,
} from "@/components/reservations/floor-plan-geometry";
import { cn } from "@/lib/utils";

const timeDe = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

type DayViewMode = "list" | "grid" | "floor";
type DaySortBy = "time" | "lastname" | "party" | "table";

const SORT_LABELS: Record<DaySortBy, string> = {
  time: "Zeit",
  lastname: "Nachname",
  party: "Personenanzahl",
  table: "Tisch",
};

type DayReservationsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: Date | null;
  reservations: ReservationListRow[];
  restaurantId: string | null;
  onEdit: (r: ReservationListRow) => void;
  onCreateReservation?: (detail?: {
    diningTableId: string;
    startsAt: Date;
  }) => void;
};

function sortReservations(
  rows: ReservationListRow[],
  by: DaySortBy,
): ReservationListRow[] {
  const copy = [...rows];
  const byTime = (a: ReservationListRow, b: ReservationListRow) =>
    new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
  switch (by) {
    case "time":
      return copy.sort(byTime);
    case "lastname": {
      const guestSortKey = (r: ReservationListRow) =>
        `${r.guest_first_name} ${r.guest_last_name}`.trim().toLocaleLowerCase("de");
      return copy.sort((a, b) => {
        const c = guestSortKey(a).localeCompare(guestSortKey(b), "de");
        return c !== 0 ? c : byTime(a, b);
      });
    }
    case "party":
      return copy.sort((a, b) =>
        a.party_size !== b.party_size ? a.party_size - b.party_size : byTime(a, b),
      );
    case "table": {
      const label = (r: ReservationListRow) =>
        r.dining_tables ? formatDiningTableLabel(r.dining_tables) : "\uFFFF";
      return copy.sort((a, b) => {
        const c = label(a).localeCompare(label(b), "de", { numeric: true });
        return c !== 0 ? c : byTime(a, b);
      });
    }
    default:
      return copy.sort(byTime);
  }
}

/** Padding um die Tisch-Union in Plan-Koordinaten (0–100, wie plan_*_pct). */
const TABLE_CROP_PAD = 10;

/** Achsenparalleles Rechteck aller Tische inkl. Padding — für Ausschnitt + aspect-ratio. */
function computeTableCropFrame(tables: DiningTableRow[]): {
  x0: number;
  y0: number;
  bw: number;
  bh: number;
} | null {
  if (tables.length === 0) return null;
  let x0 = 100;
  let x1 = 0;
  let y0 = 100;
  let y1 = 0;
  for (const t of tables) {
    const cx = Number(t.plan_x_pct);
    const cy = Number(t.plan_y_pct);
    const w = Number(t.plan_w_pct) || 13;
    const h = Number(t.plan_h_pct) || 20;
    x0 = Math.min(x0, cx - w / 2);
    x1 = Math.max(x1, cx + w / 2);
    y0 = Math.min(y0, cy - h / 2);
    y1 = Math.max(y1, cy + h / 2);
  }
  x0 = Math.max(0, x0 - TABLE_CROP_PAD);
  x1 = Math.min(100, x1 + TABLE_CROP_PAD);
  y0 = Math.max(0, y0 - TABLE_CROP_PAD);
  y1 = Math.min(100, y1 + TABLE_CROP_PAD);
  const bw = Math.max(x1 - x0, 4);
  const bh = Math.max(y1 - y0, 4);
  return { x0, y0, bw, bh };
}

const FLOOR_ZOOM_MIN = 0.52;
const FLOOR_ZOOM_MAX = 1.9;
const FLOOR_ZOOM_STEP = 0.06;

/**
 * Schrift am Tisch relativ zur sichtbaren Kachelgröße im Ausschnitt (Anteil der Plan-Breite/-Höhe 0–100),
 * nicht nach Rohwerten plan_w_pct — damit große Kacheln im Viewport lesbare Pixelgrößen bekommen.
 */
function dayFloorTableTypography(wPctInCrop: number, hPctInCrop: number) {
  const m = Math.max(8, Math.min(100, Math.min(wPctInCrop, hPctInCrop)));
  const t = (m - 8) / 92;
  return {
    labelPx: Math.round(15 + t * 22),
    guestPx: Math.round(12 + t * 11),
    metaPx: Math.round(10 + t * 9),
    freiPx: Math.round(12 + t * 8),
    iconBoxPx: Math.round(28 + t * 12),
    iconSvgPx: Math.round(15 + t * 5),
    contentPadPx: Math.round(5 + t * 7),
    contentGapPx: Math.max(2, Math.round(3 + t * 5)),
  };
}

/**
 * Schriftgröße für „frei“, sodass das Wort in der Kachel einzeilig vollständig sichtbar bleibt
 * (Platz unter dem Tischlabel, mit Padding und Zeilenhöhe).
 */
function fitFreiLabelFontPx(params: {
  cellWpx: number;
  cellHpx: number;
  contentPadPx: number;
  labelFontPx: number;
  contentGapPx: number;
  compact: boolean;
}): number {
  const {
    cellWpx,
    cellHpx,
    contentPadPx,
    labelFontPx,
    contentGapPx,
    compact,
  } = params;
  const gap = compact ? 2 : contentGapPx;
  const innerW = Math.max(4, cellWpx - 2 * contentPadPx);
  const innerH = Math.max(4, cellHpx - 2 * contentPadPx);
  const labelBlockH = labelFontPx * 1.32 + gap;
  const freiH = Math.max(6, innerH - labelBlockH);
  const freiW = innerW;
  /** Breite von „frei“ ≈ 2.5× fontSize (UI-Sans); Zeilenhöhe ≈ 1.22×. */
  const byW = freiW / 2.5;
  const byH = freiH / 1.22;
  return Math.max(5, Math.min(36, Math.floor(Math.min(byW, byH))));
}

function reservationsAtTableForInstant(
  tables: DiningTableRow[],
  reservations: ReservationListRow[],
  instant: Date,
): Map<string, ReservationListRow[]> {
  const map = new Map<string, ReservationListRow[]>();
  const tableIds = new Set(tables.map((t) => t.id));
  for (const r of reservations) {
    if (!r.dining_table_id || !tableIds.has(r.dining_table_id)) continue;
    if (!reservationActiveAtInstant(r, instant)) continue;
    const arr = map.get(r.dining_table_id) ?? [];
    arr.push(r);
    map.set(r.dining_table_id, arr);
  }
  for (const arr of map.values()) {
    arr.sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
  }
  return map;
}

export function DayReservationsDrawer({
  open,
  onOpenChange,
  day,
  reservations,
  restaurantId,
  onEdit,
  onCreateReservation,
}: DayReservationsDrawerProps) {
  const { getProfileForRestaurantId, isReady: profileReady } = useRestaurantProfile();
  const [viewMode, setViewMode] = useState<DayViewMode>("list");
  const [sortBy, setSortBy] = useState<DaySortBy>("time");
  const [areas, setAreas] = useState<DiningAreaRow[]>([]);
  const [tables, setTables] = useState<DiningTableRow[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [slotIndex, setSlotIndex] = useState(0);
  const [floorAutoplay, setFloorAutoplay] = useState(false);
  const [floorPlanZoom, setFloorPlanZoom] = useState(1);
  const floorViewportRef = useRef<HTMLDivElement>(null);
  const [floorViewportSize, setFloorViewportSize] = useState({ w: 0, h: 0 });
  /** Entspricht `p-1` (4px) bzw. `sm:p-2` (8px) am Plan-Wrapper — sonst ist der Plan minimal größer als die nutzbare Fläche. */
  const [floorFitPadPx, setFloorFitPadPx] = useState(4);
  /** Ab sm (640px) wie `sm:grid-cols-2` auf der Seite — sonst wirkt Grid wie Liste. */
  const [showGridOption, setShowGridOption] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => {
      setShowGridOption(mq.matches);
      setFloorFitPadPx(mq.matches ? 8 : 4);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!showGridOption && viewMode === "grid") {
      setViewMode("list");
    }
  }, [showGridOption, viewMode]);

  const hoursBundle = useMemo(() => {
    if (!restaurantId || !profileReady) return null;
    const p = getProfileForRestaurantId(restaurantId);
    return {
      weekly: p.weeklyHours,
      exceptions: p.dateExceptions,
    };
  }, [restaurantId, profileReady, getProfileForRestaurantId]);

  useEffect(() => {
    if (!open || !restaurantId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const [aRes, tRes] = await Promise.all([
        fetchDiningAreas(restaurantId),
        fetchDiningTables(restaurantId),
      ]);
      if (cancelled) return;
      setAreas(aRes.data);
      setTables(tRes.data);
      setSelectedAreaId((prev) => {
        if (prev && aRes.data.some((a) => a.id === prev)) return prev;
        return aRes.data[0]?.id ?? null;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [open, restaurantId]);

  useEffect(() => {
    if (!open) {
      setFloorAutoplay(false);
      setSlotIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setSlotIndex(0);
    setFloorAutoplay(false);
  }, [day?.getTime(), viewMode]);

  /** Minutentakt für die Tisch-Zeitleiste (Floor); feinere Schritte als 15-Min-Raster. */
  const floorSlotStartsMinutes = useMemo(() => {
    if (!day || !hoursBundle) return [];
    const resolved = resolveHoursForLocalCalendarDay(
      day,
      hoursBundle.weekly,
      hoursBundle.exceptions,
    );
    const fb = fallbackSlotRangeFromReservations(reservations, day);
    return openingDaySlotStartsMinutes(resolved, fb, 1);
  }, [day, hoursBundle, reservations]);

  useEffect(() => {
    setSlotIndex((i) =>
      Math.min(i, Math.max(0, floorSlotStartsMinutes.length - 1)),
    );
  }, [floorSlotStartsMinutes.length]);

  const sorted = useMemo(
    () => sortReservations(reservations, sortBy),
    [reservations, sortBy],
  );

  const tablesInArea = useMemo(
    () => tables.filter((t) => t.area_id === selectedAreaId && t.is_active),
    [tables, selectedAreaId],
  );

  const floorCropFrame = useMemo(
    () => computeTableCropFrame(tablesInArea),
    [tablesInArea],
  );

  const floorPlanFitSize = useMemo(() => {
    if (!floorCropFrame) return null;
    const { bw, bh } = floorCropFrame;
    const ar = bh / bw;
    const pad = floorFitPadPx * 2;
    /** clientWidth/Height minus Rand wie am Plan-Wrapper; 1px Puffer gegen Subpixel-Overflow. */
    const vw = Math.max(0, floorViewportSize.w - pad - 1);
    const vh = Math.max(0, floorViewportSize.h - pad - 1);
    if (vw < 24 || vh < 24) return null;
    let planW = vw;
    let planH = planW * ar;
    if (planH > vh) {
      planH = vh;
      planW = planH / ar;
    }
    planW = Math.floor(planW);
    planH = Math.floor(planH);
    return { planW, planH, ar };
  }, [floorCropFrame, floorFitPadPx, floorViewportSize.w, floorViewportSize.h]);

  useLayoutEffect(() => {
    if (!open || viewMode !== "floor") return;
    const el = floorViewportRef.current;
    if (!el) return;
    const measure = () => {
      const node = floorViewportRef.current;
      if (!node) return;
      setFloorViewportSize({ w: node.clientWidth, h: node.clientHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, viewMode, floorCropFrame, selectedAreaId, tablesInArea.length]);

  useEffect(() => {
    setFloorPlanZoom(1);
  }, [day?.getTime(), viewMode, selectedAreaId]);

  const slotInstant = useMemo(() => {
    if (!day || floorSlotStartsMinutes.length === 0) return null;
    const m =
      floorSlotStartsMinutes[
        Math.min(slotIndex, floorSlotStartsMinutes.length - 1)
      ] ?? 0;
    return localDateAtSlotMinutes(day, m);
  }, [day, floorSlotStartsMinutes, slotIndex]);

  const occupancy = useMemo(() => {
    if (!slotInstant) return new Map<string, ReservationListRow[]>();
    return reservationsAtTableForInstant(tablesInArea, reservations, slotInstant);
  }, [tablesInArea, reservations, slotInstant]);

  useEffect(() => {
    if (
      !open ||
      viewMode !== "floor" ||
      !floorAutoplay ||
      floorSlotStartsMinutes.length <= 1
    ) {
      return;
    }
    const id = window.setInterval(() => {
      setSlotIndex((i) =>
        i + 1 >= floorSlotStartsMinutes.length ? 0 : i + 1,
      );
    }, 100);
    return () => clearInterval(id);
  }, [open, viewMode, floorAutoplay, floorSlotStartsMinutes.length]);

  const pauseAutoplay = useCallback(() => setFloorAutoplay(false), []);

  const bumpFloorPlanZoom = useCallback((delta: number) => {
    setFloorPlanZoom((z) => {
      const n = z + delta;
      return Math.min(
        FLOOR_ZOOM_MAX,
        Math.max(FLOOR_ZOOM_MIN, Math.round(n * 100) / 100),
      );
    });
  }, []);

  const floorPlanBoxPx = useMemo(() => {
    if (!floorPlanFitSize) return { w: 0, h: 0 };
    return {
      w: Math.floor(floorPlanFitSize.planW * floorPlanZoom),
      h: Math.floor(floorPlanFitSize.planH * floorPlanZoom),
    };
  }, [floorPlanFitSize, floorPlanZoom]);

  /** Außenmaß des Plan-Rahmens inkl. Innenrand (`p-1` / `sm:p-2` = floorFitPadPx). */
  const floorPlanShellPx = useMemo(() => {
    const p = floorFitPadPx * 2;
    return {
      w: floorPlanBoxPx.w + p,
      h: floorPlanBoxPx.h + p,
    };
  }, [floorPlanBoxPx.w, floorPlanBoxPx.h, floorFitPadPx]);

  const currentSlotLabel = useMemo(() => {
    if (floorSlotStartsMinutes.length === 0 || !day) return "—";
    const m =
      floorSlotStartsMinutes[
        Math.min(slotIndex, floorSlotStartsMinutes.length - 1)
      ] ?? 0;
    return minutesToHHmm(m);
  }, [day, floorSlotStartsMinutes, slotIndex]);

  const renderCard = (r: ReservationListRow, compact: boolean) => {
    const st = r.reservation_statuses;
    const stripe =
      st?.color_hex && /^#[0-9A-Fa-f]{6}$/i.test(st.color_hex) ? st.color_hex : "#64748b";
    const guest = `${r.guest_first_name} ${r.guest_last_name}`.trim();
    const t = timeDe.format(new Date(r.starts_at));
    const endLabel = timeDe.format(new Date(r.ends_at));
    const tableLabel = r.dining_tables ? formatDiningTableLabel(r.dining_tables) : null;
    const editBtn = (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 shrink-0 self-start rounded-xl"
        aria-label={`${guest} bearbeiten`}
        onClick={() => onEdit(r)}
      >
        <Pencil className="size-4" />
      </Button>
    );
    if (compact) {
      return (
        <div
          key={r.id}
          className="flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-muted/10 transition-shadow duration-300"
        >
          <div className="flex w-full min-w-0 items-start gap-2 p-3 pt-4">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div
                className="h-1 w-full shrink-0 rounded-full"
                style={{ backgroundColor: stripe }}
                aria-hidden
              />
              <div className="min-w-0 w-full space-y-1">
                <div className="flex min-w-0 w-full flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="shrink-0 text-xl font-semibold tabular-nums text-foreground">
                    {t}
                  </span>
                  <div className="min-w-0 flex-1 basis-0">
                    <GuestReservationBadge
                      reservation={r}
                      textClassName="text-muted-foreground"
                      maxFontPx={15}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {r.party_size} {r.party_size === 1 ? "Person" : "Personen"} · bis {endLabel}
                  {tableLabel ? ` · ${tableLabel}` : ""}
                  {st?.name ? ` · ${st.name}` : ""}
                </p>
              </div>
            </div>
            {editBtn}
          </div>
        </div>
      );
    }
    return (
      <div
        key={r.id}
        className="flex gap-3 rounded-2xl border border-border/50 bg-muted/10 p-3 transition-shadow duration-300"
      >
        <div
          className="w-1 shrink-0 self-stretch rounded-full"
          style={{ backgroundColor: stripe }}
          aria-hidden
        />
        <div className="grid min-w-0 flex-1 grid-cols-[auto_1fr] grid-rows-2 items-center gap-x-3 gap-y-0.5">
          <div className="row-span-2 flex items-center self-stretch">
            <span className="text-3xl font-semibold tabular-nums leading-none tracking-tight text-foreground">
              {t}
            </span>
          </div>
          <div className="col-start-2 row-start-1 min-w-0">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="min-w-0 font-medium leading-snug">{guest}</span>
              <span className="shrink-0 font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                #{r.reservation_number}
              </span>
              {st?.name ? (
                <span className="text-xs text-muted-foreground">{st.name}</span>
              ) : null}
              {tableLabel ? (
                <span className="rounded-md border border-border/50 bg-background/80 px-1.5 py-px text-[11px] font-medium text-foreground">
                  {tableLabel}
                </span>
              ) : null}
            </div>
          </div>
          <div className="col-start-2 row-start-2 min-w-0">
            <p className="text-xs text-muted-foreground">
              {r.party_size} {r.party_size === 1 ? "Person" : "Personen"}
              {" · "}
              <span className="tabular-nums">bis {endLabel}</span>
            </p>
            {(r.guest_phone || r.guest_email) && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {[r.guest_phone, r.guest_email].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        {editBtn}
      </div>
    );
  };

  if (!day) return null;

  const viewChip = (id: DayViewMode, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setViewMode(id)}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200",
        viewMode === id
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50",
      )}
    >
      {label}
    </button>
  );

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs
      handleOnly
    >
      <DrawerContent
        showHandle
        className={cn(
          "flex h-[min(96dvh,calc(100dvh-0.5rem))] max-h-[min(96dvh,calc(100dvh-0.5rem))] min-h-0 w-full flex-col overflow-hidden rounded-t-[1.75rem] border-0 bg-card shadow-elevated",
          "data-[vaul-drawer-direction=bottom]:mt-4 data-[vaul-drawer-direction=bottom]:max-h-[min(96dvh,calc(100dvh-0.5rem))]",
          viewMode === "floor"
            ? "w-full max-w-full data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:translate-x-0"
            : "w-full max-w-[42rem] data-[vaul-drawer-direction=bottom]:inset-x-auto data-[vaul-drawer-direction=bottom]:left-1/2 data-[vaul-drawer-direction=bottom]:right-auto data-[vaul-drawer-direction=bottom]:-translate-x-1/2 data-[vaul-drawer-direction=bottom]:w-full",
          "transition-[max-width,width,transform] duration-[600ms] ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none",
        )}
      >
        <DrawerHeader
          className={cn(
            "shrink-0 space-y-3 pt-2 pb-2 text-left",
            viewMode === "floor" ? "px-3 sm:px-4" : "px-6",
          )}
        >
          <div>
            <DrawerTitle className="text-xl font-semibold tracking-tight">
              Tagesübersicht
            </DrawerTitle>
            <DrawerDescription className="text-base text-foreground/90">
              {formatDayHeadingDe(day)}
            </DrawerDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2">
              {viewChip("list", "Listenansicht")}
              {showGridOption ? viewChip("grid", "Gridansicht") : null}
              {viewChip("floor", "Tischansicht")}
            </div>
            {onCreateReservation ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto size-9 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                aria-label="Neue Reservierung"
                onClick={() => onCreateReservation?.()}
              >
                <Plus className="size-5" />
              </Button>
            ) : null}
          </div>
          {(viewMode === "list" || (viewMode === "grid" && showGridOption)) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Sortierung</span>
              <Select
                value={sortBy}
                onValueChange={(v) => setSortBy(v as DaySortBy)}
              >
                <SelectTrigger className="h-9 w-[min(100%,220px)] rounded-xl text-left text-xs">
                  <SelectValue>{SORT_LABELS[sortBy]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">Zeit</SelectItem>
                  <SelectItem value="lastname">Nachname</SelectItem>
                  <SelectItem value="party">Personenanzahl</SelectItem>
                  <SelectItem value="table">Tisch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </DrawerHeader>

        {viewMode === "floor" && areas.length > 1 ? (
          <div className="shrink-0 border-b border-border/40 px-3 pb-2 sm:px-4">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {areas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAreaId(a.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-200",
                    selectedAreaId === a.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "min-h-0 flex-1 overflow-hidden",
            viewMode === "floor" ? "px-2 sm:px-3" : "px-6",
          )}
        >
          {viewMode === "list" && (
            <div className="h-full space-y-2 overflow-y-auto pb-4">
              {sorted.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Keine Reservierungen an diesem Tag.
                </p>
              ) : (
                sorted.map((r) => renderCard(r, false))
              )}
            </div>
          )}
          {viewMode === "grid" && showGridOption && (
            <div className="h-full overflow-y-auto pb-4">
              {sorted.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Keine Reservierungen an diesem Tag.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {sorted.map((r) => renderCard(r, true))}
                </div>
              )}
            </div>
          )}
          {viewMode === "floor" && (
            <div className="flex h-full min-h-[200px] flex-col gap-2 pb-2">
              {!restaurantId ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Kein Restaurant gewählt — Tischplan nicht verfügbar.
                </p>
              ) : tablesInArea.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Keine Tische in diesem Bereich.
                </p>
              ) : (
                <>
                  <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                    <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 px-0.5 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 rounded-full px-3"
                        disabled={!floorPlanFitSize}
                        aria-label="Plan verkleinern"
                        onClick={() => bumpFloorPlanZoom(-FLOOR_ZOOM_STEP)}
                      >
                        <ZoomOut className="size-4" />
                      </Button>
                      <span className="min-w-[3.25rem] select-none text-center text-xs font-medium tabular-nums text-muted-foreground">
                        {(floorPlanZoom * 100).toFixed(0)}%
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 rounded-full px-3"
                        disabled={!floorPlanFitSize}
                        aria-label="Plan vergrößern"
                        onClick={() => bumpFloorPlanZoom(FLOOR_ZOOM_STEP)}
                      >
                        <ZoomIn className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 rounded-full px-3 text-xs"
                        disabled={!floorPlanFitSize || floorPlanZoom === 1}
                        onClick={() => setFloorPlanZoom(1)}
                      >
                        Anpassen
                      </Button>
                    </div>
                    <div
                      ref={floorViewportRef}
                      data-vaul-no-drag
                      className={cn(
                        "relative min-h-0 flex-1",
                        floorPlanZoom > 1 ? "overflow-auto" : "overflow-hidden",
                      )}
                    >
                      {floorCropFrame && floorPlanFitSize ? (
                        <div
                          className={cn(
                            "rounded-2xl border border-border/60 bg-muted/20 shadow-inner",
                            floorPlanZoom > 1
                              ? "shrink-0"
                              : "flex h-full min-h-0 w-full flex-col",
                          )}
                          style={
                            floorPlanZoom > 1
                              ? {
                                  width: floorPlanShellPx.w,
                                  height: floorPlanShellPx.h,
                                }
                              : undefined
                          }
                        >
                          <div className="flex min-h-full min-w-full flex-1 items-center justify-center p-1 sm:p-2">
                        <div
                          className="relative shrink-0 overflow-hidden rounded-xl bg-muted/15 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                          style={{
                            width: floorPlanBoxPx.w,
                            height: floorPlanBoxPx.h,
                          }}
                        >
                          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)] [background-size:20px_20px] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)]" />
                          <div className="relative h-full w-full">
                            {tablesInArea.map((t) => {
                              const fr = floorCropFrame;
                              const list = occupancy.get(t.id) ?? [];
                              const cx = Number(t.plan_x_pct);
                              const cy = Number(t.plan_y_pct);
                              const w = Number(t.plan_w_pct) || 13;
                              const h = Number(t.plan_h_pct) || 20;
                              const leftPct = ((cx - fr.x0) / fr.bw) * 100;
                              const topPct = ((cy - fr.y0) / fr.bh) * 100;
                              const wPct = (w / fr.bw) * 100;
                              const hPct = (h / fr.bh) * 100;
                              const planWpx = floorPlanBoxPx.w;
                              const planHpx = floorPlanBoxPx.h;
                              const cellWpx = (wPct / 100) * planWpx;
                              const cellHpx = (hPct / 100) * planHpx;
                              const typo = dayFloorTableTypography(wPct, hPct);
                              const bg = parseTableHex(t.color_hex) ?? "#94a3b8";
                              const compact = list.length > 1;
                              const labelPx = compact
                                ? Math.max(13, Math.round(typo.labelPx * 0.95))
                                : typo.labelPx;
                              const freiFontPx = fitFreiLabelFontPx({
                                cellWpx,
                                cellHpx,
                                contentPadPx: typo.contentPadPx,
                                labelFontPx: labelPx,
                                contentGapPx: typo.contentGapPx,
                                compact,
                              });
                              const freiDisplayPx = Math.min(
                                freiFontPx,
                                Math.max(5, Math.round(typo.freiPx * 1.35)),
                              );
                              const chipInnerW = Math.max(
                                10,
                                (wPct / 100) * planWpx -
                                  2 * typo.contentPadPx -
                                  6,
                              );
                              return (
                                <div
                                  key={t.id}
                                  className="absolute -translate-x-1/2 -translate-y-1/2 transition-[opacity,transform] duration-150 ease-out"
                                  style={{
                                    left: `${leftPct}%`,
                                    top: `${topPct}%`,
                                    width: `${wPct}%`,
                                    height: `${hPct}%`,
                                  }}
                                >
                                  <div
                                    className={cn(
                                      "relative flex h-full w-full flex-col overflow-hidden rounded-2xl border-2 shadow-card transition-colors duration-150 ease-out",
                                      list.length > 0
                                        ? cn(
                                            "border-red-600 dark:border-red-500",
                                            list.length > 1 &&
                                              "ring-2 ring-amber-500/90 ring-offset-1 ring-offset-transparent dark:ring-amber-400/90",
                                          )
                                        : "border-green-600 dark:border-green-500",
                                    )}
                                    style={{ backgroundColor: bg }}
                                  >
                                    <div
                                      className="flex min-h-0 flex-1 flex-col items-stretch justify-start text-center transition-opacity duration-150"
                                      style={{
                                        padding: typo.contentPadPx,
                                        gap: compact ? 2 : typo.contentGapPx,
                                      }}
                                    >
                                      <span
                                        className={cn(
                                          "max-w-full shrink-0 truncate font-semibold leading-tight",
                                          tablePlanTextClass(bg),
                                        )}
                                        style={{ fontSize: labelPx }}
                                      >
                                        {formatDiningTableLabel(t)}
                                      </span>
                                      <div
                                        key={
                                          list.map((x) => x.id).join("-") ||
                                          `empty-${t.id}`
                                        }
                                        className="flex min-h-0 w-full max-w-full flex-1 flex-col justify-center transition-opacity duration-150"
                                      >
                                        {list.length === 0 ? (
                                          onCreateReservation && slotInstant ? (
                                            <button
                                              type="button"
                                              data-vaul-no-drag
                                              className={cn(
                                                "flex w-full items-center justify-center rounded-md px-0.5 py-0.5 outline-none transition-colors",
                                                "hover:bg-black/15 active:bg-black/25 dark:hover:bg-white/12 dark:active:bg-white/20",
                                                "focus-visible:ring-2 focus-visible:ring-white/50",
                                              )}
                                              aria-label={`Neue Reservierung um ${timeDe.format(slotInstant)}`}
                                              onClick={() =>
                                                onCreateReservation({
                                                  diningTableId: t.id,
                                                  startsAt: slotInstant,
                                                })
                                              }
                                            >
                                              <span
                                                className={cn(
                                                  "inline-block max-w-full whitespace-nowrap opacity-80",
                                                  tablePlanMutedClass(bg),
                                                )}
                                                style={{
                                                  fontSize: freiDisplayPx,
                                                  lineHeight: 1.1,
                                                }}
                                              >
                                                frei
                                              </span>
                                            </button>
                                          ) : (
                                            <span
                                              className={cn(
                                                "inline-block max-w-full whitespace-nowrap opacity-80",
                                                tablePlanMutedClass(bg),
                                              )}
                                              style={{
                                                fontSize: freiDisplayPx,
                                                lineHeight: 1.1,
                                              }}
                                            >
                                              frei
                                            </span>
                                          )
                                        ) : (
                                          <div className="flex max-h-full w-full flex-col gap-0.5 overflow-y-auto [scrollbar-width:thin]">
                                            {list.map((res) => {
                                              const g =
                                                `${res.guest_first_name} ${res.guest_last_name}`.trim();
                                              const caption = pickFloorTableCaption(
                                                res.guest_first_name,
                                                res.guest_last_name,
                                                res.reservation_number,
                                                chipInnerW,
                                                freiDisplayPx,
                                              );
                                              return (
                                                <button
                                                  key={res.id}
                                                  type="button"
                                                  data-vaul-no-drag
                                                  className={cn(
                                                    "flex w-full items-center justify-center rounded-lg border-b border-black/15 px-0.5 py-0.5 text-center outline-none last:border-b-0 dark:border-white/20",
                                                    "transition-colors hover:bg-black/15 focus-visible:bg-black/15 focus-visible:ring-2 focus-visible:ring-white/40 dark:hover:bg-white/12 dark:focus-visible:bg-white/12",
                                                    "touch-manipulation active:bg-black/25 dark:active:bg-white/18",
                                                  )}
                                                  aria-label={`Reservierung ${g || "Gast"} bearbeiten`}
                                                  onClick={() => onEdit(res)}
                                                >
                                                  <span
                                                    className={cn(
                                                      "inline-block max-w-full whitespace-nowrap text-center opacity-90",
                                                      tablePlanMutedClass(bg),
                                                    )}
                                                    style={{
                                                      fontSize: freiDisplayPx,
                                                      lineHeight: 1.1,
                                                    }}
                                                  >
                                                    {caption}
                                                  </span>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                    ) : (
                      <div className="flex min-h-[12rem] w-full items-center justify-center p-6 text-sm text-muted-foreground">
                        {floorCropFrame ? "Plan wird geladen …" : null}
                      </div>
                    )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {viewMode === "floor" && floorSlotStartsMinutes.length > 0 ? (
          <div
            data-vaul-no-drag
            className="shrink-0 space-y-2 border-t border-border/50 bg-card px-3 py-3 touch-pan-y sm:px-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {currentSlotLabel}
                <span className="ml-2 font-normal text-muted-foreground/80">
                  ({minutesToHHmm(floorSlotStartsMinutes[0] ?? 0)} –{" "}
                  {minutesToHHmm(
                    floorSlotStartsMinutes[floorSlotStartsMinutes.length - 1] ?? 0,
                  )}
                  )
                </span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 rounded-full px-3 text-xs"
                onClick={() => setFloorAutoplay((v) => !v)}
                disabled={floorSlotStartsMinutes.length <= 1}
              >
                {floorAutoplay ? (
                  <>
                    <Pause className="size-3.5" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="size-3.5" />
                    Abspielen
                  </>
                )}
              </Button>
            </div>
            <input
              type="range"
              className="h-9 w-full cursor-pointer accent-accent"
              min={0}
              max={Math.max(0, floorSlotStartsMinutes.length - 1)}
              step={1}
              value={Math.min(slotIndex, floorSlotStartsMinutes.length - 1)}
              aria-valuetext={`Uhrzeit ${currentSlotLabel}`}
              onPointerDown={pauseAutoplay}
              onInput={(e) => {
                setSlotIndex(Number((e.target as HTMLInputElement).value));
              }}
              onChange={(e) => {
                setSlotIndex(Number(e.target.value));
              }}
            />
            <p className="text-[10px] text-muted-foreground">
              Schritte im Minutentakt, basierend auf den Öffnungszeiten für den{" "}
              {localDateStringForDate(day)}.
            </p>
          </div>
        ) : null}

        <div
          className={cn(
            "shrink-0 border-t border-border/50 py-3",
            viewMode === "floor" ? "px-3 sm:px-4" : "px-6",
          )}
        >
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Schließen
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
