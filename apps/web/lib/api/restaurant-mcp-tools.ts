import type { RestaurantApiModuleId } from "@/lib/api/restaurant-api-modules";
import { RESTAURANT_API_MODULES } from "@/lib/api/restaurant-api-modules";

/** JSON Schema fragment for MCP tool `inputSchema`. */
export type RestaurantMcpJsonSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type RestaurantMcpToolDefinition = {
  name: string;
  title: string;
  description: string;
  /** API module that must be enabled on the key. */
  moduleId: RestaurantApiModuleId;
  /** Same published-restaurant rule as REST (purchase_orders is the exception). */
  requirePublished: boolean;
  inputSchema: RestaurantMcpJsonSchema;
};

const EMPTY_OBJECT_SCHEMA: RestaurantMcpJsonSchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

const RESERVATION_GUEST_PROPERTIES = {
  guest_first_name: {
    type: "string",
    description: "Vorname des Gastes",
  },
  guest_last_name: {
    type: "string",
    description: "Nachname des Gastes (Pflicht)",
  },
  guest_company: {
    type: ["string", "null"],
    description: "Firma (optional)",
  },
  guest_phone: {
    type: ["string", "null"],
    description: "Telefon — mind. ein Kontaktkanal nötig",
  },
  guest_email: {
    type: ["string", "null"],
    description: "E-Mail — mind. ein Kontaktkanal nötig",
  },
  party_size: {
    type: "integer",
    minimum: 1,
    description: "Personenanzahl",
  },
  starts_at: {
    type: "string",
    description: "Beginn ISO-8601 (UTC empfohlen)",
  },
  ends_at: {
    type: "string",
    description: "Ende ISO-8601 — oft starts_at + defaultDwellMinutes",
  },
  notify_email: {
    type: "boolean",
    description: "Benachrichtigung per E-Mail",
  },
  notify_whatsapp: {
    type: "boolean",
    description: "Benachrichtigung per WhatsApp",
  },
  terms_accepted: {
    type: "boolean",
    description: "Muss true sein",
  },
  guest_locale: {
    type: ["string", "null"],
    description: "Sprache im Buchungsformular (optional)",
  },
} as const;

function moduleLabel(id: RestaurantApiModuleId): string {
  return RESTAURANT_API_MODULES.find((m) => m.id === id)?.label ?? id;
}

function readTool(
  moduleId: RestaurantApiModuleId,
  name: string,
  extraDescription?: string,
): RestaurantMcpToolDefinition {
  const label = moduleLabel(moduleId);
  return {
    name,
    title: `${label} lesen`,
    description:
      extraDescription ??
      `Öffentliche ${label}-Daten des Restaurants (gleicher Inhalt wie GET /api/v1/${moduleId === "opening_hours" ? "opening-hours" : moduleId === "purchase_orders" ? "purchase-orders" : moduleId}).`,
    moduleId,
    requirePublished: moduleId !== "purchase_orders",
    inputSchema: EMPTY_OBJECT_SCHEMA,
  };
}

/**
 * MCP tools mirror the Public Restaurant API (/api/v1). Discovery is filtered
 * by the API key's `enabled_modules` — same scopes as REST.
 */
export const RESTAURANT_MCP_TOOLS: readonly RestaurantMcpToolDefinition[] = [
  readTool("menu", "get_menu"),
  readTool(
    "reservation",
    "get_reservation_config",
    "Öffentliche Buchungs-Konfiguration (Öffnungszeiten, Vorlauf, Dwell) — wie GET /api/v1/reservation.",
  ),
  readTool("reviews", "get_reviews"),
  readTool("news", "get_news"),
  readTool("events", "get_events"),
  readTool("gallery", "get_gallery"),
  readTool("opening_hours", "get_opening_hours"),
  {
    name: "get_purchase_orders",
    title: "Bestellungen lesen",
    description:
      "Einkaufsbestellungen lesen (opt-in am API-Key). Restaurant muss nicht veröffentlicht sein. Gleicher Inhalt wie GET /api/v1/purchase-orders.",
    moduleId: "purchase_orders",
    requirePublished: false,
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Einzelne Bestell-ID (optional)",
        },
        status: {
          type: "string",
          description:
            "Komma-getrennte Status-Filter: open, ordered, closed (optional)",
        },
        supplierId: {
          type: "string",
          description: "Lieferanten-ID (optional)",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "Seitengröße (default 50, max 100)",
        },
        offset: {
          type: "integer",
          minimum: 0,
          description: "Offset für Pagination (default 0)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_reservation",
    title: "Reservierung buchen",
    description:
      "Öffentliche Online-Reservierung anlegen — wie POST /api/v1/reservation. Restaurant kommt aus dem API-Key (kein Slug nötig).",
    moduleId: "reservation",
    requirePublished: true,
    inputSchema: {
      type: "object",
      properties: { ...RESERVATION_GUEST_PROPERTIES },
      required: [
        "guest_last_name",
        "party_size",
        "starts_at",
        "ends_at",
        "notify_email",
        "notify_whatsapp",
        "terms_accepted",
      ],
      additionalProperties: false,
    },
  },
  {
    name: "manage_reservation",
    title: "Reservierung verwalten",
    description:
      "Reservierung laden (action=load) oder ändern — wie POST /api/v1/reservation/manage. Braucht reservation_number + PIN.",
    moduleId: "reservation",
    requirePublished: true,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["load", "update"],
          description: "load = Gast-Ansicht laden; update = ändern (Default)",
        },
        reservation_number: {
          type: "integer",
          description: "Reservierungsnummer",
        },
        pin: {
          type: "string",
          description: "Gast-PIN",
        },
        ...RESERVATION_GUEST_PROPERTIES,
      },
      required: ["reservation_number", "pin"],
      additionalProperties: false,
    },
  },
] as const;

const TOOL_BY_NAME = new Map(
  RESTAURANT_MCP_TOOLS.map((tool) => [tool.name, tool] as const),
);

export function restaurantMcpToolByName(
  name: string,
): RestaurantMcpToolDefinition | null {
  return TOOL_BY_NAME.get(name) ?? null;
}

/** Tools visible to this key — same module scope as REST. */
export function restaurantMcpToolsForEnabledModules(
  enabledModules: readonly RestaurantApiModuleId[],
): RestaurantMcpToolDefinition[] {
  const allowed = new Set(enabledModules);
  return RESTAURANT_MCP_TOOLS.filter((tool) => allowed.has(tool.moduleId));
}

export function restaurantMcpToolListItems(
  enabledModules: readonly RestaurantApiModuleId[],
): Array<{
  name: string;
  title: string;
  description: string;
  inputSchema: RestaurantMcpJsonSchema;
}> {
  return restaurantMcpToolsForEnabledModules(enabledModules).map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}
