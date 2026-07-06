import "server-only";

import type { DashboardPwaIconSize } from "@/lib/dashboard/dashboard-pwa-config";
import { renderPwaIconServer } from "@/lib/pwa/render-pwa-icon-server";

export async function renderDashboardPwaIcon(size: DashboardPwaIconSize): Promise<Buffer> {
  return renderPwaIconServer(size, "D");
}
