import type { GuidesMediaMime } from "@/lib/constants/guides-media";
import { validateGuidesMediaFile } from "@/lib/guides/validate-guides-media-file";

export type GuideMediaUploadResult = {
  stepId: string;
  storagePath: string;
  mimeType: string;
  kind: "image" | "video";
  sizeBytes: number;
  url: string | null;
};

export async function uploadGuideMediaClient(params: {
  restaurantId: string;
  guideId: string;
  stepId?: string | null;
  file: File;
}): Promise<{ data: GuideMediaUploadResult | null; error: string | null }> {
  const validation = validateGuidesMediaFile(params.file);
  if (validation === "empty_file") {
    return { data: null, error: "Datei ist leer." };
  }
  if (validation === "file_too_large") {
    return { data: null, error: "Datei ist zu groß (max. 100 MB)." };
  }
  if (validation === "unsupported_type") {
    return {
      data: null,
      error: "Dateityp nicht unterstützt (Bild oder Video).",
    };
  }

  const form = new FormData();
  form.set("restaurantId", params.restaurantId);
  form.set("guideId", params.guideId);
  if (params.stepId) form.set("stepId", params.stepId);
  form.set("file", params.file);

  const res = await fetch("/api/guides/media/upload", {
    method: "POST",
    body: form,
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    stepId?: string;
    storagePath?: string;
    mimeType?: GuidesMediaMime | string;
    kind?: "image" | "video";
    sizeBytes?: number;
    url?: string | null;
  };

  if (!res.ok) {
    if (json.error === "storage_quota_exceeded") {
      return {
        data: null,
        error: "Speicherlimit erreicht. Bitte Dateien löschen oder Plan upgraden.",
      };
    }
    return {
      data: null,
      error: json.error ?? "Upload fehlgeschlagen.",
    };
  }

  if (!json.storagePath || !json.kind || !json.mimeType || !json.stepId) {
    return { data: null, error: "Upload fehlgeschlagen." };
  }

  return {
    data: {
      stepId: json.stepId,
      storagePath: json.storagePath,
      mimeType: json.mimeType,
      kind: json.kind,
      sizeBytes: Number(json.sizeBytes ?? params.file.size),
      url: json.url ?? null,
    },
    error: null,
  };
}
