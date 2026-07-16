import type { PosLanHubSnapshot } from "@gwada/pos-lan";
import type { DiningFloorSnapshot } from "@/src/lib/dining-floor";

/** Wire-Snapshot der Kasse → DiningFloorSnapshot (Reservierungen leer — nur Floor). */
export function diningFloorFromHubSnapshot(
  snapshot: PosLanHubSnapshot,
): DiningFloorSnapshot {
  return {
    areas: snapshot.floor.areas,
    tables: snapshot.floor.tables,
    openSessions: snapshot.floor.openSessions,
    orderCountBySessionId: snapshot.floor.orderCountBySessionId,
    sessionMetaBySessionId: snapshot.floor.sessionMetaBySessionId,
    reservations: [],
    reservationsByTableId: {},
  };
}
