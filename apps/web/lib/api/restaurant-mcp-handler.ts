import "server-only";

import {
  authenticateRestaurantApiKey,
  buildRestaurantApiCorsHeaders,
  handleRestaurantApiPreflight,
  type AuthenticatedRestaurantApiKey,
} from "@/lib/api/restaurant-api-auth-server";
import {
  restaurantMcpToolByName,
  restaurantMcpToolListItems,
} from "@/lib/api/restaurant-mcp-tools";
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
  fetchPurchaseOrdersForApi,
  parsePurchaseOrdersApiQuery,
} from "@/lib/inventory/purchase-orders-api-server";
import { recordApiUsageFireAndForget } from "@/lib/insights/restaurant-usage-server";

/** Protocol versions we accept for Streamable HTTP MCP clients. */
export const RESTAURANT_MCP_PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
] as const;

export const RESTAURANT_MCP_DEFAULT_PROTOCOL_VERSION =
  RESTAURANT_MCP_PROTOCOL_VERSIONS[0];

export const RESTAURANT_MCP_SERVER_INFO = {
  name: "gwada-restaurant",
  title: "Gwada Restaurant API",
  version: "1.0.0",
} as const;

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: unknown;
  id?: JsonRpcId;
  method?: unknown;
  params?: unknown;
};

type McpSession = {
  auth: AuthenticatedRestaurantApiKey;
  isPublished: boolean;
};

function isNotification(message: JsonRpcRequest): boolean {
  return !("id" in message) || message.id === undefined;
}

function jsonRpcResult(id: JsonRpcId, result: unknown): unknown {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): unknown {
  return {
    jsonrpc: "2.0",
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

function textToolResult(payload: unknown, isError = false): unknown {
  return {
    content: [
      {
        type: "text",
        text:
          typeof payload === "string"
            ? payload
            : JSON.stringify(payload, null, 2),
      },
    ],
    isError,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stringOrNull(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return String(value);
}

function boolOrFalse(value: unknown): boolean {
  return value === true;
}

async function executeRestaurantMcpTool(
  session: McpSession,
  name: string,
  args: Record<string, unknown>,
): Promise<{ ok: true; result: unknown } | { ok: false; message: string }> {
  const tool = restaurantMcpToolByName(name);
  if (!tool) {
    return { ok: false, message: `Unknown tool: ${name}` };
  }
  if (!session.auth.enabledModules.includes(tool.moduleId)) {
    return { ok: false, message: "module_not_enabled" };
  }
  if (tool.requirePublished && !session.isPublished) {
    return { ok: false, message: "restaurant_not_published" };
  }

  recordApiUsageFireAndForget({
    restaurantId: session.auth.restaurantId,
    moduleId: tool.moduleId,
  });

  const slug = session.auth.slug;

  switch (tool.name) {
    case "get_menu": {
      const result = await fetchPublicEmbedMenu(slug);
      if (!result.data) return { ok: false, message: result.error };
      return { ok: true, result: result.data };
    }
    case "get_reservation_config": {
      const result = await fetchPublicEmbedRestaurant(slug);
      if (!result.data) return { ok: false, message: result.error };
      return { ok: true, result: result.data };
    }
    case "get_reviews": {
      const result = await fetchPublicEmbedReviews(slug);
      if (!result.data) return { ok: false, message: result.error };
      return { ok: true, result: result.data };
    }
    case "get_news": {
      const result = await fetchPublicEmbedNews(slug);
      if (!result.data) return { ok: false, message: result.error };
      return { ok: true, result: result.data };
    }
    case "get_events": {
      const result = await fetchPublicEmbedEvents(slug);
      if (!result.data) return { ok: false, message: result.error };
      return { ok: true, result: result.data };
    }
    case "get_gallery": {
      const result = await fetchPublicEmbedGallery(slug);
      if (!result.data) return { ok: false, message: result.error };
      return { ok: true, result: result.data };
    }
    case "get_opening_hours": {
      const result = await fetchPublicEmbedOpeningHours(slug);
      if (!result.data) return { ok: false, message: result.error };
      return { ok: true, result: result.data };
    }
    case "get_purchase_orders": {
      const url = new URL("https://gwada.app/api/v1/purchase-orders");
      for (const key of ["id", "status", "supplierId", "limit", "offset"] as const) {
        const value = args[key];
        if (value == null || value === "") continue;
        url.searchParams.set(key, String(value));
      }
      const parsed = parsePurchaseOrdersApiQuery(url);
      if (!parsed.ok) return { ok: false, message: parsed.error };
      const result = await fetchPurchaseOrdersForApi(
        session.auth.restaurantId,
        parsed.query,
      );
      if (!result.ok) return { ok: false, message: result.error };
      return { ok: true, result: result.data };
    }
    case "create_reservation": {
      const body = {
        slug,
        guest_first_name: String(args.guest_first_name ?? ""),
        guest_last_name: String(args.guest_last_name ?? ""),
        guest_company: stringOrNull(args.guest_company),
        guest_phone: stringOrNull(args.guest_phone),
        guest_email: stringOrNull(args.guest_email),
        party_size: Number(args.party_size),
        starts_at: String(args.starts_at ?? ""),
        ends_at: String(args.ends_at ?? ""),
        notify_email: boolOrFalse(args.notify_email),
        notify_whatsapp: boolOrFalse(args.notify_whatsapp),
        terms_accepted: boolOrFalse(args.terms_accepted),
        guest_locale: stringOrNull(args.guest_locale),
      } satisfies PublicReservationCreateBody;
      const result = await createPublicReservation(body);
      if (!result.data) return { ok: false, message: result.error };
      return { ok: true, result: result.data };
    }
    case "manage_reservation": {
      const reservationNumber = Number(args.reservation_number);
      const pin = String(args.pin ?? "").trim();
      if (!Number.isFinite(reservationNumber) || !pin) {
        return { ok: false, message: "invalid_request" };
      }
      const action =
        typeof args.action === "string" ? args.action : "update";
      if (action === "load") {
        const result = await loadPublicReservationForManage(
          slug,
          reservationNumber,
          pin,
        );
        if (!result.data) return { ok: false, message: result.error };
        const { id: _id, dining_table_id: _t, ...guest } = result.data;
        return { ok: true, result: { reservation: guest } };
      }
      const body = {
        slug,
        reservation_number: reservationNumber,
        pin,
        guest_first_name: String(args.guest_first_name ?? ""),
        guest_last_name: String(args.guest_last_name ?? ""),
        guest_company: stringOrNull(args.guest_company),
        guest_phone: stringOrNull(args.guest_phone),
        guest_email: stringOrNull(args.guest_email),
        party_size: Number(args.party_size),
        starts_at: String(args.starts_at ?? ""),
        ends_at: String(args.ends_at ?? ""),
        notify_email: boolOrFalse(args.notify_email),
        notify_whatsapp: boolOrFalse(args.notify_whatsapp),
        terms_accepted: boolOrFalse(args.terms_accepted),
        guest_locale: stringOrNull(args.guest_locale),
      } satisfies PublicReservationUpdateBody;
      const result = await updatePublicReservation(body);
      if (!result.data) return { ok: false, message: result.error };
      return { ok: true, result: result.data };
    }
    default:
      return { ok: false, message: `Unknown tool: ${name}` };
  }
}

function negotiateProtocolVersion(requested: unknown): string {
  if (
    typeof requested === "string" &&
    (RESTAURANT_MCP_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
  ) {
    return requested;
  }
  return RESTAURANT_MCP_DEFAULT_PROTOCOL_VERSION;
}

async function handleJsonRpcMessage(
  session: McpSession,
  message: JsonRpcRequest,
): Promise<{ kind: "response"; body: unknown } | { kind: "ack" } | { kind: "empty" }> {
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    const id = (message.id as JsonRpcId) ?? null;
    return {
      kind: "response",
      body: jsonRpcError(id, -32600, "Invalid Request"),
    };
  }

  const method = message.method;
  const params = asRecord(message.params);
  const notification = isNotification(message);
  const id = notification ? null : (message.id as JsonRpcId);

  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return { kind: "ack" };
  }

  if (notification) {
    return { kind: "empty" };
  }

  if (method === "initialize") {
    const protocolVersion = negotiateProtocolVersion(params.protocolVersion);
    return {
      kind: "response",
      body: jsonRpcResult(id, {
        protocolVersion,
        capabilities: {
          tools: {},
        },
        serverInfo: RESTAURANT_MCP_SERVER_INFO,
        instructions:
          "Gwada Restaurant MCP — gleiche API-Schlüssel und Modul-Scopes wie /api/v1. tools/list liefert nur freigeschaltete Module.",
      }),
    };
  }

  if (method === "ping") {
    return { kind: "response", body: jsonRpcResult(id, {}) };
  }

  if (method === "tools/list") {
    recordApiUsageFireAndForget({
      restaurantId: session.auth.restaurantId,
      moduleId: "mcp",
    });
    return {
      kind: "response",
      body: jsonRpcResult(id, {
        tools: restaurantMcpToolListItems(session.auth.enabledModules),
      }),
    };
  }

  if (method === "tools/call") {
    const name = typeof params.name === "string" ? params.name : "";
    if (!name) {
      return {
        kind: "response",
        body: jsonRpcError(id, -32602, "Invalid params", {
          reason: "missing_tool_name",
        }),
      };
    }
    const args = asRecord(params.arguments);
    const executed = await executeRestaurantMcpTool(session, name, args);
    if (!executed.ok) {
      return {
        kind: "response",
        body: jsonRpcResult(id, textToolResult({ error: executed.message }, true)),
      };
    }
    return {
      kind: "response",
      body: jsonRpcResult(id, textToolResult({ data: executed.result })),
    };
  }

  return {
    kind: "response",
    body: jsonRpcError(id, -32601, "Method not found", { method }),
  };
}

function mcpResponseHeaders(
  request: Request,
  auth: AuthenticatedRestaurantApiKey | null,
  protocolVersion: string,
): Headers {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "private, no-cache, no-store, must-revalidate",
    "MCP-Protocol-Version": protocolVersion,
  });
  const cors = buildRestaurantApiCorsHeaders(
    request,
    auth?.allowedOrigins ?? [],
  );
  for (const [key, value] of Object.entries(cors)) {
    headers.set(key, value);
  }
  return headers;
}

/**
 * Streamable HTTP MCP endpoint handler for `/api/v1/mcp`.
 * Auth: same Bearer `gwada_sk_live_…` keys; tools filtered by `enabled_modules`.
 */
export async function handleRestaurantMcpHttp(
  request: Request,
): Promise<Response> {
  const preflight = handleRestaurantApiPreflight(request);
  if (preflight) return preflight;

  if (request.method === "GET") {
    return new Response(
      JSON.stringify({
        error: "method_not_allowed",
        hint: "POST JSON-RPC (initialize, tools/list, tools/call) with Authorization: Bearer gwada_sk_live_…",
      }),
      {
        status: 405,
        headers: {
          Allow: "POST, OPTIONS",
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  if (request.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  const authResult = await authenticateRestaurantApiKey(request, {
    requirePublished: false,
    skipUsageRecording: true,
  });
  if (!authResult.ok) return authResult.response;

  const session: McpSession = {
    auth: authResult.auth,
    isPublished: authResult.isPublished,
  };

  const headerVersion = request.headers.get("mcp-protocol-version")?.trim();
  const protocolVersion =
    headerVersion &&
    (RESTAURANT_MCP_PROTOCOL_VERSIONS as readonly string[]).includes(
      headerVersion,
    )
      ? headerVersion
      : RESTAURANT_MCP_DEFAULT_PROTOCOL_VERSION;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify(jsonRpcError(null, -32700, "Parse error")),
      {
        status: 400,
        headers: mcpResponseHeaders(request, session.auth, protocolVersion),
      },
    );
  }

  if (Array.isArray(body)) {
    if (body.length === 0) {
      return new Response(
        JSON.stringify(jsonRpcError(null, -32600, "Invalid Request")),
        {
          status: 400,
          headers: mcpResponseHeaders(request, session.auth, protocolVersion),
        },
      );
    }
    const responses: unknown[] = [];
    for (const item of body) {
      const handled = await handleJsonRpcMessage(
        session,
        (item ?? {}) as JsonRpcRequest,
      );
      if (handled.kind === "response") responses.push(handled.body);
    }
    if (responses.length === 0) {
      return new Response(null, {
        status: 202,
        headers: mcpResponseHeaders(request, session.auth, protocolVersion),
      });
    }
    return new Response(JSON.stringify(responses), {
      status: 200,
      headers: mcpResponseHeaders(request, session.auth, protocolVersion),
    });
  }

  const handled = await handleJsonRpcMessage(
    session,
    (body ?? {}) as JsonRpcRequest,
  );
  if (handled.kind === "ack" || handled.kind === "empty") {
    return new Response(null, {
      status: 202,
      headers: mcpResponseHeaders(request, session.auth, protocolVersion),
    });
  }

  return new Response(JSON.stringify(handled.body), {
    status: 200,
    headers: mcpResponseHeaders(request, session.auth, protocolVersion),
  });
}
