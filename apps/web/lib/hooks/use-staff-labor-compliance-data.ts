"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import { useStaffModuleSelectionOptional } from "@/lib/contexts/staff-module-selection-context";
import {
  exclusiveUtcIsoAfterLocalVisibleEnd,
  localDayStartToUtcIso,
  startOfLocalDay,
} from "@/lib/reservations/month-range";
import { fetchStaffWorkEntriesInRange } from "@/lib/supabase/staff-db";
import { evaluateLaborCompliance } from "@/lib/staff/labor-law/evaluate-work-compliance";
import { sixMonthWindowStartYmd } from "@/lib/staff/labor-law/de-arbzg-rules";
import type { LaborComplianceViolation } from "@/lib/staff/labor-law/de-arbzg-rules";
import type { RestaurantStaffWorkEntryRow } from "@/lib/types/staff";
import { staffFamilyFirstDisplayName } from "@/lib/types/staff";

function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return startOfLocalDay(new Date(y!, m! - 1, d!));
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useStaffLaborComplianceData(params: {
  restaurantId: string | null;
  staffId?: string | null;
  enabled?: boolean;
}) {
  const enabled = params.enabled !== false;
  const restaurantTimeZone = useRestaurantIanaTimezone(params.restaurantId);
  const { profile } = useRestaurantProfile();
  const staffSelection = useStaffModuleSelectionOptional();
  const staffList = staffSelection?.staffList ?? [];

  const [entries, setEntries] = useState<RestaurantStaffWorkEntryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const todayKey = useMemo(() => localDayKey(startOfLocalDay(new Date())), []);
  const lookbackStartYmd = useMemo(
    () => sixMonthWindowStartYmd(todayKey),
    [todayKey],
  );

  const reload = useCallback(async () => {
    if (!enabled || !params.restaurantId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    const rangeStart = localDayStartToUtcIso(ymdToLocalDate(lookbackStartYmd));
    const rangeEnd = exclusiveUtcIsoAfterLocalVisibleEnd(
      ymdToLocalDate(todayKey),
    );
    const { data, error } = await fetchStaffWorkEntriesInRange(
      params.restaurantId,
      params.staffId ?? null,
      rangeStart,
      rangeEnd,
    );
    setLoading(false);
    if (error) {
      toast.error(error);
      setEntries([]);
      return;
    }
    setEntries(data);
  }, [enabled, params.restaurantId, params.staffId, lookbackStartYmd, todayKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const violations = useMemo((): LaborComplianceViolation[] => {
    if (!enabled || entries.length === 0) return [];
    return evaluateLaborCompliance({
      entries,
      countryIso2: profile.countryIso2,
      countryLabel: profile.country,
      timeZone: restaurantTimeZone,
      closedOnly: true,
    });
  }, [
    enabled,
    entries,
    profile.countryIso2,
    profile.country,
    restaurantTimeZone,
  ]);

  const staffNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of staffList) {
      map.set(row.id, staffFamilyFirstDisplayName(row));
    }
    return map;
  }, [staffList]);

  const fixableCount = useMemo(
    () => violations.filter((v) => v.fixable).length,
    [violations],
  );

  return {
    violations,
    fixableCount,
    loading,
    reload,
    staffNameById,
    lookbackStartYmd,
    todayKey,
  };
}
