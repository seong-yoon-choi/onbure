import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { supabaseRest } from "@/lib/supabase-rest";
import { sendEmail } from "@/lib/email";

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
        const emailByUserId = new Map<string, string>();
        if (authorUserIds.length > 0) {
            const inClause = authorUserIds.map((userId) => encodeURIComponent(userId)).join(",");
            const profileRows = await supabaseRest(
                `/profiles?select=user_id,email&user_id=in.(${inClause})`
            ) as Array<{ user_id: string; email: string | null }>;
            profileRows.forEach((profile) => {
                const userId = String(profile?.user_id || "").trim();
                if (!userId) return;
                emailByUserId.set(userId, String(profile?.email || "").trim());
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
                        // Ignore error
                    }
                }

                return {
                    ...row,
                    attached_file_name: String(row?.attached_file_name || "").trim() || null,
                    attached_file_url: resolvedFileUrl || null,
                    profiles: {
                        email: userId ? (emailByUserId.get(userId) || "") : "",
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
        const { entryId, answerContent, notifyEmail, entryTitle, typeLabel } = body;
        const normalizedTypeLabel = normalizeAdminSubmissionType(typeLabel);

        if (!entryId || !answerContent) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const now = new Date().toISOString();

        await supabaseRest(
            `/qna_feedback?entry_id=eq.${encodeURIComponent(entryId)}`,
            {
                method: "PATCH",
                body: {
                    answer_content: answerContent,
                    answered_at: now
                }
            }
        );

        let emailWarning = "";
        if (notifyEmail) {
            const subject = `[Onbure] 답변이 등록되었습니다: ${entryTitle || "Your Inquiry"}`;
            const html = `
                <h2>안녕하세요, Onbure 입니다.</h2>
                <p>남겨주신 ${normalizedTypeLabel === "qna" ? "문의" : "피드백"}에 대한 답변이 등록되었습니다.</p>
                <hr style="border: 1px solid #eaeaea; margin-top: 20px; margin-bottom: 20px;" />
                <p><strong>답변 내용:</strong></p>
                <p style="white-space: pre-wrap;">${answerContent}</p>
                <hr style="border: 1px solid #eaeaea; margin-top: 20px; margin-bottom: 20px;" />
                <p>항상 Onbure를 이용해주셔서 감사합니다.</p>
            `;

            try {
                await sendEmail(notifyEmail, subject, html);
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
