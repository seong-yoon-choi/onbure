import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

const LEGAL_REGION_SEGMENTS = ["kr", "cn", "jp", "us", "eu"] as const;
const LEGAL_LAST_UPDATED = new Date("2026-02-20");
const MARKETING_LAST_UPDATED = new Date("2026-02-26");
const HOME_LAST_UPDATED = new Date("2026-03-07");
const REGISTER_LAST_UPDATED = new Date("2026-03-06");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: absoluteUrl("/"),
      lastModified: HOME_LAST_UPDATED,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/register"),
      lastModified: REGISTER_LAST_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/legal/marketing-communications"),
      lastModified: MARKETING_LAST_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...LEGAL_REGION_SEGMENTS.map((region) => ({
      url: absoluteUrl(`/legal/${region}`),
      lastModified: LEGAL_LAST_UPDATED,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
