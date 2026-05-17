import { toast } from "sonner";
import { GWADA_DB_UNAVAILABLE_MESSAGE } from "@/lib/constants/database-mode";

export function toastDatabaseUnavailable(): void {
  toast.error(GWADA_DB_UNAVAILABLE_MESSAGE, { duration: 10_000 });
}
