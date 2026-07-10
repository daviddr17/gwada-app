"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { deriveMessagesUnreadSummaryFromConversations } from "@/lib/contact-messages/messages-unread-summary";
import {
  GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT,
  peekUnifiedInboxCache,
} from "@/lib/contact-messages/unified-inbox-cache";
import type { DashboardBatchWidgetId } from "@/lib/dashboard/dashboard-batch-widgets";
import { writeDashboardBatchSummaryCache } from "@/lib/dashboard/dashboard-batch-summary-cache";
import {
  GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT,
  GWADA_DASHBOARD_RESERVATIONS_LIVE_INSERT_EVENT,
  GWADA_DASHBOARD_RESERVATIONS_LIVE_UPDATE_EVENT,
  GWADA_DASHBOARD_RESERVATIONS_REFRESH_EVENT,
  type DashboardMessagesRefreshDetail,
  type DashboardReservationsLiveInsertDetail,
  type DashboardReservationsLiveUpdateDetail,
} from "@/lib/dashboard/dashboard-live-events";
import {
  GWADA_DASHBOARD_WIDGET_LIVE_PATCH_EVENT,
  dispatchDashboardWidgetLiveFetch,
  type DashboardWidgetLivePatchDetail,
} from "@/lib/dashboard/dashboard-widgets-live-events";
import { patchMessagesUnreadSummary } from "@/lib/dashboard/patch-dashboard-messages-read-client";
import {
  fetchDashboardWidgetSummaryClient,
  isDashboardWidgetLiveFetchId,
} from "@/lib/dashboard/patch-dashboard-batch-widget-client";
import {
  patchDashboardReservationSummaryFromInsert,
  patchDashboardReservationSummaryResolvedOpen,
  reservationInsertInMonthRange,
  reservationLiveInsertListRowRaw,
} from "@/lib/dashboard/patch-dashboard-reservations-live-client";
import {
  GWADA_RESERVATION_OPEN_RESOLVED_EVENT,
  type ReservationOpenResolvedDetail,
  shouldDecrementUnconfirmedCount,
} from "@/lib/reservations/reservation-open-status";
import { useDashboardEffectiveWidgetPrefs } from "@/lib/hooks/use-dashboard-effective-widget-prefs";
import type { DashboardBatchQueryData } from "@/lib/hooks/use-dashboard-batch-summary-query";
import {
  currentMonthReservationRange,
  peekReservationsMonthCache,
  writeReservationsMonthCache,
} from "@/lib/reservations/reservations-month-client-cache";
import { mapRawToReservationListRow } from "@/lib/supabase/reservations-db";
import { GWADA_STAFF_DATA_REFRESH_EVENT } from "@/lib/staff/staff-live-events";
import { queryKeys } from "@/lib/query/query-keys";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

const BATCH_RECONCILE_DEBOUNCE_MS = 20_000;
const RESERVATION_RECONCILE_DEBOUNCE_MS = 12_000;
const WIDGET_LIVE_FETCH_DEBOUNCE_MS = 500;
const WIDGET_RECONCILE_DEBOUNCE_MS = 15_000;

/**
 * App-weite Live-Patches (Dashboard-KPIs, Monats-Cache) — unabhängig von der Route.
 * Batch-Invalidierung nur debounced als Reconciliation, nicht pro Event.
 */
export function AppDashboardLivePatchMount() {
  const queryClient = useQueryClient();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const restaurantTimeZone = useRestaurantIanaTimezone(restaurantId);
  const { batchWidgets } = useDashboardEffectiveWidgetPrefs();
  const batchReconcileRef = useRef<number | null>(null);
  const reservationReconcileRef = useRef<number | null>(null);
  const widgetFetchRef = useRef<Map<DashboardBatchWidgetId, number>>(new Map());
  const widgetReconcileRef = useRef<Map<DashboardBatchWidgetId, number>>(
    new Map(),
  );

  useEffect(() => {
    if (
      !workspaceReady ||
      !restaurantId ||
      !isUuidRestaurantId(restaurantId)
    ) {
      return;
    }

    const scheduleBatchReconcile = (delayMs = BATCH_RECONCILE_DEBOUNCE_MS) => {
      if (batchReconcileRef.current) {
        window.clearTimeout(batchReconcileRef.current);
      }
      batchReconcileRef.current = window.setTimeout(() => {
        batchReconcileRef.current = null;
        void queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.summaryRoot(restaurantId),
        });
      }, delayMs);
    };

    const scheduleReservationReconcile = () => {
      if (reservationReconcileRef.current) {
        window.clearTimeout(reservationReconcileRef.current);
      }
      reservationReconcileRef.current = window.setTimeout(() => {
        reservationReconcileRef.current = null;
        void queryClient.invalidateQueries({
          queryKey: queryKeys.dashboard.summaryRoot(restaurantId),
        });
      }, RESERVATION_RECONCILE_DEBOUNCE_MS);
    };

    const patchBatchData = (
      mutator: (old: DashboardBatchQueryData) => DashboardBatchQueryData | undefined,
    ) => {
      queryClient.setQueriesData<DashboardBatchQueryData>(
        { queryKey: queryKeys.dashboard.summaryRoot(restaurantId) },
        (old) => {
          if (!old) return old;
          const next = mutator(old);
          if (!next || next === old) return old;
          writeDashboardBatchSummaryCache(restaurantId, batchWidgets, next);
          return next;
        },
      );
    };

    const patchWidgetSummary = (
      widget: DashboardBatchWidgetId,
      summary: NonNullable<DashboardBatchQueryData["data"][typeof widget]>,
    ) => {
      patchBatchData((old) => {
        if (!old.data[widget]) return old;
        return {
          ...old,
          data: { ...old.data, [widget]: summary },
        };
      });
    };

    const patchWidgetFromServer = async (widget: DashboardBatchWidgetId) => {
      if (!isDashboardWidgetLiveFetchId(widget)) return;
      const data = await fetchDashboardWidgetSummaryClient(widget, restaurantId);
      if (!data) return;
      patchWidgetSummary(widget, data);
    };

    const scheduleWidgetFetch = (widget: DashboardBatchWidgetId) => {
      if (!isDashboardWidgetLiveFetchId(widget)) return;
      const existing = widgetFetchRef.current.get(widget);
      if (existing) window.clearTimeout(existing);
      const id = window.setTimeout(() => {
        widgetFetchRef.current.delete(widget);
        void patchWidgetFromServer(widget);
      }, WIDGET_LIVE_FETCH_DEBOUNCE_MS);
      widgetFetchRef.current.set(widget, id);
    };

    const scheduleWidgetReconcile = (widget: DashboardBatchWidgetId) => {
      if (!isDashboardWidgetLiveFetchId(widget)) return;
      const existing = widgetReconcileRef.current.get(widget);
      if (existing) window.clearTimeout(existing);
      const id = window.setTimeout(() => {
        widgetReconcileRef.current.delete(widget);
        void patchWidgetFromServer(widget);
      }, WIDGET_RECONCILE_DEBOUNCE_MS);
      widgetReconcileRef.current.set(widget, id);
    };

    const onWidgetLivePatch = (event: Event) => {
      const detail = (event as CustomEvent<DashboardWidgetLivePatchDetail>).detail;
      if (!detail || detail.restaurantId !== restaurantId) return;
      if (!isDashboardWidgetLiveFetchId(detail.widget)) return;

      if (detail.summary !== undefined) {
        patchWidgetSummary(
          detail.widget,
          detail.summary as NonNullable<
            DashboardBatchQueryData["data"][typeof detail.widget]
          >,
        );
        scheduleWidgetReconcile(detail.widget);
        return;
      }

      if (detail.immediate) {
        void patchWidgetFromServer(detail.widget);
        return;
      }

      scheduleWidgetFetch(detail.widget);
    };

    const onReservationOpenResolved = (event: Event) => {
      const detail = (event as CustomEvent<ReservationOpenResolvedDetail>).detail;
      if (!detail || detail.restaurantId !== restaurantId) return;
      if (
        !shouldDecrementUnconfirmedCount({
          previousStatusCode: detail.previousStatusCode,
          nextStatusCode: detail.nextStatusCode,
        })
      ) {
        return;
      }
      patchBatchData((old) => {
        if (!old.data.reservations) return old;
        return {
          ...old,
          data: {
            ...old.data,
            reservations: patchDashboardReservationSummaryResolvedOpen(
              old.data.reservations,
              detail.reservationId,
            ),
          },
        };
      });
    };

    const onReservationLiveUpdate = (event: Event) => {
      const detail = (event as CustomEvent<DashboardReservationsLiveUpdateDetail>)
        .detail;
      if (!detail || detail.restaurantId !== restaurantId) return;
      if (detail.immediate) {
        void patchWidgetFromServer("reservations");
        void patchWidgetFromServer("contacts");
        return;
      }
      scheduleWidgetFetch("reservations");
    };

    const patchMessagesFromInboxCache = () => {
      const conversations = peekUnifiedInboxCache(restaurantId);
      if (!conversations) return;
      const nextMessages =
        deriveMessagesUnreadSummaryFromConversations(conversations);
      patchBatchData((old) => {
        if (!old.data.messages) return old;
        return {
          ...old,
          data: { ...old.data, messages: nextMessages },
        };
      });
    };

    const onMessagesRefresh = (event: Event) => {
      const detail = (event as CustomEvent<DashboardMessagesRefreshDetail | undefined>)
        .detail;
      if (detail?.restaurantId && detail.restaurantId !== restaurantId) return;

      if (detail?.contactId || detail?.all) {
        patchBatchData((old) => {
          if (!old.data.messages) return old;
          return {
            ...old,
            data: {
              ...old.data,
              messages: patchMessagesUnreadSummary(
                old.data.messages,
                { contactId: detail.contactId, all: detail.all },
                peekUnifiedInboxCache(restaurantId),
              ),
            },
          };
        });
        return;
      }

      patchMessagesFromInboxCache();
    };

    const onInboxCache = (event: Event) => {
      const detail = (event as CustomEvent<{ restaurantId?: string }>).detail;
      if (detail?.restaurantId !== restaurantId) return;
      patchMessagesFromInboxCache();
    };

    const onReservationLiveInsert = (event: Event) => {
      const detail = (event as CustomEvent<DashboardReservationsLiveInsertDetail>)
        .detail;
      if (!detail || detail.restaurantId !== restaurantId) return;

      patchBatchData((old) => {
        if (!old.data.reservations) return old;
        return {
          ...old,
          data: {
            ...old.data,
            reservations: patchDashboardReservationSummaryFromInsert(
              old.data.reservations,
              detail.insert,
              new Date(),
              restaurantTimeZone,
            ),
          },
        };
      });

      const monthRange = currentMonthReservationRange();
      if (reservationInsertInMonthRange(detail.insert.starts_at, monthRange)) {
        const cached = peekReservationsMonthCache(restaurantId, monthRange);
        if (cached && !cached.rows.some((r) => r.id === detail.insert.id)) {
          const stubRow = mapRawToReservationListRow(
            reservationLiveInsertListRowRaw(detail.insert, detail.restaurantId),
          );
          writeReservationsMonthCache(restaurantId, monthRange, [
            ...cached.rows,
            stubRow,
          ]);
        }
      }

      dispatchDashboardWidgetLiveFetch(restaurantId, "contacts");
      scheduleReservationReconcile();
    };

    const onLegacyReservationsRefresh = () => {
      scheduleReservationReconcile();
    };

    const onStaffRefresh = () => {
      dispatchDashboardWidgetLiveFetch(restaurantId, "staff");
      scheduleBatchReconcile(BATCH_RECONCILE_DEBOUNCE_MS);
    };

    const onWorkspaceChanged = () => {
      if (batchReconcileRef.current) {
        window.clearTimeout(batchReconcileRef.current);
        batchReconcileRef.current = null;
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.summaryRoot(restaurantId),
      });
    };

    patchMessagesFromInboxCache();

    window.addEventListener(
      GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT,
      onMessagesRefresh,
    );
    window.addEventListener(
      GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT,
      onInboxCache,
    );
    window.addEventListener(
      GWADA_DASHBOARD_RESERVATIONS_LIVE_INSERT_EVENT,
      onReservationLiveInsert,
    );
    window.addEventListener(
      GWADA_DASHBOARD_RESERVATIONS_REFRESH_EVENT,
      onLegacyReservationsRefresh,
    );
    window.addEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onStaffRefresh);
    window.addEventListener(
      GWADA_DASHBOARD_RESERVATIONS_LIVE_UPDATE_EVENT,
      onReservationLiveUpdate,
    );
    window.addEventListener(
      GWADA_RESERVATION_OPEN_RESOLVED_EVENT,
      onReservationOpenResolved,
    );
    window.addEventListener(
      GWADA_DASHBOARD_WIDGET_LIVE_PATCH_EVENT,
      onWidgetLivePatch,
    );
    window.addEventListener(
      GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
      onWorkspaceChanged,
    );

    return () => {
      if (batchReconcileRef.current) {
        window.clearTimeout(batchReconcileRef.current);
      }
      if (reservationReconcileRef.current) {
        window.clearTimeout(reservationReconcileRef.current);
      }
      for (const id of widgetFetchRef.current.values()) {
        window.clearTimeout(id);
      }
      widgetFetchRef.current.clear();
      for (const id of widgetReconcileRef.current.values()) {
        window.clearTimeout(id);
      }
      widgetReconcileRef.current.clear();
      window.removeEventListener(
        GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT,
        onMessagesRefresh,
      );
      window.removeEventListener(
        GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT,
        onInboxCache,
      );
      window.removeEventListener(
        GWADA_DASHBOARD_RESERVATIONS_LIVE_INSERT_EVENT,
        onReservationLiveInsert,
      );
      window.removeEventListener(
        GWADA_DASHBOARD_RESERVATIONS_REFRESH_EVENT,
        onLegacyReservationsRefresh,
      );
      window.removeEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onStaffRefresh);
      window.removeEventListener(
        GWADA_DASHBOARD_RESERVATIONS_LIVE_UPDATE_EVENT,
        onReservationLiveUpdate,
      );
      window.removeEventListener(
        GWADA_RESERVATION_OPEN_RESOLVED_EVENT,
        onReservationOpenResolved,
      );
      window.removeEventListener(
        GWADA_DASHBOARD_WIDGET_LIVE_PATCH_EVENT,
        onWidgetLivePatch,
      );
      window.removeEventListener(
        GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
        onWorkspaceChanged,
      );
    };
  }, [
    batchWidgets,
    queryClient,
    restaurantId,
    restaurantTimeZone,
    workspaceReady,
  ]);

  return null;
}
