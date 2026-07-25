import "server-only";

import { fetchPublicEmbedEvents } from "@/lib/events/public-events-server";
import { fetchPublicEmbedGallery } from "@/lib/gallery/public-gallery-server";
import { fetchPublicEmbedMenu } from "@/lib/menu/public-menu-server";
import { fetchPublicEmbedNews } from "@/lib/news/public-news-server";
import { fetchPublicEmbedOpeningHours } from "@/lib/opening-hours/public-opening-hours-server";
import {
  createPublicReservation,
  fetchPublicEmbedRestaurant,
  loadPublicReservationForManage,
  updatePublicReservation,
  type PublicReservationCreateBody,
  type PublicReservationUpdateBody,
} from "@/lib/reservations/public-reservation-server";
import { fetchPublicEmbedReviews } from "@/lib/reviews/public-reviews-server";
import {
  authenticateRestaurantApiKey,
  handleRestaurantApiPreflight,
  restaurantApiJsonResponse,
} from "@/lib/api/restaurant-api-auth-server";
import type { RestaurantApiModuleId } from "@/lib/api/restaurant-api-modules";

const NO_CACHE =
  "private, no-cache, no-store, must-revalidate" as const;

export async function handleRestaurantApiV1Get(
  request: Request,
  module: RestaurantApiModuleId,
): Promise<Response> {
  const preflightOnly = handleRestaurantApiPreflight(request);
  if (preflightOnly) return preflightOnly;

  const authResult = await authenticateRestaurantApiKey(request, module);
  if (!authResult.ok) return authResult.response;

  const { auth } = authResult;
  const slug = auth.slug;

  if (module === "menu") {
    const result = await fetchPublicEmbedMenu(slug);
    if (!result.data) {
      return Response.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return restaurantApiJsonResponse(request, result.data, auth);
  }

  if (module === "reservation") {
    const result = await fetchPublicEmbedRestaurant(slug);
    if (!result.data) {
      return Response.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return restaurantApiJsonResponse(request, result.data, auth);
  }

  if (module === "reviews") {
    const result = await fetchPublicEmbedReviews(slug);
    if (!result.data) {
      return Response.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return restaurantApiJsonResponse(request, result.data, auth);
  }

  if (module === "news") {
    const result = await fetchPublicEmbedNews(slug);
    if (!result.data) {
      return Response.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return restaurantApiJsonResponse(request, result.data, auth, "private, no-cache, no-store, must-revalidate");
  }

  if (module === "events") {
    const result = await fetchPublicEmbedEvents(slug);
    if (!result.data) {
      return Response.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return restaurantApiJsonResponse(request, result.data, auth);
  }

  if (module === "gallery") {
    const result = await fetchPublicEmbedGallery(slug);
    if (!result.data) {
      return Response.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return restaurantApiJsonResponse(request, result.data, auth);
  }

  if (module === "opening_hours") {
    const result = await fetchPublicEmbedOpeningHours(slug);
    if (!result.data) {
      return Response.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return restaurantApiJsonResponse(request, result.data, auth);
  }

  return Response.json({ error: "invalid_module" }, { status: 400 });
}

/** POST /api/v1/reservation — öffentliche Buchung; Slug aus API-Key. */
export async function handleRestaurantApiV1ReservationCreate(
  request: Request,
): Promise<Response> {
  const preflightOnly = handleRestaurantApiPreflight(request);
  if (preflightOnly) return preflightOnly;

  const authResult = await authenticateRestaurantApiKey(request, "reservation");
  if (!authResult.ok) return authResult.response;

  const { auth } = authResult;
  const body = (await request.json().catch(() => ({}))) as PublicReservationCreateBody;
  const result = await createPublicReservation({
    ...body,
    slug: auth.slug,
  });
  if (!result.data) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return restaurantApiJsonResponse(request, result.data, auth, NO_CACHE);
}

/**
 * POST /api/v1/reservation/manage — laden (`action: load`) oder ändern.
 * Slug aus API-Key; PIN + Reservierungsnummer im Body.
 */
export async function handleRestaurantApiV1ReservationManage(
  request: Request,
): Promise<Response> {
  const preflightOnly = handleRestaurantApiPreflight(request);
  if (preflightOnly) return preflightOnly;

  const authResult = await authenticateRestaurantApiKey(request, "reservation");
  if (!authResult.ok) return authResult.response;

  const { auth } = authResult;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
  } & PublicReservationUpdateBody;

  const action = body.action ?? "update";
  const reservationNumber = Number(body.reservation_number);
  const pin = body.pin?.trim() ?? "";

  if (!Number.isFinite(reservationNumber) || !pin) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (action === "load") {
    const result = await loadPublicReservationForManage(
      auth.slug,
      reservationNumber,
      pin,
    );
    if (!result.data) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    const { id: _id, dining_table_id: _t, ...guest } = result.data;
    return restaurantApiJsonResponse(
      request,
      { reservation: guest },
      auth,
      NO_CACHE,
    );
  }

  const result = await updatePublicReservation({
    ...body,
    slug: auth.slug,
    reservation_number: reservationNumber,
    pin,
  });
  if (!result.data) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return restaurantApiJsonResponse(request, result.data, auth, NO_CACHE);
}
