"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertModal } from "@/components/ui/modal";
import CreateTeamModal from "@/components/teams/CreateTeamModal";
import { Globe, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

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
    const [activeTab, setActiveTab] = useState<"teams" | "people">("teams");
    const [teams, setTeams] = useState<any[]>([]);
    const [people, setPeople] = useState<any[]>([]);
    const [myTeams, setMyTeams] = useState<Array<{ teamId: string; name: string }> | null>(null);
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
        mode: "CHAT" | "INVITE" | "JOIN";
        toUserId: string;
        toUsername: string;
        message: string;
        selectedTeamId: string;
        teamOptions: Array<{ teamId: string; name: string }>;
        isSubmitting: boolean;
        error: string;
    }>({
        isOpen: false,
        mode: "CHAT",
        toUserId: "",
        toUsername: "",
        message: "",
        selectedTeamId: "",
        teamOptions: [],
        isSubmitting: false,
        error: "",
    });

    const searchQuery = useMemo(() => initialSearchQuery.trim(), [initialSearchQuery]);
    const normalizedSearchQuery = searchQuery.toLowerCase();
    const isSearching = normalizedSearchQuery.length > 0;

    const normalizeShortMessage = (value: string, fallback: string) => {
        const trimmed = value.trim().replace(/\s+/g, " ");
        if (!trimmed) return fallback;
        return trimmed.slice(0, 160);
    };

    const openNotice = (title: string, message: string) => {
        setNotice({
            open: true,
            title,
            message,
        });
    };

    const getMyTeams = async () => {
        if (myTeams) return myTeams;
        const res = await fetch("/api/chat/teams");
        if (!res.ok) throw new Error("Failed to load your teams.");
        const data = (await res.json()) as Array<{ teamId: string; name: string }>;
        setMyTeams(data);
        return data;
    };

    async function fetchData() {
        try {
            const res = await fetch("/api/discovery");
            if (res.ok) {
                const data = await res.json();
                setTeams(data.teams);
                setPeople(data.people);
            }
        } catch (error) {
            console.error("Failed to fetch discovery data", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchData();
    }, []);

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
            router.push(`/teams/${encodeURIComponent(profileMenu.id)}`);
            setProfileMenu(null);
            return;
        }
        router.push(`/people/${encodeURIComponent(profileMenu.id)}`);
        setProfileMenu(null);
    };

    const openChatComposer = (person: any) => {
        setComposer({
            isOpen: true,
            mode: "CHAT",
            toUserId: person.userId,
            toUsername: person.username || "User",
            message: "Let's chat!",
            selectedTeamId: "",
            teamOptions: [],
            isSubmitting: false,
            error: "",
        });
    };

    const openInviteComposer = async (person: any) => {
        try {
            const options = await getMyTeams();
            if (!options.length) {
                openNotice("Invite unavailable", "You need at least one team to send an invite.");
                return;
            }

            setComposer({
                isOpen: true,
                mode: "INVITE",
                toUserId: person.userId,
                toUsername: person.username || "User",
                message: "I'd like to invite you to my team.",
                selectedTeamId: options[0].teamId,
                teamOptions: options,
                isSubmitting: false,
                error: "",
            });
        } catch (error) {
            console.error(error);
            openNotice("Failed to load teams", "Please try again in a moment.");
        }
    };

    const openJoinComposer = (team: any) => {
        const teamId = String(team?.teamId || "").trim();
        if (!teamId) return;

        setComposer({
            isOpen: true,
            mode: "JOIN",
            toUserId: teamId,
            toUsername: team?.name || "Team",
            message: "I'd like to join your team.",
            selectedTeamId: "",
            teamOptions: [],
            isSubmitting: false,
            error: "",
        });
    };

    const submitComposer = async () => {
        if (!composer.isOpen || composer.isSubmitting) return;

        const fallback =
            composer.mode === "CHAT"
                ? "Let's chat!"
                : composer.mode === "INVITE"
                  ? "I'd like to invite you to my team."
                  : "I'd like to join your team.";
        const message = normalizeShortMessage(composer.message, fallback);
        if (composer.mode === "INVITE" && !composer.selectedTeamId) {
            setComposer((prev) => ({ ...prev, error: "Please select a team." }));
            return;
        }

        setComposer((prev) => ({ ...prev, isSubmitting: true, error: "" }));

        try {
            const body =
                composer.mode === "CHAT"
                    ? { type: "CHAT", toId: composer.toUserId, message }
                    : composer.mode === "INVITE"
                      ? {
                        type: "INVITE",
                        toId: composer.toUserId,
                        teamId: composer.selectedTeamId,
                        message,
                      }
                      : {
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
                if (composer.mode === "CHAT") {
                    setPeople((prev) =>
                        prev.map((person) =>
                            person.userId === composer.toUserId
                                ? { ...person, canRequestChat: false, chatState: "PENDING" }
                                : person
                        )
                    );
                } else if (composer.mode === "JOIN") {
                    setTeams((prev) =>
                        prev.map((team) =>
                            team.teamId === composer.toUserId
                                ? { ...team, isJoinRequested: true }
                                : team
                        )
                    );
                    openNotice("Request sent", "Your join request has been sent.");
                }
                setComposer((prev) => ({ ...prev, isOpen: false, isSubmitting: false, error: "" }));
                return;
            }

            if (res.status === 409) {
                if (composer.mode === "CHAT") {
                    await fetchData();
                    openNotice("Already requested", data.error || "A chat request already exists.");
                    setComposer((prev) => ({ ...prev, isOpen: false, isSubmitting: false, error: "" }));
                    return;
                }
                if (composer.mode === "JOIN") {
                    setTeams((prev) =>
                        prev.map((team) =>
                            team.teamId === composer.toUserId
                                ? { ...team, isJoinRequested: true }
                                : team
                        )
                    );
                    openNotice("Already requested", data.error || "A join request already exists for this team.");
                    setComposer((prev) => ({ ...prev, isOpen: false, isSubmitting: false, error: "" }));
                    return;
                }
                setComposer((prev) => ({
                    ...prev,
                    isSubmitting: false,
                    error: data.error || "An active request already exists.",
                }));
                return;
            }

            setComposer((prev) => ({
                ...prev,
                isSubmitting: false,
                error: data.error || "Failed to send request.",
            }));
        } catch (error) {
            console.error(error);
            setComposer((prev) => ({ ...prev, isSubmitting: false, error: "Failed to send request." }));
        }
    };

    const filteredTeams = useMemo(() => {
        if (!normalizedSearchQuery) return teams;
        return teams.filter((team) => {
            const candidates = [
                team?.name,
                team?.description,
                team?.visibility,
                team?.stage,
                team?.language,
                ...(Array.isArray(team?.recruitingRoles) ? team.recruitingRoles : []),
            ]
                .filter(Boolean)
                .map((value) => String(value).toLowerCase());
            return candidates.some((value) => value.includes(normalizedSearchQuery));
        });
    }, [teams, normalizedSearchQuery]);

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
                .map((value) => String(value).toLowerCase());
            return candidates.some((value) => value.includes(normalizedSearchQuery));
        });
    }, [people, normalizedSearchQuery]);

    return (
        <>
        <div className="space-y-6">
            {isSearching ? (
                <div className="space-y-1 border-b border-[var(--border)] pb-4">
                    <h1 className="text-2xl font-bold text-[var(--fg)]">Search Results</h1>
                    <p className="text-sm text-[var(--muted)]">
                        {searchQuery} - Teams {filteredTeams.length}, People {filteredPeople.length}
                    </p>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-[var(--fg)]">Discovery</h1>
                            <p className="text-[var(--muted)]">Explore teams and people.</p>
                        </div>
                        {activeTab === "teams" && (
                            <Button onClick={() => setIsCreateTeamOpen(true)} className="hover:brightness-90 active:brightness-85">
                                <Plus className="w-4 h-4 mr-2" />
                                Create Team
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
                        <div className="flex gap-4">
                            <button
                                onClick={() => setActiveTab("teams")}
                                className={cn(
                                    "text-sm font-medium transition-colors pb-1 border-b-2",
                                    activeTab === "teams" ? "text-[var(--primary)] border-[var(--primary)]" : "text-[var(--muted)] border-transparent hover:text-[var(--fg)]"
                                )}
                            >
                                Teams
                            </button>
                            <button
                                onClick={() => setActiveTab("people")}
                                className={cn(
                                    "text-sm font-medium transition-colors pb-1 border-b-2",
                                    activeTab === "people" ? "text-[var(--primary)] border-[var(--primary)]" : "text-[var(--muted)] border-transparent hover:text-[var(--fg)]"
                                )}
                            >
                                People
                            </button>
                        </div>
                        {activeTab === "teams" && (
                            <p className="text-xs text-[var(--muted)]">Discovery shows public teams only.</p>
                        )}
                    </div>
                </>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? <div className="text-[var(--muted)]">Loading...</div> :
                    isSearching ? (
                        filteredTeams.length === 0 && filteredPeople.length === 0 ? (
                            <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-6 text-sm text-[var(--muted)]">
                                No results matched your search.
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
                                        <p className="text-sm text-[var(--muted)] mt-1 line-clamp-2 h-10">{team.description}</p>
                                        {team.isJoined ? (
                                            <span className="w-full mt-4 h-9 inline-flex items-center justify-center rounded-md border border-[var(--border)] text-xs font-medium text-[var(--muted)] bg-[var(--input-bg)]">
                                                Already Joined
                                            </span>
                                        ) : team.isJoinRequested ? (
                                            <span className="w-full mt-4 h-9 inline-flex items-center justify-center rounded-md border border-[var(--border)] text-xs font-medium text-[var(--muted)] bg-[var(--input-bg)]">
                                                Requested
                                            </span>
                                        ) : (
                                            <Button
                                                className="w-full mt-4"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => openJoinComposer(team)}
                                                disabled={
                                                    composer.isSubmitting &&
                                                    composer.mode === "JOIN" &&
                                                    composer.toUserId === team.teamId
                                                }
                                            >
                                                {composer.isSubmitting &&
                                                composer.mode === "JOIN" &&
                                                composer.toUserId === team.teamId
                                                    ? "Applying..."
                                                    : "Apply to Join"}
                                            </Button>
                                        )}
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
                                                aria-label={`${person.username || "user"} avatar`}
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
                                                        <span className="text-[10px] text-[var(--muted)] italic">No skills yet</span>
                                                    )}
                                                    {person.skills?.length > 2 && <span className="text-[10px] text-[var(--muted)]">+{person.skills.length - 2}</span>}
                                                </div>
                                                <p className="text-xs text-[var(--muted)] mt-2 line-clamp-2 min-h-8">
                                                    {person.bio?.trim() ? person.bio : "No bio yet."}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center text-xs text-[var(--muted)] border-t border-[var(--border)] pt-3">
                                            <span>{person.availabilityHours || "Hours not set"} / week</span>
                                            <div className="flex gap-2">
                                                {person.canRequestChat !== false ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs px-3 text-[var(--fg)] hover:border-[var(--border)] hover:bg-[var(--card-bg-hover)]"
                                                    onClick={() => openChatComposer(person)}
                                                >
                                                    Chat
                                                </Button>
                                                ) : (
                                                    <span className="h-7 px-3 inline-flex items-center rounded border border-[var(--border)] text-[10px] font-medium text-[var(--muted)]">
                                                        {person.chatState === "ACCEPTED" ? "Connected" : "Requested"}
                                                    </span>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs px-3 text-[var(--fg)] hover:border-[var(--border)] hover:bg-[var(--card-bg-hover)]"
                                                    onClick={() => void openInviteComposer(person)}
                                                >
                                                    Invite
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                )})}
                            </>
                        )
                    ) : activeTab === "teams" ? (
                        filteredTeams.length === 0 ? (
                            <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-6 text-sm text-[var(--muted)]">
                                {searchQuery ? "No teams matched your search." : "No teams found."}
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
                                <p className="text-sm text-[var(--muted)] mt-1 line-clamp-2 h-10">{team.description}</p>
                                {team.isJoined ? (
                                    <span className="w-full mt-4 h-9 inline-flex items-center justify-center rounded-md border border-[var(--border)] text-xs font-medium text-[var(--muted)] bg-[var(--input-bg)]">
                                        Already Joined
                                    </span>
                                ) : team.isJoinRequested ? (
                                    <span className="w-full mt-4 h-9 inline-flex items-center justify-center rounded-md border border-[var(--border)] text-xs font-medium text-[var(--muted)] bg-[var(--input-bg)]">
                                        Requested
                                    </span>
                                ) : (
                                    <Button
                                        className="w-full mt-4"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => openJoinComposer(team)}
                                        disabled={
                                            composer.isSubmitting &&
                                            composer.mode === "JOIN" &&
                                            composer.toUserId === team.teamId
                                        }
                                    >
                                        {composer.isSubmitting &&
                                        composer.mode === "JOIN" &&
                                        composer.toUserId === team.teamId
                                            ? "Applying..."
                                            : "Apply to Join"}
                                    </Button>
                                )}
                            </Card>
                            );
                        }))
                    ) : (
                        filteredPeople.length === 0 ? (
                            <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-6 text-sm text-[var(--muted)]">
                                {searchQuery ? "No people matched your search." : "No people found."}
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
                                        aria-label={`${person.username || "user"} avatar`}
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
                                                <span className="text-[10px] text-[var(--muted)] italic">No skills yet</span>
                                            )}
                                            {person.skills?.length > 2 && <span className="text-[10px] text-[var(--muted)]">+{person.skills.length - 2}</span>}
                                        </div>
                                        <p className="text-xs text-[var(--muted)] mt-2 line-clamp-2 min-h-8">
                                            {person.bio?.trim() ? person.bio : "No bio yet."}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center text-xs text-[var(--muted)] border-t border-[var(--border)] pt-3">
                                    <span>{person.availabilityHours || "Hours not set"} / week</span>
                                    <div className="flex gap-2">
                                        {person.canRequestChat !== false ? (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs px-3 text-[var(--fg)] hover:border-[var(--border)] hover:bg-[var(--card-bg-hover)]"
                                            onClick={() => openChatComposer(person)}
                                        >
                                            Chat
                                        </Button>
                                        ) : (
                                            <span className="h-7 px-3 inline-flex items-center rounded border border-[var(--border)] text-[10px] font-medium text-[var(--muted)]">
                                                {person.chatState === "ACCEPTED" ? "Connected" : "Requested"}
                                            </span>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs px-3 text-[var(--fg)] hover:border-[var(--border)] hover:bg-[var(--card-bg-hover)]"
                                            onClick={() => void openInviteComposer(person)}
                                        >
                                            Invite
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        )}))
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
                        <h3 className="text-base font-semibold text-[var(--fg)]">
                            {composer.mode === "CHAT"
                                ? "Send Chat Request"
                                : composer.mode === "INVITE"
                                  ? "Send Team Invite"
                                  : "Apply to Join"}
                        </h3>
                        <p className="text-xs text-[var(--muted)] mt-1 truncate">
                            {composer.mode === "JOIN" ? "Team" : "To"}: {composer.toUsername}
                        </p>
                    </div>

                    <div className="px-5 py-4 space-y-3">
                        {composer.mode === "INVITE" && (
                            <div className="space-y-1">
                                <label className="text-xs text-[var(--muted)]">Team</label>
                                <select
                                    value={composer.selectedTeamId}
                                    onChange={(event) =>
                                        setComposer((prev) => ({ ...prev, selectedTeamId: event.target.value }))
                                    }
                                    className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none"
                                >
                                    {composer.teamOptions.map((team) => (
                                        <option key={team.teamId} value={team.teamId}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs text-[var(--muted)]">Message</label>
                            <textarea
                                value={composer.message}
                                onChange={(event) =>
                                    setComposer((prev) => ({ ...prev, message: event.target.value.slice(0, 160) }))
                                }
                                rows={4}
                                className="w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                placeholder={
                                    composer.mode === "CHAT"
                                        ? "Write a short chat request..."
                                        : composer.mode === "INVITE"
                                          ? "Write a short invite message..."
                                          : "Write a short join request..."
                                }
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
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => void submitComposer()}
                            disabled={composer.isSubmitting}
                        >
                            {composer.isSubmitting ? "Sending..." : "Send"}
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
                    {profileMenu.kind === "team" ? "팀 프로필 보기" : "프로필 보기"}
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
