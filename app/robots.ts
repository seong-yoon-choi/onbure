import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteUrl } from "@/lib/seo";

const DISALLOWED_APP_PATHS = [
  "/api",
  "/admin",
  "/chat",
  "/friends",
  "/people",
  "/profile",
  "/requests",
  "/teams",
  "/workspace",
];

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  if (process.env.NODE_ENV !== "production") {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
      sitemap: absoluteUrl("/sitemap.xml"),
      host: siteUrl.origin,
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        disallow: DISALLOWED_APP_PATHS,
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl.origin,
  };
}
