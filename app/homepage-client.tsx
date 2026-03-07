"use client";

import Image from "next/image";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import { ArrowRight, Globe, Rocket, Search, Sparkles, UserPlus } from "lucide-react";
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
    badge: "Global partners, live translation, real execution",
    navOpenApp: "Find a partner",
    navLogIn: "Log in",
    navCreateAccount: "Create profile",
    title1: "Find the right partner,",
    title2: "start the project,",
    title3: "and bring your idea to life.",
    description:
      "Find collaborators across countries, or create a profile and let the right partner discover you. Onbure helps you move from idea to execution with live translation and shared context from day one.",
    heroOpenApp: "Find a partner",
    heroCreateAccount: "Create your profile",
    miniDiscoveryTitle: "Global profiles",
    miniDiscoveryBody: "Browse people and teams across countries by skills, interests, and readiness before you reach out.",
    miniWorkspaceTitle: "Post your profile",
    miniWorkspaceBody: "Register your profile, share what you want to build, and stay visible to the right partner anywhere.",
    miniRequestsTitle: "Translate and build",
    miniRequestsBody: "Move from first introduction to real execution with live translation and less friction.",
    workflowKicker: "Global partner flow",
    workflowTitle: "Find partners worldwide or be discovered",
    workflowPill: "Explore globally",
    boardTitle: "Share your idea",
    boardBody:
      "Share what you want to build, what kind of partner you need, and which timezone or working style fits best.",
    inboxTitle: "Meet strong matches",
    inboxBody: "Review promising partners from different countries and start clearer conversations from day one.",
    discoveryPanelTitle: "Profile live worldwide",
    discoveryPanelBody: "Create your profile once and stay visible while the right partner looks for someone like you, even across languages.",
    fitTitle: "Live translation",
    fitBody:
      "Some people want to search first. Others want to post a profile and wait. Onbure supports both paths with live translation built in.",
    sectionKicker: "Why Onbure",
    sectionTitle: "Build with the right partner, even across borders",
    sectionDescription:
      "Onbure is built for people who have an idea, but not yet the right person to build it with. Search globally, stay visible, and use live translation to keep execution moving.",
    feature1Title: "Search for global partners",
    feature1Body:
      "Explore public profiles and teams across countries, compare skills and working styles, and reach out when the fit feels real.",
    feature2Title: "Create a profile and get discovered",
    feature2Body:
      "Tell people what you want to build and what kind of partner you need so the right person can find you from anywhere.",
    feature3Title: "Execute without language friction",
    feature3Body:
      "Keep requests, context, and collaboration in one place with live translation so the idea keeps moving after the introduction.",
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
    badge: "グローバルパートナー、リアルタイム翻訳、アイデアの実行",
    navOpenApp: "パートナーを探す",
    navLogIn: "ログイン",
    navCreateAccount: "プロフィール作成",
    title1: "最適なパートナーを見つけ、",
    title2: "プロジェクトを始め、",
    title3: "アイデアを現実にしましょう。",
    description:
      "今すぐパートナーを探すか、プロフィールを登録してチームを作りましょう。Onbure はリアルタイム翻訳でグローバルパートナーとの会話を途切れなくつなぎ、アイデアが実行まで進むよう支えます。",
    heroOpenApp: "パートナーを探す",
    heroCreateAccount: "プロフィール作成",
    miniDiscoveryTitle: "グローバルプロフィール",
    miniDiscoveryBody: "国をまたいで、スキル、関心、準備状況から一緒に進める人やチームを探せます。",
    miniWorkspaceTitle: "プロフィール掲載",
    miniWorkspaceBody: "何を作りたいかを共有し、世界中の相性の良いパートナーに見つけてもらいましょう。",
    miniRequestsTitle: "翻訳しながら実行",
    miniRequestsBody: "最初の会話から協業まで、リアルタイム翻訳と共有コンテキストで流れを止めません。",
    workflowKicker: "グローバルパートナーの流れ",
    workflowTitle: "世界中のパートナーを探す、または見つけてもらう",
    workflowPill: "グローバル探索",
    boardTitle: "アイデアを共有",
    boardBody:
      "何を作りたいか、どんなパートナーが必要か、どの国や時間帯が合うかをまとめて伝えましょう。",
    inboxTitle: "合うパートナーを探す",
    inboxBody: "複数の国の有力な候補を比べ、リアルタイム翻訳でそのまま会話を始められます。",
    discoveryPanelTitle: "プロフィールを世界に公開",
    discoveryPanelBody: "プロフィールを一度登録すれば、言語の違うパートナーにもアイデアが届きます。",
    fitTitle: "なぜ使いやすいのか",
    fitBody:
      "自分で探したい人も、プロフィールを載せて待ちたい人もいます。Onbure はリアルタイム翻訳でその両方を支えます。",
    sectionKicker: "なぜ Onbure なのか",
    sectionTitle: "国境を越えて、合うパートナーとアイデアを実行する方法",
    sectionDescription:
      "Onbure はアイデアはあるが一緒に作るパートナーがまだいない人のための場所です。世界中から相手を探し、プロフィールを公開し、リアルタイム翻訳で止まらず実行できます。",
    feature1Title: "世界中のパートナーを探す",
    feature1Body:
      "公開プロフィールやチームを見て、国・スキル・方向性を比較し、相性の良い相手に連絡できます。",
    feature2Title: "プロフィールを公開してグローバルマッチを待つ",
    feature2Body:
      "作りたいものと必要な役割を書いておけば、別の国の相手から見つけてもらえます。",
    feature3Title: "リアルタイム翻訳で止まらず実行",
    feature3Body:
      "会話、リクエスト、協業の流れをリアルタイム翻訳と一緒につなぎ、言語の壁なしで進められます。",
    languageAria: "言語を選択",
  },
  fr: {
    badge: "Partenaires mondiaux, traduction en temps réel, exécution des idées",
    navOpenApp: "Trouver un partenaire",
    navLogIn: "Connexion",
    navCreateAccount: "Créer un profil",
    title1: "Trouvez le bon partenaire,",
    title2: "lancez le projet,",
    title3: "et donnez vie à votre idée.",
    description:
      "Trouvez directement un partenaire ou créez un profil pour former votre équipe. Onbure permet de parler sans friction avec des partenaires du monde entier grâce à la traduction en temps réel et vous aide à mener l'idée jusqu'à l'exécution.",
    heroOpenApp: "Trouver un partenaire",
    heroCreateAccount: "Créer un profil",
    miniDiscoveryTitle: "Profils globaux",
    miniDiscoveryBody: "Parcourez des personnes et des équipes de différents pays selon les compétences, les centres d'intérêt et la disponibilité.",
    miniWorkspaceTitle: "Publier un profil",
    miniWorkspaceBody: "Expliquez ce que vous voulez construire et laissez le bon partenaire vous découvrir, où qu'il soit.",
    miniRequestsTitle: "Traduire et avancer",
    miniRequestsBody: "Passez du premier échange à l'exécution avec la traduction en temps réel et un contexte partagé.",
    workflowKicker: "Flux partenaire global",
    workflowTitle: "Trouvez des partenaires dans le monde ou soyez découvert",
    workflowPill: "Explorer le monde",
    boardTitle: "Partager votre idée",
    boardBody:
      "Décrivez ce que vous voulez construire, le type de partenaire recherché et le fuseau horaire qui vous convient.",
    inboxTitle: "Trouver les bons profils",
    inboxBody: "Comparez des partenaires prometteurs dans plusieurs pays et démarrez des conversations plus claires dès le premier jour.",
    discoveryPanelTitle: "Profil visible partout",
    discoveryPanelBody: "Créez votre profil une fois et restez visible même auprès de partenaires qui parlent une autre langue.",
    fitTitle: "Traduction en direct",
    fitBody:
      "Certaines personnes préfèrent chercher d'abord. D'autres préfèrent publier leur profil et attendre. Onbure prend en charge les deux avec la traduction en temps réel.",
    sectionKicker: "Pourquoi Onbure",
    sectionTitle: "Construire avec le bon partenaire, même au-delà des frontières",
    sectionDescription:
      "Onbure est pensé pour celles et ceux qui ont une idée, mais pas encore le bon partenaire pour la construire. Cherchez à l'international, rendez votre profil visible et avancez sans blocage grâce à la traduction en temps réel.",
    feature1Title: "Chercher des partenaires à l'international",
    feature1Body:
      "Explorez des profils et des équipes publiques dans différents pays, comparez les compétences et les façons de travailler, puis contactez la bonne personne.",
    feature2Title: "Créer un profil et vous faire découvrir",
    feature2Body:
      "Expliquez ce que vous voulez construire et le type de partenaire recherché pour que la bonne personne vous trouve, où qu'elle soit.",
    feature3Title: "Exécuter sans blocage de langue",
    feature3Body:
      "Gardez demandes, contexte et collaboration au même endroit avec la traduction en temps réel pour que l'idée continue d'avancer.",
    languageAria: "Choisir la langue",
  },
  es: {
    badge: "Socios globales, traducción en tiempo real, ideas en ejecución",
    navOpenApp: "Buscar socio",
    navLogIn: "Iniciar sesión",
    navCreateAccount: "Crear perfil",
    title1: "Encuentra al socio adecuado,",
    title2: "empieza el proyecto,",
    title3: "y haz realidad tu idea.",
    description:
      "Busca un socio directamente o crea un perfil para formar tu equipo. Onbure mantiene conversaciones fluidas con socios globales gracias a la traducción en tiempo real y te ayuda a llevar tu idea hasta la ejecución.",
    heroOpenApp: "Buscar socio",
    heroCreateAccount: "Crear perfil",
    miniDiscoveryTitle: "Perfiles globales",
    miniDiscoveryBody: "Explora personas y equipos de distintos países según habilidades, intereses y disponibilidad antes de escribirles.",
    miniWorkspaceTitle: "Publica tu perfil",
    miniWorkspaceBody: "Comparte lo que quieres construir y deja que el socio adecuado te descubra desde cualquier lugar.",
    miniRequestsTitle: "Traduce y ejecuta",
    miniRequestsBody: "Pasa de la primera conversación a la ejecución con traducción en tiempo real y contexto compartido.",
    workflowKicker: "Flujo global de socios",
    workflowTitle: "Encuentra socios en todo el mundo o deja que te descubran",
    workflowPill: "Explorar globalmente",
    boardTitle: "Comparte tu idea",
    boardBody:
      "Cuenta qué quieres construir, qué tipo de socio necesitas y qué país o zona horaria encaja mejor.",
    inboxTitle: "Encuentra socios adecuados",
    inboxBody: "Compara perfiles prometedores de distintos países y empieza conversaciones más claras desde el primer día.",
    discoveryPanelTitle: "Perfil visible en todo el mundo",
    discoveryPanelBody: "Crea tu perfil una vez y mantente visible incluso para socios que hablan otro idioma.",
    fitTitle: "Traducción en vivo",
    fitBody:
      "Algunas personas quieren buscar primero. Otras prefieren publicar su perfil y esperar. Onbure permite ambos caminos con traducción en tiempo real.",
    sectionKicker: "Por qué Onbure",
    sectionTitle: "Construye con el socio adecuado, incluso entre países",
    sectionDescription:
      "Onbure está pensado para personas que tienen una idea, pero aún no al socio adecuado para construirla. Busca globalmente, mantén tu perfil visible y avanza con traducción en tiempo real.",
    feature1Title: "Busca socios globales",
    feature1Body:
      "Explora perfiles y equipos públicos de distintos países, compara habilidades y estilos de trabajo, y contacta a la persona adecuada.",
    feature2Title: "Crea un perfil y deja que te encuentren",
    feature2Body:
      "Explica qué quieres construir y qué socio necesitas para que la persona correcta te encuentre desde cualquier lugar.",
    feature3Title: "Ejecuta sin fricción de idioma",
    feature3Body:
      "Mantén solicitudes, contexto y colaboración en un solo lugar con traducción en tiempo real para que la idea siga avanzando.",
    languageAria: "Seleccionar idioma",
  },
};

const HOME_COPY_KO_OVERRIDE: HomeCopy = {
  badge: "글로벌 파트너, 실시간 번역, 아이디어 실행",
  navOpenApp: "파트너 찾기",
  navLogIn: "로그인",
  navCreateAccount: "프로필 만들기",
  title1: "함께할 사람을 찾아서,",
  title2: "프로젝트를 만들고,",
  title3: "여러분의 아이디어를 실현시켜 보세요!",
  description:
    "지금 직접 파트너를 찾거나 프로필을 등록해 팀을 만들어 보세요. Onbure는 실시간 번역으로 글로벌 파트너와 대화를 막힘없이 이어 주고, 아이디어가 실행까지 이어지도록 돕습니다.",
  heroOpenApp: "파트너 찾기",
  heroCreateAccount: "프로필 만들기",
  miniDiscoveryTitle: "글로벌 프로필 탐색",
  miniDiscoveryBody: "나라가 달라도 스킬, 관심사, 준비 상태를 보고 함께할 사람이나 팀을 찾을 수 있습니다.",
  miniWorkspaceTitle: "프로필 등록",
  miniWorkspaceBody: "무엇을 만들고 싶은지 올려두고, 전 세계의 맞는 파트너가 당신을 발견하도록 기다려보세요.",
  miniRequestsTitle: "번역하며 실행",
  miniRequestsBody: "첫 대화부터 협업까지 실시간 번역과 공유된 맥락으로 아이디어를 끊기지 않게 이어갑니다.",
  workflowKicker: "글로벌 파트너 흐름",
  workflowTitle: "전 세계 파트너를 찾거나, 발견되거나",
  workflowPill: "글로벌 탐색",
  boardTitle: "아이디어 공유",
  boardBody: "무엇을 만들고 싶은지, 어떤 파트너가 필요한지, 어느 나라나 시간대와 잘 맞는지 함께 적어보세요.",
  inboxTitle: "맞는 파트너 찾기",
  inboxBody: "다른 나라의 유망한 파트너를 비교하고, 실시간 번역으로 바로 대화를 시작할 수 있습니다.",
  discoveryPanelTitle: "전 세계에 프로필 공개",
  discoveryPanelBody: "프로필을 한 번 등록해두면, 다른 언어를 쓰는 파트너에게도 당신의 아이디어가 닿을 수 있습니다.",
  fitTitle: "왜 잘 맞을까",
  fitBody: "직접 찾든, 프로필을 올려두고 기다리든 괜찮습니다. Onbure는 실시간 번역으로 글로벌 협업의 장벽을 낮춥니다.",
  sectionKicker: "왜 Onbure인가",
  sectionTitle: "국경을 넘어 맞는 파트너와 아이디어를 실행하는 방법",
  sectionDescription:
    "Onbure는 아이디어는 있지만 함께 만들 파트너가 없는 사람들을 위한 공간입니다. 전 세계에서 파트너를 찾고, 프로필을 공개하고, 실시간 번역으로 막힘 없이 실행해보세요.",
  feature1Title: "전 세계 파트너 탐색",
  feature1Body: "공개 프로필과 팀을 둘러보며 나라, 스킬, 방향을 비교하고 잘 맞는 사람에게 연락할 수 있습니다.",
  feature2Title: "프로필을 올리고 글로벌 매칭 기다리기",
  feature2Body: "무엇을 만들고 싶은지와 필요한 역할을 적어두면, 다른 나라의 맞는 파트너도 먼저 당신을 찾을 수 있습니다.",
  feature3Title: "실시간 번역으로 막힘 없이 실행",
  feature3Body: "대화와 요청, 협업 흐름을 실시간 번역과 함께 이어가며 언어 장벽 없이 프로젝트를 움직일 수 있습니다.",
  languageAria: "언어 선택",
};

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

export default function HomePageClient() {
  const { language, setLanguage, t } = useLanguage();
  const copy = language === "ko" ? HOME_COPY_KO_OVERRIDE : HOME_COPY[language] || HOME_COPY.en;

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
            <span className="block">{copy.title3}</span>
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
