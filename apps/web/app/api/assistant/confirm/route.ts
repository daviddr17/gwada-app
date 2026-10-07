import type {
  AssistantOpeningHoursPreview,
  AssistantReservationPreview,
} from "@/lib/assistant/assistant-actions";
import { persistOpeningHoursPreview } from "@/lib/assistant/assistant-settings-tools";
import { toolCreateReservation } from "@/lib/assistant/assistant-tools";
import type { AssistantToolContext } from "@/lib/assistant/assistant-tool-context";
import { authorizeDashboardRestaurant } from "@/lib/dashboard/authorize-dashboard-restaurant";
import { authorizeRestaurantModule } from "@/lib/permissions/authorize-restaurant-module";
import { getSuperadminSession } from "@/lib/superadmin/superadmin-session";
import { normalizeAppLocale } from "@/i18n/config";
import { getLocale } from "next-intl/server";

export const dynamic = "force-dynamic";

function toolCtx(
  auth: { restaurantId: string; userId: string; sb: AssistantToolContext["sb"] },
  zone: "restaurant" | "superadmin",
  callerIsSuperadmin: boolean,
): AssistantToolContext {
  return {
    restaurantId: auth.restaurantId,
    userId: auth.userId,
    sb: auth.sb,
    zone,
    callerIsSuperadmin,
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    zone?: string;
    kind?: string;
    preview?: AssistantReservationPreview | AssistantOpeningHoursPreview;
  };
  const kind = body.kind?.trim() || "create_reservation";
  const preview = body.preview;
  if (!preview) {
    return Response.json({ error: "missing_preview" }, { status: 400 });
  }

  const auth = await authorizeDashboardRestaurant(body.restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const zone = body.zone === "superadmin" ? "superadmin" : "restaurant";
  const superSession =
    zone === "superadmin" ? await getSuperadminSession(auth.sb) : null;
  const callerIsSuperadmin = superSession?.status === "ok";
  const locale = normalizeAppLocale(await getLocale().catch(() => "de"));
  const ctx = toolCtx(auth, zone, callerIsSuperadmin);

  if (kind === "update_opening_hours") {
    const hoursPreview = preview as AssistantOpeningHoursPreview;
    if (
      !Array.isArray(hoursPreview.weekly_changes) ||
      !Array.isArray(hoursPreview.exception_changes) ||
      !hoursPreview.next_weekly
    ) {
      return Response.json({ error: "missing_preview" }, { status: 400 });
    }
    if (!(callerIsSuperadmin && zone === "superadmin")) {
      const hoursAuth = await authorizeRestaurantModule(
        auth.restaurantId,
        "settings.opening_hours",
      );
      if (!hoursAuth.ok) {
        return Response.json(
          { error: "Keine Berechtigung, Öffnungszeiten zu ändern." },
          { status: 403 },
        );
      }
    }
    const raw = await persistOpeningHoursPreview(
      auth.sb,
      auth.restaurantId,
      hoursPreview,
      locale,
    );
    let parsed: { ok?: boolean; status?: string; ask?: string; error?: string };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      return Response.json({ error: "confirm_failed" }, { status: 500 });
    }
    if (!parsed.ok || parsed.status !== "saved") {
      return Response.json(
        {
          error: parsed.error ?? parsed.ask ?? "Nicht gespeichert.",
          ask: parsed.ask ?? null,
        },
        { status: 400 },
      );
    }
    return Response.json({
      ok: true,
      reply: locale === "de" ? "Öffnungszeiten gespeichert." : "Opening hours saved.",
    });
  }

  const reservationPreview = preview as AssistantReservationPreview;
  if (!reservationPreview.date_ymd || !reservationPreview.guest_first_name) {
    return Response.json({ error: "missing_preview" }, { status: 400 });
  }

  const raw = await toolCreateReservation(
    ctx,
    {
      ...reservationPreview,
      confirm: true,
      restaurant_name:
        zone === "superadmin"
          ? reservationPreview.restaurant_name ?? undefined
          : undefined,
    },
    locale,
  );

  let parsed: { ok?: boolean; status?: string; ask?: string; error?: string };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return Response.json({ error: "confirm_failed" }, { status: 500 });
  }
  if (!parsed.ok || parsed.status !== "created") {
    return Response.json(
      {
        error: parsed.error ?? parsed.ask ?? "Nicht gespeichert.",
        ask: parsed.ask ?? null,
      },
      { status: 400 },
    );
  }
  return Response.json({ ok: true, reply: "Gespeichert." });
}
