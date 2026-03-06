import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata(
  "Friends",
  "Private Onbure connection management screens."
);

export default function FriendsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
