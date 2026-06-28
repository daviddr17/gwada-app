import {
  parseBusinessCardDesign,
  type BusinessCardDesign,
} from "@/lib/restaurant/business-card-design";

export async function fetchBusinessCardDesignClient(
  restaurantId: string,
): Promise<BusinessCardDesign | null> {
  const res = await fetch(
    `/api/restaurant/business-card-design?restaurantId=${encodeURIComponent(restaurantId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;

  const body = (await res.json().catch(() => ({}))) as { design?: unknown };
  return parseBusinessCardDesign(body.design);
}

export async function saveBusinessCardDesignClient(
  restaurantId: string,
  design: BusinessCardDesign,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/restaurant/business-card-design", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId, design }),
  });

  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: body.error ?? `save_${res.status}` };
  }

  return { ok: true };
}
