import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

const themeInitScript = `(() => {
  try {
    const key = "onbure.theme";
    const stored = localStorage.getItem(key);
    const theme = stored === "dark" ? "dark" : "light";
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    if (!stored) localStorage.setItem(key, theme);
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
