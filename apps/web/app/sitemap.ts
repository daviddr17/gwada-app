import type { MetadataRoute } from "next";

/** Öffentliche Marketing-/Legal-URLs für Crawler und Agentic Browsing. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://gwada.app";
  const now = new Date();
  const paths = [
    "/",
    "/login",
    "/docs",
    "/impressum",
    "/datenschutz",
    "/agb",
    "/avv",
    "/llms.txt",
  ] as const;

  return paths.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
