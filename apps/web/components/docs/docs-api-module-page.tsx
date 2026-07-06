import type { Metadata } from "next";
import { DocsProse } from "@/components/docs/docs-prose";
import {
  restaurantApiModuleById,
  type RestaurantApiModuleId,
} from "@/lib/api/restaurant-api-modules";

export function docsApiModuleMetadata(moduleId: RestaurantApiModuleId): Metadata {
  const meta = restaurantApiModuleById(moduleId);
  return { title: meta?.label ?? "API" };
}

export function DocsApiModulePage({ moduleId }: { moduleId: RestaurantApiModuleId }) {
  const meta = restaurantApiModuleById(moduleId);
  if (!meta) return null;

  return (
    <DocsProse
      title={meta.label}
      description={`Read-only JSON für ${meta.label.toLowerCase()}.`}
    >
      <p>
        Endpunkt: <code>GET /api/v1/{meta.path}</code>
      </p>
      <pre>{`curl -s "https://gwada.app/api/v1/${meta.path}" \\
  -H "Authorization: Bearer gwada_sk_live_…" \\
  -H "Accept: application/json"`}</pre>
      <p>
        Die Antwort entspricht dem JSON der eingebetteten Variante (iframe) — gleiche
        Felder und Struktur wie in der Public-Embed-Pipeline.
      </p>
      <p>
        Der API-Schlüssel muss das Modul <strong>{meta.label}</strong> freigeschaltet
        haben. Restaurant muss veröffentlicht sein.
      </p>
    </DocsProse>
  );
}
