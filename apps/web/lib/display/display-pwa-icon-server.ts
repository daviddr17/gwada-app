import "server-only";

import type { DisplayPwaIconSize } from "@/lib/display/display-pwa-config";
import { renderPwaIconServer } from "@/lib/pwa/render-pwa-icon-server";

export async function renderDisplayPwaIcon(size: DisplayPwaIconSize): Promise<Buffer> {
  return renderPwaIconServer(size, "D");
}
