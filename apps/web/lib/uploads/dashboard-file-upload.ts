import { toast } from "sonner";
import { withDashboardUploadTracking } from "@/lib/uploads/dashboard-upload-bus";

type UploadResult = { error?: string | null };

export async function trackDashboardFileUpload<T extends UploadResult>(
  run: () => Promise<T>,
  options?: {
    message?: string;
    successMessage?: string;
    errorMessage?: (code?: string) => string;
  },
): Promise<T> {
  return withDashboardUploadTracking(
    async () => {
      const result = await run();
      if (result.error) {
        toast.error(
          options?.errorMessage?.(result.error) ?? "Upload fehlgeschlagen.",
        );
        return result;
      }
      return result;
    },
    {
      message: options?.message,
      successMessage: options?.successMessage ?? "Hochgeladen",
      isSuccess: (result) => !result.error,
    },
  );
}
