"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertModal } from "@/components/ui/modal";
import CreateTeamModal from "@/components/teams/CreateTeamModal";
import { Globe, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackUxClick } from "@/lib/ux/client";
import { useLanguage } from "@/components/providers";

interface DiscoveryClientPageProps {
    initialSearchQuery?: string;
}

interface ContextMenuState {
    x: number;
    y: number;
    kind: "user" | "team";
    id: string;
}

export default function DiscoveryClientPage({ initialSearchQuery = "" }: DiscoveryClientPageProps) {
    const router = useRouter();
    const { t } = useLanguage();
    const { status: sessionStatus } = useSession();
    const [activeTab, setActiveTab] = useState<"teams" | "people">("teams");
    const [teams, setTeams] = useState<any[]>([]);
    const [people, setPeople] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState<{ open: boolean; title: string; message: string }>({
        open: false,
        title: "",
        message: "",
    });
    const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
    const [profileMenu, setProfileMenu] = useState<ContextMenuState | null>(null);
    const [composer, setComposer] = useState<{
        isOpen: boolean;
        toUserId: string;
        toUsername: string;
        message: string;
        isSubmitting: boolean;
        error: string;
    }>({
        isOpen: false,
        toUserId: "",
        toUsername: "",
        message: "",
        isSubmitting: false,
        error: "",
    });

    const normalizeSearchValue = (value: unknown) =>
        String(value || "")
            .trim()
            .replace(/\s+/g, " ")
            .toLowerCase();

    const searchQuery = useMemo(() => initialSearchQuery.trim(), [initialSearchQuery]);
    const normalizedSearchQuery = normalizeSearchValue(searchQuery);
    const isSearching = normalizedSearchQuery.length > 0;
    const searchTokens = useMemo(
        () => normalizedSearchQuery.split(" ").filter(Boolean),
        [normalizedSearchQuery]
    );

    const normalizeShortMessage = (value: string, fallback: string) => {
        const trimmed = value.trim().replace(/\s+/g, " ");
        if (!trimmed) return fallback;
        return trimmed.slice(0, 160);
    };

    const getTeamDescriptionForView = (team: any) =>
        String(team?.descriptionTranslated || team?.description || "").trim();

    const openNotice = (title: string, message: string) => {
        setNotice({
            open: true,
            title,
            message,
        });
    };

    const trackDiscoveryAction = (actionKey: string, context?: Record<string, unknown>) => {
        trackUxClick(actionKey, {
            page: "discovery",
            activeTab,
            searching: isSearching,
            ...context,
        });
    };

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch("/api/discovery");
            if (res.status === 401) {
                router.push("/login");
                return;
            }
            if (!res.ok) {
                throw new Error(t("discovery.error.loadFailedMessage"));
            }

            const data = (await res.json()) as {
                teams?: any[];
                people?: any[];
                partialError?: boolean;
            };
            setTeams(Array.isArray(data.teams) ? data.teams : []);
            setPeople(Array.isArray(data.people) ? data.people : []);

            if (data.partialError) {
                openNotice(t("discovery.error.partialLoadTitle"), t("discovery.error.partialLoadMessage"));
            }
        } catch (error) {
            console.error("Failed to fetch discovery data", error);
            openNotice(t("discovery.error.loadFailedTitle"), t("discovery.error.loadFailedMessage"));
        } finally {
            setLoading(false);
        }
    }, [router, t]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (!profileMenu) return;

        const closeOnOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-discovery-profile-menu='true']")) return;
            setProfileMenu(null);
        };
        const closeOnResize = () => setProfileMenu(null);
        const closeOnKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setProfileMenu(null);
        };

        document.addEventListener("mousedown", closeOnOutside);
        window.addEventListener("resize", closeOnResize);
        window.addEventListener("keydown", closeOnKey);
        return () => {
            document.removeEventListener("mousedown", closeOnOutside);
            window.removeEventListener("resize", closeOnResize);
            window.removeEventListener("keydown", closeOnKey);
        };
    }, [profileMenu]);

    useEffect(() => {
        if (!composer.isOpen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setComposer((prev) => (prev.isSubmitting ? prev : { ...prev, isOpen: false, error: "" }));
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [composer.isOpen, composer.isSubmitting]);

    const closeComposer = () => {
        setComposer((prev) => (prev.isSubmitting ? prev : { ...prev, isOpen: false, error: "" }));
    };

    const openProfileMenu = (event: React.MouseEvent, kind: "user" | "team", id?: string) => {
        if (!id) return;
        event.preventDefault();
        event.stopPropagation();

        const menuWidth = 132;
        const menuHeight = 44;
        const gap = 8;
        const x = Math.min(Math.max(event.clientX, gap), window.innerWidth - menuWidth - gap);
        const y = Math.min(Math.max(event.clientY, gap), window.innerHeight - menuHeight - gap);
        setProfileMenu({ x, y, kind, id });
    };

    const viewProfileFromMenu = () => {
        if (!profileMenu) return;
        if (profileMenu.kind === "team") {
            trackDiscoveryAction("discovery.open_team_profile", { teamId: profileMenu.id, source: "context_menu" });
            router.push(`/teams/${encodeURIComponent(profileMenu.id)}`);
            setProfileMenu(null);
            return;
        }
        trackDiscoveryAction("discovery.open_user_profile", { userId: profileMenu.id, source: "context_menu" });
        router.push(`/people/${encodeURIComponent(profileMenu.id)}`);
        setProfileMenu(null);
    };

    const openJoinComposer = (team: any) => {
        if (sessionStatus === "unauthenticated") {
            router.push("/login");
            return;
        }
        const teamId = String(team?.teamId || "").trim();
        if (!teamId) return;
        trackDiscoveryAction("discovery.team_request", { teamId });

        setComposer({
            isOpen: true,
            toUserId: teamId,
            toUsername: team?.name || t("discovery.defaultTeamName"),
            message: t("discovery.fallbackJoinMessage"),
            isSubmitting: false,
            error: "",
        });
    };

    const submitComposer = async () => {
        if (!composer.isOpen || composer.isSubmitting) return;

        const fallback = t("discovery.fallbackJoinMessage");
        const message = normalizeShortMessage(composer.message, fallback);

        setComposer((prev) => ({ ...prev, isSubmitting: true, error: "" }));

        try {
            const body = {
                type: "JOIN",
                toId: composer.toUserId,
                teamId: composer.toUserId,
                message,
                answers: { a1: message, a2: "" },
            };

            const res = await fetch("/api/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                setTeams((prev) =>
                    prev.map((team) =>
                        team.teamId === composer.toUserId
                            ? { ...team, isJoinRequested: true }
                            : team
                    )
                );
                openNotice(t("discovery.notice.requestSentTitle"), t("discovery.notice.requestSentMessage"));
                setComposer((prev) => ({ ...prev, isOpen: false, isSubmitting: false, error: "" }));
                return;
            }

            if (res.status === 409) {
                setTeams((prev) =>
                    prev.map((team) =>
                        team.teamId === composer.toUserId
                            ? { ...team, isJoinRequested: true }
                            : team
                    )
                );
                openNotice(
                    t("discovery.notice.alreadyRequestedTitle"),
                    data.error || t("discovery.notice.alreadyRequestedMessage")
                );
                setComposer((prev) => ({ ...prev, isOpen: false, isSubmitting: false, error: "" }));
                return;
            }

            setComposer((prev) => ({
                ...prev,
                isSubmitting: false,
                error: data.error || t("discovery.error.requestFailed"),
            }));
        } catch (error) {
            console.error(error);
            setComposer((prev) => ({ ...prev, isSubmitting: false, error: t("discovery.error.requestFailed") }));
        }
    };

    const filteredTeams = useMemo(() => {
        if (!normalizedSearchQuery) return teams;
        return teams.filter((team) => {
            const candidates = [
                team?.name,
                team?.description,
                team?.descriptionTranslated,
                team?.visibility,
                team?.stage,
                team?.language,
                ...(Array.isArray(team?.recruitingRoles) ? team.recruitingRoles : []),
            ]
                .filter(Boolean)
                .map((value) => normalizeSearchValue(value));
            return searchTokens.every((token) => candidates.some((value) => value.includes(token)));
        });
    }, [teams, normalizedSearchQuery, searchTokens]);

    const filteredPeople = useMemo(() => {
        if (!normalizedSearchQuery) return people;
        return people.filter((person) => {
            const candidates = [
                person?.username,
                person?.publicCode,
                person?.bio,
                person?.country,
                person?.language,
                person?.availabilityHours,
                ...(Array.isArray(person?.skills) ? person.skills : []),
            ]
                .filter(Boolean)
                .map((value) => normalizeSearchValue(value));
            return searchTokens.every((token) => candidates.some((value) => value.includes(token)));
        });
    }, [people, normalizedSearchQuery, searchTokens]);

    return (
        <>
            <div className="space-y-6">
                {isSearching ? (
                    <div className="space-y-1 border-b border-[var(--border)] pb-4">
                        <h1 className="text-2xl font-bold text-[var(--fg)]">{t("discovery.searchResults")}</h1>
                        <p className="text-sm text-[var(--muted)]">
                            {t("discovery.searchSummary", {
                                query: searchQuery,
                                teams: filteredTeams.length,
                                people: filteredPeople.length,
                            })}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-[var(--fg)]">{t("nav.discovery")}</h1>
                                <p className="text-[var(--muted)]">{t("discovery.subtitle")}</p>
                            </div>
                            {activeTab === "teams" && (
                                <Button
                                    onClick={() => {
                                        if (sessionStatus === "unauthenticated") {
                                            router.push("/login");
                                            return;
                                        }
                                        trackDiscoveryAction("discovery.create_team");
                                        setIsCreateTeamOpen(true);
                                    }}
                                    className="hover:brightness-90 active:brightness-85"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    {t("nav.createTeam")}
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
                            <div className="flex gap-4">
                                <button
                                    onClick={() => {
                                        trackDiscoveryAction("discovery.tab_team");
                                        setActiveTab("teams");
                                    }}
                                    className={cn(
                                        "text-sm font-medium transition-colors pb-1 border-b-2",
                                        activeTab === "teams" ? "text-[var(--primary)] border-[var(--primary)]" : "text-[var(--muted)] border-transparent hover:text-[var(--fg)]"
                                    )}
                                >
                                    {t("discovery.tabTeams")}
                                </button>
                                <button
                                    onClick={() => {
                                        trackDiscoveryAction("discovery.tab_people");
                                        setActiveTab("people");
                                    }}
                                    className={cn(
                                        "text-sm font-medium transition-colors pb-1 border-b-2",
                                        activeTab === "people" ? "text-[var(--primary)] border-[var(--primary)]" : "text-[var(--muted)] border-transparent hover:text-[var(--fg)]"
                                    )}
                                >
                                    {t("discovery.tabPeople")}
                                </button>
                            </div>
                            {activeTab === "teams" && (
                                <p className="text-xs text-[var(--muted)]">{t("discovery.publicOnlyHint")}</p>
                            )}
                        </div>
                    </>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {loading ? <div className="text-[var(--muted)]">{t("common.loading")}</div> :
                        isSearching ? (
                            filteredTeams.length === 0 && filteredPeople.length === 0 ? (
                                <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-6 text-sm text-[var(--muted)]">
                                    {t("discovery.noResults")}
                                </div>
                            ) : (
                                <>
                                    {filteredTeams.map(team => {
                                        return (
                                            <Card
                                                key={`team:${team.id}`}
                                                className="p-5 hover:shadow-lg transition-colors"
                                                onContextMenu={(event) => openProfileMenu(event, "team", team.teamId)}
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="h-10 w-10 rounded bg-[var(--card-bg-hover)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)]">
                                                        <Globe className="w-5 h-5" />
                                                    </div>
                                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] border border-emerald-500/20">
                                                        {team.visibility}
                                                    </span>
                                                </div>
                                                <p className="font-bold text-[var(--fg)]">
                                                    {team.name}
                                                </p>
                                                <p className="text-sm text-[var(--muted)] mt-1 line-clamp-2 h-10">
                                                    {getTeamDescriptionForView(team)}
                                                </p>
                                                <div className="mt-4 flex items-center gap-2">
                                                    <Link
                                                        href={`/teams/${encodeURIComponent(team.teamId)}`}
                                                        onClick={() =>
                                                            trackDiscoveryAction("discovery.open_team_profile", {
                                                                teamId: team.teamId,
                                                            })
                                                        }
                                                        className="h-9 flex-1 inline-flex items-center justify-center rounded-md border border-[var(--border)] text-xs font-medium text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                                    >
                                                        {t("discovery.profile")}
                                                    </Link>
                                                    {team.isJoined ? (
                                                        <span className="h-9 flex-1 inline-flex items-center justify-center rounded-md border border-[var(--border)] text-xs font-medium text-[var(--muted)] bg-[var(--input-bg)]">
                                                            {t("discovery.alreadyJoined")}
                                                        </span>
                                                    ) : team.isJoinRequested ? (
                                                        <span className="h-9 flex-1 inline-flex items-center justify-center rounded-md border border-[var(--border)] text-xs font-medium text-[var(--muted)] bg-[var(--input-bg)]">
                                                            {t("discovery.requested")}
                                                        </span>
                                                    ) : (
                                                        <Button
                                                            className="flex-1"
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={() => openJoinComposer(team)}
                                                            disabled={
                                                                composer.isSubmitting &&
                                                                composer.toUserId === team.teamId
                                                            }
                                                        >
                                                            {composer.isSubmitting &&
                                                                composer.toUserId === team.teamId
                                                                ? t("discovery.applying")
                                                                : t("discovery.applyToJoin")}
                                                        </Button>
                                                    )}
                                                </div>
                                            </Card>
                                        );
                                    })}
                                    {filteredPeople.map(person => {
                                        return (
                                            <Card
                                                key={`user:${person.id}`}
                                                className="p-4 flex flex-col gap-4"
                                                onContextMenu={(event) => openProfileMenu(event, "user", person.userId)}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div
                                                        className="h-12 w-12 rounded-full bg-[var(--card-bg-hover)] border border-[var(--border)] flex items-center justify-center text-[var(--fg)] font-bold text-lg shrink-0"
                                                        aria-label={`${person.username || t("discovery.userFallback")} ${t("discovery.avatar")}`}
                                                    >
                                                        {person.username?.[0] || "?"}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start">
                                                            <p className="font-bold text-[var(--fg)] text-base truncate">
                                                                {person.username}
                                                            </p>
                                                            {person.language && (
                                                                <span className="text-[10px] px-1.5 py-0.5 bg-[var(--card-bg-hover)] rounded border border-[var(--border)] text-[var(--muted)] uppercase">
                                                                    {person.language}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-[var(--muted)] mt-0.5">{person.publicCode || "-"}</p>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {person.skills && person.skills.length > 0 ? (
                                                                person.skills.slice(0, 2).map((skill: string) => (
                                                                    <span key={skill} className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 px-1.5 rounded">
                                                                        {skill}
                                                                    </span>
                                                                ))
                                                            ) : (
                                                                <span className="text-[10px] text-[var(--muted)] italic">{t("discovery.noSkillsYet")}</span>
                                                            )}
                                                            {person.skills?.length > 2 && <span className="text-[10px] text-[var(--muted)]">+{person.skills.length - 2}</span>}
                                                        </div>
                                                        <p className="text-xs text-[var(--muted)] mt-2 line-clamp-2 min-h-8">
                                                            {person.bio?.trim() ? person.bio : t("discovery.noBioYet")}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex justify-between items-center text-xs text-[var(--muted)] border-t border-[var(--border)] pt-3">
                                                    <span>{person.availabilityHours || t("discovery.hoursNotSet")} / {t("discovery.perWeek")}</span>
                                                    <div className="flex">
                                                        <Link
                                                            href={`/people/${encodeURIComponent(person.userId)}`}
                                                            onClick={() =>
                                                                trackDiscoveryAction("discovery.open_user_profile", {
                                                                    userId: person.userId,
                                                                })
                                                            }
                                                            className="h-7 px-3 inline-flex items-center rounded border border-[var(--border)] text-[11px] text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                                        >
                                                            {t("discovery.profile")}
                                                        </Link>
                                                    </div>
                                                </div>
                                            </Card>
                                        )
                                    })}
                                </>
                            )
                        ) : activeTab === "teams" ? (
                            filteredTeams.length === 0 ? (
                                <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-6 text-sm text-[var(--muted)]">
                                    {searchQuery ? t("discovery.noTeamsMatched") : t("discovery.noTeamsFound")}
                                </div>
                            ) : (
                                filteredTeams.map(team => {
                                    return (
                                        <Card
                                            key={team.id}
                                            className="p-5 hover:shadow-lg transition-colors"
                                            onContextMenu={(event) => openProfileMenu(event, "team", team.teamId)}
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="h-10 w-10 rounded bg-[var(--card-bg-hover)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)]">
                                                    <Globe className="w-5 h-5" />
                                                </div>
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] border border-emerald-500/20">
                                                    {team.visibility}
                                                </span>
                                            </div>
                                            <p className="font-bold text-[var(--fg)]">
                                                {team.name}
                                            </p>
                                            <p className="text-sm text-[var(--muted)] mt-1 line-clamp-2 h-10">
                                                {getTeamDescriptionForView(team)}
                                            </p>
                                            <div className="mt-4 flex items-center gap-2">
                                                <Link
                                                    href={`/teams/${encodeURIComponent(team.teamId)}`}
                                                    onClick={() =>
                                                        trackDiscoveryAction("discovery.open_team_profile", {
                                                            teamId: team.teamId,
                                                        })
                                                    }
                                                    className="h-9 flex-1 inline-flex items-center justify-center rounded-md border border-[var(--border)] text-xs font-medium text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                                >
                                                    {t("discovery.profile")}
                                                </Link>
                                                {team.isJoined ? (
                                                    <span className="h-9 flex-1 inline-flex items-center justify-center rounded-md border border-[var(--border)] text-xs font-medium text-[var(--muted)] bg-[var(--input-bg)]">
                                                        {t("discovery.alreadyJoined")}
                                                    </span>
                                                ) : team.isJoinRequested ? (
                                                    <span className="h-9 flex-1 inline-flex items-center justify-center rounded-md border border-[var(--border)] text-xs font-medium text-[var(--muted)] bg-[var(--input-bg)]">
                                                        {t("discovery.requested")}
                                                    </span>
                                                ) : (
                                                    <Button
                                                        className="flex-1"
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => openJoinComposer(team)}
                                                        disabled={
                                                            composer.isSubmitting &&
                                                            composer.toUserId === team.teamId
                                                        }
                                                    >
                                                        {composer.isSubmitting &&
                                                            composer.toUserId === team.teamId
                                                            ? t("discovery.applying")
                                                            : t("discovery.applyToJoin")}
                                                    </Button>
                                                )}
                                            </div>
                                        </Card>
                                    );
                                }))
                        ) : (
                            filteredPeople.length === 0 ? (
                                <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-6 text-sm text-[var(--muted)]">
                                    {searchQuery ? t("discovery.noPeopleMatched") : t("discovery.noPeopleFound")}
                                </div>
                            ) : (
                                filteredPeople.map(person => {
                                    return (
                                        <Card
                                            key={person.id}
                                            className="p-4 flex flex-col gap-4"
                                            onContextMenu={(event) => openProfileMenu(event, "user", person.userId)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div
                                                    className="h-12 w-12 rounded-full bg-[var(--card-bg-hover)] border border-[var(--border)] flex items-center justify-center text-[var(--fg)] font-bold text-lg shrink-0"
                                                    aria-label={`${person.username || t("discovery.userFallback")} ${t("discovery.avatar")}`}
                                                >
                                                    {person.username?.[0] || "?"}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <p className="font-bold text-[var(--fg)] text-base truncate">
                                                            {person.username}
                                                        </p>
                                                        {person.language && (
                                                            <span className="text-[10px] px-1.5 py-0.5 bg-[var(--card-bg-hover)] rounded border border-[var(--border)] text-[var(--muted)] uppercase">
                                                                {person.language}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-[var(--muted)] mt-0.5">{person.publicCode || "-"}</p>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {person.skills && person.skills.length > 0 ? (
                                                            person.skills.slice(0, 2).map((skill: string) => (
                                                                <span key={skill} className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 px-1.5 rounded">
                                                                    {skill}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-[10px] text-[var(--muted)] italic">{t("discovery.noSkillsYet")}</span>
                                                        )}
                                                        {person.skills?.length > 2 && <span className="text-[10px] text-[var(--muted)]">+{person.skills.length - 2}</span>}
                                                    </div>
                                                    <p className="text-xs text-[var(--muted)] mt-2 line-clamp-2 min-h-8">
                                                        {person.bio?.trim() ? person.bio : t("discovery.noBioYet")}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center text-xs text-[var(--muted)] border-t border-[var(--border)] pt-3">
                                                <span>{person.availabilityHours || t("discovery.hoursNotSet")} / {t("discovery.perWeek")}</span>
                                                <div className="flex">
                                                    <Link
                                                        href={`/people/${encodeURIComponent(person.userId)}`}
                                                        onClick={() =>
                                                            trackDiscoveryAction("discovery.open_user_profile", {
                                                                userId: person.userId,
                                                            })
                                                        }
                                                        className="h-7 px-3 inline-flex items-center rounded border border-[var(--border)] text-[11px] text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                                    >
                                                        {t("discovery.profile")}
                                                    </Link>
                                                </div>
                                            </div>
                                        </Card>
                                    )
                                }))
                        )
                    }
                </div>
            </div>

            {composer.isOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm px-4"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeComposer();
                        }
                    }}
                >
                    <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] shadow-2xl">
                        <div className="px-5 py-4 border-b border-[var(--border)]">
                            <h3 className="text-base font-semibold text-[var(--fg)]">{t("discovery.applyTitle")}</h3>
                            <p className="text-xs text-[var(--muted)] mt-1 truncate">
                                {t("discovery.teamPrefix", { name: composer.toUsername })}
                            </p>
                        </div>

                        <div className="px-5 py-4 space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs text-[var(--muted)]">{t("discovery.message")}</label>
                                <textarea
                                    value={composer.message}
                                    onChange={(event) =>
                                        setComposer((prev) => ({ ...prev, message: event.target.value.slice(0, 160) }))
                                    }
                                    rows={4}
                                    className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                    placeholder={t("discovery.messagePlaceholder")}
                                />
                                <div className="text-[10px] text-[var(--muted)] text-right">
                                    {composer.message.length}/160
                                </div>
                            </div>

                            {composer.error && (
                                <p className="text-xs text-rose-500">{composer.error}</p>
                            )}
                        </div>

                        <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-end gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={closeComposer}
                                disabled={composer.isSubmitting}
                            >
                                {t("common.cancel")}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => void submitComposer()}
                                disabled={composer.isSubmitting}
                            >
                                {composer.isSubmitting ? t("discovery.sending") : t("discovery.send")}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            {profileMenu && (
                <div
                    data-discovery-profile-menu="true"
                    className="fixed z-[70] min-w-[132px] border rounded-md shadow-md py-1"
                    style={{
                        left: `${profileMenu.x}px`,
                        top: `${profileMenu.y}px`,
                        backgroundColor: "var(--card-bg)",
                        borderColor: "var(--border)",
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    <button
                        type="button"
                        className="w-full text-left px-3 py-1.5 text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                        onClick={viewProfileFromMenu}
                    >
                        {profileMenu.kind === "team" ? t("discovery.contextMenuTeamProfile") : t("discovery.contextMenuUserProfile")}
                    </button>
                </div>
            )}
            <AlertModal
                open={notice.open}
                title={notice.title}
                message={notice.message}
                onClose={() => setNotice((prev) => ({ ...prev, open: false }))}
            />
            <CreateTeamModal
                open={isCreateTeamOpen}
                onClose={() => setIsCreateTeamOpen(false)}
                onCreated={(teamId) => {
                    setIsCreateTeamOpen(false);
                    router.push(`/workspace/${encodeURIComponent(teamId)}`);
                }}
            />
        </>
    );
}
