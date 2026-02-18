import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFileShareDownloadInfoForUser } from "@/lib/db/requests";

const TAR_BLOCK_SIZE = 512;
const textEncoder = new TextEncoder();

function sanitizeDownloadFileName(input: string, fallback: string) {
    const trimmed = String(input || "").trim();
    const sanitized = trimmed.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
    return sanitized || fallback;
}

function buildAttachmentDisposition(fileName: string) {
    const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, "_");
    const encoded = encodeURIComponent(fileName);
    return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

function truncateToUtf8Bytes(value: string, maxBytes: number) {
    if (!value) return "";
    let result = "";
    let usedBytes = 0;
    for (const char of value) {
        const bytes = textEncoder.encode(char).length;
        if (usedBytes + bytes > maxBytes) break;
        result += char;
        usedBytes += bytes;
    }
    return result;
}

function splitTarPath(rawPath: string) {
    const normalized = String(rawPath || "").replace(/^\/+/, "").trim();
    if (!normalized) {
        return { name: "file", prefix: "" };
    }

    if (textEncoder.encode(normalized).length <= 100) {
        return { name: normalized, prefix: "" };
    }

    const slashIndex = normalized.lastIndexOf("/");
    if (slashIndex > 0) {
        const prefix = normalized.slice(0, slashIndex);
        const name = normalized.slice(slashIndex + 1);
        if (textEncoder.encode(name).length <= 100 && textEncoder.encode(prefix).length <= 155) {
            return { name, prefix };
        }
    }

    return { name: truncateToUtf8Bytes(normalized, 100), prefix: "" };
}

function writeStringField(target: Uint8Array, offset: number, length: number, value: string) {
    const encoded = textEncoder.encode(value);
    target.set(encoded.slice(0, length), offset);
}

function writeOctalField(target: Uint8Array, offset: number, length: number, value: number) {
    const safe = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
    const octal = safe.toString(8).padStart(length - 1, "0");
    writeStringField(target, offset, length, `${octal}\0`);
}

function createTarHeader(path: string, size: number, mtimeSec: number) {
    const header = new Uint8Array(TAR_BLOCK_SIZE);
    const { name, prefix } = splitTarPath(path);

    writeStringField(header, 0, 100, name);
    writeOctalField(header, 100, 8, 0o644);
    writeOctalField(header, 108, 8, 0);
    writeOctalField(header, 116, 8, 0);
    writeOctalField(header, 124, 12, size);
    writeOctalField(header, 136, 12, mtimeSec);
    writeStringField(header, 156, 1, "0");
    writeStringField(header, 257, 6, "ustar");
    writeStringField(header, 263, 2, "00");
    writeStringField(header, 345, 155, prefix);

    for (let i = 148; i < 156; i += 1) {
        header[i] = 32;
    }
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    const checksumField = `${checksum.toString(8).padStart(6, "0")}\0 `;
    writeStringField(header, 148, 8, checksumField);

    return header;
}

function createTarArchive(entries: Array<{ path: string; bytes: Uint8Array }>) {
    const chunks: Uint8Array[] = [];
    const now = Math.floor(Date.now() / 1000);

    for (const entry of entries) {
        const bytes = entry.bytes || new Uint8Array();
        chunks.push(createTarHeader(entry.path, bytes.length, now));
        chunks.push(bytes);

        const padding = (TAR_BLOCK_SIZE - (bytes.length % TAR_BLOCK_SIZE)) % TAR_BLOCK_SIZE;
        if (padding > 0) {
            chunks.push(new Uint8Array(padding));
        }
    }

    chunks.push(new Uint8Array(TAR_BLOCK_SIZE * 2));

    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const archive = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        archive.set(chunk, offset);
        offset += chunk.length;
    }
    return archive;
}

async function fetchBinary(url: string) {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch file content (${res.status}).`);
    }
    return new Uint8Array(await res.arrayBuffer());
}

function ensureUniqueName(name: string, used: Map<string, number>) {
    const trimmed = String(name || "").trim() || "file";
    const count = used.get(trimmed) || 0;
    used.set(trimmed, count + 1);
    if (count === 0) return trimmed;

    const dotIndex = trimmed.lastIndexOf(".");
    if (dotIndex > 0) {
        const base = trimmed.slice(0, dotIndex);
        const ext = trimmed.slice(dotIndex);
        return `${base} (${count})${ext}`;
    }
    return `${trimmed} (${count})`;
}

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = String((session.user as { id?: string } | undefined)?.id || "").trim();
    if (!currentUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestId = String(searchParams.get("requestId") || "").trim();
    if (!requestId) {
        return NextResponse.json({ error: "requestId is required." }, { status: 400 });
    }

    try {
        const payload = await getFileShareDownloadInfoForUser(requestId, currentUserId);
        if (!payload) {
            return NextResponse.json({ error: "File request not found." }, { status: 404 });
        }

        if (payload.kind === "file") {
            const fileName = sanitizeDownloadFileName(payload.fileName, "shared-file");
            const upstream = await fetch(payload.url);
            if (!upstream.ok) {
                throw new Error(`Failed to fetch file content (${upstream.status}).`);
            }

            const contentType = upstream.headers.get("Content-Type") || "application/octet-stream";
            const buffer = await upstream.arrayBuffer();
            return new NextResponse(buffer, {
                headers: {
                    "Cache-Control": "no-store",
                    "Content-Type": contentType,
                    "Content-Disposition": buildAttachmentDisposition(fileName),
                },
            });
        }

        const archiveName = sanitizeDownloadFileName(
            payload.fileName.endsWith(".tar") ? payload.fileName : `${payload.fileName}.tar`,
            "shared-folder.tar"
        );
        const rootDir = sanitizeDownloadFileName(archiveName.replace(/\.tar$/i, ""), "shared-folder");
        const usedNames = new Map<string, number>();
        const tarEntries: Array<{ path: string; bytes: Uint8Array }> = [];

        for (const entry of payload.entries || []) {
            const originalName = sanitizeDownloadFileName(entry.name, "file");
            const uniqueName = ensureUniqueName(originalName, usedNames);
            const bytes = await fetchBinary(entry.url);
            tarEntries.push({
                path: `${rootDir}/${uniqueName}`,
                bytes,
            });
        }

        if (tarEntries.length === 0) {
            return NextResponse.json({ error: "Folder has no downloadable files." }, { status: 400 });
        }

        const archive = createTarArchive(tarEntries);
        return new NextResponse(archive, {
            headers: {
                "Cache-Control": "no-store",
                "Content-Type": "application/x-tar",
                "Content-Disposition": buildAttachmentDisposition(archiveName),
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        if (message === "Forbidden") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
