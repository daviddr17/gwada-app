"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccountingConnectorPublicInfo } from "@/lib/accounting/connectors/connector-meta";

const DEFAULT_CONNECTOR: AccountingConnectorPublicInfo = {
  key: "none",
  connected: false,
  displayName: "Gwada",
  source: "gwada",
  capabilities: {
    canCreateSales: true,
    canCreateVouchers: true,
    canCreateSalesCorrections: false,
    canCreateVoucherCorrections: false,
    canSyncSales: false,
    canSyncVouchers: false,
    canFetchExternalSalesPdf: false,
    canFetchExternalSalesXml: false,
    canFetchExternalVoucherFile: false,
    canEnrichSalesDetail: false,
    canEnrichVoucherDetail: false,
    readOnlyDocumentsInGwada: false,
  },
  autoSyncEnabled: false,
};

export function useAccountingConnector(restaurantId: string | null) {
  const [loading, setLoading] = useState(true);
  const [connector, setConnector] =
    useState<AccountingConnectorPublicInfo>(DEFAULT_CONNECTOR);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setConnector(DEFAULT_CONNECTOR);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/accounting/connector?${new URLSearchParams({ restaurantId })}`,
        { cache: "no-store" },
      );
      const body = (await res.json()) as {
        connector?: AccountingConnectorPublicInfo;
      };
      if (res.ok && body.connector) {
        setConnector(body.connector);
      } else {
        setConnector(DEFAULT_CONNECTOR);
      }
    } catch {
      setConnector(DEFAULT_CONNECTOR);
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { connector, loading, refresh: load };
}
