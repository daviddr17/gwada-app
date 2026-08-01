import type { RestaurantApiModuleId } from "@/lib/api/restaurant-api-modules";

export type ApiModuleGuideSection = {
  heading: string;
  body?: string;
  items?: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
  code?: string;
};

export type ApiModuleGuide = {
  moduleId: RestaurantApiModuleId;
  title: string;
  description: string;
  intro: string[];
  /** Path segment under /api/v1/ */
  path: string;
  methods: string[];
  cacheNote: string;
  sections: ApiModuleGuideSection[];
  tips?: string[];
  related?: { label: string; href: string }[];
};

export const API_READ_MODULE_GUIDES: Record<
  Exclude<RestaurantApiModuleId, "reservation">,
  ApiModuleGuide
> = {
  menu: {
    moduleId: "menu",
    title: "Speisekarte",
    description:
      "Aktive Gerichte, Kategorien, Tags und Optionsgruppen als JSON — gleiche Datenbasis wie das Speisekarten-Embed.",
    intro: [
      "Liest die veröffentlichte Speisekarte des Restaurants, das am API-Schlüssel hängt. Es gibt keine Query-Parameter — die Antwort enthält nur aktive Kategorien und Gerichte im aktuell gültigen Datumsfenster.",
      "Modul-ID im Schlüssel: menu. Restaurant muss veröffentlicht sein.",
    ],
    path: "menu",
    methods: ["GET", "OPTIONS"],
    cacheNote:
      "Cache-Control: public, s-maxage=60, stale-while-revalidate=300",
    sections: [
      {
        heading: "Endpunkt",
        code: `curl -s "https://gwada.app/api/v1/menu" \\
  -H "Authorization: Bearer gwada_sk_live_…" \\
  -H "Accept: application/json"`,
      },
      {
        heading: "Antwort (Auszug)",
        code: `{
  "data": {
    "restaurantId": "uuid",
    "name": "Restaurant Name",
    "slug": "mein-slug",
    "accentHex": "#c45c26",
    "currencyCode": "EUR",
    "mainCategories": [
      { "id": "main-1", "name": "Speisen", "active": true }
    ],
    "categories": [
      {
        "id": "cat-1",
        "name": "Vorspeisen",
        "active": true,
        "mainCategoryId": "main-1"
      }
    ],
    "items": [
      {
        "id": "uuid",
        "name": "Vorspeise",
        "description": "Kurztext",
        "price": 12.5,
        "category": "cat-1",
        "imageUrl": "https://…",
        "tags": ["tag-id", "allergen-id"],
        "active": true,
        "listNumber": 1,
        "recipe": null,
        "optionGroupIds": ["group-id"],
        "availableFrom": "2026-01-01",
        "availableTo": null
      }
    ],
    "tagDefinitions": [
      {
        "id": "tag-id",
        "name": "Vegan",
        "active": true,
        "backgroundColor": "#64748b"
      }
    ],
    "optionGroups": [
      {
        "id": "group-id",
        "name": "Beilagen",
        "active": true,
        "minSelect": 0,
        "maxSelect": 2,
        "choices": [
          {
            "id": "choice-id",
            "name": "Pommes",
            "priceDelta": 2.5,
            "active": true
          }
        ]
      }
    ],
    "guestOrderingEnabled": false
  }
}`,
      },
      {
        heading: "Wichtige Felder",
        table: {
          headers: ["Feld", "Bedeutung"],
          rows: [
            ["mainCategories / categories", "Hierarchie der Speisekarte"],
            ["items[].category", "ID der Kategorie"],
            ["items[].tags", "Tag- und Allergen-IDs (gemergt)"],
            ["items[].optionGroupIds", "Verknüpfte Optionsgruppen"],
            ["items[].availableFrom / availableTo", "Optionales Sichtbarkeitsfenster (Datum)"],
            ["optionGroups[].choices[].priceDelta", "Aufpreis zur Basis"],
            ["currencyCode", "Währung für Preise"],
            ["guestOrderingEnabled", "Derzeit immer false (kein Gast-Bestellen über API)"],
          ],
        },
      },
      {
        heading: "Hinweise",
        items: [
          "Nur aktive Einträge im gültigen Zeitraum — Entwürfe und abgelaufene Gerichte fehlen",
          "Keine Pagination und keine Filter-Query auf /api/v1/menu",
          "Gleiche Struktur wie das öffentliche Speisekarten-Embed",
        ],
      },
    ],
    tips: [
      "Preise sind Zahlen (nicht formatierte Strings) — Formatierung übernimmt der Client anhand currencyCode.",
      "Tags auflösen über tagDefinitions[].id → name / backgroundColor.",
    ],
    related: [
      { label: "Handbuch Speisekarte", href: "/docs/handbuch/speisekarte" },
      { label: "Authentifizierung", href: "/docs/api/authentication" },
      { label: "Rate Limits", href: "/docs/api/rate-limits" },
    ],
  },

  reviews: {
    moduleId: "reviews",
    title: "Bewertungen",
    description:
      "Öffentliche Bewertungen und Zusammenfassung über verbundene Plattformen.",
    intro: [
      "Liefert sichtbare Bewertungen (Gwada, Google, Facebook, TripAdvisor — je nach Verbindung) plus Summary mit Durchschnitt, Median und Sterne-Verteilung.",
      "Modul-ID im Schlüssel: reviews. Auf v1 gibt es keine page-/paginate-Parameter — die Antwort enthält den öffentlichen Feed ohne Pagination-Objekt.",
    ],
    path: "reviews",
    methods: ["GET", "OPTIONS"],
    cacheNote:
      "Cache-Control: public, s-maxage=60, stale-while-revalidate=300",
    sections: [
      {
        heading: "Endpunkt",
        code: `curl -s "https://gwada.app/api/v1/reviews" \\
  -H "Authorization: Bearer gwada_sk_live_…" \\
  -H "Accept: application/json"`,
      },
      {
        heading: "Antwort (Auszug)",
        code: `{
  "data": {
    "restaurantId": "uuid",
    "name": "Restaurant Name",
    "slug": "mein-slug",
    "accentHex": "#c45c26",
    "viewMode": "grid",
    "connectedPlatforms": ["gwada", "google"],
    "reviews": [
      {
        "id": "rev-1",
        "platform": "gwada",
        "rating": 5,
        "comment": "Sehr gut!",
        "authorName": "Anna",
        "createdAt": "2026-07-01T12:00:00.000Z",
        "reply": null
      }
    ],
    "summary": {
      "count": 10,
      "average": 4.5,
      "median": 5,
      "distribution": { "1": 0, "2": 0, "3": 1, "4": 2, "5": 7 }
    }
  }
}`,
      },
      {
        heading: "Wichtige Felder",
        table: {
          headers: ["Feld", "Bedeutung"],
          rows: [
            ["connectedPlatforms", "Plattformen mit Daten in diesem Feed"],
            ["reviews[].platform", "gwada | google | facebook | tripadvisor"],
            ["reviews[].rating", "Sterne (typisch 1–5)"],
            ["reviews[].reply", "Öffentliche Antwort, falls vorhanden"],
            ["summary.average / median", "Kennzahlen über den sichtbaren Satz"],
            ["summary.distribution", "Anzahl je Sterne-Stufe als String-Keys „1“…„5“"],
            ["viewMode", "Empfohlene Darstellung aus Embed-Einstellungen (z. B. grid)"],
          ],
        },
      },
      {
        heading: "Hinweise",
        items: [
          "Nur öffentlich sichtbare Bewertungen — interne Status bleiben draußen",
          "Keine Query-Parameter auf /api/v1/reviews",
          "Nicht verbundene Plattformen erscheinen nicht in connectedPlatforms",
        ],
      },
    ],
    related: [
      { label: "Handbuch Bewertungen", href: "/docs/handbuch/bewertungen" },
      { label: "Authentifizierung", href: "/docs/api/authentication" },
      { label: "Rate Limits", href: "/docs/api/rate-limits" },
    ],
  },

  news: {
    moduleId: "news",
    title: "News",
    description:
      "Öffentlicher News-Feed inkl. Medien, Pins und Story-Rings.",
    intro: [
      "Liefert veröffentlichte Beiträge und Story-Rings für das Restaurant am API-Schlüssel. Anzahl und Plattform-Mix folgen den News-Embed-Einstellungen (u. a. embed_max_items, Standard 24).",
      "Modul-ID im Schlüssel: news. Die Antwort wird bewusst nicht öffentlich gecacht.",
    ],
    path: "news",
    methods: ["GET", "OPTIONS"],
    cacheNote:
      "Cache-Control: private, no-cache, no-store, must-revalidate",
    sections: [
      {
        heading: "Endpunkt",
        code: `curl -s "https://gwada.app/api/v1/news" \\
  -H "Authorization: Bearer gwada_sk_live_…" \\
  -H "Accept: application/json"`,
      },
      {
        heading: "Antwort (Auszug)",
        code: `{
  "data": {
    "restaurantId": "uuid",
    "name": "Restaurant Name",
    "slug": "mein-slug",
    "accentHex": "#c45c26",
    "viewMode": "list",
    "connectedPlatforms": ["gwada", "instagram"],
    "items": [
      {
        "id": "post-1",
        "platform": "gwada",
        "source": "gwada",
        "postId": null,
        "title": "Tagesgericht",
        "body": "Heute: …",
        "media": [
          {
            "id": "m1",
            "kind": "image",
            "url": "https://…",
            "thumbUrl": "https://…",
            "storagePath": null,
            "mimeType": "image/jpeg",
            "sortOrder": 0,
            "width": null,
            "height": null,
            "blurDataUrl": null
          }
        ],
        "createdAt": "2026-07-01T10:00:00.000Z",
        "publishedAt": "2026-07-01T10:00:00.000Z",
        "scheduledAt": null,
        "status": "published",
        "canEdit": false,
        "canDelete": false,
        "externalUrl": null,
        "insights": { "likes": 0, "comments": 0, "views": 0, "shares": 0 },
        "authorName": null,
        "isPinned": false
      }
    ],
    "storyRings": [
      {
        "id": "ring-1",
        "platform": "instagram",
        "title": "Stories",
        "coverUrl": "https://…",
        "slideIds": ["slide-1"],
        "slides": [
          {
            "id": "slide-1",
            "platform": "instagram",
            "kind": "image",
            "url": "https://…",
            "caption": null,
            "externalUrl": "https://…",
            "publishedAt": "2026-07-01T09:00:00.000Z",
            "expiresAt": "2026-07-02T09:00:00.000Z"
          }
        ]
      }
    ],
    "showAllPlatformFilter": true
  }
}`,
      },
      {
        heading: "Plattformen",
        body: "Mögliche Werte in platform / connectedPlatforms:",
        items: [
          "gwada",
          "facebook",
          "instagram",
          "google_business",
          "whatsapp_channel",
        ],
      },
      {
        heading: "Wichtige Felder",
        table: {
          headers: ["Feld", "Bedeutung"],
          rows: [
            ["items", "Feed-Beiträge (gepinnt zuerst, dann chronologisch)"],
            ["items[].media", "Bilder/Videos zum Beitrag"],
            ["items[].externalUrl", "Link zur Original-Plattform, falls vorhanden"],
            ["storyRings", "Story-Gruppen mit slides[]"],
            ["showAllPlatformFilter", "Ob der Embed-Chip „Alle“ vorgesehen ist"],
            ["viewMode", "Empfohlene Ansicht aus Einstellungen (list/grid)"],
          ],
        },
      },
      {
        heading: "Hinweise",
        items: [
          "Keine Query-Parameter — Filterung nach Plattform macht der Client",
          "Max. Einträge über News → Einstellungen (embed_max_items, 1–100)",
          "canEdit / canDelete sind in der Public API immer false",
        ],
      },
    ],
    tips: [
      "Wegen no-store solltest du selbst sinnvoll cachen (z. B. kurz serverseitig), wenn du oft pollst.",
      "Story-Rings können unabhängig vom Feed-Items leer sein.",
    ],
    related: [
      { label: "Handbuch News", href: "/docs/handbuch/news" },
      { label: "Authentifizierung", href: "/docs/api/authentication" },
      { label: "Rate Limits", href: "/docs/api/rate-limits" },
    ],
  },

  events: {
    moduleId: "events",
    title: "Events",
    description:
      "Kommende und vergangene Veranstaltungen für Profil und Embed.",
    intro: [
      "Liefert Events des Restaurants am API-Schlüssel — aufgeteilt in items (kommend inkl. kurzer Grace-Periode) und pastItems (vergangen). Beide Listen sind auf embed_max_items begrenzt (Standard 24).",
      "Modul-ID im Schlüssel: events.",
    ],
    path: "events",
    methods: ["GET", "OPTIONS"],
    cacheNote:
      "Cache-Control: public, s-maxage=60, stale-while-revalidate=300",
    sections: [
      {
        heading: "Endpunkt",
        code: `curl -s "https://gwada.app/api/v1/events" \\
  -H "Authorization: Bearer gwada_sk_live_…" \\
  -H "Accept: application/json"`,
      },
      {
        heading: "Antwort (Auszug)",
        code: `{
  "data": {
    "restaurantId": "uuid",
    "name": "Restaurant Name",
    "slug": "mein-slug",
    "accentHex": "#c45c26",
    "viewMode": "list",
    "connectedPlatforms": ["gwada", "facebook"],
    "items": [
      {
        "id": "evt-1",
        "platform": "gwada",
        "source": "gwada",
        "eventId": null,
        "title": "Jazz Night",
        "description": "Live-Musik …",
        "coverUrl": "https://…",
        "coverStoragePath": null,
        "startAt": "2026-08-15T18:00:00.000Z",
        "endAt": "2026-08-15T22:00:00.000Z",
        "ticketUrl": "https://…",
        "location": "Innenhof",
        "status": "published",
        "canEdit": false,
        "canDelete": false,
        "externalUrl": null,
        "createdAt": "2026-07-01T10:00:00.000Z",
        "publishedAt": "2026-07-01T10:00:00.000Z",
        "isPinned": true
      }
    ],
    "pastItems": [],
    "showAllPlatformFilter": true
  }
}`,
      },
      {
        heading: "Plattformen",
        items: [
          "gwada",
          "facebook",
          "google_business",
          "instagram",
          "whatsapp_channel",
        ],
      },
      {
        heading: "Wichtige Felder",
        table: {
          headers: ["Feld", "Bedeutung"],
          rows: [
            ["items", "Kommende Events (ggf. gepinnt zuerst)"],
            ["pastItems", "Vergangene Events"],
            ["startAt / endAt", "ISO-8601; endAt optional"],
            ["ticketUrl / location", "Optionale Gast-Infos"],
            ["coverUrl", "Titelbild-URL"],
            ["externalUrl", "Link zur Plattform-Quelle"],
          ],
        },
      },
      {
        heading: "Hinweise",
        items: [
          "Keine Query-Parameter auf /api/v1/events",
          "Instagram/WhatsApp erscheinen oft als Ankündigungs-Kanäle — native Sync vor allem Gwada/Facebook/Google",
          "Max. Einträge über Events → Einstellungen steuern",
        ],
      },
    ],
    related: [
      { label: "Handbuch Events", href: "/docs/handbuch/events" },
      { label: "Authentifizierung", href: "/docs/api/authentication" },
      { label: "Rate Limits", href: "/docs/api/rate-limits" },
    ],
  },

  gallery: {
    moduleId: "gallery",
    title: "Galerie",
    description:
      "Öffentliche Galerie-Bilder, Highlights und Plattform-Liste.",
    intro: [
      "Liefert Galerie-Einträge und Highlights. Im Gegensatz zu manchen Public-Profile-Routen akzeptiert /api/v1/gallery keine page-/platform-Query — es wird die erste Seite mit pageSize 24 zurückgegeben.",
      "Modul-ID im Schlüssel: gallery. totalCount zeigt die Gesamtzahl; für weitere Seiten nutze derzeit das Embed/Public-Profile oder plane Client-seitig mit dem ersten Page-Satz.",
    ],
    path: "gallery",
    methods: ["GET", "OPTIONS"],
    cacheNote:
      "Cache-Control: public, s-maxage=60, stale-while-revalidate=300",
    sections: [
      {
        heading: "Endpunkt",
        code: `curl -s "https://gwada.app/api/v1/gallery" \\
  -H "Authorization: Bearer gwada_sk_live_…" \\
  -H "Accept: application/json"`,
      },
      {
        heading: "Antwort (Auszug)",
        code: `{
  "data": {
    "restaurantId": "uuid",
    "name": "Restaurant Name",
    "slug": "mein-slug",
    "accentHex": "#c45c26",
    "items": [
      {
        "id": "img-1",
        "platform": "gwada",
        "source": "gwada",
        "itemId": null,
        "title": "Ambiente",
        "caption": null,
        "category": "ambiente",
        "categoryLabel": "Ambiente",
        "mediaKind": "image",
        "previewUrl": "https://…",
        "fullUrl": "https://…",
        "thumbUrl": "https://…",
        "width": null,
        "height": null,
        "storagePath": null,
        "mimeType": null,
        "sizeBytes": null,
        "createdAt": "2026-07-01T10:00:00.000Z",
        "canEdit": false,
        "canDelete": false,
        "externalUrl": null,
        "externalId": "…",
        "parentExternalId": null,
        "isPinned": false
      }
    ],
    "highlights": [
      {
        "id": "hl-1",
        "platform": "gwada",
        "title": "Favoriten",
        "coverUrl": "https://…",
        "itemIds": ["img-1"],
        "items": []
      }
    ],
    "totalCount": 100,
    "availablePlatforms": ["gwada", "instagram"],
    "page": 1,
    "pageSize": 24
  }
}`,
      },
      {
        heading: "Plattformen",
        items: [
          "gwada",
          "facebook",
          "instagram",
          "google_business",
          "tripadvisor",
        ],
      },
      {
        heading: "Wichtige Felder",
        table: {
          headers: ["Feld", "Bedeutung"],
          rows: [
            ["items", "Galerie-Einträge der aktuellen Seite"],
            ["previewUrl / fullUrl / thumbUrl", "Bild-URLs für Anzeige"],
            ["category / categoryLabel", "Optionale Kategorie"],
            ["highlights", "Kuratierte Gwada-Highlights"],
            ["totalCount", "Gesamtanzahl über alle Seiten"],
            ["page / pageSize", "Aktuelle Seite — v1 liefert page=1, pageSize=24"],
            ["availablePlatforms", "Plattformen mit Galerie-Inhalten"],
          ],
        },
      },
      {
        heading: "Hinweise",
        items: [
          "Keine Query-Parameter — Plattform-Filter musst du clientseitig auf items anwenden",
          "Public-Payload entfernt interne Storage-Details wo möglich (storagePath oft null)",
          "Highlights referenzieren Gwada-Bilder über itemIds",
        ],
      },
    ],
    tips: [
      "Wenn totalCount > pageSize, plane Pagination über Public-Profile-API oder warte auf erweiterte v1-Query-Unterstützung — v1 allein liefert nur die erste Seite.",
    ],
    related: [
      { label: "Handbuch Galerie", href: "/docs/handbuch/galerie" },
      { label: "Authentifizierung", href: "/docs/api/authentication" },
      { label: "Rate Limits", href: "/docs/api/rate-limits" },
    ],
  },

  opening_hours: {
    moduleId: "opening_hours",
    title: "Öffnungszeiten",
    description:
      "Wochenraster, Küchenzeiten und Datums-Ausnahmen für Embeds und eigene UIs.",
    intro: [
      "Liefert die öffentlichen Öffnungszeiten des Restaurants am API-Schlüssel. Beachte: Die Payload nutzt restaurantName statt name/slug/restaurantId.",
      "Modul-ID im Schlüssel: opening_hours. URL-Pfad: /api/v1/opening-hours (Bindestrich).",
    ],
    path: "opening-hours",
    methods: ["GET", "OPTIONS"],
    cacheNote:
      "Cache-Control: public, s-maxage=60, stale-while-revalidate=300",
    sections: [
      {
        heading: "Endpunkt",
        code: `curl -s "https://gwada.app/api/v1/opening-hours" \\
  -H "Authorization: Bearer gwada_sk_live_…" \\
  -H "Accept: application/json"`,
      },
      {
        heading: "Antwort (Auszug)",
        code: `{
  "data": {
    "restaurantName": "Restaurant Name",
    "accentHex": "#c45c26",
    "weeklyHours": {
      "monday": { "closed": false, "open": "11:30", "close": "22:00" },
      "tuesday": { "closed": true },
      "wednesday": {
        "closed": false,
        "open": "11:30",
        "close": "22:00",
        "periods": [
          { "open": "11:30", "close": "14:30" },
          { "open": "17:30", "close": "22:00" }
        ]
      },
      "thursday": { "closed": false, "open": "11:30", "close": "22:00" },
      "friday": { "closed": false, "open": "11:30", "close": "23:00" },
      "saturday": { "closed": false, "open": "12:00", "close": "23:00" },
      "sunday": { "closed": true }
    },
    "kitchenHoursEnabled": true,
    "kitchenWeeklyHours": {
      "monday": { "closed": false, "open": "11:30", "close": "21:00" }
    },
    "dateExceptions": [
      {
        "id": "2026-12-24",
        "date": "2026-12-24",
        "closed": false,
        "open": "12:00",
        "close": "18:00",
        "periods": [{ "open": "12:00", "close": "18:00" }],
        "note": "Heiligabend"
      }
    ],
    "settings": {
      "embedFooterText": null,
      "embedShowKitchenHours": true,
      "embedShowExceptions": true
    }
  }
}`,
      },
      {
        heading: "Wichtige Felder",
        table: {
          headers: ["Feld", "Bedeutung"],
          rows: [
            ["weeklyHours", "Keys monday…sunday"],
            ["DayHours.closed", "Geschlossen an diesem Wochentag"],
            ["DayHours.open / close", "Einfaches Zeitfenster HH:mm"],
            ["DayHours.periods", "Optional mehrere Intervalle am selben Tag"],
            ["kitchenHoursEnabled / kitchenWeeklyHours", "Separate Küchenzeiten"],
            ["dateExceptions", "Feiertage / Sonderzeiten mit date YYYY-MM-DD"],
            ["settings.embedShow*", "Hinweise für Embed-Darstellung"],
          ],
        },
      },
      {
        heading: "Hinweise",
        items: [
          "Zeiten sind lokal als HH:mm — Zeitzone des Restaurants kommt aus den Stammdaten (nicht in jeder Payload)",
          "Ausnahmen überschreiben das Wochenraster für einzelne Daten",
          "Unveröffentlichtes Restaurant → 404 not_found / not_published",
        ],
      },
    ],
    related: [
      { label: "Handbuch Einstellungen → Öffnungszeiten", href: "/docs/handbuch/einstellungen" },
      { label: "Authentifizierung", href: "/docs/api/authentication" },
      { label: "Rate Limits", href: "/docs/api/rate-limits" },
    ],
  },
};

export function apiModuleGuideById(
  moduleId: RestaurantApiModuleId,
): ApiModuleGuide | null {
  if (moduleId === "reservation") return null;
  return API_READ_MODULE_GUIDES[moduleId] ?? null;
}
