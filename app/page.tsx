import type { Metadata } from "next";
import { headers } from "next/headers";
import HomePageClient from "@/app/homepage-client";
import {
  HOME_SEO_DESCRIPTION,
  absoluteUrl,
  buildPageMetadata,
  resolveHomeSeoLanguage,
  SITE_NAME,
} from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const seoLanguage = resolveHomeSeoLanguage({
    country: requestHeaders.get("x-vercel-ip-country"),
    acceptLanguage: requestHeaders.get("accept-language"),
  });

  return buildPageMetadata({
    title: "Find the Right Partner and Bring Your Idea to Life",
    description: HOME_SEO_DESCRIPTION[seoLanguage],
    pathname: "/",
    locale: seoLanguage === "ko" ? "ko_KR" : "en_US",
    keywords: [
      "global startup partners",
      "live translation collaboration",
      "partner discovery platform",
      "cross-border project workspace",
      "idea execution platform",
    ],
  });
}

export default async function Home() {
  const requestHeaders = await headers();
  const seoLanguage = resolveHomeSeoLanguage({
    country: requestHeaders.get("x-vercel-ip-country"),
    acceptLanguage: requestHeaders.get("accept-language"),
  });
  const brandDescription = HOME_SEO_DESCRIPTION[seoLanguage];
  const brandSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: SITE_NAME,
        url: absoluteUrl("/"),
        logo: absoluteUrl("/icon.png"),
      },
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: absoluteUrl("/"),
        description: brandDescription,
      },
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: absoluteUrl("/"),
        description: brandDescription,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(brandSchema) }}
      />
      <HomePageClient />
    </>
  );
}
