import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/superadmin/", "/api/", "/embed/", "/display/"],
    },
    sitemap: "https://gwada.app/sitemap.xml",
    host: "https://gwada.app",
  };
}
