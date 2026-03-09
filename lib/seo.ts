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

function isIpv4Hostname(hostname: string) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}

function isPrivateIpv4Hostname(hostname: string) {
  if (!isIpv4Hostname(hostname)) return false;

  const octets = hostname.split(".").map((part) => Number.parseInt(part, 10));
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function shouldRejectOriginInProduction(url: URL) {
  const hostname = url.hostname.toLowerCase();

  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    isPrivateIpv4Hostname(hostname)
  );
}

export function getSiteUrl() {
  const isProduction = process.env.NODE_ENV === "production";
  const candidates = [
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    process.env.NEXTAUTH_URL,
    process.env.NODE_ENV === "production" ? DEFAULT_PROD_SITE_URL : DEFAULT_DEV_SITE_URL,
  ];

  for (const candidate of candidates) {
    try {
      const normalized = normalizeOrigin(candidate || "");
      if (normalized) {
        const url = new URL(normalized);
        if (isProduction && shouldRejectOriginInProduction(url)) {
          continue;
        }
        return url;
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
