import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) {
    return nextResolve(specifier, context);
  }
  const rel = specifier.slice(2);
  const base = fileURLToPath(new URL(`../apps/web/${rel}`, import.meta.url));
  for (const ext of [".ts", ".tsx", ".js", "/index.ts"]) {
    const file = base + ext;
    if (existsSync(file)) {
      return nextResolve(pathToFileURL(file).href, context);
    }
  }
  return nextResolve(specifier, context);
}
