import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";
import {
  buildIubendaConfigScript,
  getIubendaCookieConfig,
  getIubendaWidgetScriptUrl,
  shouldLoadIubendaEmbedLoader,
  shouldLoadIubendaScripts,
} from "@/lib/iubenda";

const inter = Inter({ subsets: ["latin"] });
const iubendaCookieConfig = getIubendaCookieConfig();
const shouldInjectIubenda = shouldLoadIubendaScripts() && Boolean(iubendaCookieConfig);
const shouldInjectIubendaEmbedLoader = shouldLoadIubendaEmbedLoader();
const iubendaWidgetScriptUrl = getIubendaWidgetScriptUrl();

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
        {shouldInjectIubenda && iubendaCookieConfig ? (
          <>
            <Script
              id="iubenda-config"
              strategy="beforeInteractive"
              dangerouslySetInnerHTML={{ __html: buildIubendaConfigScript(iubendaCookieConfig) }}
            />
            <Script
              id="iubenda-autoblocking"
              strategy="beforeInteractive"
              src={`https://cs.iubenda.com/autoblocking/${encodeURIComponent(iubendaCookieConfig.siteId)}.js`}
            />
            <Script
              id="iubenda-gpp-stub"
              strategy="beforeInteractive"
              src="https://cdn.iubenda.com/cs/gpp/stub.js"
            />
            <Script
              id="iubenda-cookie-solution"
              strategy="afterInteractive"
              src="https://cdn.iubenda.com/cs/iubenda_cs.js"
            />
          </>
        ) : null}
        {shouldInjectIubendaEmbedLoader ? (
          <Script
            id="iubenda-embed-loader"
            strategy="afterInteractive"
            src="https://cdn.iubenda.com/iubenda.js"
          />
        ) : null}
        {shouldInjectIubendaEmbedLoader && iubendaWidgetScriptUrl ? (
          <Script
            id="iubenda-widget-script"
            strategy="afterInteractive"
            src={iubendaWidgetScriptUrl}
          />
        ) : null}
      </head>
      <body className={`${inter.className} h-full antialiased`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
