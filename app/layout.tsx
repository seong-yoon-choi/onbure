import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Inter } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { Providers } from "@/components/providers";
import {
  buildIubendaConfigScript,
  getIubendaLegalUrl,
  getIubendaCookieConfig,
  getIubendaWidgetScriptUrl,
  shouldLoadIubendaEmbedLoader,
  shouldLoadIubendaScripts,
} from "@/lib/iubenda";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, getSiteUrl } from "@/lib/seo";

const inter = Inter({ subsets: ["latin"] });
const DEFAULT_IUBENDA_PRIVACY_URL = "https://www.iubenda.com/privacy-policy/31787811";
const DEFAULT_IUBENDA_COOKIE_URL = "https://www.iubenda.com/privacy-policy/31787811/cookie-policy";
const MARKETING_COMMUNICATIONS_LINK = "/legal/marketing-communications";
const iubendaCookieConfig = getIubendaCookieConfig();
const shouldInjectIubenda = shouldLoadIubendaScripts() && Boolean(iubendaCookieConfig);
const shouldInjectIubendaEmbedLoader = shouldLoadIubendaEmbedLoader();
const iubendaWidgetScriptUrl = getIubendaWidgetScriptUrl();
const privacyFooterLink = String(getIubendaLegalUrl("privacy") || DEFAULT_IUBENDA_PRIVACY_URL).trim();
const cookieFooterLink = String(getIubendaLegalUrl("cookie") || DEFAULT_IUBENDA_COOKIE_URL).trim();

function getFooterLegalLinkClassName(href: string) {
  const isIubendaLink = /^https?:\/\/(www\.)?iubenda\.com/i.test(href);
  return `text-[var(--muted)] hover:text-[var(--fg)] hover:underline underline-offset-2${isIubendaLink ? " iubenda-white iubenda-noiframe iubenda-embed" : ""}`;
}

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
  metadataBase: getSiteUrl(),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "technology",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
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
        <Providers>
          <div className="min-h-full flex flex-col">
            <div className="flex-1">{children}</div>
            <footer className="border-t border-[var(--border)] bg-[var(--bg)]">
              <div className="mx-auto max-w-6xl px-4 py-2 flex flex-wrap items-center justify-center gap-2 text-xs text-[var(--muted)]">
                <a
                  href={privacyFooterLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={getFooterLegalLinkClassName(privacyFooterLink)}
                >
                  Privacy Policy
                </a>
                <span aria-hidden="true">|</span>
                <a
                  href={cookieFooterLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={getFooterLegalLinkClassName(cookieFooterLink)}
                >
                  Cookie Policy
                </a>
                <span aria-hidden="true">|</span>
                <Link
                  href={MARKETING_COMMUNICATIONS_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={getFooterLegalLinkClassName(MARKETING_COMMUNICATIONS_LINK)}
                >
                  Marketing Communications
                </Link>
              </div>
            </footer>
          </div>
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
