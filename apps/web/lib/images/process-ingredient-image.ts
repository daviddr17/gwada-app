import "server-only";

import sharp from "sharp";

/** Zutatenbild: neu kodieren, damit angehängte Inhalte nicht mit ausgeliefert werden. */
export async function processIngredientImageUpload(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: "none" })
    .rotate()
    .webp({ quality: 90, effort: 4 })
    .toBuffer();
}
