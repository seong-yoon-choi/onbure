import type { Metadata } from "next";
import MainLayout from "./(main)/layout";
import DiscoveryClientPage from "./(main)/discovery/discovery-client";
import { absoluteUrl, buildPageMetadata, SITE_NAME } from "@/lib/seo";

interface RootPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "Discover Startup Teams And Collaborators",
  description:
    "Browse public teams, collaborator profiles, and active opportunities on Onbure.",
  pathname: "/",
  keywords: [
    "Onbure discovery",
    "startup collaborators",
    "public teams",
    "collaboration opportunities",
    "team discovery platform",
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

export default async function RootPage({ searchParams }: RootPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawQuery = resolvedSearchParams.q;
  const initialSearchQuery = Array.isArray(rawQuery) ? (rawQuery[0] ?? "") : (rawQuery ?? "");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(brandSchema) }}
      />
      <MainLayout>
        <DiscoveryClientPage initialSearchQuery={initialSearchQuery} />
      </MainLayout>
    </>
  );
}
