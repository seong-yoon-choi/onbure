import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSupabaseBackend } from "@/lib/db/backend";
import { createFile } from "@/lib/db/workspace";
import { getTeamById, getTeamMembers, isActiveMemberStatus } from "@/lib/db/teams";
import { syncAcceptedTeamMembershipsForUser } from "@/lib/db/requests";
import { uploadWorkspaceFileToStorage } from "@/lib/supabase-storage";
import { appendAuditLog } from "@/lib/db/audit";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function resolveWorkspaceFileScope(value: FormDataEntryValue | null): "team" | "user" {
    return String(value || "").trim().toLowerCase() === "my" ? "user" : "team";
}

function invalidateWorkspaceTeamCache(teamId: string) {
    const cache = (globalThis as any).__onbureWorkspaceCache as Map<string, unknown> | undefined;
    if (!cache) return;
    const suffix = `:${teamId}`;
    for (const key of cache.keys()) {
        if (key.endsWith(suffix)) {
            cache.delete(key);
        }
    }
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ teamId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!isSupabaseBackend()) {
        return NextResponse.json(
            { error: "File upload is available only when DATA_BACKEND=supabase." },
            { status: 400 }
        );
    }

    const currentUserId = String((session.user as { id?: string } | undefined)?.id || "");
    if (!currentUserId.trim()) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { teamId } = await params;

    try {
        await syncAcceptedTeamMembershipsForUser(currentUserId, teamId).catch(() => undefined);
        const [team, members] = await Promise.all([getTeamById(teamId), getTeamMembers(teamId)]);
        if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

        const isMember = members.some(
            (member) => member.userId === currentUserId && isActiveMemberStatus(member.status)
        );
        if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const form = await req.formData();
        const payload = form.get("file");
        const fileScope = resolveWorkspaceFileScope(form.get("scope"));
        if (!(payload instanceof File)) {
            return NextResponse.json({ error: "file is required." }, { status: 400 });
        }

        const safeName = String(payload.name || "").trim().replace(/\s+/g, " ").slice(0, 120);
        if (!safeName) {
            return NextResponse.json({ error: "Invalid file name." }, { status: 400 });
        }
        if (payload.size <= 0) {
            return NextResponse.json({ error: "Empty file cannot be uploaded." }, { status: 400 });
        }
        if (payload.size > MAX_UPLOAD_BYTES) {
            return NextResponse.json(
                { error: `File is too large. Max ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.` },
                { status: 413 }
            );
        }

        const bytes = await payload.arrayBuffer();
        const pointer = await uploadWorkspaceFileToStorage({
            teamId,
            fileName: safeName,
            body: bytes,
            contentType: payload.type || "application/octet-stream",
        });

        await createFile(teamId, safeName, pointer, {
            scope: fileScope,
            ownerUserId: fileScope === "user" ? currentUserId : undefined,
        });
        invalidateWorkspaceTeamCache(teamId);
        await appendAuditLog({
            category: "workspace",
            event: "workspace_file_uploaded",
            actorUserId: currentUserId,
            teamId,
            scope: fileScope,
            metadata: {
                fileName: safeName,
                size: payload.size,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("POST /api/workspace/[teamId]/files/upload failed", error);
        const message = error instanceof Error ? error.message : String(error || "");
        const missingScopedFileColumns =
            message.includes("PGRST204") &&
            message.includes("workspace_files") &&
            (message.includes("scope") || message.includes("owner_user_id"));
        if (missingScopedFileColumns) {
            return NextResponse.json(
                {
                    error: "workspace_files.scope / owner_user_id is missing. Run the Supabase migration and reload schema cache.",
                },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { error: message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
