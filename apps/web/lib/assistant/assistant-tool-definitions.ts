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
          "Reservierung ändern: Status (set_status), Storno (cancel) oder Felder (edit: Uhrzeit/Datum/Personen/Tisch/Notiz/Name/Telefon). date_ymd = Lookup-Tag; new_date_ymd = neues Datum. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              description: "set_status | cancel | edit",
            },
            guest_name: { type: "string" },
            date_ymd: { type: "string", description: "Tag der bestehenden Reservierung (Lookup)" },
            new_date_ymd: { type: "string", description: "Neues Datum (edit)" },
            time_hm: { type: "string", description: "Neue Uhrzeit HH:mm (edit)" },
            party_size: { type: "integer", minimum: 1 },
            notes: { type: "string" },
            table: { type: "string", description: "Tischnummer oder -name" },
            clear_table: { type: "boolean" },
            guest_first_name: { type: "string" },
            guest_last_name: { type: "string" },
            guest_phone: { type: "string" },
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
        name: "delete_reservation",
        description:
          "Reservierung endgültig löschen. confirm immer false — UI bestätigt.",
        parameters: {
          type: "object",
          properties: {
            guest_name: { type: "string" },
            date_ymd: { type: "string" },
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
        name: "set_reservation_day_note",
        description:
          "Tagesnotiz für einen Service-Tag anlegen. Ohne date_ymd = heute. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            date_ymd: { type: "string" },
            body: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "resolve_reservation_change_request",
        description:
          "Gast-Änderungsanfrage annehmen (approve) oder ablehnen (decline). confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            decision: {
              type: "string",
              description: "approve | decline",
            },
            guest_name: { type: "string" },
            date_ymd: { type: "string" },
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

    {
      type: "function",
      function: {
        name: "upsert_contact",
        description:
          "Kontakt anlegen (mode=create) oder ändern (mode=update). Mind. E-Mail oder Telefon beim Anlegen. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            mode: { type: "string" },
            contact_id: { type: "string" },
            contact_name: { type: "string" },
            first_name: { type: "string" },
            last_name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            company: { type: "string" },
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
        name: "delete_contact",
        description: "Kontakt löschen. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            contact_id: { type: "string" },
            contact_name: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "read_contact_thread",
        description: "Nachrichten-Thread eines Kontakts lesen (kurze Liste).",
        parameters: {
          type: "object",
          properties: {
            contact_id: { type: "string" },
            contact_name: { type: "string" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "mark_contact_thread_read",
        description: "Kontakt-Thread als gelesen markieren. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            contact_id: { type: "string" },
            contact_name: { type: "string" },
            platform: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "reply_to_review",
        description:
          "Auf Bewertung antworten (platform=google|facebook|gwada). confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            platform: { type: "string" },
            review_id: { type: "string" },
            comment: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "mark_review_read",
        description: "Bewertung gelesen/ungelesen. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            platform: { type: "string" },
            review_id: { type: "string" },
            unread: { type: "boolean" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "upsert_news_post",
        description:
          "News-Entwurf speichern oder mit publish=true veröffentlichen. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            body: { type: "string" },
            publish: { type: "boolean" },
            platforms: { type: "array", items: { type: "string" } },
            post_id: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "upsert_event",
        description:
          "Event-Entwurf oder publish=true. Braucht title, date_ymd, time_hm. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            date_ymd: { type: "string" },
            time_hm: { type: "string" },
            location: { type: "string" },
            publish: { type: "boolean" },
            platforms: { type: "array", items: { type: "string" } },
            event_id: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "upsert_ingredient",
        description: "Zutat anlegen/ändern. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            mode: { type: "string" },
            name: { type: "string" },
            new_name: { type: "string" },
            unit: { type: "string" },
            current_stock: { type: "number" },
            ingredient_id: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_purchase_order",
        description:
          "Bestellung mit Positionen anlegen. lines=[{ingredient,quantity,unit?}]. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            supplier: { type: "string" },
            lines: { type: "array", items: { type: "object" } },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_staff",
        description: "Mitarbeiter anlegen. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            given_name: { type: "string" },
            family_name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "delete_staff",
        description: "Mitarbeiter löschen. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            staff_id: { type: "string" },
            name: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "upsert_staff_shift",
        description:
          "Schicht planen/ändern (date_ymd, start_hm, end_hm, Mitarbeiter). confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            staff_id: { type: "string" },
            name: { type: "string" },
            date_ymd: { type: "string" },
            start_hm: { type: "string" },
            end_hm: { type: "string" },
            shift_id: { type: "string" },
            label: { type: "string" },
            note: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "delete_staff_shift",
        description: "Geplante Schicht löschen. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            shift_id: { type: "string" },
            name: { type: "string" },
            date_ymd: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_staff_todos",
        description: "Offene Checklisten/ToDos listen.",
        parameters: {
          type: "object",
          properties: { restaurant_name: { type: "string" } },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "upsert_staff_todo",
        description: "ToDo/Checkliste anlegen oder ändern. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            todo_id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            priority: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_documents",
        description: "Dokumente listen/suchen.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "add_document_note",
        description: "Notiz an Dokument. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            document_id: { type: "string" },
            body: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_guides",
        description: "Anleitungen listen/suchen.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_compliance",
        description: "Eigenkontrollen listen.",
        parameters: {
          type: "object",
          properties: { restaurant_name: { type: "string" } },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_compliance_record",
        description: "Eigenkontrolle anlegen. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            note: { type: "string" },
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
        name: "delete_menu_item",
        description: "Gericht löschen. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
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
        name: "upsert_menu_category",
        description: "Speisekarten-Kategorie anlegen/ändern. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            category_id: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "upsert_menu_tag",
        description: "Menü-Tag anlegen. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "upsert_menu_allergen",
        description: "Allergen anlegen. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_cash_book_entry",
        description:
          "Kassenbuch-Eintrag (direction income|expense, amount, category?). confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            direction: { type: "string" },
            amount: { type: "number" },
            category: { type: "string" },
            note: { type: "string" },
            date_ymd: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_restaurant_stammdaten",
        description:
          "Restaurant-Stammdaten patchen (name, phone, email, street, city, postal_code). Keine Secrets. confirm immer false.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            phone: { type: "string" },
            email: { type: "string" },
            street: { type: "string" },
            city: { type: "string" },
            postal_code: { type: "string" },
            confirm: { type: "boolean" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
  ];
