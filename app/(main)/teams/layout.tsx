import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata(
  "Team Profile",
  "Onbure team profile pages are not indexed until public team SEO content is finalized."
);

export default function TeamsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
