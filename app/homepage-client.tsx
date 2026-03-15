"use client";

import Image from "next/image";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import { ArrowRight, Globe, Rocket, Search, Sparkles, UserPlus } from "lucide-react";
import { useLanguage } from "@/components/providers";
import { normalizeLanguage } from "@/lib/i18n";
import { HOME_COPY } from "@/lib/i18n/home-copy";
import { APP_LANGUAGES, AppLanguage } from "@/lib/i18n/messages";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });

const featureKeys = [
  {
    titleKey: "feature1Title",
    bodyKey: "feature1Body",
    icon: Search,
    accent: "from-amber-500/25 to-orange-500/10",
  },
  {
    titleKey: "feature2Title",
    bodyKey: "feature2Body",
    icon: UserPlus,
    accent: "from-teal-500/20 to-cyan-500/10",
  },
  {
    titleKey: "feature3Title",
    bodyKey: "feature3Body",
    icon: Rocket,
    accent: "from-slate-900/12 to-slate-500/5",
  },
] as const;

function renderHeroTitle3(language: AppLanguage, title3: string) {
  if (language !== "ko") return title3;

  const match = /^(.*?)(보세요!)$/.exec(title3.trim());
  if (!match) return title3;

  return (
    <>
      {match[1]}
      <span className="whitespace-nowrap">{match[2]}</span>
    </>
  );
}

export default function HomePageClient() {
  const { language, setLanguage, t } = useLanguage();
  const copy = HOME_COPY[language] || HOME_COPY.en;
  const heroTitle3 = renderHeroTitle3(language, copy.title3);

  const languageLabels: Record<AppLanguage, string> = {
    ko: t("language.korean"),
    ja: t("language.japanese"),
    en: t("language.english"),
    fr: t("language.french"),
    es: t("language.spanish"),
  };

  return (
    <main className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.24),_transparent_28%),radial-gradient(circle_at_85%_18%,_rgba(20,184,166,0.18),_transparent_22%),linear-gradient(180deg,_#fffaf3_0%,_#f8fafc_44%,_#eef6ff_100%)] text-slate-950">
      <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),transparent)]" />
      <div className="absolute left-[6%] top-28 h-32 w-32 rounded-full bg-amber-300/25 blur-3xl" />
      <div className="absolute right-[10%] top-44 h-44 w-44 rounded-full bg-teal-400/15 blur-3xl" />

      <section className="relative mx-auto max-w-7xl px-5 pb-20 pt-6 sm:px-8 lg:px-12">
        <header className="mb-14 flex flex-wrap items-center justify-between gap-4 rounded-full border border-slate-200/80 bg-white/75 px-4 py-3 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.4)] backdrop-blur sm:px-5">
          <Link href="/discovery" className="flex items-center gap-3 transition hover:opacity-85">
            <Image
              src="/icon.png"
              alt="Onbure"
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl border border-slate-200/80 bg-white p-1 object-contain shadow-sm"
            />
            <p className={`text-lg font-semibold tracking-tight text-slate-950 ${spaceGrotesk.className}`}>
              Onbure
            </p>
          </Link>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-slate-700">
              <Globe className="h-4 w-4 text-slate-500" />
              <select
                value={language}
                onChange={(event) => setLanguage(normalizeLanguage(event.target.value))}
                aria-label={copy.languageAria}
                className="bg-transparent text-sm text-slate-700 outline-none"
              >
                {APP_LANGUAGES.map((code) => (
                  <option key={code} value={code} className="bg-white text-slate-900">
                    {languageLabels[code]}
                  </option>
                ))}
              </select>
            </div>
            <Link
              className="inline-flex items-center rounded-full border border-slate-300 bg-white/80 px-4 py-2 font-medium text-slate-900 transition hover:border-slate-400 hover:bg-white"
              href="/discovery"
            >
              {copy.navOpenApp}
            </Link>
            <Link
              className="inline-flex items-center rounded-full border border-slate-300 bg-white/80 px-4 py-2 font-medium text-slate-900 transition hover:border-slate-400 hover:bg-white"
              href="/login"
            >
              {copy.navLogIn}
            </Link>
            <Link
              className="inline-flex items-center rounded-full bg-slate-950 px-4 py-2 font-medium text-white transition hover:bg-slate-800"
              href="/register"
            >
              {copy.navCreateAccount}
            </Link>
          </div>
        </header>

        <div className="max-w-5xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-amber-900 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            {copy.badge}
          </div>
          <h1
            className={`max-w-5xl text-5xl font-semibold leading-[0.94] tracking-[-0.05em] text-slate-950 sm:text-6xl lg:text-7xl ${spaceGrotesk.className}`}
          >
            {copy.title1}
            <span className="block text-amber-700">{copy.title2}</span>
            <span className="block">{heroTitle3}</span>
          </h1>
          <p className="mt-6 max-w-4xl text-lg leading-8 text-slate-700 sm:text-xl">
            {copy.description}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/discovery"
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              {copy.heroOpenApp}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/80 px-6 py-3 text-sm font-medium text-slate-900 transition hover:border-slate-400 hover:bg-white"
            >
              {copy.heroCreateAccount}
            </Link>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/80 bg-white/70 p-4 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.55)] backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{copy.miniDiscoveryTitle}</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{copy.miniDiscoveryBody}</p>
            </div>
            <div className="rounded-3xl border border-white/80 bg-white/70 p-4 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.55)] backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{copy.miniWorkspaceTitle}</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{copy.miniWorkspaceBody}</p>
            </div>
            <div className="rounded-3xl border border-white/80 bg-white/70 p-4 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.55)] backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{copy.miniRequestsTitle}</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{copy.miniRequestsBody}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:px-12">
        <div className="mb-8 max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            {copy.sectionKicker}
          </p>
          <h2 className={`mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl ${spaceGrotesk.className}`}>
            {copy.sectionTitle}
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-700 sm:text-lg">
            {copy.sectionDescription}
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {featureKeys.map(({ titleKey, bodyKey, icon: Icon, accent }) => (
            <article
              key={titleKey}
              className="rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,_rgba(255,255,255,0.92),_rgba(255,255,255,0.72))] p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.55)]"
            >
              <div className={`inline-flex rounded-2xl bg-gradient-to-br ${accent} p-3 text-slate-950`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-950">
                {copy[titleKey]}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">{copy[bodyKey]}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
