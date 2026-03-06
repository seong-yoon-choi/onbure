import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata(
  "Requests",
  "Private request management views for Onbure members."
);

export default function RequestsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
