import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { v4 as uuidv4 } from "uuid";
import { authOptions } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { supabaseRest } from "@/lib/supabase-rest";
import { getTeamById, getTeamMembers, isActiveMemberStatus } from "@/lib/db/teams";
import { syncAcceptedTeamMembershipsForUser } from "@/lib/db/requests";

export const runtime = "nodejs";

type SubmissionType = "qna" | "feedback";

interface WorkspaceQnaFeedbackRow {
    entry_id: string;
    team_id: string | null;
    type: string | null;
    title: string | null;
    content: string | null;
    author_user_id: string | null;
    author_name: string | null;
    created_at: string | null;
}

function normalizeSubmissionType(value: unknown): SubmissionType | null {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "qna" || normalized === "feedback") return normalized;
    return null;
}

function normalizeTeamId(value: unknown) {
    return String(value || "").trim();
}

function getSessionUserId(session: unknown) {
    return String(((session as { user?: { id?: string } } | null)?.user?.id) || "").trim();
}

async function assertTeamMember(teamId: string, userId: string) {
    await syncAcceptedTeamMembershipsForUser(userId, teamId).catch(() => undefined);
    const [team, members] = await Promise.all([getTeamById(teamId), getTeamMembers(teamId)]);
    if (!team) throw new Error("Team not found");

    const isMember = members.some(
        (member) => member.userId === userId && isActiveMemberStatus(member.status)
    );
    if (!isMember) throw new Error("Forbidden");
}

function toClientEntry(row: WorkspaceQnaFeedbackRow, currentUserId: string) {
    const type = normalizeSubmissionType(row.type) || "qna";
    const title = String(row.title || "").trim();
    const content = String(row.content || "").trim();
    if (!row.entry_id || !title || !content) return null;

    return {
        id: row.entry_id,
        teamId: String(row.team_id || "").trim(),
        type,
        title,
        content,
        authorName: String(row.author_name || "").trim(),
        authorUserId: String(row.author_user_id || "").trim(),
        createdAt: String(row.created_at || new Date().toISOString()),
        canDelete: String(row.author_user_id || "").trim() === currentUserId,
    };
}

function mapMissingTableError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || "");
    const missingTable =
        message.includes("PGRST205") &&
        message.includes("qna_feedback");

    if (!missingTable) return null;
    return "qna_feedback table is missing. Run supabase/schema.sql and reload schema cache.";
}

function escapeHtml(input: string) {
    return String(input || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const currentUserId = getSessionUserId(session);
        if (!session?.user || !currentUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const requestUrl = new URL(req.url);
        const teamId = normalizeTeamId(requestUrl.searchParams.get("teamId"));
        if (teamId) {
            await assertTeamMember(teamId, currentUserId);
        }

        const filter = teamId
            ? `team_id=eq.${encodeURIComponent(teamId)}`
            : `team_id=is.null&author_user_id=eq.${encodeURIComponent(currentUserId)}`;

        const rows = (await supabaseRest(
            `/qna_feedback?select=entry_id,team_id,type,title,content,author_user_id,author_name,attached_file_name,attached_file_url,created_at&${filter}&order=created_at.desc&limit=300`
        )) as Array<WorkspaceQnaFeedbackRow & { attached_file_name?: string | null; attached_file_url?: string | null }>;
        const entries = await Promise.all(
            rows.map(async (row) => {
                const clientEntry = toClientEntry(row, currentUserId);
                if (!clientEntry) return null;

                let resolvedFileUrl = "";
                const rawUrl = String(row.attached_file_url || "");
                if (rawUrl) {
                    try {
                        const { getSignedUrlFromStoragePointer, parseSupabaseStoragePointer } = await import("@/lib/supabase-storage");
                        if (parseSupabaseStoragePointer(rawUrl)) {
                            resolvedFileUrl = await getSignedUrlFromStoragePointer(rawUrl);
                        } else {
                            resolvedFileUrl = rawUrl;
                        }
                    } catch {
                        // Ignore
                    }
                }

                return {
                    ...clientEntry,
                    attachedFileName: String(row.attached_file_name || "").trim() || undefined,
                    attachedFileUrl: resolvedFileUrl || undefined,
                };
            })
        );

        const validEntries = entries.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

        return NextResponse.json({ entries: validEntries });
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message === "Team not found") {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }
        if (message === "Forbidden") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const missingTableError = mapMissingTableError(error);
        if (missingTableError) {
            return NextResponse.json({ error: missingTableError }, { status: 400 });
        }
        console.error("Failed to load QnA/Feedback entries:", error);
        return NextResponse.json({ error: "Failed to load entries." }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const currentUserId = getSessionUserId(session);
        if (!session?.user || !currentUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const receiverEmail = String(session.user.email || "").trim().toLowerCase();

        let type: ReturnType<typeof normalizeSubmissionType>;
        let title: string;
        let content: string;
        let teamId: string;
        let authorName: string;
        let attachedFileUrl: string | null = null;
        let attachedFileName: string | null = null;

        const contentType = req.headers.get("content-type") || "";
        if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData().catch(() => new FormData());
            type = normalizeSubmissionType(formData.get("type"));
            title = String(formData.get("title") || "").trim().slice(0, 120);
            content = String(formData.get("content") || "").trim().slice(0, 4000);
            teamId = normalizeTeamId(formData.get("teamId"));
            authorName = String(formData.get("authorName") || session.user.name || receiverEmail || currentUserId)
                .trim()
                .slice(0, 120);

            const filePayload = formData.get("file");
            if (filePayload instanceof File && filePayload.size > 0) {
                const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB
                if (filePayload.size > MAX_UPLOAD_BYTES) {
                    return NextResponse.json({ error: `File is too large. Max ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.` }, { status: 413 });
                }

                const safeName = String(filePayload.name || "").trim().replace(/\s+/g, " ").slice(0, 120);
                if (safeName) {
                    try {
                        const { uploadWorkspaceFileToStorage } = await import("@/lib/supabase-storage");
                        const bytes = await filePayload.arrayBuffer();
                        // TeamId can be empty for global feedback, use "global_feedback" as the bucket folder
                        const storageTeamId = teamId || "global_feedback";
                        attachedFileUrl = await uploadWorkspaceFileToStorage({
                            teamId: storageTeamId,
                            fileName: safeName,
                            body: bytes,
                            contentType: filePayload.type || "application/octet-stream",
                        });
                        attachedFileName = safeName;
                    } catch (uploadError) {
                        console.error("Failed to upload QnA feedback attachment:", uploadError);
                        return NextResponse.json({ error: "Failed to upload attached file." }, { status: 500 });
                    }
                }
            }
        } else {
            // Fallback for JSON
            const body = (await req.json().catch(() => ({}))) as {
                type?: string;
                title?: string;
                content?: string;
                teamId?: unknown;
                authorName?: string;
            };

            type = normalizeSubmissionType(body.type);
            title = String(body.title || "").trim().slice(0, 120);
            content = String(body.content || "").trim().slice(0, 4000);
            teamId = normalizeTeamId(body.teamId);
            authorName = String(body.authorName || session.user.name || receiverEmail || currentUserId)
                .trim()
                .slice(0, 120);
        }

        if (!type || !title || !content) {
            return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
        }
        if (teamId) {
            await assertTeamMember(teamId, currentUserId);
        }

        const insertedRows = (await supabaseRest("/qna_feedback", {
            method: "POST",
            prefer: "return=representation",
            body: {
                entry_id: uuidv4(),
                team_id: teamId || null,
                type,
                title,
                content,
                author_user_id: currentUserId,
                author_name: authorName,
                attached_file_url: attachedFileUrl,
                attached_file_name: attachedFileName,
            },
        })) as Array<WorkspaceQnaFeedbackRow & { attached_file_name?: string | null; attached_file_url?: string | null }>;

        const inserted = insertedRows[0];
        let createdEntry = null;
        if (inserted) {
            const clientEntry = toClientEntry(inserted, currentUserId);
            if (clientEntry) {
                createdEntry = {
                    ...clientEntry,
                    attachedFileName: String(inserted.attached_file_name || "").trim() || undefined,
                    // Return the raw URL for immediate UI mapping, or it could be signed. We'll leave it as we just uploaded it.
                };
            }
        }

        let emailWarning = "";
        if (receiverEmail) {
            const label = type === "qna" ? "QnA" : "Feedback";
            const subject = `[Onbure][${label}] ${title}`;
            const fileAttachmentHtml = attachedFileName ? `<p><strong>Attached File:</strong> ${escapeHtml(attachedFileName)}</p>` : "";
            const html = `
            <h2>${label} Submission</h2>
            <p><strong>Author:</strong> ${escapeHtml(authorName)}</p>
            <p><strong>Team:</strong> ${escapeHtml(teamId || "global")}</p>
            <p><strong>Title:</strong> ${escapeHtml(title)}</p>
            ${fileAttachmentHtml}
            <hr />
            <p style="white-space: pre-wrap;">${escapeHtml(content)}</p>
        `;
            try {
                await sendEmail(receiverEmail, subject, html);
            } catch (error) {
                const message =
                    error instanceof Error && error.message
                        ? error.message
                        : "Failed to send email.";
                emailWarning = message;
            }
        }

        return NextResponse.json(
            {
                ok: true,
                entry: createdEntry,
                ...(emailWarning ? { emailWarning } : {}),
            },
            { status: 201 }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message === "Team not found") {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }
        if (message === "Forbidden") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const missingTableError = mapMissingTableError(error);
        if (missingTableError) {
            return NextResponse.json({ error: missingTableError }, { status: 400 });
        }
        console.error("Failed to create QnA/Feedback entry:", error);
        return NextResponse.json({ error: "Failed to create entry." }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const currentUserId = getSessionUserId(session);
        if (!session?.user || !currentUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await req.json().catch(() => ({}))) as { id?: string };
        const entryId = String(body.id || "").trim();
        if (!entryId) {
            return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
        }

        const rows = (await supabaseRest(
            `/qna_feedback?select=entry_id,author_user_id&entry_id=eq.${encodeURIComponent(entryId)}&limit=1`
        )) as Array<{ entry_id: string; author_user_id: string | null }>;
        const target = rows[0];
        if (!target) {
            return NextResponse.json({ error: "Entry not found." }, { status: 404 });
        }
        if (String(target.author_user_id || "").trim() !== currentUserId) {
            return NextResponse.json({ error: "Only the author can delete this entry." }, { status: 403 });
        }

        await supabaseRest(
            `/qna_feedback?entry_id=eq.${encodeURIComponent(entryId)}`,
            {
                method: "DELETE",
                prefer: "return=minimal",
            }
        );

        return NextResponse.json({ ok: true });
    } catch (error) {
        const missingTableError = mapMissingTableError(error);
        if (missingTableError) {
            return NextResponse.json({ error: missingTableError }, { status: 400 });
        }
        console.error("Failed to delete QnA/Feedback entry:", error);
        return NextResponse.json({ error: "Failed to delete entry." }, { status: 500 });
    }
}
