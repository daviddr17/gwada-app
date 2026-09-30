import { toolCreateReservation } from "@/lib/assistant/assistant-tools";
import type { AssistantReservationPreview } from "@/lib/assistant/assistant-actions";
import { authorizeDashboardRestaurant } from "@/lib/dashboard/authorize-dashboard-restaurant";
import { getSuperadminSession } from "@/lib/superadmin/superadmin-session";
import { normalizeAppLocale } from "@/i18n/config";
import { getLocale } from "next-intl/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    zone?: string;
    preview?: AssistantReservationPreview;
  };
  const preview = body.preview;
  if (!preview?.date_ymd || !preview.guest_first_name) {
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

  const raw = await toolCreateReservation(
    {
      restaurantId: auth.restaurantId,
      userId: auth.userId,
      sb: auth.sb,
      zone,
      callerIsSuperadmin,
    },
    {
      ...preview,
      confirm: true,
      restaurant_name:
        zone === "superadmin" ? preview.restaurant_name ?? undefined : undefined,
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
      { error: parsed.error ?? parsed.ask ?? "Nicht gespeichert.", ask: parsed.ask ?? null },
      { status: 400 },
    );
  }
  return Response.json({ ok: true, reply: "Gespeichert." });
}
