import { randomUUID } from "crypto";

const DEFAULT_STORAGE_BUCKET = "workspace-files";

declare global {
    var __onbureEnsuredStorageBuckets: Set<string> | undefined;
}

const ensuredBuckets =
    globalThis.__onbureEnsuredStorageBuckets ||
    (globalThis.__onbureEnsuredStorageBuckets = new Set<string>());

function trimSlash(value: string) {
    return value.replace(/\/+$/, "");
}

function assertSupabaseEnv() {
    const baseUrl = String(process.env.SUPABASE_URL || "").trim();
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!baseUrl) throw new Error("Missing SUPABASE_URL");
    if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

    return {
        baseUrl: trimSlash(baseUrl),
        serviceRoleKey,
    };
}

function getStorageBucket() {
    return String(process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_STORAGE_BUCKET).trim() || DEFAULT_STORAGE_BUCKET;
}

function storageHeaders(serviceRoleKey: string, contentType?: string, extra?: Record<string, string>) {
    return {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        ...(contentType ? { "Content-Type": contentType } : {}),
        ...(extra || {}),
    };
}

function encodeStoragePath(path: string) {
    return path
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
}

function sanitizeFileName(fileName: string) {
    const normalized = String(fileName || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    const dotIndex = normalized.lastIndexOf(".");
    const hasExt = dotIndex > 0 && dotIndex < normalized.length - 1;
    const rawBase = hasExt ? normalized.slice(0, dotIndex) : normalized;
    const rawExt = hasExt ? normalized.slice(dotIndex + 1) : "";

    const base = rawBase
        .replace(/\s+/g, "_")
        .replace(/[^A-Za-z0-9_-]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^[_-]+|[_-]+$/g, "");

    const ext = rawExt
        .replace(/\s+/g, "")
        .replace(/[^A-Za-z0-9]/g, "")
        .toLowerCase()
        .slice(0, 16);

    const safeBase = base || "file";
    const safeName = ext ? `${safeBase}.${ext}` : safeBase;
    return safeName.slice(0, 160);
}

function isBucketMissingResponse(status: number, bodyText: string) {
    if (status === 404) return true;
    if (status !== 400) return false;

    const normalized = String(bodyText || "").toLowerCase();
    if (normalized.includes("bucket not found")) return true;
    if (normalized.includes("\"statuscode\":\"404\"")) return true;

    try {
        const parsed = JSON.parse(bodyText) as Record<string, unknown>;
        const statusCode = String(parsed.statusCode || parsed.status_code || "");
        const message = String(parsed.message || parsed.error || "").toLowerCase();
        return statusCode === "404" || message.includes("bucket not found");
    } catch {
        return false;
    }
}

async function ensureBucketExists(bucket: string) {
    if (ensuredBuckets.has(bucket)) return;

    const { baseUrl, serviceRoleKey } = assertSupabaseEnv();

    const getRes = await fetch(`${baseUrl}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
        method: "GET",
        headers: storageHeaders(serviceRoleKey),
        cache: "no-store",
    });

    const getText = getRes.ok ? "" : await getRes.text();
    if (isBucketMissingResponse(getRes.status, getText)) {
        const createRes = await fetch(`${baseUrl}/storage/v1/bucket`, {
            method: "POST",
            headers: storageHeaders(serviceRoleKey, "application/json"),
            body: JSON.stringify({
                id: bucket,
                name: bucket,
                public: false,
            }),
            cache: "no-store",
        });

        const createText = createRes.ok ? "" : await createRes.text();
        const normalizedCreateText = createText.toLowerCase();
        const alreadyExists =
            createRes.status === 409 ||
            normalizedCreateText.includes("already exists") ||
            normalizedCreateText.includes("duplicate");

        if (!createRes.ok && !alreadyExists) {
            throw new Error(
                `Supabase Storage Error [${createRes.status}]: ${createText}. ` +
                `Please create bucket '${bucket}' in Supabase Storage and retry.`
            );
        }
    } else if (!getRes.ok) {
        throw new Error(`Supabase Storage Error [${getRes.status}]: ${getText}`);
    }

    ensuredBuckets.add(bucket);
}

export function buildSupabaseStoragePointer(bucket: string, path: string) {
    return `supabase://${bucket}/${path}`;
}

export function parseSupabaseStoragePointer(rawUrl: string | null | undefined) {
    const value = String(rawUrl || "").trim();
    if (!value.startsWith("supabase://")) return null;

    const rest = value.slice("supabase://".length);
    const slashIndex = rest.indexOf("/");
    if (slashIndex <= 0) return null;

    const bucket = rest.slice(0, slashIndex).trim();
    const path = rest.slice(slashIndex + 1).trim();
    if (!bucket || !path) return null;

    return { bucket, path };
}

export async function uploadWorkspaceFileToStorage(params: {
    teamId: string;
    fileName: string;
    body: ArrayBuffer;
    contentType?: string;
}) {
    const { baseUrl, serviceRoleKey } = assertSupabaseEnv();
    const bucket = getStorageBucket();
    await ensureBucketExists(bucket);

    const safeFileName = sanitizeFileName(params.fileName);
    const teamSegment = String(params.teamId || "")
        .replace(/[^A-Za-z0-9_-]/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 80) || "team";
    const objectPath = `${teamSegment}/${Date.now()}-${randomUUID()}-${safeFileName}`;
    const encodedPath = encodeStoragePath(objectPath);

    const uploadRes = await fetch(
        `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`,
        {
            method: "POST",
            headers: storageHeaders(serviceRoleKey, params.contentType || "application/octet-stream", {
                "x-upsert": "true",
            }),
            body: new Blob([params.body], { type: params.contentType || "application/octet-stream" }),
            cache: "no-store",
        }
    );

    if (!uploadRes.ok) {
        const text = await uploadRes.text();
        throw new Error(`Supabase Storage Error [${uploadRes.status}]: ${text}`);
    }

    return buildSupabaseStoragePointer(bucket, objectPath);
}

export async function getSignedUrlFromStoragePointer(pointer: string, expiresInSeconds = 60 * 60 * 24 * 7) {
    const parsed = parseSupabaseStoragePointer(pointer);
    if (!parsed) return "";

    const { baseUrl, serviceRoleKey } = assertSupabaseEnv();
    await ensureBucketExists(parsed.bucket);

    const signRes = await fetch(
        `${baseUrl}/storage/v1/object/sign/${encodeURIComponent(parsed.bucket)}/${encodeStoragePath(parsed.path)}`,
        {
            method: "POST",
            headers: storageHeaders(serviceRoleKey, "application/json"),
            body: JSON.stringify({ expiresIn: expiresInSeconds }),
            cache: "no-store",
        }
    );

    if (!signRes.ok) {
        const text = await signRes.text();
        throw new Error(`Supabase Storage Error [${signRes.status}]: ${text}`);
    }

    const payload = (await signRes.json().catch(() => ({}))) as Record<string, unknown>;
    const signed = String(payload.signedURL || payload.signedUrl || "").trim();
    if (!signed) return "";

    if (signed.startsWith("http://") || signed.startsWith("https://")) return signed;
    if (signed.startsWith("/storage/v1/")) return `${baseUrl}${signed}`;
    if (signed.startsWith("/")) return `${baseUrl}/storage/v1${signed}`;
    return `${baseUrl}/storage/v1/${signed}`;
}

export async function deleteStorageObjectFromPointer(pointer: string) {
    const parsed = parseSupabaseStoragePointer(pointer);
    if (!parsed) return;

    const { baseUrl, serviceRoleKey } = assertSupabaseEnv();
    await ensureBucketExists(parsed.bucket);

    const deleteRes = await fetch(
        `${baseUrl}/storage/v1/object/${encodeURIComponent(parsed.bucket)}/${encodeStoragePath(parsed.path)}`,
        {
            method: "DELETE",
            headers: storageHeaders(serviceRoleKey),
            cache: "no-store",
        }
    );

    // Ignore 404 to keep delete idempotent.
    if (!deleteRes.ok && deleteRes.status !== 404) {
        const text = await deleteRes.text();
        throw new Error(`Supabase Storage Error [${deleteRes.status}]: ${text}`);
    }
}
