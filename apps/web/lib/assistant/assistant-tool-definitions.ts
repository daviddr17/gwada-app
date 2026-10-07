import type OpenAI from "openai";

/** OpenAI/Grok tool schemas for the restaurant assistant. */
export const ASSISTANT_TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] =
  [
    {
      type: "function",
      function: {
        name: "count_reservations",
        description:
          "Zählt Reservierungen und Gäste. Ohne Datum gilt heute. Keine Gästeliste.",
        parameters: {
          type: "object",
          properties: {
            start_ymd: { type: "string" },
            end_ymd: { type: "string" },
            date_ymd: { type: "string" },
            scope: { type: "string" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "service_today",
        description:
          "Service: Zählung, kurze Liste (≤8) oder ein Gast per Name. Ohne Datum = heute.",
        parameters: {
          type: "object",
          properties: {
            mode: { type: "string" },
            date_ymd: { type: "string" },
            guest_name: { type: "string" },
            scope: { type: "string" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_reservation",
        description:
          "Reservierung anlegen. Fehlende Felder → ask. confirm immer false (UI bestätigt).",
        parameters: {
          type: "object",
          properties: {
            date_ymd: { type: "string" },
            time_hm: { type: "string" },
            party_size: { type: "integer", minimum: 1 },
            guest_first_name: { type: "string" },
            guest_last_name: { type: "string" },
            guest_phone: { type: "string" },
            notes: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_reservation",
        description:
          "Reservierungsstatus ändern oder stornieren (action=cancel). confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            action: { type: "string", description: "set_status | cancel" },
            guest_name: { type: "string" },
            date_ymd: { type: "string" },
            status_code: {
              type: "string",
              description: "confirmed | pending | cancelled | no_show | …",
            },
            reservation_id: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_restaurant_rules",
        description: "Öffnungszeiten und Reservierungs-Einstellungen lesen.",
        parameters: {
          type: "object",
          properties: {
            scope: { type: "string" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_opening_hours",
        description:
          "Öffnungszeiten ändern (Wochentage/Ausnahmen). confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            days: { type: "array", items: { type: "object" } },
            exceptions: { type: "array", items: { type: "object" } },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "sync_platforms",
        description:
          "Öffnungszeiten zu Google/Facebook und/oder Bewertungen synchronisieren. confirm immer false — UI bestätigt. Keine neuen OAuth-Verbindungen.",
        parameters: {
          type: "object",
          properties: {
            scope: { type: "string" },
            platforms: { type: "array", items: { type: "string" } },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "search_menu",
        description:
          "Speisekarte: Anzahl, Suche nach Gericht, kurze Liste. mode=count|list|one.",
        parameters: {
          type: "object",
          properties: {
            mode: { type: "string" },
            name: { type: "string" },
            only_active: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "set_menu_item_active",
        description:
          "Gericht aktivieren/deaktivieren. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            active: { type: "boolean" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "upsert_menu_item",
        description:
          "Gericht anlegen (mode=create) oder ändern (mode=update), inkl. Rezept aus Bestandszutaten [{ingredient, amount}]. confirm immer false — UI fragt „Jetzt umsetzen?“.",
        parameters: {
          type: "object",
          properties: {
            mode: { type: "string", description: "create | update" },
            name: { type: "string", description: "Gerichtsname (bei update: Suche)" },
            new_name: { type: "string" },
            description: { type: "string" },
            price: { type: "number" },
            category: { type: "string", description: "Kategoriename" },
            active: { type: "boolean" },
            recipe: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  ingredient: { type: "string" },
                  amount: { type: "number" },
                },
              },
            },
            replace_recipe: {
              type: "boolean",
              description: "true = Rezept leeren/ersetzen",
            },
            menu_item_id: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_staff",
        description:
          "Mitarbeiterstammdaten ändern (Name, E-Mail, Telefon, Adresse, aktiv). confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            staff_id: { type: "string" },
            given_name: { type: "string" },
            family_name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            city: { type: "string" },
            postal_code: { type: "string" },
            address_line1: { type: "string" },
            birth_date: { type: "string" },
            is_active: { type: "boolean" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "send_contact_message",
        description:
          "Nachricht an Kontakt senden (whatsapp|email|gwada|facebook|instagram). confirm immer false — nie still senden.",
        parameters: {
          type: "object",
          properties: {
            contact_name: { type: "string" },
            contact_id: { type: "string" },
            body: { type: "string" },
            channel: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "stock",
        description:
          "Bestand: leere Zutaten, offene Bestellungen, eine Zutat per Name.",
        parameters: {
          type: "object",
          properties: {
            mode: { type: "string" },
            name: { type: "string" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "adjust_ingredient_stock",
        description:
          "Bestand einer Zutat setzen. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            current_stock: { type: "number" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "purchase_orders",
        description: "Bestellungen: Anzahl und kurze Liste (Status-Filter).",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", description: "open | ordered | received | all" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "set_purchase_order_status",
        description:
          "Bestellstatus setzen (open/ordered/received/cancelled). confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            supplier: { type: "string" },
            order_id: { type: "string" },
            status: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "staff_on_shift",
        description: "Wer gerade eingestempelt ist.",
        parameters: {
          type: "object",
          properties: {
            mode: { type: "string" },
            name: { type: "string" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "staff_shifts",
        description: "Geplante Schichten für einen Tag (Standard: heute).",
        parameters: {
          type: "object",
          properties: {
            date_ymd: { type: "string" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "search_contacts",
        description: "Kontakte zählen oder per Name/E-Mail/Telefon suchen.",
        parameters: {
          type: "object",
          properties: {
            mode: { type: "string" },
            name: { type: "string" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "inbox_summary",
        description: "Nachrichten: eingehende Anzahl und letzte 7 Tage.",
        parameters: {
          type: "object",
          properties: { restaurant_name: { type: "string" } },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "reviews_summary",
        description: "Bewertungen: Plattform-Übersicht und kurze aktuelle Liste.",
        parameters: {
          type: "object",
          properties: { restaurant_name: { type: "string" } },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "content_feed",
        description: "News- und Event-Zähler inkl. Plattform-Sync-Status.",
        parameters: {
          type: "object",
          properties: {
            kind: { type: "string", description: "news | events | all" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "open_amounts",
        description: "Offene/überfällige Rechnungsbeträge.",
        parameters: {
          type: "object",
          properties: {
            mode: { type: "string" },
            name: { type: "string" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "restaurant_stats",
        description:
          "Restaurant-Statistiken/Insights (Reservierungen, Reviews, Nachrichten, Nutzung, Plattformen). period_days 7|30|90 oder start_ymd/end_ymd.",
        parameters: {
          type: "object",
          properties: {
            period_days: { type: "integer" },
            start_ymd: { type: "string" },
            end_ymd: { type: "string" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "search_handbook",
        description: "Gwada-Benutzerhandbuch durchsuchen.",
        parameters: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      },
    },
  ];
