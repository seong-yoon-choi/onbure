import type { Metadata } from "next";

export const SITE_NAME = "Onbure";
export const SITE_DESCRIPTION =
  "Onbure helps teams discover collaborators, organize shared workspaces, and manage requests in one place.";
export const SITE_KEYWORDS = [
  "Onbure",
  "team collaboration",
  "workspace management",
  "startup teams",
  "project coordination",
  "team discovery",
];

const DEFAULT_SITE_URL = "http://localhost:3000";

function normalizeOrigin(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return DEFAULT_SITE_URL;
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export function getSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    DEFAULT_SITE_URL;

  try {
    return new URL(normalizeOrigin(configuredUrl));
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

export function absoluteUrl(pathname = "/") {
  return new URL(pathname, getSiteUrl()).toString();
}

type PageMetadataOptions = {
  title: string;
  description: string;
  pathname?: string;
  keywords?: string[];
  noIndex?: boolean;
  openGraphType?: "website" | "article";
};

export function buildPageMetadata({
  title,
  description,
  pathname,
  keywords = [],
  noIndex = false,
  openGraphType = "website",
}: PageMetadataOptions): Metadata {
  return {
    title,
    description,
    keywords: [...SITE_KEYWORDS, ...keywords],
    alternates: pathname ? { canonical: pathname } : undefined,
    openGraph: {
      type: openGraphType,
      title,
      description,
      siteName: SITE_NAME,
      locale: "en_US",
      url: pathname || undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
            "max-image-preview": "none",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        }
      : undefined,
  };
}

export function buildNoIndexMetadata(
  title: string,
  description: string,
  pathname?: string
) {
  return buildPageMetadata({
    title,
    description,
    pathname,
    noIndex: true,
  });
}
