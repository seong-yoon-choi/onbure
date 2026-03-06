import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata(
  "Member Profile",
  "Onbure member profiles are not indexed until public profile SEO policy is finalized."
);

export default function PeopleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
