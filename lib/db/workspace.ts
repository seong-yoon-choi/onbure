import { supabaseRest } from "@/lib/supabase-rest";
import {
    deleteStorageObjectFromPointer,
    getSignedUrlFromStoragePointer,
    parseSupabaseStoragePointer,
} from "@/lib/supabase-storage";
import { v4 as uuidv4 } from "uuid";

type WorkspaceFileScope = "team" | "user";

interface WorkspaceFileOptions {
    scope?: WorkspaceFileScope;
    ownerUserId?: string;
    folderId?: string | null;
}

function normalizeWorkspaceFileScope(value: string | null | undefined): WorkspaceFileScope {
    return String(value || "").trim().toLowerCase() === "user" ? "user" : "team";
}

function resolveWorkspaceFileOptions(options?: WorkspaceFileOptions) {
    const scope = options?.scope === "user" ? "user" : "team";
    const ownerUserId = String(options?.ownerUserId || "").trim();
    const folderId = String(options?.folderId || "").trim() || null;
    return {
        scope,
        ownerUserId: scope === "user" ? ownerUserId : "",
        folderId,
    };
}

export async function getLinks(teamId: string) {
    const rows = (await supabaseRest(
        `/workspace_links?select=*&team_id=eq.${encodeURIComponent(teamId)}&order=created_at.asc`
    )) as Array<{ link_id: string; title: string; url: string | null }>;

    return rows.map((row) => ({
        id: row.link_id,
        linkId: row.link_id,
        title: row.title || "",
        url: row.url || "",
    }));
}

export async function createLink(teamId: string, title: string, url: string) {
    await supabaseRest("/workspace_links", {
        method: "POST",
        prefer: "return=minimal",
        body: {
            link_id: uuidv4(),
            team_id: teamId,
            title,
            url,
        },
    });
    return;
}

export async function getFiles(teamId: string, options?: WorkspaceFileOptions) {
    const { scope, ownerUserId } = resolveWorkspaceFileOptions(options);

    const rows = (await supabaseRest(
        `/workspace_files?select=*&team_id=eq.${encodeURIComponent(teamId)}&order=created_at.asc`
    )) as Array<{
        file_id: string;
        title: string;
        url: string | null;
        folder_id?: string | null;
        scope?: string | null;
        owner_user_id?: string | null;
        created_at: string;
    }>;

    const filteredRows = rows.filter((row) => {
        const rowScope = normalizeWorkspaceFileScope(row.scope);
        if (scope === "user") {
            if (!ownerUserId) return false;
            return rowScope === "user" && String(row.owner_user_id || "").trim() === ownerUserId;
        }
        return rowScope === "team";
    });

    return Promise.all(
        filteredRows.map(async (row) => {
            const rawUrl = row.url || "";
            let resolvedUrl = rawUrl;
            if (parseSupabaseStoragePointer(rawUrl)) {
                try {
                    resolvedUrl = await getSignedUrlFromStoragePointer(rawUrl);
                } catch {
                    resolvedUrl = "";
                }
            }

            return {
                id: row.file_id,
                fileId: row.file_id,
                title: row.title || "Untitled",
                url: resolvedUrl,
                folderId: row.folder_id || undefined,
                createdAt: row.created_at,
            };
        })
    );
}

export async function createFile(teamId: string, title: string, _url: string, options?: WorkspaceFileOptions) {
    const fileId = uuidv4();
    const { scope, ownerUserId, folderId } = resolveWorkspaceFileOptions(options);

    if (scope === "user" && !ownerUserId) {
        throw new Error("ownerUserId is required for user-scoped workspace files.");
    }

    await supabaseRest("/workspace_files", {
        method: "POST",
        prefer: "return=minimal",
        body: {
            file_id: fileId,
            team_id: teamId,
            title,
            url: _url || null,
            folder_id: folderId,
            scope,
            owner_user_id: scope === "user" ? ownerUserId : null,
        },
    });
    return fileId;
}

export async function renameFile(teamId: string, fileId: string, title: string, options?: WorkspaceFileOptions) {
    if (!teamId || !fileId) return;
    const normalizedTitle = String(title || "").trim().replace(/\s+/g, " ").slice(0, 120);
    if (!normalizedTitle) return;
    const { scope, ownerUserId } = resolveWorkspaceFileOptions(options);

    if (scope === "user" && !ownerUserId) return;

    const ownerFilter =
        scope === "user"
            ? `&scope=eq.user&owner_user_id=eq.${encodeURIComponent(ownerUserId)}`
            : "";
    await supabaseRest(
        `/workspace_files?team_id=eq.${encodeURIComponent(teamId)}&file_id=eq.${encodeURIComponent(fileId)}${ownerFilter}`,
        {
            method: "PATCH",
            prefer: "return=minimal",
            body: { title: normalizedTitle },
        }
    );
    return;
}

export async function deleteFile(teamId: string, fileId: string, options?: WorkspaceFileOptions) {
    if (!teamId || !fileId) return;
    const { scope, ownerUserId } = resolveWorkspaceFileOptions(options);

    if (scope === "user" && !ownerUserId) return;

    const ownerFilter =
        scope === "user"
            ? `&scope=eq.user&owner_user_id=eq.${encodeURIComponent(ownerUserId)}`
            : "";
    const targetRows = (await supabaseRest(
        `/workspace_files?select=file_id,title,url&team_id=eq.${encodeURIComponent(teamId)}&file_id=eq.${encodeURIComponent(fileId)}${ownerFilter}&limit=1`
    )) as Array<{ file_id: string; title: string | null; url: string | null }>;
    const target = targetRows[0];
    if (!target) return;

    const deleteStoragePointerIfNeeded = async (rawUrl: string | null | undefined) => {
        const url = String(rawUrl || "").trim();
        if (!parseSupabaseStoragePointer(url)) return;
        try {
            await deleteStorageObjectFromPointer(url);
        } catch {
            // Continue DB deletion even if storage cleanup fails.
        }
    };

    const targetTitle = String(target.title || "").trim();
    const isFolder = targetTitle.startsWith("Folder: ");

    if (isFolder) {
        const childRows = (await supabaseRest(
            `/workspace_files?select=file_id,url&team_id=eq.${encodeURIComponent(teamId)}&folder_id=eq.${encodeURIComponent(fileId)}${ownerFilter}`
        )) as Array<{ file_id: string; url: string | null }>;

        for (const child of childRows) {
            await deleteStoragePointerIfNeeded(child.url);
        }

        await supabaseRest(
            `/workspace_files?team_id=eq.${encodeURIComponent(teamId)}&folder_id=eq.${encodeURIComponent(fileId)}${ownerFilter}`,
            {
                method: "DELETE",
                prefer: "return=minimal",
            }
        );
    }

    await deleteStoragePointerIfNeeded(target.url);
    await supabaseRest(
        `/workspace_files?team_id=eq.${encodeURIComponent(teamId)}&file_id=eq.${encodeURIComponent(fileId)}${ownerFilter}`,
        {
            method: "DELETE",
            prefer: "return=minimal",
        }
    );
    return;
}

export async function moveFileToFolder(
    teamId: string,
    fileId: string,
    folderId?: string | null,
    options?: WorkspaceFileOptions
) {
    if (!teamId || !fileId) return;
    const normalizedFolderId = String(folderId || "").trim() || null;
    const { scope, ownerUserId } = resolveWorkspaceFileOptions(options);

    if (scope === "user" && !ownerUserId) return;

    const ownerFilter =
        scope === "user"
            ? `&scope=eq.user&owner_user_id=eq.${encodeURIComponent(ownerUserId)}`
            : "";
    await supabaseRest(
        `/workspace_files?team_id=eq.${encodeURIComponent(teamId)}&file_id=eq.${encodeURIComponent(fileId)}${ownerFilter}`,
        {
            method: "PATCH",
            prefer: "return=minimal",
            body: { folder_id: normalizedFolderId },
        }
    );
    return;
}

export async function getTasks(teamId: string) {
    const rows = (await supabaseRest(
        `/workspace_tasks?select=*&team_id=eq.${encodeURIComponent(teamId)}&order=created_at.asc`
    )) as Array<{ task_id: string; title: string; status: string }>;
    return rows.map((row) => ({
        id: row.task_id,
        title: row.title || "",
        status: row.status || "To Do",
    }));
}

export async function createTask(teamId: string, title: string, status: string = "To Do") {
    await supabaseRest("/workspace_tasks", {
        method: "POST",
        prefer: "return=minimal",
        body: {
            task_id: uuidv4(),
            team_id: teamId,
            title,
            status: status || "To Do",
        },
    });
    return;
}

export async function updateTaskStatus(pageId: string, status: string) {
    await supabaseRest(
        `/workspace_tasks?task_id=eq.${encodeURIComponent(pageId)}`,
        {
            method: "PATCH",
            prefer: "return=minimal",
            body: { status: status || "To Do" },
        }
    );
    return;
}

export async function getAgreementNotes(teamId: string) {
    const rows = (await supabaseRest(
        `/workspace_agreement_notes?select=*&team_id=eq.${encodeURIComponent(teamId)}&order=created_at.asc`
    )) as Array<{ agreement_note_id: string; body: string | null; footer_notice: string | null }>;
    return rows.map((row) => ({
        id: row.agreement_note_id,
        body: row.body || "",
        footer: row.footer_notice || "",
    }));
}

export async function createAgreementNote(teamId: string, content: string) {
    await supabaseRest("/workspace_agreement_notes", {
        method: "POST",
        prefer: "return=minimal",
        body: {
            agreement_note_id: uuidv4(),
            team_id: teamId,
            body: content,
            footer_notice: "Changes require team agreement.",
        },
    });
    return;
}

export async function updateAgreementNote(pageId: string, content: string) {
    await supabaseRest(
        `/workspace_agreement_notes?agreement_note_id=eq.${encodeURIComponent(pageId)}`,
        {
            method: "PATCH",
            prefer: "return=minimal",
            body: { body: content },
        }
    );
    return;
}

export async function getMeetingNotes(_teamId: string) {
    const rows = (await supabaseRest(
        `/workspace_meeting_notes?select=*&team_id=eq.${encodeURIComponent(_teamId)}&order=created_at.asc`
    )) as Array<{ meeting_note_id: string; title: string; content: string; created_at: string }>;
    return rows.map((row) => ({
        id: row.meeting_note_id,
        title: row.title || "",
        content: row.content || "",
        createdAt: row.created_at,
    }));
}

export async function createMeetingNote(_teamId: string, _title: string, _content: string) {
    await supabaseRest("/workspace_meeting_notes", {
        method: "POST",
        prefer: "return=minimal",
        body: {
            meeting_note_id: uuidv4(),
            team_id: _teamId,
            title: _title || "Meeting Note",
            content: _content || "",
        },
    });
    return;
}
