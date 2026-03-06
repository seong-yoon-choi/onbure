import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Create Account",
  description:
    "Create an Onbure account to join teams, collaborate in shared workspaces, and manage requests.",
  pathname: "/register",
  keywords: ["sign up", "create account", "team onboarding"],
});

export default function RegisterLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
