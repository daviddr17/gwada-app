import {
  POS_LAN_PROTOCOL_VERSION,
  type PosLanHubSnapshot,
} from "@gwada/pos-lan";
import { fetchDiningFloorSnapshot } from "@/src/lib/dining-floor";
import { fetchRegisterStatus } from "@/src/lib/pos-api";

type BuildArgs = {
  restaurantId: string;
  restaurantName: string;
  hubDeviceId: string;
  hubDisplayName: string;
};

export async function buildPosLanHubSnapshot(
  args: BuildArgs,
): Promise<PosLanHubSnapshot> {
  const [floor, register] = await Promise.all([
    fetchDiningFloorSnapshot(args.restaurantId),
    fetchRegisterStatus(args.restaurantId),
  ]);

  return {
    protocolVersion: POS_LAN_PROTOCOL_VERSION,
    restaurantId: args.restaurantId,
    restaurantName: args.restaurantName,
    generatedAt: new Date().toISOString(),
    register: {
      isOpen: register.isOpen,
      sessionId: register.sessionId,
      openedAt: register.openedAt,
    },
    floor: {
      areas: floor.areas,
      tables: floor.tables,
      openSessions: floor.openSessions,
      orderCountBySessionId: floor.orderCountBySessionId,
      sessionMetaBySessionId: floor.sessionMetaBySessionId,
    },
    hub: {
      deviceId: args.hubDeviceId,
      displayName: args.hubDisplayName,
      role: "hub",
    },
  };
}
