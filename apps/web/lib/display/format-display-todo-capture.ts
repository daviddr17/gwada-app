import type { StaffTodoCaptureType } from "@/lib/types/staff-todos";

export function formatDisplayTodoCapturedValue(
  captureType: StaffTodoCaptureType,
  capturedNumeric: number | null | undefined,
  capturedText: string | null | undefined,
): string | null {
  if (captureType === "temperature" && capturedNumeric != null) {
    return `${capturedNumeric} °C`;
  }
  if (captureType === "number" && capturedNumeric != null) {
    return String(capturedNumeric);
  }
  if (captureType === "text" && capturedText?.trim()) {
    return capturedText.trim();
  }
  return null;
}
