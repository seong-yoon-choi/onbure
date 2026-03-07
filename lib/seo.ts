import type { Metadata } from "next";

export const SITE_NAME = "Onbure";
export const SITE_DESCRIPTION =
  "Onbure helps people with ideas find global partners, get discovered through profiles, and move from idea to execution with live translation.";
export const SITE_KEYWORDS = [
  "Onbure",
  "global collaboration",
  "live translation",
  "startup partners",
  "project execution",
  "partner discovery",
];

const DEFAULT_DEV_SITE_URL = "http://localhost:3000";
const DEFAULT_PROD_SITE_URL = "https://onbure.com";
export const DEFAULT_SOCIAL_IMAGE_PATH = "/search-preview.svg";

function normalizeOrigin(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.endsWith("/") ? withProtocol.slice(0, -1) : withProtocol;
}

export function getSiteUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    process.env.NODE_ENV === "production" ? DEFAULT_PROD_SITE_URL : DEFAULT_DEV_SITE_URL,
  ];

  for (const candidate of candidates) {
    try {
      const normalized = normalizeOrigin(candidate || "");
      if (normalized) {
        return new URL(normalized);
      }
    } catch {
      continue;
    }
  }

  return new URL(DEFAULT_DEV_SITE_URL);
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
  const socialImageUrl = absoluteUrl(DEFAULT_SOCIAL_IMAGE_PATH);

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
      images: [
        {
          url: socialImageUrl,
          width: 1200,
          height: 630,
          alt: SITE_NAME,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImageUrl],
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
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
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
