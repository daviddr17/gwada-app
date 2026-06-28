const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_EDGE_PX = 720;

export type PreparedBusinessCardDecoration = {
  dataUrl: string;
  format: "PNG" | "JPEG";
  fileName: string;
  aspect: number;
};

export function isBusinessCardDecorationFile(file: File): boolean {
  return ACCEPTED_TYPES.has(file.type);
}

export async function readBusinessCardDecorationAspect(
  file: File,
): Promise<number | null> {
  if (!isBusinessCardDecorationFile(file)) return null;
  try {
    const objectUrl = URL.createObjectURL(file);
    const loaded = await loadImage(objectUrl);
    URL.revokeObjectURL(objectUrl);
    if (!loaded || loaded.width <= 0 || loaded.height <= 0) return null;
    return loaded.width / loaded.height;
  } catch {
    return null;
  }
}

export async function prepareBusinessCardDecorationFile(
  file: File,
): Promise<PreparedBusinessCardDecoration | null> {
  if (!isBusinessCardDecorationFile(file) || file.size > MAX_FILE_BYTES) {
    return null;
  }

  try {
    const objectUrl = URL.createObjectURL(file);
    const loaded = await loadImage(objectUrl);
    URL.revokeObjectURL(objectUrl);
    if (!loaded) return null;

    const scale = Math.min(1, MAX_EDGE_PX / Math.max(loaded.width, loaded.height));
    const width = Math.max(1, Math.round(loaded.width * scale));
    const height = Math.max(1, Math.round(loaded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(loaded.image, 0, 0, width, height);

    const usePng = file.type === "image/png";
    const dataUrl = usePng
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/jpeg", 0.88);

    return {
      dataUrl,
      format: usePng ? "PNG" : "JPEG",
      fileName: file.name.trim() || "bild.png",
      aspect: width / height,
    };
  } catch {
    return null;
  }
}

function loadImage(
  src: string,
): Promise<{ image: HTMLImageElement; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        image: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
