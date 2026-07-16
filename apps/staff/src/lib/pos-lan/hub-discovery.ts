import {
  POS_LAN_BONJOUR_TYPE,
  POS_LAN_HUB_PORT,
  posLanHubBaseUrl,
} from "@gwada/pos-lan";

export type DiscoveredPosHub = {
  host: string;
  port: number;
  name: string;
  baseUrl: string;
};

type ZeroconfService = {
  name?: string;
  host?: string;
  addresses?: string[];
  port?: number;
};

function pickIpv4(addresses: string[] | undefined): string | null {
  if (!addresses?.length) return null;
  for (const addr of addresses) {
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(addr) && !addr.startsWith("127.")) {
      return addr;
    }
  }
  return addresses[0] ?? null;
}

/**
 * Bonjour-Scan nach iPad-Kassen. Fehlt das Native-Modul (Expo Go),
 * liefert leeres Array — manueller Host / SecureStore greifen dann.
 */
export async function discoverPosHubsViaBonjour(
  timeoutMs = 5000,
): Promise<DiscoveredPosHub[]> {
  try {
    // Dynamisch: Dev ohne Native-Modul soll nicht crashen.
    const zeroconf = (await import("expo-zeroconf")) as {
      scan?: (
        type: string,
        opts?: { timeoutMs?: number },
      ) => Promise<ZeroconfService[]>;
    };
    if (typeof zeroconf.scan !== "function") return [];

    const services = await zeroconf.scan(POS_LAN_BONJOUR_TYPE, { timeoutMs });
    const found: DiscoveredPosHub[] = [];

    for (const service of services ?? []) {
      const host =
        pickIpv4(service.addresses) ??
        (service.host && !service.host.endsWith(".local")
          ? service.host
          : null);
      if (!host) continue;
      const port =
        typeof service.port === "number" && service.port > 0
          ? service.port
          : POS_LAN_HUB_PORT;
      found.push({
        host,
        port,
        name: service.name?.trim() || "Gwada Kasse",
        baseUrl: posLanHubBaseUrl(host, port),
      });
    }
    return found;
  } catch {
    return [];
  }
}

export async function publishPosHubBonjour(args: {
  name: string;
  port: number;
  restaurantId: string;
}): Promise<{ unpublish: () => void } | null> {
  try {
    const zeroconf = (await import("expo-zeroconf")) as {
      publishService?: (opts: {
        name: string;
        type: string;
        port: number;
        txt?: Record<string, string>;
      }) => Promise<{ unpublish: () => void }>;
    };
    if (typeof zeroconf.publishService !== "function") return null;

    const published = await zeroconf.publishService({
      name: args.name,
      type: POS_LAN_BONJOUR_TYPE,
      port: args.port,
      txt: {
        restaurantId: args.restaurantId,
        role: "hub",
        path: "/v1",
      },
    });
    return published;
  } catch {
    return null;
  }
}
