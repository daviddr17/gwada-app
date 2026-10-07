import type {
  AssistantOpeningHoursPreview,
  AssistantReservationPreview,
} from "@/lib/assistant/assistant-actions";
import {
  applyAdjustIngredientStockPreview,
  applySetMenuItemActivePreview,
  applySetPurchaseOrderStatusPreview,
  applyUpdateReservationPreview,
} from "@/lib/assistant/assistant-module-write-tools";
import { persistOpeningHoursPreview } from "@/lib/assistant/assistant-settings-tools";
import { toolSyncPlatforms } from "@/lib/assistant/assistant-settings-tools";
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

function parseToolResult(raw: string): {
  ok?: boolean;
  status?: string;
  ask?: string;
  error?: string;
  message?: string;
} {
  try {
    return JSON.parse(raw) as {
      ok?: boolean;
      status?: string;
      ask?: string;
      error?: string;
      message?: string;
    };
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    zone?: string;
    kind?: string;
    preview?:
      | AssistantReservationPreview
      | AssistantOpeningHoursPreview
      | { action: string; args: Record<string, unknown> };
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

  if (kind === "confirm_mutation") {
    const mutation = preview as { action?: string; args?: Record<string, unknown> };
    const action = mutation.action?.trim() ?? "";
    const args = mutation.args ?? {};
    let raw = "";
    switch (action) {
      case "update_reservation":
        raw = await applyUpdateReservationPreview(ctx, args, locale);
        break;
      case "set_menu_item_active":
        raw = await applySetMenuItemActivePreview(ctx, args, locale);
        break;
      case "adjust_ingredient_stock":
        raw = await applyAdjustIngredientStockPreview(ctx, args, locale);
        break;
      case "set_purchase_order_status":
        raw = await applySetPurchaseOrderStatusPreview(ctx, args, locale);
        break;
      case "sync_platforms":
        raw = await toolSyncPlatforms(
          ctx,
          { ...args, confirm: true },
          locale,
        );
        break;
      default:
        return Response.json({ error: "unknown_action" }, { status: 400 });
    }
    const parsed = parseToolResult(raw);
    const success =
      parsed.ok === true &&
      (action === "sync_platforms" || parsed.status === "saved");
    if (!success) {
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
      reply:
        parsed.message ??
        (locale === "de"
          ? action === "sync_platforms"
            ? "Sync ausgeführt."
            : "Gespeichert."
          : action === "sync_platforms"
            ? "Sync done."
            : "Saved."),
    });
  }

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
    const parsed = parseToolResult(raw);
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

  const parsed = parseToolResult(raw);
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
