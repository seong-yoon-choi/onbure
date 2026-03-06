import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata(
  "Discovery",
  "Onbure team and member discovery views are not indexed until public SEO content is finalized."
);

export default function DiscoveryLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
