import type { Metadata } from "next";
import HomePageClient from "@/app/homepage-client";
import { absoluteUrl, buildPageMetadata, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Collaboration Workspace For Startup Teams",
  description:
    "Onbure helps startup teams discover collaborators, organize shared workspaces, manage requests, and keep projects moving in one place.",
  pathname: "/",
  keywords: [
    "Onbure startup teams",
    "collaboration workspace",
    "team discovery platform",
    "shared project workspace",
    "request management",
  ],
});

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
      description:
        "A collaboration workspace for startup teams to discover collaborators, manage requests, and organize shared work.",
    },
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: absoluteUrl("/"),
      description:
        "Onbure is a web-based collaboration workspace for startup teams, requests, and shared project coordination.",
    },
  ],
};

export default function Home() {
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
