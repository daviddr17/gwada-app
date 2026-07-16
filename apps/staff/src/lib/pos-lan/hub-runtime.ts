import {
  POS_LAN_HUB_PORT,
  POS_LAN_PROTOCOL_VERSION,
  posLanBonjourDisplayName,
  type PosLanHealthResponse,
} from "@gwada/pos-lan";
import { discoverPosHubsViaBonjour, publishPosHubBonjour } from "@/src/lib/pos-lan/hub-discovery";
import {
  fetchPosHubHealth,
  fetchPosHubSnapshot,
  hubBaseUrlFromHost,
  PosHubClientError,
} from "@/src/lib/pos-lan/hub-client";
import { usePosHubConnectionStore } from "@/src/lib/pos-lan/hub-connection-store";
import { usePosDeviceRoleStore } from "@/src/lib/pos-lan/device-role-store";
import { usePosHubHostStore } from "@/src/lib/pos-lan/hub-host-store";
import { buildPosLanHubSnapshot } from "@/src/lib/pos-lan/hub-snapshot-builder";
import {
  startPosHubServer,
  type PosHubServerHandle,
} from "@/src/lib/pos-lan/hub-server";
import { useAuthStore } from "@/src/stores/auth-store";

let hubServer: PosHubServerHandle | null = null;
let bonjourHandle: { unpublish: () => void } | null = null;
let hubDeviceId: string | null = null;
let runtimeRestaurantId: string | null = null;
let handheldBootstrapInFlight: Promise<void> | null = null;

function ensureHubDeviceId(): string {
  if (hubDeviceId) return hubDeviceId;
  hubDeviceId = `hub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return hubDeviceId;
}

function restaurantNameFor(restaurantId: string): string {
  const list = useAuthStore.getState().restaurants;
  return list.find((r) => r.restaurantId === restaurantId)?.name ?? "Restaurant";
}

export async function stopPosHubRuntime(): Promise<void> {
  if (bonjourHandle) {
    try {
      bonjourHandle.unpublish();
    } catch {
      // ignore
    }
    bonjourHandle = null;
  }
  if (hubServer) {
    await hubServer.stop();
    hubServer = null;
  }
  runtimeRestaurantId = null;
}

export async function startPosHubRuntime(restaurantId: string): Promise<void> {
  if (
    hubServer &&
    runtimeRestaurantId === restaurantId
  ) {
    return;
  }

  await stopPosHubRuntime();
  runtimeRestaurantId = restaurantId;

  const deviceId = ensureHubDeviceId();
  const restaurantName = restaurantNameFor(restaurantId);
  const displayName = posLanBonjourDisplayName(restaurantName);

  hubServer = await startPosHubServer({
    port: POS_LAN_HUB_PORT,
    getHealth: (): PosLanHealthResponse | null => {
      if (!runtimeRestaurantId) return null;
      return {
        ok: true,
        protocolVersion: POS_LAN_PROTOCOL_VERSION,
        restaurantId: runtimeRestaurantId,
        restaurantName: restaurantNameFor(runtimeRestaurantId),
        role: "hub",
        generatedAt: new Date().toISOString(),
      };
    },
    getSnapshot: async () => {
      if (!runtimeRestaurantId) return null;
      try {
        return await buildPosLanHubSnapshot({
          restaurantId: runtimeRestaurantId,
          restaurantName: restaurantNameFor(runtimeRestaurantId),
          hubDeviceId: deviceId,
          hubDisplayName: displayName,
        });
      } catch {
        return null;
      }
    },
  });

  bonjourHandle = await publishPosHubBonjour({
    name: displayName,
    port: hubServer.port,
    restaurantId,
  });
}

export async function bootstrapPosHandheldFromHub(
  restaurantId: string | null,
): Promise<void> {
  if (handheldBootstrapInFlight) {
    await handheldBootstrapInFlight;
    return;
  }

  handheldBootstrapInFlight = (async () => {
    const conn = usePosHubConnectionStore.getState();
    conn.setSearching();

    await usePosHubHostStore.getState().init();
    const savedHost = usePosHubHostStore.getState().hubHost;

    const candidates: string[] = [];
    if (savedHost) {
      candidates.push(hubBaseUrlFromHost(savedHost));
    }

    const discovered = await discoverPosHubsViaBonjour(4500);
    for (const hub of discovered) {
      if (!candidates.includes(hub.baseUrl)) {
        candidates.push(hub.baseUrl);
      }
    }

    if (candidates.length === 0) {
      conn.setError(
        "Keine Kasse im WLAN gefunden. iPad-Kasse starten oder Hub-IP im Menü eintragen.",
      );
      return;
    }

    let lastError: string | null = null;
    for (const baseUrl of candidates) {
      try {
        conn.setConnecting(baseUrl);
        const health = await fetchPosHubHealth(baseUrl);
        if (
          restaurantId &&
          health.restaurantId &&
          health.restaurantId !== restaurantId
        ) {
          lastError = "Gefundene Kasse gehört zu einem anderen Restaurant.";
          continue;
        }
        const snapshot = await fetchPosHubSnapshot(
          baseUrl,
          restaurantId ?? health.restaurantId,
        );
        const host = baseUrl.replace(/^https?:\/\//, "").split(":")[0]!;
        await usePosHubHostStore.getState().setHubHost(host);
        conn.setConnected(baseUrl, snapshot);
        return;
      } catch (err) {
        lastError =
          err instanceof PosHubClientError
            ? err.message
            : "Kasse nicht erreichbar.";
      }
    }

    conn.setError(lastError ?? "Kasse nicht erreichbar.");
  })().finally(() => {
    handheldBootstrapInFlight = null;
  });

  await handheldBootstrapInFlight;
}

export async function refreshPosHubSnapshot(): Promise<void> {
  const { hubBaseUrl, status } = usePosHubConnectionStore.getState();
  if (!hubBaseUrl || (status !== "connected" && status !== "error")) return;

  const restaurantId = useAuthStore.getState().activeRestaurantId;
  try {
    usePosHubConnectionStore.getState().setConnecting(hubBaseUrl);
    const snapshot = await fetchPosHubSnapshot(hubBaseUrl, restaurantId);
    usePosHubConnectionStore.getState().setConnected(hubBaseUrl, snapshot);
  } catch (err) {
    usePosHubConnectionStore.getState().setError(
      err instanceof PosHubClientError
        ? err.message
        : "Snapshot von der Kasse fehlgeschlagen.",
    );
  }
}

/**
 * Nach Login / Restaurantwahl / Rollenwechsel aufrufen.
 */
export async function syncPosLanRuntime(): Promise<void> {
  await usePosDeviceRoleStore.getState().init();
  await usePosHubHostStore.getState().init();

  const role = usePosDeviceRoleStore.getState().role;
  const restaurantId = useAuthStore.getState().activeRestaurantId;
  const session = useAuthStore.getState().session;

  if (!session || !restaurantId) {
    await stopPosHubRuntime();
    usePosHubConnectionStore.getState().clear();
    return;
  }

  if (role === "hub") {
    usePosHubConnectionStore.getState().clear();
    try {
      await startPosHubRuntime(restaurantId);
    } catch (err) {
      // Hub-UI kann den Fehler im Menü zeigen — App bleibt nutzbar (Cloud).
      console.warn(
        "[pos-lan] Hub-Server start failed:",
        err instanceof Error ? err.message : err,
      );
    }
    return;
  }

  await stopPosHubRuntime();
  await bootstrapPosHandheldFromHub(restaurantId);
}

export function getPosHubServerPort(): number | null {
  return hubServer?.port ?? null;
}
