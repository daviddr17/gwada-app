"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  Download,
  Pause,
  Play,
  Plus,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { drawerFormHeaderClassName, drawerFormFullWidthButtonClassName } from "@/lib/ui/drawer-form-section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { useReservationGwadaReviews } from "@/lib/hooks/use-reservation-gwada-reviews";
import type { ReservationGwadaReviewSummary } from "@/lib/reviews/reservation-gwada-review-types";
import {
  reservationListRowButtonCompactClassName,
  reservationListRowButtonDrawerFullClassName,
} from "@/lib/ui/reservation-list-row-interactive";
import { ReservationGwadaReviewSheet } from "@/components/reservations/reservation-gwada-review-sheet";
import { ReservationGwadaReviewStarButton } from "@/components/reservations/reservation-gwada-review-star-button";
import { ReservationQuickAcceptButton } from "@/components/reservations/reservation-quick-accept-button";
import { formatDayHeadingDe } from "@/lib/reservations/month-range";
import {
  isConfirmedReservationStatus,
  reservationAssignedTableLabel,
  reservationDiningTableLabel,
} from "@/lib/reservations/reservation-table-assignment";
import { ReservationInternalNoteIndicator } from "@/components/reservations/reservation-internal-note-indicator";
import { reservationInternalNoteText } from "@/lib/reservations/reservation-internal-note";
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
  maxFontSizeThatFitsCaption,
} from "@/components/reservations/guest-reservation-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FloorTableChairsAround,
  floorTableChairInsetPx,
} from "@/components/reservations/floor-table-chairs";
import {
  parseTableHex,
  tablePlanMutedClass,
  tablePlanTextClass,
} from "@/components/reservations/floor-plan-geometry";
import { DayReservationsExportSheet } from "@/components/reservations/day-reservations-export-sheet";
import { ReservationDayNotesSection } from "@/components/reservations/reservation-day-notes-section";
import { AutoAssignTablesButton } from "@/components/reservations/auto-assign-tables-button";
import { reservationsDayDrawerHeaderActionButtonClassName } from "@/components/reservations/reservations-day-drawer-toolbar";
import { toAutoAssignReservation } from "@/lib/reservations/auto-table-assignment";
import { reservationEndsAtFromLiveInsert } from "@/lib/dashboard/patch-dashboard-reservations-live-client";
import { reservationsAtTableForInstant } from "@/lib/reservations/reservations-table-occupancy";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import { createRestaurantDateTimeFormatter } from "@/lib/restaurant/restaurant-timezone";
import { cn } from "@/lib/utils";

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
  onDataChanged?: () => void;
  onDayNotesChanged?: () => void;
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
const TABLE_CROP_PAD = 5;

/** Zielanteil der sichtbaren Planfläche (unter Zoom/Statistik). */
const FLOOR_PLAN_HEIGHT_FILL = 0.92;
/** Geschätzte Höhe von Zoom-Zeile + Statistik innerhalb des scrollbaren Bereichs. */
const FLOOR_PLAN_CHROME_PX = 100;

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
const FLOOR_ZOOM_MAX = 2.4;
const FLOOR_ZOOM_STEP = 0.06;

function floorPlanHeightFillZoom(planHpx: number, viewportHpx: number): number {
  if (planHpx < 12 || viewportHpx < 32) return 1;
  const target = viewportHpx * FLOOR_PLAN_HEIGHT_FILL;
  if (planHpx >= target * 0.96) return 1;
  return Math.min(
    FLOOR_ZOOM_MAX,
    Math.max(1, Math.round((target / planHpx) * 100) / 100),
  );
}

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

type DayFloorTableCellLayout = {
  contentPadPx: number;
  /** Quer (breiter als hoch): Tischnummer | Inhalt in einer Zeile; hoch: untereinander. */
  bodyLayout: "stack" | "inline";
  labelPx: number;
  labelWidthPx: number | null;
  innerW: number;
  bodyGapPx: number;
  slotFontPx: number;
  slotWidthPx: number;
  slotHeightPx: number;
  slotSepPx: number;
};

function floorTableContentPadPx(
  cellWpx: number,
  cellHpx: number,
  typoPad: number,
): number {
  return Math.max(2, Math.min(typoPad, Math.floor(Math.min(cellWpx, cellHpx) * 0.12)));
}

function maxSlotFontForCaptions(
  captions: string[],
  slotW: number,
  slotH: number,
  capPx: number,
): number {
  if (captions.length === 0) return 6;
  let fs = 16;
  for (const text of captions) {
    fs = Math.min(
      fs,
      maxFontSizeThatFitsCaption(text, slotW, slotH, capPx, 5),
    );
  }
  return fs;
}

/** Label + Slots: quer = nebeneinander, hoch = untereinander. */
function layoutDayFloorTableCell(params: {
  cellWpx: number;
  cellHpx: number;
  typo: ReturnType<typeof dayFloorTableTypography>;
  reservationCount: number;
  tableLabel: string;
  slotCaptions: string[];
}): DayFloorTableCellLayout {
  const { cellWpx, cellHpx, typo, reservationCount, tableLabel, slotCaptions } =
    params;
  const pad = floorTableContentPadPx(cellWpx, cellHpx, typo.contentPadPx);
  const innerW = Math.max(8, cellWpx - 2 * pad);
  const innerH = Math.max(8, cellHpx - 2 * pad);
  const captions = slotCaptions.length > 0 ? slotCaptions : ["frei"];
  const slotCount = captions.length;
  const bodyLayout: "inline" | "stack" = innerW > innerH ? "inline" : "stack";
  const bodyGapPx = 2;
  const slotSepPx = 4;
  const labelSepPx = Math.max(5, 6);

  if (bodyLayout === "inline") {
    const labelW = Math.max(
      10,
      Math.min(
        Math.floor(innerW * 0.34),
        innerW - slotCount * 14 - bodyGapPx - labelSepPx - 8,
      ),
    );
    const slotsTotalW = Math.max(
      12,
      innerW - labelW - bodyGapPx - labelSepPx,
    );
    const slotWidthPx =
      slotCount <= 1
        ? slotsTotalW
        : Math.max(
            10,
            Math.floor((slotsTotalW - (slotCount - 1) * slotSepPx) / slotCount),
          );
    const slotHeightPx = innerH;
    const labelPx = maxFontSizeThatFitsCaption(
      tableLabel,
      labelW,
      innerH,
      Math.min(typo.labelPx, Math.floor(innerH * 0.52)),
      6,
    );
    const slotFontPx = maxSlotFontForCaptions(
      captions,
      slotWidthPx,
      slotHeightPx,
      Math.min(16, Math.floor(Math.min(slotWidthPx, innerH) * 0.88)),
    );
    return {
      contentPadPx: pad,
      bodyLayout,
      labelPx: Math.min(labelPx, slotFontPx + 2),
      labelWidthPx: labelW,
      innerW,
      bodyGapPx,
      slotFontPx,
      slotWidthPx,
      slotHeightPx,
      slotSepPx,
    };
  }

  const labelMaxH = Math.max(8, Math.floor(innerH * 0.4));
  let labelPx = maxFontSizeThatFitsCaption(
    tableLabel,
    innerW,
    labelMaxH,
    Math.min(typo.labelPx, Math.floor(labelMaxH * 0.95)),
    6,
  );
  const labelBlockH = labelPx * 1.12 + bodyGapPx;
  let remainH = Math.max(8, innerH - labelBlockH);
  let slotHeightPx = Math.max(
    8,
    Math.floor((remainH - (slotCount - 1) * 2) / slotCount),
  );
  const slotWidthPx = innerW;
  let slotFontPx = maxSlotFontForCaptions(
    captions,
    slotWidthPx,
    slotHeightPx,
    Math.min(16, Math.floor(Math.min(slotWidthPx, slotHeightPx) * 0.9)),
  );
  if (slotFontPx <= 6 && labelPx > 6) {
    labelPx = Math.max(
      6,
      maxFontSizeThatFitsCaption(
        tableLabel,
        innerW,
        Math.max(6, Math.floor(innerH * 0.3)),
        labelPx - 1,
        6,
      ),
    );
    remainH = Math.max(8, innerH - labelPx * 1.12 - bodyGapPx);
    slotHeightPx = Math.max(
      8,
      Math.floor((remainH - (slotCount - 1) * 2) / slotCount),
    );
    slotFontPx = maxSlotFontForCaptions(
      captions,
      slotWidthPx,
      slotHeightPx,
      16,
    );
  }

  return {
    contentPadPx: pad,
    bodyLayout,
    labelPx,
    labelWidthPx: null,
    innerW,
    bodyGapPx,
    slotFontPx,
    slotWidthPx,
    slotHeightPx,
    slotSepPx,
  };
}

export function DayReservationsDrawer({
  open,
  onOpenChange,
  day,
  reservations,
  restaurantId,
  onEdit,
  onCreateReservation,
  onDataChanged,
  onDayNotesChanged,
}: DayReservationsDrawerProps) {
  const restaurantTimeZone = useRestaurantIanaTimezone(restaurantId);
  const timeFmt = useMemo(
    () =>
      createRestaurantDateTimeFormatter(restaurantTimeZone, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [restaurantTimeZone],
  );
  const { getProfileForRestaurantId, isReady: profileReady } = useRestaurantProfile();
  const [viewMode, setViewMode] = useState<DayViewMode>("list");
  const [sortBy, setSortBy] = useState<DaySortBy>("time");
  const [areas, setAreas] = useState<DiningAreaRow[]>([]);
  const [tables, setTables] = useState<DiningTableRow[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [slotIndex, setSlotIndex] = useState(0);
  const [floorAutoplay, setFloorAutoplay] = useState(false);
  const [floorPlanZoom, setFloorPlanZoom] = useState(1);
  const floorPlanMeasureRef = useRef<HTMLDivElement>(null);
  const [floorPlanAreaSize, setFloorPlanAreaSize] = useState({ w: 0, h: 0 });
  /** Entspricht `p-1` (4px) bzw. `sm:p-2` (8px) am Plan-Wrapper — sonst ist der Plan minimal größer als die nutzbare Fläche. */
  const [floorFitPadPx, setFloorFitPadPx] = useState(4);
  /** Ab sm (640px) wie `sm:grid-cols-2` auf der Seite — sonst wirkt Grid wie Liste. */
  const [showGridOption, setShowGridOption] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [gwadaReviewSheet, setGwadaReviewSheet] = useState<{
    review: ReservationGwadaReviewSummary;
    guestLabel: string;
    reservationNumber: number | null;
  } | null>(null);

  const reservationIds = useMemo(
    () => reservations.map((r) => r.id),
    [reservations],
  );
  const gwadaReviewsByReservation = useReservationGwadaReviews(
    restaurantId,
    reservationIds,
  );

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

  useEffect(() => {
    if (open && day) {
      setSortBy("time");
    }
  }, [open, day]);

  const hoursBundle = useMemo(() => {
    if (!restaurantId || !profileReady) return null;
    const p = getProfileForRestaurantId(restaurantId);
    return {
      weekly: p.weeklyHours,
      exceptions: p.dateExceptions,
    };
  }, [restaurantId, profileReady, getProfileForRestaurantId]);

  const restaurantName = useMemo(() => {
    if (!restaurantId || !profileReady) return undefined;
    return getProfileForRestaurantId(restaurantId).name.trim() || undefined;
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

  const floorPlanMaxHeightPx = useMemo(() => {
    const h = floorPlanAreaSize.h;
    if (h < 48) return 0;
    return Math.max(96, h - FLOOR_PLAN_CHROME_PX);
  }, [floorPlanAreaSize.h]);

  const floorPlanFitSize = useMemo(() => {
    if (!floorCropFrame || floorPlanMaxHeightPx < 48) return null;
    const { bw, bh } = floorCropFrame;
    const ar = bh / bw;
    const pad = floorFitPadPx * 2;
    const vw = Math.max(0, floorPlanAreaSize.w - pad - 1);
    const maxH = Math.max(48, floorPlanMaxHeightPx - pad - 1);
    if (vw < 24) return null;
    let planW = vw;
    let planH = planW * ar;
    if (planH > maxH) {
      planH = maxH;
      planW = planH / ar;
    }
    planW = Math.floor(planW);
    planH = Math.floor(planH);
    return { planW, planH, ar, maxH };
  }, [
    floorCropFrame,
    floorFitPadPx,
    floorPlanAreaSize.w,
    floorPlanMaxHeightPx,
  ]);

  useLayoutEffect(() => {
    if (!open || viewMode !== "floor") return;
    const el = floorPlanMeasureRef.current;
    if (!el) return;
    const measure = () => {
      const node = floorPlanMeasureRef.current;
      if (!node) return;
      setFloorPlanAreaSize({ w: node.clientWidth, h: node.clientHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, viewMode, floorCropFrame, selectedAreaId, tablesInArea.length]);

  useEffect(() => {
    if (viewMode !== "floor" || !floorPlanFitSize || floorPlanMaxHeightPx < 48) {
      setFloorPlanZoom(1);
      return;
    }
    setFloorPlanZoom(
      floorPlanHeightFillZoom(floorPlanFitSize.planH, floorPlanFitSize.maxH),
    );
  }, [
    day?.getTime(),
    viewMode,
    selectedAreaId,
    floorPlanFitSize?.planH,
    floorPlanFitSize?.maxH,
    floorPlanMaxHeightPx,
  ]);

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

  const floorSlotStats = useMemo(() => {
    if (!slotInstant || tablesInArea.length === 0) {
      return {
        freeTables: 0,
        occupiedTables: 0,
        freeSeats: 0,
        occupiedSeats: 0,
        totalSeats: 0,
      };
    }
    let occupiedTables = 0;
    let occupiedSeats = 0;
    let totalSeats = 0;
    for (const t of tablesInArea) {
      const cap = Math.max(0, Number(t.capacity) || 0);
      totalSeats += cap;
      const list = occupancy.get(t.id) ?? [];
      if (list.length > 0) {
        occupiedTables += 1;
        occupiedSeats += list.reduce((sum, r) => sum + r.party_size, 0);
      }
    }
    return {
      freeTables: tablesInArea.length - occupiedTables,
      occupiedTables,
      freeSeats: Math.max(0, totalSeats - occupiedSeats),
      occupiedSeats,
      totalSeats,
    };
  }, [tablesInArea, occupancy, slotInstant]);

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
    const t = timeFmt.format(new Date(r.starts_at));
    const endLabel = timeFmt.format(
      new Date(reservationEndsAtFromLiveInsert(r)),
    );
    const tableLabel = compact
      ? reservationAssignedTableLabel(r)
      : reservationDiningTableLabel(r);
    const gwadaReview = gwadaReviewsByReservation.get(r.id);
    const starBtn = gwadaReview ? (
      <ReservationGwadaReviewStarButton
        review={gwadaReview}
        className={compact ? "shrink-0 self-start" : "shrink-0 self-center"}
        onOpen={() => {
          setGwadaReviewSheet({
            review: gwadaReview,
            guestLabel: guest,
            reservationNumber: r.reservation_number,
          });
        }}
      />
    ) : null;
    if (compact) {
      return (
        <div key={r.id} className="flex items-stretch gap-1.5">
          <button
            type="button"
            className={cn("min-w-0 flex-1", reservationListRowButtonCompactClassName)}
            aria-label={`Reservierung ${guest} bearbeiten`}
            onClick={() => onEdit(r)}
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
                    {tableLabel ? (
                      <span className="shrink-0 rounded-md border border-border/50 bg-background/80 px-1.5 py-px text-[11px] font-medium tabular-nums text-foreground">
                        {tableLabel}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {r.party_size} {r.party_size === 1 ? "Person" : "Personen"} · bis {endLabel}
                    {st?.name ? ` · ${st.name}` : ""}
                    {st?.code === "change_requested" ? " · Änderung prüfen" : ""}
                  </p>
                </div>
              </div>
              {starBtn}
            </div>
          </button>
          {restaurantId && st?.code === "pending" ? (
            <div className="flex shrink-0 items-center self-center">
              <ReservationQuickAcceptButton
                restaurantId={restaurantId}
                reservationId={r.id}
                statusCode={st.code}
                onFailed={() => onDataChanged?.()}
              />
            </div>
          ) : null}
        </div>
      );
    }
    return (
      <div key={r.id} className="flex items-stretch gap-1.5">
        <button
          type="button"
          className={cn(
            "min-w-0 flex-1",
            reservationListRowButtonDrawerFullClassName,
            gwadaReview && "pr-1",
          )}
          aria-label={`Reservierung ${guest} bearbeiten`}
          onClick={() => onEdit(r)}
        >
        <div
          className="w-1 shrink-0 self-stretch rounded-full"
          style={{ backgroundColor: stripe }}
          aria-hidden
        />
        <div
          className={cn(
            "grid min-w-0 flex-1 items-start gap-x-3 gap-y-0.5",
            gwadaReview
              ? "grid-cols-[auto_1fr_auto] grid-rows-2"
              : "grid-cols-[auto_1fr] grid-rows-2",
          )}
        >
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
              {reservationInternalNoteText(r.notes) ? (
                <ReservationInternalNoteIndicator />
              ) : null}
            </div>
          </div>
          <div className="col-start-2 row-start-2 min-w-0 flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground">
              {r.party_size} {r.party_size === 1 ? "Person" : "Personen"}
              {" · "}
              <span className="tabular-nums">bis {endLabel}</span>
              {r.guest_phone ? (
                <>
                  {" · "}
                  <span className="truncate">{r.guest_phone}</span>
                </>
              ) : null}
            </p>
            {r.guest_email ? (
              <p className="truncate text-xs text-muted-foreground">
                {r.guest_email}
              </p>
            ) : null}
          </div>
          {gwadaReview ? (
            <ReservationGwadaReviewStarButton
              review={gwadaReview}
              className="col-start-3 row-span-2 self-center justify-self-end"
              onOpen={() => {
                setGwadaReviewSheet({
                  review: gwadaReview,
                  guestLabel: guest,
                  reservationNumber: r.reservation_number,
                });
              }}
            />
          ) : null}
        </div>
        </button>
        {restaurantId && st?.code === "pending" ? (
          <div className="flex shrink-0 items-center self-center">
            <ReservationQuickAcceptButton
              restaurantId={restaurantId}
              reservationId={r.id}
              statusCode={st.code}
              onFailed={() => onDataChanged?.()}
            />
          </div>
        ) : null}
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

  const dayTitle = day ? formatDayHeadingDe(day) : "";
  const serviceDateYmd = day ? localDateStringForDate(day) : null;

  return (
    <>
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs
      handleOnly
    >
      <DrawerContent
        className={cn(
          drawerContentClassName("dayOverview"),
          viewMode === "floor"
            ? "md:max-w-[min(100%,52rem)]"
            : "md:max-w-[42rem]",
          "data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:mt-4 data-[vaul-drawer-direction=bottom]:max-h-[min(96dvh,calc(100dvh-0.5rem))]",
        )}
      >
        <DrawerHeader className={drawerFormHeaderClassName(6, "min-w-0 space-y-3 overflow-x-hidden")}>
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
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <AutoAssignTablesButton
                variant="dashboard"
                size="icon"
                reservations={reservations.map(toAutoAssignReservation)}
                tables={tables}
                onDone={onDataChanged}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={reservationsDayDrawerHeaderActionButtonClassName}
                aria-label="Tagesliste exportieren"
                disabled={sorted.length === 0}
                onClick={() => setExportOpen(true)}
              >
                <Download className="size-4" />
              </Button>
              {onCreateReservation ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={reservationsDayDrawerHeaderActionButtonClassName}
                  aria-label="Neue Reservierung"
                  onClick={() => onCreateReservation?.()}
                >
                  <Plus className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>
          {(viewMode === "list" || (viewMode === "grid" && showGridOption)) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Sortierung</span>
              <Select
                value={sortBy}
                onValueChange={(v) => setSortBy(v as DaySortBy)}
              >
                <SelectTrigger
                  size="sm"
                  className="h-8 min-h-8 w-[min(100%,220px)] rounded-xl px-2.5 py-0 text-left text-xs font-medium"
                >
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

        <ReservationDayNotesSection
          open={open}
          restaurantId={restaurantId}
          serviceDate={serviceDateYmd}
          onNotesChanged={onDayNotesChanged}
          className="px-6"
        />

        {viewMode === "floor" && areas.length > 1 ? (
          <div className="min-w-0 shrink-0 overflow-x-hidden border-b border-border/40 px-6 pb-2">
            <div className="flex max-w-full gap-1.5 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]">
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
          ref={viewMode === "floor" ? floorPlanMeasureRef : undefined}
          data-vaul-no-drag
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-x-hidden px-6 pt-3",
            viewMode === "floor"
              ? "overflow-y-auto overscroll-x-none overscroll-y-contain touch-pan-y"
              : "overflow-hidden",
          )}
        >
          {viewMode === "list" && (
            <div className="h-full min-w-0 space-y-2 overflow-x-hidden overflow-y-auto overscroll-x-none touch-pan-y pb-6">
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
            <div className="h-full min-w-0 overflow-x-hidden overflow-y-auto overscroll-x-none touch-pan-y pb-6">
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
            <div className="flex min-w-0 max-w-full flex-col gap-1.5 pb-3">
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
                  <div className="flex flex-col gap-1">
                    <div className="flex shrink-0 flex-wrap items-center justify-center gap-1.5 px-0.5 pt-0.5">
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
                        disabled={!floorPlanFitSize}
                        onClick={() => {
                          if (!floorPlanFitSize) return;
                          setFloorPlanZoom(
                            floorPlanHeightFillZoom(
                              floorPlanFitSize.planH,
                              floorPlanFitSize.maxH,
                            ),
                          );
                        }}
                      >
                        Anpassen
                      </Button>
                    </div>
                    <div className="grid shrink-0 grid-cols-2 gap-x-2 gap-y-0.5 rounded-lg border border-border/40 bg-muted/15 px-2.5 py-1.5 text-[10px] leading-snug text-muted-foreground sm:grid-cols-4">
                      <p>
                        Freie Tische:{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {floorSlotStats.freeTables}
                        </span>
                      </p>
                      <p>
                        Besetzte Tische:{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {floorSlotStats.occupiedTables}
                        </span>
                      </p>
                      <p>
                        Freie Plätze:{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {floorSlotStats.freeSeats}
                        </span>
                      </p>
                      <p>
                        Besetzte Plätze:{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {floorSlotStats.occupiedSeats}
                        </span>
                      </p>
                    </div>
                    <div className="relative w-full max-w-full shrink-0 overflow-x-hidden rounded-lg bg-muted/10 py-1">
                      {floorCropFrame && floorPlanFitSize ? (
                        <div className="box-border flex w-full max-w-full justify-center overflow-x-auto overscroll-x-contain touch-pan-x p-0.5 [-webkit-overflow-scrolling:touch]">
                          <div
                            className="relative shrink-0 overflow-visible rounded-xl bg-muted/15 shadow-sm ring-1 ring-border/50"
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
                              const capacity = Math.max(
                                0,
                                Number(t.capacity) || 0,
                              );
                              const layoutWide = cellWpx > cellHpx * 1.02;
                              const chairInset = floorTableChairInsetPx(
                                capacity,
                                cellWpx,
                                cellHpx,
                                layoutWide,
                              );
                              const tableWpx = Math.max(
                                20,
                                cellWpx - chairInset.left - chairInset.right,
                              );
                              const tableHpx = Math.max(
                                20,
                                cellHpx - chairInset.top - chairInset.bottom,
                              );
                              const slotCaptions =
                                list.length === 0
                                  ? ["frei"]
                                  : list.map(
                                      (r) => `#${r.reservation_number}`,
                                    );
                              const cellLayout = layoutDayFloorTableCell({
                                cellWpx: tableWpx,
                                cellHpx: tableHpx,
                                typo,
                                reservationCount: list.length,
                                tableLabel: formatDiningTableLabel(t),
                                slotCaptions,
                              });
                              return (
                                <div
                                  key={t.id}
                                  className="absolute -translate-x-1/2 -translate-y-1/2 overflow-visible transition-[opacity,transform] duration-150 ease-out"
                                  style={{
                                    left: `${leftPct}%`,
                                    top: `${topPct}%`,
                                    width: `${wPct}%`,
                                    height: `${hPct}%`,
                                  }}
                                >
                                  <div className="relative h-full w-full overflow-visible">
                                    {capacity > 0 ? (
                                      <FloorTableChairsAround
                                        capacity={capacity}
                                        reservations={list}
                                        cellWpx={cellWpx}
                                        cellHpx={cellHpx}
                                        layoutWide={layoutWide}
                                      />
                                    ) : null}
                                    <div
                                      className={cn(
                                        "absolute flex flex-col overflow-hidden rounded-2xl border-2 shadow-card transition-colors duration-150 ease-out",
                                        list.length > 0
                                          ? cn(
                                              "border-red-600 dark:border-red-500",
                                              list.length > 1 &&
                                                "ring-2 ring-amber-500/90 ring-offset-1 ring-offset-transparent dark:ring-amber-400/90",
                                            )
                                          : "border-green-600 dark:border-green-500",
                                      )}
                                      style={{
                                        backgroundColor: bg,
                                        top: chairInset.top,
                                        right: chairInset.right,
                                        bottom: chairInset.bottom,
                                        left: chairInset.left,
                                      }}
                                    >
                                    <div
                                      className={cn(
                                        "flex min-h-0 flex-1 overflow-hidden text-center transition-opacity duration-150",
                                        cellLayout.bodyLayout === "inline"
                                          ? "flex-row items-center justify-center"
                                          : "flex-col items-center justify-center",
                                      )}
                                      style={{
                                        padding: cellLayout.contentPadPx,
                                        gap: cellLayout.bodyGapPx,
                                      }}
                                    >
                                      <span
                                        className={cn(
                                          "shrink-0 truncate font-semibold leading-tight",
                                          tablePlanTextClass(bg),
                                        )}
                                        style={{
                                          fontSize: cellLayout.labelPx,
                                          maxWidth:
                                            cellLayout.labelWidthPx ?? "100%",
                                        }}
                                      >
                                        {formatDiningTableLabel(t)}
                                      </span>
                                      <span
                                        className={cn(
                                          "shrink-0 select-none leading-none opacity-45",
                                          tablePlanMutedClass(bg),
                                        )}
                                        style={{
                                          fontSize: Math.max(
                                            5,
                                            cellLayout.slotFontPx - 1,
                                          ),
                                        }}
                                        aria-hidden
                                      >
                                        {cellLayout.bodyLayout === "inline"
                                          ? "|"
                                          : "–"}
                                      </span>
                                      <div
                                        key={
                                          list.map((x) => x.id).join("-") ||
                                          `empty-${t.id}`
                                        }
                                        className={cn(
                                          "flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden",
                                          cellLayout.bodyLayout === "inline"
                                            ? "flex-row"
                                            : "flex-col",
                                        )}
                                        style={{ gap: 0 }}
                                      >
                                        {list.length === 0 ? (
                                          onCreateReservation && slotInstant ? (
                                            <Tooltip>
                                              <TooltipTrigger
                                                render={
                                                  <button
                                                    type="button"
                                                    data-vaul-no-drag
                                                    className={cn(
                                                      "flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden px-0.5 py-0 outline-none",
                                                      cellLayout.bodyLayout ===
                                                        "inline"
                                                        ? "h-full max-w-full"
                                                        : "w-full",
                                                      "transition-colors hover:bg-black/15 focus-visible:bg-black/15 focus-visible:ring-1 focus-visible:ring-white/35 dark:hover:bg-white/12 dark:focus-visible:bg-white/12",
                                                      "touch-manipulation active:bg-black/25 dark:active:bg-white/18",
                                                      tablePlanMutedClass(bg),
                                                    )}
                                                    style={{
                                                      maxHeight:
                                                        cellLayout.slotHeightPx,
                                                      maxWidth:
                                                        cellLayout.bodyLayout ===
                                                        "inline"
                                                          ? cellLayout.slotWidthPx
                                                          : undefined,
                                                      fontSize:
                                                        cellLayout.slotFontPx,
                                                      lineHeight: 1.12,
                                                    }}
                                                    aria-label={`Neue Reservierung um ${timeFmt.format(slotInstant)}`}
                                                    onClick={() =>
                                                      onCreateReservation({
                                                        diningTableId: t.id,
                                                        startsAt: slotInstant,
                                                      })
                                                    }
                                                  >
                                                    frei
                                                  </button>
                                                }
                                              />
                                              <TooltipContent
                                                side="top"
                                                className="max-w-[14rem] text-left"
                                              >
                                                <p className="font-medium leading-snug">
                                                  Neue Reservierung
                                                </p>
                                                <p className="text-background/85">
                                                  {timeFmt.format(slotInstant)} ·
                                                  Tisch{" "}
                                                  {formatDiningTableLabel(t)}
                                                </p>
                                              </TooltipContent>
                                            </Tooltip>
                                          ) : (
                                            <span
                                              className={cn(
                                                "block w-full truncate opacity-80",
                                                tablePlanMutedClass(bg),
                                              )}
                                              style={{
                                                fontSize: cellLayout.slotFontPx,
                                                lineHeight: 1.12,
                                              }}
                                            >
                                              frei
                                            </span>
                                          )
                                        ) : (
                                          list.map((res, resIndex) => {
                                            const g =
                                              `${res.guest_first_name} ${res.guest_last_name}`.trim();
                                            const slotText = `#${res.reservation_number}`;
                                            const partyLabel =
                                              res.party_size === 1
                                                ? "1 Person"
                                                : `${res.party_size} Personen`;
                                            return (
                                              <Fragment key={res.id}>
                                                {resIndex > 0 ? (
                                                  <span
                                                    className={cn(
                                                      "shrink-0 select-none opacity-45",
                                                      cellLayout.bodyLayout ===
                                                        "inline"
                                                        ? "px-px leading-none"
                                                        : "block leading-[0.85]",
                                                      tablePlanMutedClass(bg),
                                                    )}
                                                    style={{
                                                      fontSize: Math.max(
                                                        5,
                                                        cellLayout.slotFontPx - 1,
                                                      ),
                                                      height:
                                                        cellLayout.bodyLayout ===
                                                        "stack"
                                                          ? Math.max(
                                                              5,
                                                              cellLayout.slotFontPx -
                                                                1,
                                                            )
                                                          : undefined,
                                                    }}
                                                    aria-hidden
                                                  >
                                                    {cellLayout.bodyLayout ===
                                                    "inline"
                                                      ? "|"
                                                      : "–"}
                                                  </span>
                                                ) : null}
                                                <Tooltip>
                                                  <TooltipTrigger
                                                    render={
                                                      <button
                                                        type="button"
                                                        data-vaul-no-drag
                                                        className={cn(
                                                          "flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden px-0.5 py-0 text-center font-medium tabular-nums outline-none",
                                                          cellLayout.bodyLayout ===
                                                            "inline"
                                                            ? "h-full max-w-full"
                                                            : "w-full",
                                                          "transition-colors hover:bg-black/15 focus-visible:bg-black/15 focus-visible:ring-1 focus-visible:ring-white/35 dark:hover:bg-white/12 dark:focus-visible:bg-white/12",
                                                          "touch-manipulation active:bg-black/25 dark:active:bg-white/18",
                                                          tablePlanMutedClass(bg),
                                                        )}
                                                        style={{
                                                          maxHeight:
                                                            cellLayout.slotHeightPx,
                                                          maxWidth:
                                                            cellLayout.bodyLayout ===
                                                            "inline"
                                                              ? cellLayout.slotWidthPx
                                                              : undefined,
                                                          fontSize:
                                                            cellLayout.slotFontPx,
                                                          lineHeight: 1.12,
                                                        }}
                                                        aria-label={`Reservierung ${slotText}, ${g || "Gast"}, ${partyLabel}`}
                                                        onClick={() => onEdit(res)}
                                                      >
                                                        {slotText}
                                                      </button>
                                                    }
                                                  />
                                                  <TooltipContent
                                                    side="top"
                                                    className="max-w-[14rem] space-y-0.5 text-left"
                                                  >
                                                    <p className="font-medium leading-snug">
                                                      {g || "Gast"}
                                                    </p>
                                                    <p className="text-background/85">
                                                      {partyLabel}
                                                    </p>
                                                  </TooltipContent>
                                                </Tooltip>
                                              </Fragment>
                                            );
                                          })
                                        )}
                                      </div>
                                    </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
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
            className="min-w-0 shrink-0 space-y-2 overflow-x-hidden border-t border-border/50 bg-card px-6 py-3 touch-pan-y"
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

        <div className="shrink-0 border-t border-border/50 px-6 py-3">
          <Button
            type="button"
            variant="outline"
            className={drawerFormFullWidthButtonClassName}
            onClick={() => onOpenChange(false)}
          >
            Schließen
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
    <DayReservationsExportSheet
      open={exportOpen}
      onOpenChange={setExportOpen}
      day={day}
      dayTitle={dayTitle}
      reservations={sorted}
      restaurantName={restaurantName}
    />
    <ReservationGwadaReviewSheet
      open={gwadaReviewSheet !== null}
      onOpenChange={(o) => {
        if (!o) setGwadaReviewSheet(null);
      }}
      review={gwadaReviewSheet?.review ?? null}
      guestLabel={gwadaReviewSheet?.guestLabel ?? ""}
      reservationNumber={gwadaReviewSheet?.reservationNumber ?? null}
    />
    </>
  );
}
