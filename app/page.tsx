import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import { ArrowRight, Globe2, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { absoluteUrl, buildPageMetadata, SITE_NAME } from "@/lib/seo";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });

export const metadata: Metadata = buildPageMetadata({
  title: "Collaboration Workspace For Startup Teams",
  description:
    "Onbure helps startup teams discover collaborators, organize shared workspaces, manage requests, and keep projects moving in one place.",
  pathname: "/",
  keywords: [
    "Onbure startup teams",
    "collaboration workspace",
    "team discovery platform",
    "shared project workspace",
    "request management",
  ],
});

const brandSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: SITE_NAME,
      url: absoluteUrl("/"),
      logo: absoluteUrl("/icon.png"),
    },
    {
      "@type": "WebSite",
      name: SITE_NAME,
      url: absoluteUrl("/"),
      description:
        "A collaboration workspace for startup teams to discover collaborators, manage requests, and organize shared work.",
    },
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: absoluteUrl("/"),
      description:
        "Onbure is a web-based collaboration workspace for startup teams, requests, and shared project coordination.",
    },
  ],
};

const featureCards = [
  {
    title: "Discover the right collaborators",
    description:
      "Browse public teams and people profiles, review skills, and find a better match before you start working together.",
    icon: Globe2,
    accent: "from-amber-500/25 to-orange-500/10",
  },
  {
    title: "Run work from one shared workspace",
    description:
      "Collect links, files, notes, and task context in one place so each team can move faster without scattered tools.",
    icon: Workflow,
    accent: "from-teal-500/20 to-cyan-500/10",
  },
  {
    title: "Keep requests and approvals visible",
    description:
      "Handle invites, chat requests, and team join flows with a dedicated request layer instead of losing context in DMs.",
    icon: ShieldCheck,
    accent: "from-slate-900/12 to-slate-500/5",
  },
];

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(brandSchema) }}
      />
      <main className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.24),_transparent_28%),radial-gradient(circle_at_85%_18%,_rgba(20,184,166,0.18),_transparent_22%),linear-gradient(180deg,_#fffaf3_0%,_#f8fafc_44%,_#eef6ff_100%)] text-slate-950">
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),transparent)]" />
        <div className="absolute left-[6%] top-28 h-32 w-32 rounded-full bg-amber-300/25 blur-3xl" />
        <div className="absolute right-[10%] top-44 h-44 w-44 rounded-full bg-teal-400/15 blur-3xl" />

        <section className="relative mx-auto max-w-6xl px-5 pb-20 pt-6 sm:px-8 lg:px-10">
          <header className="mb-14 flex flex-wrap items-center justify-between gap-4 rounded-full border border-slate-200/80 bg-white/75 px-5 py-3 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.4)] backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                ON
              </div>
              <div>
                <p className={`text-lg font-semibold tracking-tight text-slate-950 ${spaceGrotesk.className}`}>
                  Onbure
                </p>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Team collaboration workspace
                </p>
              </div>
            </div>
            <nav className="flex flex-wrap items-center gap-3 text-sm">
              <Link className="text-slate-600 transition hover:text-slate-950" href="/legal/us">
                Legal
              </Link>
              <Link className="text-slate-600 transition hover:text-slate-950" href="/login">
                Log in
              </Link>
              <Link
                className="inline-flex items-center rounded-full bg-slate-950 px-4 py-2 font-medium text-white transition hover:bg-slate-800"
                href="/register"
              >
                Create account
              </Link>
            </nav>
          </header>

          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-center">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-amber-900 shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Built for startup teams and collaborators
              </div>
              <h1
                className={`max-w-4xl text-5xl font-semibold leading-[0.94] tracking-[-0.05em] text-slate-950 sm:text-6xl lg:text-7xl ${spaceGrotesk.className}`}
              >
                Find collaborators,
                <span className="block text-amber-700">organize shared work,</span>
                and keep every request moving.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700 sm:text-xl">
                Onbure is a web-based collaboration platform for teams that need a cleaner way to
                discover people, coordinate projects, and manage invites, chat requests, and
                workspace activity in one place.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  Start with Onbure
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/80 px-6 py-3 text-sm font-medium text-slate-900 transition hover:border-slate-400 hover:bg-white"
                >
                  Open the app
                </Link>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/80 bg-white/70 p-4 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.55)] backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Discovery</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    Public team and people browsing with richer collaboration context.
                  </p>
                </div>
                <div className="rounded-3xl border border-white/80 bg-white/70 p-4 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.55)] backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Workspace</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    Shared links, files, notes, and tasks in a single team space.
                  </p>
                </div>
                <div className="rounded-3xl border border-white/80 bg-white/70 p-4 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.55)] backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Requests</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    Join, invite, and chat request flows that stay visible and organized.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-[2rem] bg-[linear-gradient(140deg,rgba(15,23,42,0.14),rgba(245,158,11,0.08),rgba(13,148,136,0.12))] blur-2xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-slate-950 p-6 text-white shadow-[0_40px_110px_-50px_rgba(15,23,42,0.8)]">
                <div className="mb-8 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/45">Live workflow</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight">Onbure workspace</p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                    Team ready
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-medium text-white/90">Shared project board</p>
                    <p className="mt-2 text-sm leading-6 text-white/60">
                      Keep links, notes, and files connected to the same team context instead of
                      scattering them across tools and chat threads.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-300/10 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-amber-100/75">
                        Request inbox
                      </p>
                      <p className="mt-3 text-sm leading-6 text-amber-50/90">
                        Accept team invites, track pending conversations, and keep decisions visible.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-teal-300/20 bg-teal-300/10 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-teal-100/75">
                        Team discovery
                      </p>
                      <p className="mt-3 text-sm leading-6 text-teal-50/90">
                        Review profiles, skills, and availability before starting a new collaboration.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/45">Best fit</p>
                    <p className="mt-3 text-sm leading-6 text-white/65">
                      Onbure works best for startup teams, project-based collaborators, and operators
                      who need one lightweight place to coordinate people and work.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8 lg:px-10">
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              Why teams use Onbure
            </p>
            <h2 className={`mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl ${spaceGrotesk.className}`}>
              A clearer collaboration layer for early-stage teams
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-700 sm:text-lg">
              Search engines need real public content to understand what Onbure does. This page
              explains the product in plain language while the app itself stays focused on the
              logged-in workflow.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {featureCards.map(({ title, description, icon: Icon, accent }) => (
              <article
                key={title}
                className={`rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,_rgba(255,255,255,0.92),_rgba(255,255,255,0.72))] p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.55)]`}
              >
                <div className={`inline-flex rounded-2xl bg-gradient-to-br ${accent} p-3 text-slate-950`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-950">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-700">{description}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.55)] sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="max-w-2xl">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
                  Ready to launch
                </p>
                <h3 className={`mt-2 text-2xl font-semibold tracking-tight text-slate-950 ${spaceGrotesk.className}`}>
                  Make Onbure the page Google can actually understand
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-700 sm:text-base">
                  Use the public homepage for brand discovery, keep app routes focused on product
                  workflows, and send new users into the app only after they know what Onbure is.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center rounded-full bg-amber-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-amber-700"
                >
                  Create account
                </Link>
                <Link
                  href="/legal/us"
                  className="inline-flex items-center rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-900 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Review legal pages
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
