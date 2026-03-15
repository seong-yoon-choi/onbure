import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { buildAdminAnswerEmail } from "@/lib/i18n/admin-email";
import { supabaseRest } from "@/lib/supabase-rest";

export const runtime = "nodejs";

function normalizeAdminSubmissionType(value: unknown): "qna" | "feedback" {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "feedback" ? "feedback" : "qna";
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email || !isAdmin(session.user.email)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(req.url);
        const type = normalizeAdminSubmissionType(url.searchParams.get("type"));
        const entryId = String(url.searchParams.get("entryId") || "").trim();
        const limit = url.searchParams.get("limit") || "50";

        const filters = [`type=ilike.${encodeURIComponent(type)}`];
        if (entryId) {
            filters.push(`entry_id=eq.${encodeURIComponent(entryId)}`);
        }

        const query = `/qna_feedback?select=*&${filters.join("&")}&order=created_at.desc&limit=${encodeURIComponent(
            entryId ? "1" : limit
        )}`;
        const rows = await supabaseRest(query) as any[];

        const authorUserIds = Array.from(
            new Set(
                rows
                    .map((row) => String(row?.author_user_id || "").trim())
                    .filter(Boolean)
            )
        );
        const profileByUserId = new Map<string, { email: string; language: string }>();
        if (authorUserIds.length > 0) {
            const inClause = authorUserIds.map((userId) => encodeURIComponent(userId)).join(",");
            const profileRows = await supabaseRest(
                `/profiles?select=user_id,email,language&user_id=in.(${inClause})`
            ) as Array<{ user_id: string; email?: string | null; language?: string | null }>;
            profileRows.forEach((profile) => {
                const userId = String(profile?.user_id || "").trim();
                if (!userId) return;
                profileByUserId.set(userId, {
                    email: String(profile?.email || "").trim(),
                    language: String(profile?.language || "").trim(),
                });
            });
        }

        const entries = await Promise.all(
            rows.map(async (row) => {
                const userId = String(row?.author_user_id || "").trim();

                let resolvedFileUrl = "";
                const rawUrl = String(row?.attached_file_url || "");
                if (rawUrl) {
                    try {
                        const { getSignedUrlFromStoragePointer, parseSupabaseStoragePointer } = await import("@/lib/supabase-storage");
                        if (parseSupabaseStoragePointer(rawUrl)) {
                            resolvedFileUrl = await getSignedUrlFromStoragePointer(rawUrl);
                        } else {
                            resolvedFileUrl = rawUrl;
                        }
                    } catch {
                        // Ignore signed-url failures; keep attachment inaccessible rather than failing the response.
                    }
                }

                const profile = profileByUserId.get(userId);

                return {
                    ...row,
                    attached_file_name: String(row?.attached_file_name || "").trim() || null,
                    attached_file_url: resolvedFileUrl || null,
                    profiles: {
                        email: profile?.email || "",
                        language: profile?.language || "",
                    },
                };
            })
        );

        if (entryId) {
            return NextResponse.json({ entry: entries[0] || null });
        }

        return NextResponse.json({ entries });
    } catch (error) {
        console.error("Failed to fetch admin QnA list:", error);
        return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email || !isAdmin(session.user.email)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const entryId = String(body?.entryId || "").trim();
        const answerContent = String(body?.answerContent || "");

        if (!entryId || !answerContent) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const entryRows = await supabaseRest(
            `/qna_feedback?select=entry_id,title,type,author_user_id&entry_id=eq.${encodeURIComponent(entryId)}&limit=1`
        ) as Array<{
            entry_id?: string | null;
            title?: string | null;
            type?: string | null;
            author_user_id?: string | null;
        }>;
        const entry = entryRows[0];
        if (!entry?.entry_id) {
            return NextResponse.json({ error: "Entry not found" }, { status: 404 });
        }

        const authorUserId = String(entry.author_user_id || "").trim();
        let notifyEmail = "";
        let recipientLanguage = "";
        if (authorUserId) {
            const profileRows = await supabaseRest(
                `/profiles?select=email,language&user_id=eq.${encodeURIComponent(authorUserId)}&limit=1`
            ) as Array<{ email?: string | null; language?: string | null }>;
            const profile = profileRows[0];
            notifyEmail = String(profile?.email || "").trim();
            recipientLanguage = String(profile?.language || "").trim();
        }

        const now = new Date().toISOString();

        await supabaseRest(
            `/qna_feedback?entry_id=eq.${encodeURIComponent(entryId)}`,
            {
                method: "PATCH",
                body: {
                    answer_content: answerContent,
                    answered_at: now,
                },
            }
        );

        let emailWarning = "";
        if (notifyEmail) {
            const email = buildAdminAnswerEmail({
                language: recipientLanguage,
                type: normalizeAdminSubmissionType(entry.type),
                title: entry.title,
                answerContent,
            });

            try {
                await sendEmail(notifyEmail, email.subject, email.html);
            } catch (err) {
                console.error("Failed to send answer email:", err);
                emailWarning = "Failed to send email to user.";
            }
        }

        return NextResponse.json({ ok: true, answeredAt: now, emailWarning });
    } catch (error) {
        console.error("Failed to save answer:", error);
        return NextResponse.json({ error: "Failed to save answer" }, { status: 500 });
    }
}
