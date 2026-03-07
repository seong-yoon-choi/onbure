import type { Metadata } from "next";
import HomePageClient from "@/app/homepage-client";
import { absoluteUrl, buildPageMetadata, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Find Collaborators And Turn Ideas Into Real Projects",
  description:
    "Onbure helps people with ideas find the right collaborators, start projects together, and turn ideas into reality.",
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
        "A platform where people with ideas can find collaborators, start projects together, and bring ideas to life.",
    },
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: absoluteUrl("/"),
      description:
        "Onbure is a web platform for finding collaborators, building projects together, and turning ideas into something real.",
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
