import type { MetadataRoute } from "next";

import { SITE_URL } from "../lib/site-config";

export default function robots(): MetadataRoute.Robots {
  const isPreview = process.env.VERCEL_ENV === "preview";

  return {
    rules: isPreview
      ? {
          userAgent: "*",
          disallow: "/",
        }
      : [
          {
            userAgent: "*",
            allow: "/",
            disallow: ["/api/"],
          },
        ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
