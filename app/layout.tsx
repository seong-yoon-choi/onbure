import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

const themeInitScript = `(() => {
  try {
    const key = "onbure.theme";
    const stored = localStorage.getItem(key);
    const hasStoredTheme = stored === "light" || stored === "dark";
    const isAuthRoute = window.location.pathname === "/login" || window.location.pathname === "/register";
    const persistedTheme = hasStoredTheme ? stored : "light";
    const theme = isAuthRoute ? "light" : persistedTheme;
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    if (!hasStoredTheme) localStorage.setItem(key, "light");
  } catch (_error) {}
})();`;

export const metadata: Metadata = {
  title: "Onbure",
  description: "Premium Team Collaboration Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.className} h-full antialiased`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
