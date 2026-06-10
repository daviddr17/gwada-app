import type { AccountingConnectorKey } from "@/lib/accounting/connectors/connector-meta";

export type AccountingConnectorSyncScope =
  | "invoices"
  | "quotations"
  | "vouchers";

export type AccountingConnectorSettingsEntry = {
  autoSync: boolean;
  lastSync: Partial<Record<AccountingConnectorSyncScope, string | null>>;
};

export type AccountingConnectorSettingsMap = Partial<
  Record<AccountingConnectorKey, AccountingConnectorSettingsEntry>
>;

const DEFAULT_LEXOFFICE_ENTRY: AccountingConnectorSettingsEntry = {
  autoSync: true,
  lastSync: {},
};

export function salesDocumentKindToSyncScope(
  kind: "invoice" | "quotation",
): AccountingConnectorSyncScope {
  return kind === "invoice" ? "invoices" : "quotations";
}

export function parseConnectorSettings(
  raw: unknown,
  legacy?: {
    auto_sync_lexoffice?: boolean;
    last_lexoffice_invoices_sync_at?: string | null;
    last_lexoffice_quotations_sync_at?: string | null;
    last_lexoffice_vouchers_sync_at?: string | null;
  },
): AccountingConnectorSettingsMap {
  const map: AccountingConnectorSettingsMap = {};

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (key !== "lexoffice" && key !== "none") continue;
      const entry = parseConnectorSettingsEntry(value);
      if (entry) {
        map[key as AccountingConnectorKey] = entry;
      }
    }
  }

  if (!map.lexoffice && legacy) {
    map.lexoffice = {
      autoSync: legacy.auto_sync_lexoffice ?? DEFAULT_LEXOFFICE_ENTRY.autoSync,
      lastSync: {
        invoices: legacy.last_lexoffice_invoices_sync_at ?? null,
        quotations: legacy.last_lexoffice_quotations_sync_at ?? null,
        vouchers: legacy.last_lexoffice_vouchers_sync_at ?? null,
      },
    };
  }

  return map;
}

function parseConnectorSettingsEntry(
  raw: unknown,
): AccountingConnectorSettingsEntry | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const lastSyncRaw = obj.lastSync;
  const lastSync: AccountingConnectorSettingsEntry["lastSync"] = {};
  if (lastSyncRaw && typeof lastSyncRaw === "object" && !Array.isArray(lastSyncRaw)) {
    for (const scope of ["invoices", "quotations", "vouchers"] as const) {
      const v = (lastSyncRaw as Record<string, unknown>)[scope];
      if (typeof v === "string") lastSync[scope] = v;
      else if (v === null) lastSync[scope] = null;
    }
  }
  return {
    autoSync:
      typeof obj.autoSync === "boolean"
        ? obj.autoSync
        : DEFAULT_LEXOFFICE_ENTRY.autoSync,
    lastSync,
  };
}

export function getConnectorSettingsEntry(
  map: AccountingConnectorSettingsMap,
  key: AccountingConnectorKey,
): AccountingConnectorSettingsEntry | null {
  if (key === "none") return null;
  return map[key] ?? null;
}

export function connectorAutoSyncEnabled(
  map: AccountingConnectorSettingsMap,
  key: AccountingConnectorKey,
): boolean {
  if (key === "none") return false;
  return getConnectorSettingsEntry(map, key)?.autoSync ?? DEFAULT_LEXOFFICE_ENTRY.autoSync;
}

export function connectorLastSyncAt(
  map: AccountingConnectorSettingsMap,
  key: AccountingConnectorKey,
  scope: AccountingConnectorSyncScope,
): string | null {
  const entry = getConnectorSettingsEntry(map, key);
  return entry?.lastSync?.[scope] ?? null;
}

export function setConnectorAutoSync(
  map: AccountingConnectorSettingsMap,
  key: AccountingConnectorKey,
  enabled: boolean,
): AccountingConnectorSettingsMap {
  if (key === "none") return map;
  const prev = map[key] ?? DEFAULT_LEXOFFICE_ENTRY;
  return {
    ...map,
    [key]: {
      ...prev,
      autoSync: enabled,
    },
  };
}

export function setConnectorLastSync(
  map: AccountingConnectorSettingsMap,
  key: AccountingConnectorKey,
  scope: AccountingConnectorSyncScope,
  iso: string,
): AccountingConnectorSettingsMap {
  if (key === "none") return map;
  const prev = map[key] ?? DEFAULT_LEXOFFICE_ENTRY;
  return {
    ...map,
    [key]: {
      ...prev,
      lastSync: {
        ...prev.lastSync,
        [scope]: iso,
      },
    },
  };
}

/** Abgeleitete Legacy-Felder für API-Kompatibilität. */
export function legacyLexofficeFieldsFromConnectorSettings(
  map: AccountingConnectorSettingsMap,
) {
  const lex = map.lexoffice;
  return {
    auto_sync_lexoffice: lex?.autoSync ?? DEFAULT_LEXOFFICE_ENTRY.autoSync,
    last_lexoffice_invoices_sync_at: lex?.lastSync?.invoices ?? null,
    last_lexoffice_quotations_sync_at: lex?.lastSync?.quotations ?? null,
    last_lexoffice_vouchers_sync_at: lex?.lastSync?.vouchers ?? null,
  };
}
