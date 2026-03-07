"use client";

import Image from "next/image";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import { ArrowRight, Globe, Globe2, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { useLanguage } from "@/components/providers";
import { normalizeLanguage } from "@/lib/i18n";
import { APP_LANGUAGES, AppLanguage } from "@/lib/i18n/messages";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });

type HomeCopy = {
  badge: string;
  navOpenApp: string;
  navLogIn: string;
  navCreateAccount: string;
  title1: string;
  title2: string;
  title3: string;
  description: string;
  heroOpenApp: string;
  heroCreateAccount: string;
  miniDiscoveryTitle: string;
  miniDiscoveryBody: string;
  miniWorkspaceTitle: string;
  miniWorkspaceBody: string;
  miniRequestsTitle: string;
  miniRequestsBody: string;
  workflowKicker: string;
  workflowTitle: string;
  workflowPill: string;
  boardTitle: string;
  boardBody: string;
  inboxTitle: string;
  inboxBody: string;
  discoveryPanelTitle: string;
  discoveryPanelBody: string;
  fitTitle: string;
  fitBody: string;
  sectionKicker: string;
  sectionTitle: string;
  sectionDescription: string;
  feature1Title: string;
  feature1Body: string;
  feature2Title: string;
  feature2Body: string;
  feature3Title: string;
  feature3Body: string;
  languageAria: string;
};

const HOME_COPY: Record<AppLanguage, HomeCopy> = {
  en: {
    badge: "Built for bold teams and collaborators",
    navOpenApp: "Open the app",
    navLogIn: "Log in",
    navCreateAccount: "Create account",
    title1: "Find the right people,",
    title2: "start your next project,",
    title3: "and build it together with momentum.",
    description:
      "Onbure helps you meet collaborators who share your energy, explore active teams, and turn early ideas into real projects with requests, workspaces, and shared context in one place.",
    heroOpenApp: "Open the app",
    heroCreateAccount: "Create account",
    miniDiscoveryTitle: "Discovery",
    miniDiscoveryBody: "Browse people and teams before you commit to working together.",
    miniWorkspaceTitle: "Workspace",
    miniWorkspaceBody: "Keep links, files, notes, and tasks together in one shared flow.",
    miniRequestsTitle: "Requests",
    miniRequestsBody: "Track invites, join requests, and chat openings without losing context.",
    workflowKicker: "Live workflow",
    workflowTitle: "Onbure workspace",
    workflowPill: "Explore ready",
    boardTitle: "Shared project board",
    boardBody:
      "Keep links, notes, and files connected to the same team context instead of scattering them across tools and chat threads.",
    inboxTitle: "Request inbox",
    inboxBody: "Accept invites, track pending conversations, and keep decisions visible.",
    discoveryPanelTitle: "Team discovery",
    discoveryPanelBody: "Review profiles, skills, and availability before starting a new collaboration.",
    fitTitle: "Best fit",
    fitBody:
      "Onbure works best for startup teams, project collaborators, and operators who need one lightweight place to coordinate people and work.",
    sectionKicker: "Why teams use Onbure",
    sectionTitle: "A clearer collaboration layer for early-stage teams",
    sectionDescription:
      "From the first match to the first launch, Onbure helps teams gather fast, start projects confidently, and keep the energy moving.",
    feature1Title: "Discover the right collaborators",
    feature1Body:
      "Browse public teams and people profiles, review skills, and find a better match before you start working together.",
    feature2Title: "Run work from one shared workspace",
    feature2Body:
      "Collect links, files, notes, and task context in one place so each team can move faster without scattered tools.",
    feature3Title: "Keep requests and approvals visible",
    feature3Body:
      "Handle invites, chat requests, and join flows with a dedicated request layer instead of losing context in direct messages.",
    languageAria: "Select language",
  },
  ko: {
    badge: "열정 있는 팀과 협업자를 위한 시작점",
    navOpenApp: "앱 둘러보기",
    navLogIn: "로그인",
    navCreateAccount: "계정 만들기",
    title1: "함께할 사람을 찾아서,",
    title2: "프로젝트를 만들고,",
    title3: "여러분의 아이디어를 실현시켜 보세요!",
    description:
      "Onbure는 같은 열정과 협업 감각을 가진 사람들을 만나고, 팀을 둘러보고, 아이디어를 실제 프로젝트로 자연스럽게 구체화할 수 있도록 요청, 워크스페이스, 공유 흐름을 한곳에 모아둔 협업 플랫폼입니다.",
    heroOpenApp: "앱 둘러보기",
    heroCreateAccount: "계정 만들기",
    miniDiscoveryTitle: "탐색",
    miniDiscoveryBody: "함께 일하기 전에 사람과 팀을 먼저 살펴볼 수 있습니다.",
    miniWorkspaceTitle: "워크스페이스",
    miniWorkspaceBody: "링크, 파일, 노트, 작업을 하나의 흐름으로 모아둡니다.",
    miniRequestsTitle: "요청",
    miniRequestsBody: "초대, 참가 요청, 대화 시작을 맥락 잃지 않고 관리합니다.",
    workflowKicker: "실시간 흐름",
    workflowTitle: "Onbure 워크스페이스",
    workflowPill: "바로 둘러보기",
    boardTitle: "공유 프로젝트 보드",
    boardBody:
      "링크, 노트, 파일을 같은 팀 맥락 안에 묶어두어 여러 도구와 채팅에 흩어지지 않게 합니다.",
    inboxTitle: "요청 인박스",
    inboxBody: "초대를 수락하고, 진행 중인 대화를 확인하고, 의사결정을 눈에 보이게 유지합니다.",
    discoveryPanelTitle: "팀 탐색",
    discoveryPanelBody: "협업을 시작하기 전에 프로필, 스킬, 가능 시간을 확인할 수 있습니다.",
    fitTitle: "잘 맞는 팀",
    fitBody:
      "Onbure는 스타트업 팀, 프로젝트 협업자, 운영 담당자가 사람과 일을 가볍게 조율해야 할 때 가장 잘 맞습니다.",
    sectionKicker: "왜 Onbure를 쓰는가",
    sectionTitle: "초기 팀을 위한 더 선명한 협업 레이어",
    sectionDescription:
      "첫 만남부터 첫 실행까지, Onbure는 팀이 빠르게 모이고 자신 있게 프로젝트를 시작할 수 있도록 돕습니다.",
    feature1Title: "맞는 협업자를 더 쉽게 찾기",
    feature1Body:
      "공개 팀과 사람 프로필을 보고, 스킬을 비교하고, 함께 일하기 전에 더 잘 맞는 조합을 찾을 수 있습니다.",
    feature2Title: "하나의 공유 공간에서 일하기",
    feature2Body:
      "링크, 파일, 노트, 작업 맥락을 한곳에 모아 팀이 도구를 오가느라 흐트러지지 않게 합니다.",
    feature3Title: "요청과 승인 흐름을 눈에 보이게",
    feature3Body:
      "초대, 채팅 요청, 참여 흐름을 전용 요청 레이어에서 관리해 DM에 묻히지 않게 합니다.",
    languageAria: "언어 선택",
  },
  ja: {
    badge: "情熱あるチームと仲間のためのスタート地点",
    navOpenApp: "アプリを見る",
    navLogIn: "ログイン",
    navCreateAccount: "アカウント作成",
    title1: "一緒に走る仲間を見つけ、",
    title2: "あなたのプロジェクトを動かし、",
    title3: "最後までチームで進めましょう。",
    description:
      "Onbure は、同じ熱量を持つ仲間と出会い、チームを探し、アイデアを本当のプロジェクトに変えるためのコラボレーションプラットフォームです。リクエスト、ワークスペース、共有の流れを一つにまとめます。",
    heroOpenApp: "アプリを見る",
    heroCreateAccount: "アカウント作成",
    miniDiscoveryTitle: "探索",
    miniDiscoveryBody: "一緒に働く前に、人とチームを先に確認できます。",
    miniWorkspaceTitle: "ワークスペース",
    miniWorkspaceBody: "リンク、ファイル、ノート、タスクを一つの流れにまとめます。",
    miniRequestsTitle: "リクエスト",
    miniRequestsBody: "招待、参加申請、チャット開始を文脈のまま管理します。",
    workflowKicker: "ライブワークフロー",
    workflowTitle: "Onbure ワークスペース",
    workflowPill: "すぐに閲覧",
    boardTitle: "共有プロジェクトボード",
    boardBody:
      "リンク、ノート、ファイルを同じチーム文脈に保ち、複数ツールやチャットに散らばらないようにします。",
    inboxTitle: "リクエスト受信箱",
    inboxBody: "招待を承認し、進行中の会話を追い、意思決定を見える形で保ちます。",
    discoveryPanelTitle: "チーム探索",
    discoveryPanelBody: "コラボを始める前に、プロフィール、スキル、稼働時間を確認できます。",
    fitTitle: "最適な使い方",
    fitBody:
      "Onbure は、スタートアップチーム、プロジェクト型の協力者、運営担当者が人と仕事を軽く整理したいときに最適です。",
    sectionKicker: "Onbure が選ばれる理由",
    sectionTitle: "初期チームのための、より明確なコラボレーションレイヤー",
    sectionDescription:
      "最初の出会いから最初の実行まで、Onbure はチームが素早く集まり、そのままプロジェクトを始められるようにします。",
    feature1Title: "適したコラボレーターを見つけやすい",
    feature1Body:
      "公開チームや人物プロフィールを見て、スキルを確認し、共同作業を始める前に相性の良い組み合わせを探せます。",
    feature2Title: "一つの共有ワークスペースで進める",
    feature2Body:
      "リンク、ファイル、ノート、タスク文脈を一か所に集め、チームが複数ツールで分断されないようにします。",
    feature3Title: "リクエストと承認を見えるまま保つ",
    feature3Body:
      "招待、チャット申請、参加フローを専用レイヤーで扱い、DM に埋もれないようにします。",
    languageAria: "言語を選択",
  },
  fr: {
    badge: "Le point de départ pour des équipes et collaborateurs ambitieux",
    navOpenApp: "Ouvrir l'app",
    navLogIn: "Connexion",
    navCreateAccount: "Créer un compte",
    title1: "Trouvez les bonnes personnes,",
    title2: "lancez votre prochain projet,",
    title3: "et faites-le avancer ensemble.",
    description:
      "Onbure réunit des collaborateurs qui partagent la même énergie, aide à explorer les équipes et transforme une idée en vrai projet grâce aux demandes, aux workspaces et à un flux partagé au même endroit.",
    heroOpenApp: "Ouvrir l'app",
    heroCreateAccount: "Créer un compte",
    miniDiscoveryTitle: "Découverte",
    miniDiscoveryBody: "Parcourez les personnes et les équipes avant de commencer à travailler ensemble.",
    miniWorkspaceTitle: "Espace de travail",
    miniWorkspaceBody: "Gardez liens, fichiers, notes et tâches dans un même flux partagé.",
    miniRequestsTitle: "Demandes",
    miniRequestsBody: "Suivez invitations, demandes d'accès et ouvertures de chat sans perdre le contexte.",
    workflowKicker: "Flux en direct",
    workflowTitle: "Workspace Onbure",
    workflowPill: "Prêt à explorer",
    boardTitle: "Tableau de projet partagé",
    boardBody:
      "Reliez liens, notes et fichiers au même contexte d'équipe au lieu de les disperser entre plusieurs outils et discussions.",
    inboxTitle: "Boîte de demandes",
    inboxBody: "Acceptez les invitations, suivez les conversations en attente et gardez les décisions visibles.",
    discoveryPanelTitle: "Découverte d'équipe",
    discoveryPanelBody: "Consultez profils, compétences et disponibilités avant de lancer une collaboration.",
    fitTitle: "Meilleur usage",
    fitBody:
      "Onbure convient surtout aux équipes startup, aux collaborateurs projet et aux opérations qui veulent coordonner personnes et travail dans un espace léger.",
    sectionKicker: "Pourquoi les équipes utilisent Onbure",
    sectionTitle: "Une couche de collaboration plus claire pour les équipes en phase de lancement",
    sectionDescription:
      "De la première rencontre au premier lancement, Onbure aide les équipes à se rassembler vite et à démarrer un projet sans perdre l'élan.",
    feature1Title: "Trouver plus facilement les bons collaborateurs",
    feature1Body:
      "Parcourez des équipes publiques et des profils, comparez les compétences et identifiez un meilleur fit avant de collaborer.",
    feature2Title: "Travailler depuis un espace partagé unique",
    feature2Body:
      "Rassemblez liens, fichiers, notes et contexte de travail au même endroit pour éviter la dispersion entre outils.",
    feature3Title: "Garder visibles demandes et validations",
    feature3Body:
      "Gérez invitations, chats et flux de participation dans une couche dédiée plutôt que dans des messages privés dispersés.",
    languageAria: "Choisir la langue",
  },
  es: {
    badge: "El punto de partida para equipos y colaboradores con impulso",
    navOpenApp: "Abrir la app",
    navLogIn: "Iniciar sesión",
    navCreateAccount: "Crear cuenta",
    title1: "Encuentra a las personas correctas,",
    title2: "pon en marcha tu proyecto,",
    title3: "y hazlo avanzar en equipo.",
    description:
      "Onbure conecta a colaboradores con la misma energía, te deja explorar equipos y convertir una idea en un proyecto real con solicitudes, workspaces y un flujo compartido en un solo lugar.",
    heroOpenApp: "Abrir la app",
    heroCreateAccount: "Crear cuenta",
    miniDiscoveryTitle: "Discovery",
    miniDiscoveryBody: "Explora personas y equipos antes de empezar a trabajar juntos.",
    miniWorkspaceTitle: "Workspace",
    miniWorkspaceBody: "Mantén enlaces, archivos, notas y tareas en un solo flujo compartido.",
    miniRequestsTitle: "Solicitudes",
    miniRequestsBody: "Sigue invitaciones, solicitudes de ingreso y aperturas de chat sin perder contexto.",
    workflowKicker: "Flujo en vivo",
    workflowTitle: "Workspace Onbure",
    workflowPill: "Listo para explorar",
    boardTitle: "Tablero de proyecto compartido",
    boardBody:
      "Mantén enlaces, notas y archivos conectados al mismo contexto de equipo en lugar de repartirlos entre herramientas y chats.",
    inboxTitle: "Bandeja de solicitudes",
    inboxBody: "Acepta invitaciones, sigue conversaciones pendientes y mantén visibles las decisiones.",
    discoveryPanelTitle: "Descubrimiento de equipos",
    discoveryPanelBody: "Revisa perfiles, habilidades y disponibilidad antes de iniciar una colaboración.",
    fitTitle: "Mejor encaje",
    fitBody:
      "Onbure funciona mejor para equipos startup, colaboradores por proyecto y operadores que necesitan coordinar personas y trabajo en un espacio ligero.",
    sectionKicker: "Por qué los equipos usan Onbure",
    sectionTitle: "Una capa de colaboración más clara para equipos en etapa inicial",
    sectionDescription:
      "Desde el primer match hasta la primera ejecución, Onbure ayuda a los equipos a reunirse rápido y empezar proyectos sin perder impulso.",
    feature1Title: "Descubre a los colaboradores adecuados",
    feature1Body:
      "Explora equipos públicos y perfiles personales, revisa habilidades y encuentra un mejor encaje antes de empezar a colaborar.",
    feature2Title: "Trabaja desde un espacio compartido",
    feature2Body:
      "Reúne enlaces, archivos, notas y contexto de tareas en un solo lugar para que el equipo no se disperse entre herramientas.",
    feature3Title: "Mantén visibles solicitudes y aprobaciones",
    feature3Body:
      "Gestiona invitaciones, chats y flujos de ingreso en una capa dedicada en lugar de perderlos en mensajes directos.",
    languageAria: "Seleccionar idioma",
  },
};

const featureKeys = [
  {
    titleKey: "feature1Title",
    bodyKey: "feature1Body",
    icon: Globe2,
    accent: "from-amber-500/25 to-orange-500/10",
  },
  {
    titleKey: "feature2Title",
    bodyKey: "feature2Body",
    icon: Workflow,
    accent: "from-teal-500/20 to-cyan-500/10",
  },
  {
    titleKey: "feature3Title",
    bodyKey: "feature3Body",
    icon: ShieldCheck,
    accent: "from-slate-900/12 to-slate-500/5",
  },
] as const;

export default function HomePageClient() {
  const { language, setLanguage, t } = useLanguage();
  const copy = HOME_COPY[language] || HOME_COPY.en;

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

      <section className="relative mx-auto max-w-6xl px-5 pb-20 pt-6 sm:px-8 lg:px-10">
        <header className="mb-14 flex flex-wrap items-center justify-between gap-4 rounded-full border border-slate-200/80 bg-white/75 px-4 py-3 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.4)] backdrop-blur sm:px-5">
          <Link href="/discovery" className="flex items-center gap-3 transition hover:opacity-85">
            <Image
              src="/icon.png"
              alt="Onbure"
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl border border-slate-200/80 bg-white object-cover shadow-sm"
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

        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-center">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-amber-900 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              {copy.badge}
            </div>
            <h1
              className={`max-w-4xl text-5xl font-semibold leading-[0.94] tracking-[-0.05em] text-slate-950 sm:text-6xl lg:text-7xl ${spaceGrotesk.className}`}
            >
              {copy.title1}
              <span className="block text-amber-700">{copy.title2}</span>
              <span className="block">{copy.title3}</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700 sm:text-xl">
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

          <div className="relative">
            <div className="absolute inset-0 rounded-[2rem] bg-[linear-gradient(140deg,rgba(15,23,42,0.14),rgba(245,158,11,0.08),rgba(13,148,136,0.12))] blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-slate-950 p-6 text-white shadow-[0_40px_110px_-50px_rgba(15,23,42,0.8)]">
              <div className="mb-6 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/5 shadow-[0_20px_50px_-30px_rgba(8,18,37,0.85)]">
                <Image
                  src="/search-preview.svg"
                  alt="Preview of the Onbure collaboration workspace"
                  width="1200"
                  height="630"
                  priority
                  unoptimized
                  className="block h-auto w-full"
                />
              </div>
              <div className="mb-8 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">{copy.workflowKicker}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">{copy.workflowTitle}</p>
                </div>
                <Link
                  href="/discovery"
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                >
                  {copy.workflowPill}
                </Link>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-medium text-white/90">{copy.boardTitle}</p>
                  <p className="mt-2 text-sm leading-6 text-white/60">{copy.boardBody}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-300/10 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-amber-100/75">
                      {copy.inboxTitle}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-amber-50/90">{copy.inboxBody}</p>
                  </div>
                  <div className="rounded-2xl border border-teal-300/20 bg-teal-300/10 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-teal-100/75">
                      {copy.discoveryPanelTitle}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-teal-50/90">{copy.discoveryPanelBody}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">{copy.fitTitle}</p>
                  <p className="mt-3 text-sm leading-6 text-white/65">{copy.fitBody}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8 lg:px-10">
        <div className="mb-8 max-w-3xl">
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
