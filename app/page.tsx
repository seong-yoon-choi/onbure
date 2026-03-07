import type { Metadata } from "next";
import HomePageClient from "@/app/homepage-client";
import { absoluteUrl, buildPageMetadata, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Find the Right Partner and Bring Your Idea to Life",
  description:
    "Onbure helps people with ideas find global partners, get discovered through profiles, and move from idea to execution with live translation.",
  pathname: "/",
  keywords: [
    "global startup partners",
    "live translation collaboration",
    "partner discovery platform",
    "cross-border project workspace",
    "idea execution platform",
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
        "A platform where people with ideas can find global collaborators, post a profile, and execute ideas together with live translation.",
    },
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: absoluteUrl("/"),
      description:
        "Onbure is a web platform for finding global partners, getting discovered through profiles, and moving ideas into real projects with live translation.",
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
