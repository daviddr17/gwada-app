import { toast } from "sonner";
import { withDashboardUploadTracking } from "@/lib/uploads/dashboard-upload-bus";

type UploadResult = { error?: string | null };

export async function trackDashboardFileUpload<T extends UploadResult>(
  run: () => Promise<T>,
  options?: {
    successMessage?: string;
    errorMessage?: (code?: string) => string;
  },
): Promise<T> {
  return withDashboardUploadTracking(async () => {
    const result = await run();
    if (result.error) {
      toast.error(
        options?.errorMessage?.(result.error) ?? "Upload fehlgeschlagen.",
      );
      return result;
    }
    if (options?.successMessage) {
      toast.success(options.successMessage);
    }
    return result;
  });
}
