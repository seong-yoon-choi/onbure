import { notion, getDatabaseId, getTextValue, getSelectValue } from "@/lib/notion-client";
import { isSupabaseBackend } from "@/lib/db/backend";
import { supabaseRest } from "@/lib/supabase-rest";
import {
    deleteStorageObjectFromPointer,
    getSignedUrlFromStoragePointer,
    parseSupabaseStoragePointer,
} from "@/lib/supabase-storage";
import { v4 as uuidv4 } from "uuid";

const DB_LINKS = getDatabaseId("NOTION_DB_LINKS");
const DB_FILES = getDatabaseId("NOTION_DB_FILES");
const DB_TASKS = getDatabaseId("NOTION_DB_TASKS");
const DB_AGREEMENT_NOTES = getDatabaseId("NOTION_DB_AGREEMENT_NOTES");

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
    if (isSupabaseBackend()) {
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

    const res = await notion.databases.query({
        database_id: DB_LINKS,
        filter: { property: "team_id", rich_text: { equals: teamId } }
    });

    return res.results.map((p: any) => ({
        id: p.id,
        linkId: getTextValue(p.properties.link_id),
        title: getTextValue(p.properties.title),
        url: p.properties.url?.url
    }));
}

export async function createLink(teamId: string, title: string, url: string) {
    if (isSupabaseBackend()) {
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

    await notion.pages.create({
        parent: { database_id: DB_LINKS },
        properties: {
            link_id: { rich_text: [{ text: { content: uuidv4() } }] },
            title: { title: [{ text: { content: title } }] },
            url: { url: url },
            team_id: { rich_text: [{ text: { content: teamId } }] }
        }
    });
}

export async function getFiles(teamId: string, options?: WorkspaceFileOptions) {
    const { scope, ownerUserId } = resolveWorkspaceFileOptions(options);

    if (isSupabaseBackend()) {
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

    const res = await notion.databases.query({
        database_id: DB_FILES,
        filter: { property: "team_id", rich_text: { equals: teamId } }
    });

    return res.results.map((p: any) => ({
        id: p.id,
        fileId: getTextValue(p.properties.file_id),
        title: p.properties.Name ? getTextValue(p.properties.Name) : "Untitled",
        url: p.properties?.url?.url || "",
        folderId: getTextValue(p.properties?.folder_id),
        createdAt: p.created_time,
    }));
}

export async function createFile(teamId: string, title: string, _url: string, options?: WorkspaceFileOptions) {
    const fileId = uuidv4();
    const { scope, ownerUserId, folderId } = resolveWorkspaceFileOptions(options);

    if (scope === "user" && !ownerUserId) {
        throw new Error("ownerUserId is required for user-scoped workspace files.");
    }

    if (isSupabaseBackend()) {
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

    await notion.pages.create({
        parent: { database_id: DB_FILES },
        properties: {
            file_id: { rich_text: [{ text: { content: fileId } }] },
            Name: { title: [{ text: { content: title } }] },
            team_id: { rich_text: [{ text: { content: teamId } }] }
        }
    });
    return fileId;
}

export async function renameFile(teamId: string, fileId: string, title: string, options?: WorkspaceFileOptions) {
    if (!teamId || !fileId) return;
    const normalizedTitle = String(title || "").trim().replace(/\s+/g, " ").slice(0, 120);
    if (!normalizedTitle) return;
    const { scope, ownerUserId } = resolveWorkspaceFileOptions(options);

    if (scope === "user" && !ownerUserId) return;

    if (isSupabaseBackend()) {
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

    const byPageId = await notion.pages.retrieve(fileId).catch(() => null as any);
    const targetPage = byPageId?.id
        ? byPageId
        : (await notion.databases.query({
            database_id: DB_FILES,
            filter: {
                and: [
                    { property: "team_id", rich_text: { equals: teamId } },
                    { property: "file_id", rich_text: { equals: fileId } },
                ],
            },
            page_size: 1,
        }))?.results?.[0];

    if (!targetPage?.id) return;

    const targetProps = (targetPage.properties || {}) as Record<string, any>;
    const titlePropertyName = Object.entries(targetProps).find(([, prop]) => prop?.type === "title")?.[0];
    if (!titlePropertyName) return;

    await notion.pages.update({
        page_id: targetPage.id,
        properties: {
            [titlePropertyName]: { title: [{ text: { content: normalizedTitle } }] },
        },
    });
}

export async function deleteFile(teamId: string, fileId: string, options?: WorkspaceFileOptions) {
    if (!teamId || !fileId) return;
    const { scope, ownerUserId } = resolveWorkspaceFileOptions(options);

    if (scope === "user" && !ownerUserId) return;

    if (isSupabaseBackend()) {
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

    try {
        await notion.pages.update({
            page_id: fileId,
            archived: true,
        });
        return;
    } catch {
        // Fallback for older records where callers might pass file_id instead of page id.
    }

    const res = await notion.databases.query({
        database_id: DB_FILES,
        filter: {
            and: [
                { property: "team_id", rich_text: { equals: teamId } },
                { property: "file_id", rich_text: { equals: fileId } },
            ],
        },
        page_size: 1,
    });

    const target = res.results[0];
    if (!target) return;

    await notion.pages.update({
        page_id: target.id,
        archived: true,
    });
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

    if (isSupabaseBackend()) {
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

    const byPageId = await notion.pages.retrieve(fileId).catch(() => null as any);
    const targetPage = byPageId?.id
        ? byPageId
        : (await notion.databases.query({
            database_id: DB_FILES,
            filter: {
                and: [
                    { property: "team_id", rich_text: { equals: teamId } },
                    { property: "file_id", rich_text: { equals: fileId } },
                ],
            },
            page_size: 1,
        }))?.results?.[0];

    if (!targetPage?.id) return;

    const targetProps = (targetPage.properties || {}) as Record<string, any>;
    const folderPropType = targetProps.folder_id?.type;
    if (folderPropType === "rich_text") {
        await notion.pages.update({
            page_id: targetPage.id,
            properties: {
                folder_id: normalizedFolderId
                    ? { rich_text: [{ text: { content: normalizedFolderId } }] }
                    : { rich_text: [] },
            },
        });
    }
}

export async function getTasks(teamId: string) {
    if (isSupabaseBackend()) {
        const rows = (await supabaseRest(
            `/workspace_tasks?select=*&team_id=eq.${encodeURIComponent(teamId)}&order=created_at.asc`
        )) as Array<{ task_id: string; title: string; status: string }>;
        return rows.map((row) => ({
            id: row.task_id,
            title: row.title || "",
            status: row.status || "To Do",
        }));
    }

    const res = await notion.databases.query({
        database_id: DB_TASKS,
        filter: { property: "team_id", rich_text: { equals: teamId } }
    });

    return res.results.map((p: any) => ({
        id: p.id,
        title: getTextValue(p.properties.title),
        status: getSelectValue(p.properties.status),
    }));
}

export async function createTask(teamId: string, title: string, status: string = "To Do") {
    if (isSupabaseBackend()) {
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

    await notion.pages.create({
        parent: { database_id: DB_TASKS },
        properties: {
            task_id: { rich_text: [{ text: { content: uuidv4() } }] },
            title: { title: [{ text: { content: title } }] },
            status: { select: { name: status } },
            team_id: { rich_text: [{ text: { content: teamId } }] }
        }
    });
}

export async function updateTaskStatus(pageId: string, status: string) {
    if (isSupabaseBackend()) {
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

    await notion.pages.update({
        page_id: pageId,
        properties: { status: { select: { name: status } } }
    });
}

export async function getAgreementNotes(teamId: string) {
    if (isSupabaseBackend()) {
        const rows = (await supabaseRest(
            `/workspace_agreement_notes?select=*&team_id=eq.${encodeURIComponent(teamId)}&order=created_at.asc`
        )) as Array<{ agreement_note_id: string; body: string | null; footer_notice: string | null }>;
        return rows.map((row) => ({
            id: row.agreement_note_id,
            body: row.body || "",
            footer: row.footer_notice || "",
        }));
    }

    const res = await notion.databases.query({
        database_id: DB_AGREEMENT_NOTES,
        filter: { property: "team_id", rich_text: { equals: teamId } }
    });

    return res.results.map((p: any) => ({
        id: p.id,
        body: getTextValue(p.properties.body),
        footer: getTextValue(p.properties.footer_notice)
    }));
}

export async function createAgreementNote(teamId: string, content: string) {
    if (isSupabaseBackend()) {
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

    await notion.pages.create({
        parent: { database_id: DB_AGREEMENT_NOTES },
        properties: {
            agreement_note_id: { rich_text: [{ text: { content: uuidv4() } }] },
            Name: { title: [{ text: { content: "Agreement" } }] },
            body: { rich_text: [{ text: { content } }] },
            footer_notice: { rich_text: [{ text: { content: "※ 지분 기능에 대해 지속적인 회의가 필요" } }] },
            team_id: { rich_text: [{ text: { content: teamId } }] }
        }
    });
}

export async function updateAgreementNote(pageId: string, content: string) {
    if (isSupabaseBackend()) {
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

    await notion.pages.update({
        page_id: pageId,
        properties: { body: { rich_text: [{ text: { content } }] } }
    });
}

export async function getMeetingNotes(_teamId: string) {
    if (isSupabaseBackend()) {
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
    return [];
}

export async function createMeetingNote(_teamId: string, _title: string, _content: string) {
    if (isSupabaseBackend()) {
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
}
