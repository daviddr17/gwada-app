import { createHash } from "crypto";

/** Muss zu `pos_display_pin_offline_hash` in Postgres passen. */
export function posDisplayPinOfflineHash(
  pin: string,
  restaurantId: string,
): string {
  return createHash("sha256")
    .update(`${pin}\0${restaurantId}\0gwada-pos-offline-v1`, "utf8")
    .digest("hex");
}
