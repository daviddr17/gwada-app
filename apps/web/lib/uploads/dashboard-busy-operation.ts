import { withDashboardUploadTracking } from "@/lib/uploads/dashboard-upload-bus";

export async function trackDashboardBusyOperation<T>(
  message: string,
  run: () => Promise<T>,
): Promise<T> {
  return withDashboardUploadTracking(run, { message });
}
