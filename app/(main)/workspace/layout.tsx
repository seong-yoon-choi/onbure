import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata(
  "Workspace",
  "Private workspace screens for Onbure members."
);

export default function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
