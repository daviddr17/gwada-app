export type LoadedCardImage = {
  dataUrl: string;
  format: "PNG" | "JPEG";
  width: number;
  height: number;
};

export async function loadImageForPdf(
  url: string | null | undefined,
): Promise<LoadedCardImage | null> {
  if (!url?.trim()) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.size) return null;

    if (blob.type === "image/png") {
      const dataUrl = await blobToDataUrl(blob);
      const dims = await readImageDimensions(dataUrl);
      return { dataUrl, format: "PNG", ...dims };
    }

    const dataUrl = await rasterizeBlobToJpeg(blob);
    const dims = await readImageDimensions(dataUrl);
    return { dataUrl, format: "JPEG", ...dims };
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function readImageDimensions(
  dataUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("image_load_failed"));
    img.src = dataUrl;
  });
}

function rasterizeBlobToJpeg(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("canvas_unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("image_load_failed"));
    };
    img.src = objectUrl;
  });
}

/** Cover: Bild so zuschneiden, dass Breite×Höhe gefüllt wird (center crop). */
export function coverImageRect(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
): { sx: number; sy: number; sWidth: number; sHeight: number } {
  const scale = Math.max(boxW / imgW, boxH / imgH);
  const sWidth = boxW / scale;
  const sHeight = boxH / scale;
  const sx = (imgW - sWidth) / 2;
  const sy = (imgH - sHeight) / 2;
  return { sx, sy, sWidth, sHeight };
}

/** Contain: ganzes Bild sichtbar, zentriert (wie object-contain). */
export function containImageRect(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
): { dx: number; dy: number; dw: number; dh: number } {
  const scale = Math.min(boxW / imgW, boxH / imgH);
  const dw = imgW * scale;
  const dh = imgH * scale;
  return {
    dx: (boxW - dw) / 2,
    dy: (boxH - dh) / 2,
    dw,
    dh,
  };
}

export async function cropImageToDataUrl(
  source: LoadedCardImage,
  boxW: number,
  boxH: number,
): Promise<LoadedCardImage> {
  const { sx, sy, sWidth, sHeight } = coverImageRect(
    source.width,
    source.height,
    boxW,
    boxH,
  );

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(boxW));
      canvas.height = Math.max(1, Math.round(boxH));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas_unavailable"));
        return;
      }
      ctx.drawImage(
        img,
        sx,
        sy,
        sWidth,
        sHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      resolve({
        dataUrl,
        format: "JPEG",
        width: canvas.width,
        height: canvas.height,
      });
    };
    img.onerror = () => reject(new Error("crop_failed"));
    img.src = source.dataUrl;
  });
}

export async function containImageToDataUrl(
  source: LoadedCardImage,
  boxW: number,
  boxH: number,
  opts?: { background?: string },
): Promise<LoadedCardImage> {
  const { dx, dy, dw, dh } = containImageRect(
    source.width,
    source.height,
    boxW,
    boxH,
  );

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(boxW));
      canvas.height = Math.max(1, Math.round(boxH));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas_unavailable"));
        return;
      }
      if (opts?.background) {
        ctx.fillStyle = opts.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, dx, dy, dw, dh);
      const usePng = source.format === "PNG";
      const dataUrl = usePng
        ? canvas.toDataURL("image/png")
        : canvas.toDataURL("image/jpeg", 0.92);
      resolve({
        dataUrl,
        format: usePng ? "PNG" : "JPEG",
        width: canvas.width,
        height: canvas.height,
      });
    };
    img.onerror = () => reject(new Error("contain_failed"));
    img.src = source.dataUrl;
  });
}
