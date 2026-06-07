import "server-only";

import { fetchFacebookPageHours } from "@/lib/integrations/facebook-hours-fetch-server";
import { fetchGoogleLocationHours } from "@/lib/integrations/google-business-hours-fetch-server";
import { loadOpeningHoursPayloadAdmin } from "@/lib/integrations/opening-hours-load-server";
import {
  futureExceptionsEqual,
  weeklyHoursEqual,
} from "@/lib/integrations/opening-hours-platform-format";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";
import { googleBusinessConfigFromJson } from "@/lib/integrations/google-business-oauth";
import { facebookIntegrationConfigFromJson } from "@/lib/integrations/facebook-oauth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type {
  HoursPlatformSyncCheck,
  HoursPlatformSyncStatus,
  OpeningHoursPlatformStatusPayload,
} from "@/lib/integrations/opening-hours-platform-status-types";

export type {
  HoursPlatformSyncCheck,
  HoursPlatformSyncStatus,
  OpeningHoursPlatformStatusPayload,
} from "@/lib/integrations/opening-hours-platform-status-types";

function syncCheck(
  status: HoursPlatformSyncStatus,
  message: string,
): HoursPlatformSyncCheck {
  return { status, message };
}

export async function loadOpeningHoursPlatformStatus(
  restaurantId: string,
): Promise<OpeningHoursPlatformStatusPayload | { error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured" };

  const local = await loadOpeningHoursPayloadAdmin(admin, restaurantId);
  if ("error" in local) {
    return { error: local.error };
  }

  const todayYmd = new Date().toISOString().slice(0, 10);

  const googleRow = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    "google_business",
    googleBusinessConfigFromJson,
  );
  const googleConnected =
    googleRow?.status === "working" &&
    Boolean(googleRow.config.location_name?.trim());

  const facebookRow = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    "facebook",
    (raw) => facebookIntegrationConfigFromJson(raw),
  );
  const facebookConnected =
    facebookRow?.status === "working" &&
    Boolean(facebookRow.config.page_id?.trim()) &&
    Boolean(facebookRow.config.page_access_token?.trim());

  let googleRegular: HoursPlatformSyncCheck | null = null;
  let googleKitchen: HoursPlatformSyncCheck | null = null;
  let googleExceptions: HoursPlatformSyncCheck | null = null;
  let facebookRegular: HoursPlatformSyncCheck | null = null;

  if (googleConnected) {
    const remote = await fetchGoogleLocationHours(restaurantId);
    if (!remote.ok) {
      const msg = "Stand bei Google konnte nicht geladen werden.";
      googleRegular = syncCheck("unavailable", msg);
      googleKitchen = syncCheck("unavailable", msg);
      googleExceptions = syncCheck("unavailable", msg);
    } else {
      googleRegular = weeklyHoursEqual(local.weeklyHours, remote.data.weeklyHours)
        ? syncCheck("in_sync", "Entspricht den gespeicherten Gwada-Öffnungszeiten.")
        : syncCheck(
            "out_of_sync",
            "Weicht von den gespeicherten Gwada-Öffnungszeiten ab.",
          );

      if (!local.kitchenHoursEnabled) {
        googleKitchen =
          remote.data.kitchenWeeklyHours == null
            ? syncCheck(
                "in_sync",
                "Keine separaten Küchenzeiten bei Google (wie in Gwada).",
              )
            : syncCheck(
                "out_of_sync",
                "Bei Google sind Küchenzeiten hinterlegt, in Gwada nicht.",
              );
      } else {
        if (remote.data.kitchenWeeklyHours == null) {
          googleKitchen = syncCheck(
            "out_of_sync",
            "Küchenzeiten fehlen bei Google.",
          );
        } else {
          googleKitchen = weeklyHoursEqual(
            local.kitchenWeeklyHours,
            remote.data.kitchenWeeklyHours,
          )
            ? syncCheck(
                "in_sync",
                "Entspricht den gespeicherten Gwada-Küchenzeiten.",
              )
            : syncCheck(
                "out_of_sync",
                "Küchenzeiten weichen von Gwada ab.",
              );
        }
      }

      const futureLocal = local.dateExceptions.filter((ex) => ex.date >= todayYmd);
      if (futureLocal.length === 0) {
        const remoteFuture = remote.data.dateExceptions.filter(
          (ex) => ex.date >= todayYmd,
        );
        googleExceptions =
          remoteFuture.length === 0
            ? syncCheck(
                "in_sync",
                "Keine zukünftigen Ausnahmen (Gwada und Google).",
              )
            : syncCheck(
                "out_of_sync",
                "Google hat zukünftige Sonderzeiten, Gwada nicht.",
              );
      } else {
        googleExceptions = futureExceptionsEqual(
          local.dateExceptions,
          remote.data.dateExceptions,
          todayYmd,
        )
          ? syncCheck(
              "in_sync",
              "Zukünftige Ausnahmen entsprechen Gwada.",
            )
          : syncCheck(
              "out_of_sync",
              "Zukünftige Ausnahmen weichen von Gwada ab.",
            );
      }
    }
  }

  if (facebookConnected) {
    const remote = await fetchFacebookPageHours(restaurantId);
    if (!remote.ok) {
      facebookRegular = syncCheck(
        "unavailable",
        "Stand bei Facebook konnte nicht geladen werden.",
      );
    } else {
      facebookRegular = weeklyHoursEqual(local.weeklyHours, remote.weeklyHours)
        ? syncCheck(
            "in_sync",
            "Entspricht den gespeicherten Gwada-Öffnungszeiten.",
          )
        : syncCheck(
            "out_of_sync",
            "Weicht von den gespeicherten Gwada-Öffnungszeiten ab.",
          );
    }
  }

  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    google: {
      connected: googleConnected,
      regular: googleRegular,
      kitchen: googleKitchen,
      exceptions: googleExceptions,
    },
    facebook: {
      connected: facebookConnected,
      regular: facebookRegular,
    },
  };
}
