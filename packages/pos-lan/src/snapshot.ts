import { POS_LAN_PROTOCOL_VERSION } from "./protocol";

export type PosLanRegisterState = {
  isOpen: boolean;
  sessionId: string | null;
  openedAt: string | null;
};

export type PosLanFloorArea = {
  id: string;
  name: string;
  display_number: number;
  color_hex: string;
  sort_order: number;
};

export type PosLanFloorTable = {
  id: string;
  area_id: string;
  table_number: number;
  table_name: string | null;
  capacity: number;
  is_active: boolean;
};

export type PosLanOpenSession = {
  id: string;
  dining_table_id: string;
  cover_count: number;
  opened_at: string;
};

export type PosLanSessionFloorMeta = {
  orderCount: number;
  openCents: number;
};

export type PosLanFloorSnapshot = {
  areas: PosLanFloorArea[];
  tables: PosLanFloorTable[];
  openSessions: PosLanOpenSession[];
  orderCountBySessionId: Record<string, number>;
  sessionMetaBySessionId: Record<string, PosLanSessionFloorMeta>;
};

export type PosLanHubInfo = {
  deviceId: string;
  displayName: string;
  role: "hub";
};

export type PosLanHubSnapshot = {
  protocolVersion: typeof POS_LAN_PROTOCOL_VERSION;
  restaurantId: string;
  restaurantName: string;
  generatedAt: string;
  register: PosLanRegisterState;
  floor: PosLanFloorSnapshot;
  hub: PosLanHubInfo;
};

export type PosLanHealthResponse = {
  ok: true;
  protocolVersion: typeof POS_LAN_PROTOCOL_VERSION;
  restaurantId: string;
  restaurantName: string;
  role: "hub";
  generatedAt: string;
};

export function isPosLanHubSnapshot(value: unknown): value is PosLanHubSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.protocolVersion === POS_LAN_PROTOCOL_VERSION &&
    typeof v.restaurantId === "string" &&
    typeof v.restaurantName === "string" &&
    typeof v.generatedAt === "string" &&
    !!v.register &&
    typeof v.register === "object" &&
    !!v.floor &&
    typeof v.floor === "object" &&
    !!v.hub &&
    typeof v.hub === "object"
  );
}

export function isPosLanHealthResponse(
  value: unknown,
): value is PosLanHealthResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.ok === true &&
    v.protocolVersion === POS_LAN_PROTOCOL_VERSION &&
    typeof v.restaurantId === "string" &&
    v.role === "hub"
  );
}
