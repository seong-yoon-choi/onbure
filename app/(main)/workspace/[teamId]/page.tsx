"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertModal, ConfirmModal, ModalShell } from "@/components/ui/modal";
import {
    Boxes,
    ChevronLeft,
    ChevronRight,
    File,
    Folder,
    FolderOpen,
    Loader2,
    MessageCircle,
    MessageSquare,
    NotebookPen,
    Plus,
    UserRound,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuditRealtime } from "@/lib/realtime/use-audit-realtime";
import { trackUxClick } from "@/lib/ux/client";
import { useLanguage } from "@/components/providers";

interface WorkspaceTeam {
    name: string;
    description: string;
}

interface WorkspaceLink {
    id: string;
    title: string;
    url: string;
}

interface WorkspaceFile {
    id: string;
    title: string;
    url?: string;
    folderId?: string;
    ownerUserId?: string;
    createdAt?: string;
}

interface WorkspaceTask {
    id: string;
    title: string;
    status: "To Do" | "In Progress" | "Done";
}

interface AgreementNote {
    id: string;
    body: string;
    footer: string;
}

interface WorkspaceMember {
    id: string;
    teamId: string;
    userId: string;
    username: string;
    role: "Owner" | "Admin" | "Member";
    status: string;
    joinedAt: string;
}

interface WorkspaceData {
    team: WorkspaceTeam;
    links: WorkspaceLink[];
    files: WorkspaceFile[];
    myFiles?: WorkspaceFile[];
    tasks: WorkspaceTask[];
    meetingNotes: unknown[];
    agreementNotes: AgreementNote[];
    members: WorkspaceMember[];
    viewerUserId?: string;
}

type WorkspaceSection = "members" | "files" | "groups";
type WorkspaceMode = "my" | "team";

type Presence = "active" | "away" | "inactive";

interface CanvasPosition {
    x: number;
    y: number;
}

interface MovingFileState {
    fileId: string;
    offsetX: number;
    offsetY: number;
}

interface MovingMemberState {
    memberId: string;
    offsetX: number;
    offsetY: number;
}

interface MovingAnnotationState {
    annotationId: string;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
}

interface MovingSelectionItemState {
    key: string;
    kind: WorkspaceGroupItemKind;
    id: string;
    startX: number;
    startY: number;
    width: number;
    height: number;
}

interface MovingSelectionState {
    anchorKey: string;
    pointerOffsetX: number;
    pointerOffsetY: number;
    items: MovingSelectionItemState[];
}

interface ResizingAnnotationState {
    annotationId: string;
    startWidth: number;
    startHeight: number;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
}

interface ProfileMenuState {
    x: number;
    y: number;
    userId: string;
    roleSubmenuLeft?: boolean;
    itemKey?: string;
    memberSourceId?: string;
}

interface CanvasMenuState {
    x: number;
    y: number;
}

interface FileItemMenuState {
    x: number;
    y: number;
    fileId: string;
    moveSubmenuLeft?: boolean;
    shareSubmenuLeft?: boolean;
}

interface AnnotationItemMenuState {
    x: number;
    y: number;
    annotationId: string;
}

interface CanvasFileItemMenuState {
    x: number;
    y: number;
    fileId: string;
    shareSubmenuLeft?: boolean;
}

interface FileShareDragState {
    fileId: string;
    fileName: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    hoverUserId: string | null;
    hoverUsername: string;
}

interface GroupMenuState {
    x: number;
    y: number;
    groupId?: string;
    source?: "sidebar" | "canvas";
}

interface GroupEntryMenuState {
    x: number;
    y: number;
    groupId: string;
    itemKey: string;
}

interface GroupDragPreviewState {
    x: number;
    y: number;
    kind: WorkspaceGroupItemKind | "mixed";
    label: string;
    count: number;
}

interface GroupEntryReorderDragState {
    groupId: string;
    itemKey: string;
}

interface GroupEntryReorderHoverState {
    groupId: string;
    itemKey: string;
    position: "before" | "after";
}

interface CreateEntryModalState {
    open: boolean;
    name: string;
    sourceFileId: string;
    isSubmitting: boolean;
    error: string;
}

interface InlineRenameState {
    fileId: string;
    isFolder: boolean;
    name: string;
    originalName: string;
    isSubmitting: boolean;
    error: string;
}

interface MoveFileModalState {
    open: boolean;
    fileId: string;
    folderId: string;
    isSubmitting: boolean;
    error: string;
}

interface RoleChangeConfirmState {
    open: boolean;
    targetUserId: string;
    targetUsername: string;
    nextRole: "Admin" | "Member";
    isSubmitting: boolean;
}

interface FileShareConfirmState {
    open: boolean;
    fileId: string;
    fileName: string;
    toUserId: string;
    toUsername: string;
    isSubmitting: boolean;
    isResend: boolean;
}

interface WorkspaceCanvasMenuState {
    x: number;
    y: number;
    canvasX: number;
    canvasY: number;
    mode?: "default" | "groupOnly";
    moveSubmenuLeft?: boolean;
}

type WorkspaceAnnotationKind = "comment" | "memo";

interface WorkspaceAnnotation {
    id: string;
    kind: WorkspaceAnnotationKind;
    title: string;
    authorUserId: string;
    authorName: string;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    createdAt: string;
    updatedAt: string;
}

interface WorkspaceItemComment {
    id: string;
    itemKey: string;
    authorUserId: string;
    authorName: string;
    text: string;
    createdAt: string;
}

type WorkspaceGroupItemKind = "file" | "member" | "annotation";

interface WorkspaceGroup {
    id: string;
    name: string;
    itemKeys: string[];
    createdAt: string;
}

interface CanvasSelectionState {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
}

interface SidebarSelectionState {
    section: "files" | "groups";
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
}

interface CanvasBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface CanvasSelectableItem {
    key: string;
    kind: WorkspaceGroupItemKind;
    id: string;
    label: string;
    bounds: CanvasBounds;
}

interface GroupDropAnimation {
    id: string;
    kind: WorkspaceGroupItemKind;
    fromX: number;
    fromY: number;
    fromWidth: number;
    fromHeight: number;
    toX: number;
    toY: number;
    started: boolean;
}

interface GroupInlineRenameState {
    groupId: string;
    name: string;
    originalName: string;
    error: string;
}

const CANVAS_FILE_WIDTH = 112;
const CANVAS_FILE_HEIGHT = 96;
const CANVAS_MEMBER_MIN_WIDTH = 176;
const CANVAS_MEMBER_MAX_WIDTH = 520;
const CANVAS_MEMBER_HEIGHT = 64;
const CANVAS_ANNOTATION_SIZE = 44;
const CANVAS_ANNOTATION_DEFAULT_WIDTH = 340;
const CANVAS_ANNOTATION_DEFAULT_HEIGHT = 220;
const CANVAS_ANNOTATION_MIN_WIDTH = 260;
const CANVAS_ANNOTATION_MIN_HEIGHT = 170;
const CANVAS_ANNOTATION_MAX_WIDTH = 760;
const CANVAS_ANNOTATION_MAX_HEIGHT = 560;
const CANVAS_PADDING = 16;
const CANVAS_COMMENT_PREVIEW_WIDTH = 224;
const CANVAS_COMMENT_PREVIEW_HEIGHT = 44;
const CANVAS_PLACEMENT_SEPARATOR = "::";

function buildCanvasItemKey(kind: WorkspaceGroupItemKind, id: string) {
    return `${kind}:${id}`;
}

function parseCanvasItemKey(raw: string): { kind: WorkspaceGroupItemKind; id: string } | null {
    const normalized = String(raw || "").trim();
    if (!normalized) return null;
    const sep = normalized.indexOf(":");
    if (sep <= 0) return null;
    const kind = normalized.slice(0, sep);
    const id = normalized.slice(sep + 1);
    if (!id) return null;
    if (kind !== "file" && kind !== "member" && kind !== "annotation") return null;
    return { kind, id };
}

function reorderGroupItemKeys(
    itemKeys: string[],
    sourceKey: string,
    targetKey: string,
    position: "before" | "after"
): string[] {
    if (!sourceKey || !targetKey || sourceKey === targetKey) return itemKeys;
    if (!itemKeys.includes(sourceKey) || !itemKeys.includes(targetKey)) return itemKeys;

    const withoutSource = itemKeys.filter((itemKey) => itemKey !== sourceKey);
    const targetIndex = withoutSource.indexOf(targetKey);
    if (targetIndex < 0) return itemKeys;

    const insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
    const next = [...withoutSource];
    next.splice(insertIndex, 0, sourceKey);
    return next;
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function clampToCanvas(
    position: CanvasPosition,
    width: number,
    height: number,
    itemWidth = CANVAS_FILE_WIDTH,
    itemHeight = CANVAS_FILE_HEIGHT
): CanvasPosition {
    const maxX = Math.max(CANVAS_PADDING, width - itemWidth - CANVAS_PADDING);
    const maxY = Math.max(CANVAS_PADDING, height - itemHeight - CANVAS_PADDING);
    return {
        x: Math.min(maxX, Math.max(CANVAS_PADDING, Math.round(position.x))),
        y: Math.min(maxY, Math.max(CANVAS_PADDING, Math.round(position.y))),
    };
}

function getMemberCardWidth(name: string): number {
    const normalized = String(name || "").trim();
    // Base space covers status dot/avatar/padding + room for role line.
    const estimated = 120 + normalized.length * 8.5;
    return Math.round(clampNumber(estimated, CANVAS_MEMBER_MIN_WIDTH, CANVAS_MEMBER_MAX_WIDTH));
}

function getDefaultAnnotationTitle(
    kind: WorkspaceAnnotationKind,
    resolveLabel?: (key: string) => string
): string {
    if (kind === "comment") return resolveLabel ? resolveLabel("workspace.annotation.commentTitle") : "Comment";
    return resolveLabel ? resolveLabel("workspace.annotation.memoTitle") : "Memo";
}

function isFolderEntry(file: WorkspaceFile) {
    return String(file.title || "").startsWith("Folder: ");
}

function getFolderDisplayName(title: string, fallbackLabel = "Folder") {
    const raw = String(title || "");
    if (!raw.startsWith("Folder: ")) return raw;
    return raw.slice("Folder: ".length).trim() || fallbackLabel;
}

function extractCanvasPlacementSourceId(rawId: string): string {
    const normalized = String(rawId || "").trim();
    if (!normalized) return "";
    const sep = normalized.indexOf(CANVAS_PLACEMENT_SEPARATOR);
    if (sep <= 0) return normalized;
    return normalized.slice(0, sep);
}

function createCanvasPlacementId(sourceId: string): string {
    const base = String(sourceId || "").trim();
    if (!base) return "";
    const suffix =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `${base}${CANVAS_PLACEMENT_SEPARATOR}${suffix}`;
}

function parseSavedPositions(raw: string | null): Record<string, CanvasPosition> {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw) as Record<string, { x: number; y: number }>;
        const next: Record<string, CanvasPosition> = {};
        for (const [fileId, value] of Object.entries(parsed || {})) {
            if (!value) continue;
            if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) continue;
            next[fileId] = { x: value.x, y: value.y };
        }
        return next;
    } catch {
        return {};
    }
}

function parseSavedAnnotations(raw: string | null): WorkspaceAnnotation[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as Array<{
            id?: string;
            kind?: string;
            title?: string;
            authorUserId?: string;
            authorName?: string;
            x?: number;
            y?: number;
            width?: number;
            height?: number;
            text?: string;
            createdAt?: string;
            updatedAt?: string;
        }>;
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map((item) => {
                const id = String(item?.id || "").trim();
                const kind = item?.kind === "memo" ? "memo" : item?.kind === "comment" ? "comment" : null;
                if (!id || !kind) return null;
                if (!Number.isFinite(item?.x) || !Number.isFinite(item?.y)) return null;
                const title = String(item?.title || "").trim() || getDefaultAnnotationTitle(kind);

                return {
                    id,
                    kind,
                    title,
                    authorUserId: String(item?.authorUserId || ""),
                    authorName: String(item?.authorName || ""),
                    x: Math.round(Number(item?.x)),
                    y: Math.round(Number(item?.y)),
                    width: Math.round(
                        clampNumber(
                            Number(item?.width ?? CANVAS_ANNOTATION_DEFAULT_WIDTH),
                            CANVAS_ANNOTATION_MIN_WIDTH,
                            CANVAS_ANNOTATION_MAX_WIDTH
                        )
                    ),
                    height: Math.round(
                        clampNumber(
                            Number(item?.height ?? CANVAS_ANNOTATION_DEFAULT_HEIGHT),
                            CANVAS_ANNOTATION_MIN_HEIGHT,
                            CANVAS_ANNOTATION_MAX_HEIGHT
                        )
                    ),
                    text: String(item?.text || ""),
                    createdAt: String(item?.createdAt || new Date().toISOString()),
                    updatedAt: String(item?.updatedAt || new Date().toISOString()),
                } as WorkspaceAnnotation;
            })
            .filter(Boolean) as WorkspaceAnnotation[];
    } catch {
        return [];
    }
}

function parseSavedItemComments(raw: string | null): WorkspaceItemComment[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as Array<{
            id?: string;
            itemKey?: string;
            authorUserId?: string;
            authorName?: string;
            text?: string;
            createdAt?: string;
        }>;
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map((item) => {
                const id = String(item?.id || "").trim();
                const itemKey = String(item?.itemKey || "").trim();
                if (!id || !parseCanvasItemKey(itemKey)) return null;
                const text = String(item?.text || "").trim();
                if (!text) return null;
                return {
                    id,
                    itemKey,
                    authorUserId: String(item?.authorUserId || "").trim(),
                    authorName: String(item?.authorName || "").trim(),
                    text: text.slice(0, 1000),
                    createdAt: String(item?.createdAt || new Date().toISOString()),
                } satisfies WorkspaceItemComment;
            })
            .filter(Boolean) as WorkspaceItemComment[];
    } catch {
        return [];
    }
}

function parseSavedGroups(raw: string | null): WorkspaceGroup[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as Array<{
            id?: string;
            name?: string;
            itemKeys?: unknown;
            createdAt?: string;
        }>;
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map((item) => {
                const id = String(item?.id || "").trim();
                if (!id) return null;
                const name = String(item?.name || "").trim().slice(0, 60) || "Group";
                const itemKeys = Array.isArray(item?.itemKeys)
                    ? Array.from(
                        new Set(
                            item.itemKeys
                                .map((value) => String(value || "").trim())
                                .filter((value) => Boolean(parseCanvasItemKey(value)))
                        )
                    )
                    : [];
                return {
                    id,
                    name,
                    itemKeys,
                    createdAt: String(item?.createdAt || new Date().toISOString()),
                } satisfies WorkspaceGroup;
            })
            .filter(Boolean) as WorkspaceGroup[];
    } catch {
        return [];
    }
}

function parseSavedStringArray(raw: string | null): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return Array.from(
            new Set(
                parsed
                    .map((item) => String(item || "").trim())
                    .filter(Boolean)
            )
        );
    } catch {
        return [];
    }
}

function parseSavedStringRecord(raw: string | null): Record<string, string> {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
        const next: Record<string, string> = {};
        for (const [key, value] of Object.entries(parsed)) {
            const normalizedKey = String(key || "").trim();
            const normalizedValue = String(value || "").trim();
            if (!normalizedKey || !normalizedValue) continue;
            next[normalizedKey] = normalizedValue;
        }
        return next;
    } catch {
        return {};
    }
}

function normalizeSelectionBounds(selection: CanvasSelectionState): CanvasBounds {
    const x = Math.min(selection.startX, selection.currentX);
    const y = Math.min(selection.startY, selection.currentY);
    return {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(Math.abs(selection.currentX - selection.startX)),
        height: Math.round(Math.abs(selection.currentY - selection.startY)),
    };
}

function normalizePointerSelectionBounds(selection: {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
}): CanvasBounds {
    const x = Math.min(selection.startX, selection.currentX);
    const y = Math.min(selection.startY, selection.currentY);
    return {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(Math.abs(selection.currentX - selection.startX)),
        height: Math.round(Math.abs(selection.currentY - selection.startY)),
    };
}

function hasRectIntersection(a: CanvasBounds, b: CanvasBounds): boolean {
    if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) return false;
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function resolvePresence(status: string | undefined | null): Presence {
    const normalized = String(status || "").trim().toLowerCase();
    if (!normalized) return "inactive";

    // Check inactive first because "inactive" contains "active".
    if (normalized.includes("inactive") || normalized.includes("offline")) return "inactive";
    if (normalized.includes("away") || normalized.includes("idle") || normalized.includes("break")) return "away";
    if (normalized.includes("active") || normalized.includes("online")) return "active";

    return "inactive";
}
export default function WorkspacePage() {
    const { teamId: teamIdParam } = useParams<{ teamId: string }>();
    const router = useRouter();
    const { t } = useLanguage();
    const teamId = Array.isArray(teamIdParam) ? teamIdParam[0] : teamIdParam;

    const [data, setData] = useState<WorkspaceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("my");
    const [activeSection, setActiveSection] = useState<WorkspaceSection>("members");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState<{ open: boolean; title: string; message: string }>({
        open: false,
        title: "",
        message: "",
    });
    const [workspaceActionPendingCount, setWorkspaceActionPendingCount] = useState(0);

    const [canvasFilePositions, setCanvasFilePositions] = useState<Record<string, CanvasPosition>>({});
    const [canvasMemberPositions, setCanvasMemberPositions] = useState<Record<string, CanvasPosition>>({});
    const [canvasMemberPlacementOwners, setCanvasMemberPlacementOwners] = useState<Record<string, string>>({});
    const [movingFile, setMovingFile] = useState<MovingFileState | null>(null);
    const [movingMember, setMovingMember] = useState<MovingMemberState | null>(null);
    const [movingAnnotation, setMovingAnnotation] = useState<MovingAnnotationState | null>(null);
    const [movingSelection, setMovingSelection] = useState<MovingSelectionState | null>(null);
    const [resizingAnnotation, setResizingAnnotation] = useState<ResizingAnnotationState | null>(null);
    const [profileMenu, setProfileMenu] = useState<ProfileMenuState | null>(null);
    const [canvasMenu, setCanvasMenu] = useState<CanvasMenuState | null>(null);
    const [fileItemMenu, setFileItemMenu] = useState<FileItemMenuState | null>(null);
    const [annotationItemMenu, setAnnotationItemMenu] = useState<AnnotationItemMenuState | null>(null);
    const [canvasFileItemMenu, setCanvasFileItemMenu] = useState<CanvasFileItemMenuState | null>(null);
    const [fileShareDrag, setFileShareDrag] = useState<FileShareDragState | null>(null);
    const [groupMenu, setGroupMenu] = useState<GroupMenuState | null>(null);
    const [groupEntryMenu, setGroupEntryMenu] = useState<GroupEntryMenuState | null>(null);
    const [groupDragPreview, setGroupDragPreview] = useState<GroupDragPreviewState | null>(null);
    const [groupEntryReorderDrag, setGroupEntryReorderDrag] = useState<GroupEntryReorderDragState | null>(null);
    const [groupEntryReorderHover, setGroupEntryReorderHover] = useState<GroupEntryReorderHoverState | null>(null);
    const [groupHintTooltip, setGroupHintTooltip] = useState<{ x: number; y: number } | null>(null);
    const [closedFolders, setClosedFolders] = useState<Record<string, boolean>>({});
    const [openCanvasFolders, setOpenCanvasFolders] = useState<Record<string, boolean>>({});
    const [openGroupFolderItems, setOpenGroupFolderItems] = useState<Record<string, boolean>>({});
    const [draggingSidebarFileId, setDraggingSidebarFileId] = useState<string | null>(null);
    const [draggingSidebarGroupId, setDraggingSidebarGroupId] = useState<string | null>(null);
    const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
    const [createEntryModal, setCreateEntryModal] = useState<CreateEntryModalState>({
        open: false,
        name: "",
        sourceFileId: "",
        isSubmitting: false,
        error: "",
    });
    const [inlineRename, setInlineRename] = useState<InlineRenameState | null>(null);
    const [moveFileModal, setMoveFileModal] = useState<MoveFileModalState>({
        open: false,
        fileId: "",
        folderId: "",
        isSubmitting: false,
        error: "",
    });
    const [roleChangeConfirm, setRoleChangeConfirm] = useState<RoleChangeConfirmState>({
        open: false,
        targetUserId: "",
        targetUsername: "",
        nextRole: "Member",
        isSubmitting: false,
    });
    const [fileShareConfirm, setFileShareConfirm] = useState<FileShareConfirmState>({
        open: false,
        fileId: "",
        fileName: "",
        toUserId: "",
        toUsername: "",
        isSubmitting: false,
        isResend: false,
    });
    const [workspaceCanvasMenu, setWorkspaceCanvasMenu] = useState<WorkspaceCanvasMenuState | null>(null);
    const [annotations, setAnnotations] = useState<WorkspaceAnnotation[]>([]);
    const [itemComments, setItemComments] = useState<WorkspaceItemComment[]>([]);
    const [activeItemCommentKey, setActiveItemCommentKey] = useState<string | null>(null);
    const [commentWindowPosition, setCommentWindowPosition] = useState<{ x: number; y: number } | null>(null);
    const [itemCommentDraft, setItemCommentDraft] = useState("");
    const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
    const [editingAnnotationTitleId, setEditingAnnotationTitleId] = useState<string | null>(null);
    const [canvasSelection, setCanvasSelection] = useState<CanvasSelectionState | null>(null);
    const [selectedCanvasItemKeys, setSelectedCanvasItemKeys] = useState<string[]>([]);
    const [sidebarSelection, setSidebarSelection] = useState<SidebarSelectionState | null>(null);
    const [selectedSidebarFileIds, setSelectedSidebarFileIds] = useState<string[]>([]);
    const [selectedSidebarGroupItemKeys, setSelectedSidebarGroupItemKeys] = useState<string[]>([]);
    const [workspaceGroups, setWorkspaceGroups] = useState<WorkspaceGroup[]>([]);
    const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});
    const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
    const [groupDropAnimations, setGroupDropAnimations] = useState<GroupDropAnimation[]>([]);
    const [groupInlineRename, setGroupInlineRename] = useState<GroupInlineRenameState | null>(null);
    const [hiddenCanvasGroupIds, setHiddenCanvasGroupIds] = useState<string[]>([]);
    const [hiddenCanvasItemKeys, setHiddenCanvasItemKeys] = useState<string[]>([]);
    const canvasRef = useRef<HTMLDivElement | null>(null);
    const importFileInputRef = useRef<HTMLInputElement | null>(null);
    const importFolderInputRef = useRef<HTMLInputElement | null>(null);
    const inlineRenameInputRef = useRef<HTMLInputElement | null>(null);
    const groupInlineRenameInputRef = useRef<HTMLInputElement | null>(null);
    const annotationEditorRef = useRef<HTMLTextAreaElement | null>(null);
    const annotationTitleInputRef = useRef<HTMLInputElement | null>(null);
    const itemCommentInputRef = useRef<HTMLTextAreaElement | null>(null);
    const createEntryDialogTitleId = useId();
    const createEntryInputId = useId();
    const moveFileDialogTitleId = useId();
    const moveFileSelectId = useId();
    const filesSidebarSelectionRef = useRef<HTMLDivElement | null>(null);
    const groupsSidebarSelectionRef = useRef<HTMLDivElement | null>(null);
    const fileLayoutLoadedKeyRef = useRef<string | null>(null);
    const memberLayoutLoadedKeyRef = useRef<string | null>(null);
    const memberOwnersLoadedKeyRef = useRef<string | null>(null);
    const annotationLoadedKeyRef = useRef<string | null>(null);
    const itemCommentsLoadedKeyRef = useRef<string | null>(null);
    const activeAnnotationLoadedKeyRef = useRef<string | null>(null);
    const groupsLoadedKeyRef = useRef<string | null>(null);
    const hiddenGroupsLoadedKeyRef = useRef<string | null>(null);
    const hiddenItemsLoadedKeyRef = useRef<string | null>(null);
    const [groupsHydratedStorageKey, setGroupsHydratedStorageKey] = useState<string | null>(null);
    const [hiddenGroupsHydratedStorageKey, setHiddenGroupsHydratedStorageKey] = useState<string | null>(null);
    const [hiddenItemsHydratedStorageKey, setHiddenItemsHydratedStorageKey] = useState<string | null>(null);
    const [memberOwnersHydratedStorageKey, setMemberOwnersHydratedStorageKey] = useState<string | null>(null);
    const annotationPointerRef = useRef<{ id: string; startX: number; startY: number; moved: boolean } | null>(null);
    const suppressAnnotationClickIdRef = useRef<string | null>(null);
    const isWorkspaceActionPending = workspaceActionPendingCount > 0;

    const viewerUserId = data?.viewerUserId || "unknown";
    const trackMyTeamAction = (actionKey: string, context?: Record<string, unknown>) => {
        trackUxClick(actionKey, {
            page: "workspace",
            teamId: teamId || "",
            viewerUserId,
            workspaceMode,
            activeSection,
            ...context,
        });
    };

    const isStorageKeyReady = (key: string) => Boolean(key) && !key.includes(".unknown");
    const modeStorageKey = useMemo(() => `onbure.workspace.mode.${teamId || "unknown"}`, [teamId]);
    const sidebarStorageKey = useMemo(() => `onbure.workspace.sidebar.${teamId || "unknown"}`, [teamId]);
    const teamLayoutStorageKey = useMemo(() => `onbure.workspace.fileLayout.${teamId || "unknown"}`, [teamId]);
    const teamMemberLayoutStorageKey = useMemo(
        () => `onbure.workspace.memberLayout.${teamId || "unknown"}`,
        [teamId]
    );
    const myLayoutStorageKey = useMemo(
        () => `onbure.workspace.my.fileLayout.${teamId || "unknown"}.${viewerUserId}`,
        [teamId, viewerUserId]
    );
    const myMemberLayoutStorageKey = useMemo(
        () => `onbure.workspace.my.memberLayout.${teamId || "unknown"}.${viewerUserId}`,
        [teamId, viewerUserId]
    );
    const activeFileLayoutStorageKey = workspaceMode === "my" ? myLayoutStorageKey : teamLayoutStorageKey;
    const activeMemberLayoutStorageKey =
        workspaceMode === "my" ? myMemberLayoutStorageKey : teamMemberLayoutStorageKey;
    const teamAnnotationsStorageKey = useMemo(
        () => `onbure.workspace.annotations.${teamId || "unknown"}`,
        [teamId]
    );
    const myAnnotationsStorageKey = useMemo(
        () => `onbure.workspace.my.annotations.${teamId || "unknown"}.${viewerUserId}`,
        [teamId, viewerUserId]
    );
    const activeAnnotationsStorageKey =
        workspaceMode === "my" ? myAnnotationsStorageKey : teamAnnotationsStorageKey;
    const teamItemCommentsStorageKey = useMemo(
        () => `onbure.workspace.itemComments.${teamId || "unknown"}`,
        [teamId]
    );
    const myItemCommentsStorageKey = useMemo(
        () => `onbure.workspace.my.itemComments.${teamId || "unknown"}.${viewerUserId}`,
        [teamId, viewerUserId]
    );
    const activeItemCommentsStorageKey =
        workspaceMode === "my" ? myItemCommentsStorageKey : teamItemCommentsStorageKey;
    const teamActiveAnnotationStorageKey = useMemo(
        () => `onbure.workspace.activeAnnotation.${teamId || "unknown"}`,
        [teamId]
    );
    const myActiveAnnotationStorageKey = useMemo(
        () => `onbure.workspace.my.activeAnnotation.${teamId || "unknown"}.${viewerUserId}`,
        [teamId, viewerUserId]
    );
    const activeAnnotationStorageKey =
        workspaceMode === "my" ? myActiveAnnotationStorageKey : teamActiveAnnotationStorageKey;
    const myGroupsStorageKey = useMemo(
        () => `onbure.workspace.my.groups.${teamId || "unknown"}.${viewerUserId}`,
        [teamId, viewerUserId]
    );
    const teamGroupsStorageKey = useMemo(
        () => `onbure.workspace.groups.${teamId || "unknown"}`,
        [teamId]
    );
    const activeGroupsStorageKey = myGroupsStorageKey;
    const teamMemberOwnersStorageKey = useMemo(
        () => `onbure.workspace.memberOwners.${teamId || "unknown"}`,
        [teamId]
    );
    const myMemberOwnersStorageKey = useMemo(
        () => `onbure.workspace.my.memberOwners.${teamId || "unknown"}.${viewerUserId}`,
        [teamId, viewerUserId]
    );
    const activeMemberOwnersStorageKey =
        workspaceMode === "my" ? myMemberOwnersStorageKey : teamMemberOwnersStorageKey;
    const teamHiddenCanvasGroupsStorageKey = useMemo(
        () => `onbure.workspace.hiddenCanvasGroups.${teamId || "unknown"}`,
        [teamId]
    );
    const myHiddenCanvasGroupsStorageKey = useMemo(
        () => `onbure.workspace.my.hiddenCanvasGroups.${teamId || "unknown"}.${viewerUserId}`,
        [teamId, viewerUserId]
    );
    const activeHiddenCanvasGroupsStorageKey =
        workspaceMode === "my" ? myHiddenCanvasGroupsStorageKey : teamHiddenCanvasGroupsStorageKey;
    const teamHiddenCanvasItemsStorageKey = useMemo(
        () => `onbure.workspace.hiddenCanvasItems.${teamId || "unknown"}`,
        [teamId]
    );
    const myHiddenCanvasItemsStorageKey = useMemo(
        () => `onbure.workspace.my.hiddenCanvasItems.${teamId || "unknown"}.${viewerUserId}`,
        [teamId, viewerUserId]
    );
    const activeHiddenCanvasItemsStorageKey =
        workspaceMode === "my" ? myHiddenCanvasItemsStorageKey : teamHiddenCanvasItemsStorageKey;
    const annotationKindForMode: WorkspaceAnnotationKind = workspaceMode === "my" ? "memo" : "comment";
    const annotationActionLabel =
        workspaceMode === "my" ? t("workspace.annotation.createMemo") : t("workspace.annotation.createComment");
    const groupHintTooltipText = t("workspace.groupHintTooltip");
    const getRoleLabel = (role: WorkspaceMember["role"]) => {
        if (role === "Owner") return t("team.role.owner");
        if (role === "Admin") return t("team.role.admin");
        return t("team.role.member");
    };
    const folderLabel = t("workspace.folder");
    const getFolderLabel = (title: string) => getFolderDisplayName(title, folderLabel);
    const sidebarFileScope: WorkspaceMode = "my";

    const fetchData = React.useCallback(async (options?: { silent?: boolean }) => {
        if (!teamId) return;
        const silent = Boolean(options?.silent);

        if (!silent) {
            setLoading(true);
            setError("");
        }

        try {
            const res = await fetch(`/api/workspace/${teamId}`);
            if (res.status === 403) {
                setError(t("workspace.error.accessDenied"));
                if (!silent) setLoading(false);
                return;
            }
            if (!res.ok) {
                setError(t("workspace.error.loadFailed"));
                if (!silent) setLoading(false);
                return;
            }
            const payload = (await res.json()) as WorkspaceData;
            setData(payload);
            setError("");
        } catch {
            setError(t("workspace.error.loadFailed"));
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [teamId, t]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (!teamId) return;

        const refreshVisibleWorkspace = () => {
            if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
            void fetchData({ silent: true });
        };

        const onFocus = () => refreshVisibleWorkspace();
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                refreshVisibleWorkspace();
            }
        };

        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [teamId, fetchData]);

    useAuditRealtime(Boolean(teamId), (row) => {
        const rowCategory = String(row.category || "").toLowerCase();
        if (rowCategory !== "workspace" && rowCategory !== "team" && rowCategory !== "request") return;

        const rowTeamId = String(row.team_id || "").trim();
        if (!rowTeamId || rowTeamId !== teamId) return;
        if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

        void fetchData({ silent: true });
    });

    useEffect(() => {
        if (typeof window === "undefined") return;
        const savedMode = window.localStorage.getItem(modeStorageKey);
        if (savedMode === "my" || savedMode === "team") {
            setWorkspaceMode(savedMode);
        }
    }, [modeStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const savedSidebar = window.localStorage.getItem(sidebarStorageKey);
        if (savedSidebar === "0") {
            setIsSidebarOpen(false);
        }
    }, [sidebarStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(modeStorageKey, workspaceMode);
    }, [workspaceMode, modeStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(sidebarStorageKey, isSidebarOpen ? "1" : "0");
    }, [isSidebarOpen, sidebarStorageKey]);

    useEffect(() => {
        if (!profileMenu) return;

        const closeOnOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-workspace-profile-menu='true']")) return;
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
        if (!canvasMenu) return;

        const closeOnOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-workspace-canvas-menu='true']")) return;
            setCanvasMenu(null);
        };
        const closeOnResize = () => setCanvasMenu(null);
        const closeOnKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setCanvasMenu(null);
        };

        document.addEventListener("mousedown", closeOnOutside);
        window.addEventListener("resize", closeOnResize);
        window.addEventListener("keydown", closeOnKey);
        return () => {
            document.removeEventListener("mousedown", closeOnOutside);
            window.removeEventListener("resize", closeOnResize);
            window.removeEventListener("keydown", closeOnKey);
        };
    }, [canvasMenu]);

    useEffect(() => {
        if (!fileItemMenu) return;

        const closeOnOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-workspace-file-item-menu='true']")) return;
            setFileItemMenu(null);
        };
        const closeOnResize = () => setFileItemMenu(null);
        const closeOnKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setFileItemMenu(null);
        };

        document.addEventListener("mousedown", closeOnOutside);
        window.addEventListener("resize", closeOnResize);
        window.addEventListener("keydown", closeOnKey);
        return () => {
            document.removeEventListener("mousedown", closeOnOutside);
            window.removeEventListener("resize", closeOnResize);
            window.removeEventListener("keydown", closeOnKey);
        };
    }, [fileItemMenu]);

    useEffect(() => {
        if (!canvasFileItemMenu) return;

        const closeOnOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-workspace-canvas-file-item-menu='true']")) return;
            setCanvasFileItemMenu(null);
        };
        const closeOnResize = () => setCanvasFileItemMenu(null);
        const closeOnKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setCanvasFileItemMenu(null);
        };

        document.addEventListener("mousedown", closeOnOutside);
        window.addEventListener("resize", closeOnResize);
        window.addEventListener("keydown", closeOnKey);
        return () => {
            document.removeEventListener("mousedown", closeOnOutside);
            window.removeEventListener("resize", closeOnResize);
            window.removeEventListener("keydown", closeOnKey);
        };
    }, [canvasFileItemMenu]);

    useEffect(() => {
        if (!fileShareDrag) return;
        const filesForShare = Array.isArray(workspaceMode === "my" ? data?.myFiles : data?.files)
            ? workspaceMode === "my"
                ? (data?.myFiles ?? [])
                : (data?.files ?? [])
            : [];
        const membersForShare = Array.isArray(data?.members) ? data.members : [];

        const resolveDropTarget = (event: PointerEvent) => {
            const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
            const target = element?.closest("[data-workspace-member-drop-target='true']") as HTMLElement | null;
            const userId = String(target?.dataset.memberUserId || "").trim();
            if (!userId) {
                return { userId: null as string | null, username: "" };
            }
            const username = String(target?.dataset.memberUsername || "").trim() || userId;
            return { userId, username };
        };

        const handlePointerMove = (event: PointerEvent) => {
            event.preventDefault();
            const drop = resolveDropTarget(event);
            setFileShareDrag((prev) =>
                prev
                    ? {
                        ...prev,
                        currentX: event.clientX,
                        currentY: event.clientY,
                        hoverUserId: drop.userId,
                        hoverUsername: drop.username,
                    }
                    : prev
            );
        };

        const handlePointerUp = (event: PointerEvent) => {
            event.preventDefault();
            const drop = resolveDropTarget(event);
            if (drop.userId) {
                const targetFile = filesForShare.find((file) => file.id === fileShareDrag.fileId);
                const targetMember = membersForShare.find((member) => member.userId === drop.userId);
                const viewerUserId = String(data?.viewerUserId || "");
                if (
                    targetFile &&
                    targetMember &&
                    workspaceMode === "my" &&
                    drop.userId !== viewerUserId
                ) {
                    setFileShareConfirm({
                        open: true,
                        fileId: targetFile.id,
                        fileName: String(targetFile.title || "").trim() || t("workspace.untitled"),
                        toUserId: drop.userId,
                        toUsername: targetMember.username || targetMember.userId,
                        isSubmitting: false,
                        isResend: false,
                    });
                }
            }
            setFileShareDrag(null);
        };

        const handlePointerCancel = () => {
            setFileShareDrag(null);
        };

        window.addEventListener("pointermove", handlePointerMove, { passive: false });
        window.addEventListener("pointerup", handlePointerUp, { passive: false });
        window.addEventListener("pointercancel", handlePointerCancel);
        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerCancel);
        };
    }, [fileShareDrag, data?.files, data?.myFiles, data?.members, workspaceMode, data?.viewerUserId, t]);

    useEffect(() => {
        if (!workspaceCanvasMenu) return;

        const closeOnOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-workspace-canvas-context-menu='true']")) return;
            setWorkspaceCanvasMenu(null);
        };
        const closeOnResize = () => setWorkspaceCanvasMenu(null);
        const closeOnKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setWorkspaceCanvasMenu(null);
        };

        document.addEventListener("mousedown", closeOnOutside);
        window.addEventListener("resize", closeOnResize);
        window.addEventListener("keydown", closeOnKey);
        return () => {
            document.removeEventListener("mousedown", closeOnOutside);
            window.removeEventListener("resize", closeOnResize);
            window.removeEventListener("keydown", closeOnKey);
        };
    }, [workspaceCanvasMenu]);

    useEffect(() => {
        if (!annotationItemMenu) return;

        const closeOnOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-workspace-annotation-item-menu='true']")) return;
            setAnnotationItemMenu(null);
        };
        const closeOnResize = () => setAnnotationItemMenu(null);
        const closeOnKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setAnnotationItemMenu(null);
        };

        document.addEventListener("mousedown", closeOnOutside);
        window.addEventListener("resize", closeOnResize);
        window.addEventListener("keydown", closeOnKey);
        return () => {
            document.removeEventListener("mousedown", closeOnOutside);
            window.removeEventListener("resize", closeOnResize);
            window.removeEventListener("keydown", closeOnKey);
        };
    }, [annotationItemMenu]);

    useEffect(() => {
        if (!groupMenu) return;

        const closeOnOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-workspace-group-menu='true']")) return;
            if (target?.closest("[data-workspace-group-label='true']")) return;
            if (target?.closest("[data-workspace-group-outline='true']")) return;
            setGroupMenu(null);
        };
        const closeOnResize = () => setGroupMenu(null);
        const closeOnKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setGroupMenu(null);
        };

        document.addEventListener("mousedown", closeOnOutside);
        window.addEventListener("resize", closeOnResize);
        window.addEventListener("keydown", closeOnKey);
        return () => {
            document.removeEventListener("mousedown", closeOnOutside);
            window.removeEventListener("resize", closeOnResize);
            window.removeEventListener("keydown", closeOnKey);
        };
    }, [groupMenu]);

    useEffect(() => {
        if (!groupEntryMenu) return;

        const closeOnOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-workspace-group-entry-menu='true']")) return;
            setGroupEntryMenu(null);
        };
        const closeOnResize = () => setGroupEntryMenu(null);
        const closeOnKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setGroupEntryMenu(null);
        };

        document.addEventListener("mousedown", closeOnOutside);
        window.addEventListener("resize", closeOnResize);
        window.addEventListener("keydown", closeOnKey);
        return () => {
            document.removeEventListener("mousedown", closeOnOutside);
            window.removeEventListener("resize", closeOnResize);
            window.removeEventListener("keydown", closeOnKey);
        };
    }, [groupEntryMenu]);

    useEffect(() => {
        if (!canvasMenu) return;
        if (!isSidebarOpen || activeSection !== "files") {
            setCanvasMenu(null);
        }
    }, [canvasMenu, isSidebarOpen, activeSection]);

    useEffect(() => {
        if (!fileItemMenu) return;
        if (!isSidebarOpen || activeSection !== "files") {
            setFileItemMenu(null);
        }
    }, [fileItemMenu, isSidebarOpen, activeSection]);

    useEffect(() => {
        if (!groupMenu) return;
        if (groupMenu.source === "canvas") return;
        if (!isSidebarOpen || activeSection !== "groups") {
            setGroupMenu(null);
        }
    }, [groupMenu, isSidebarOpen, activeSection]);

    useEffect(() => {
        if (!groupEntryMenu) return;
        if (!isSidebarOpen || activeSection !== "groups") {
            setGroupEntryMenu(null);
        }
    }, [groupEntryMenu, isSidebarOpen, activeSection]);

    useEffect(() => {
        if (isSidebarOpen && activeSection === "groups") return;
        if (groupEntryReorderDrag) {
            setGroupEntryReorderDrag(null);
        }
        if (groupEntryReorderHover) {
            setGroupEntryReorderHover(null);
        }
    }, [isSidebarOpen, activeSection, groupEntryReorderDrag, groupEntryReorderHover]);

    useEffect(() => {
        if (movingFile || movingMember || movingAnnotation || movingSelection) return;
        if (groupDragPreview) {
            setGroupDragPreview(null);
        }
    }, [movingFile, movingMember, movingAnnotation, movingSelection, groupDragPreview]);

    useEffect(() => {
        if (!isSidebarOpen || activeSection !== "files") {
            setDraggingSidebarFileId(null);
            setHoveredFolderId(null);
            setInlineRename(null);
        }
    }, [isSidebarOpen, activeSection]);

    useEffect(() => {
        if (!isSidebarOpen || activeSection !== "groups") {
            setHoveredGroupId(null);
            setDraggingSidebarGroupId(null);
            setGroupInlineRename(null);
        }
    }, [isSidebarOpen, activeSection]);

    useEffect(() => {
        if (!inlineRename) return;
        const id = window.setTimeout(() => {
            inlineRenameInputRef.current?.focus();
            inlineRenameInputRef.current?.select();
        }, 0);
        return () => window.clearTimeout(id);
    }, [inlineRename]);

    useEffect(() => {
        if (!groupInlineRename) return;
        const id = window.setTimeout(() => {
            groupInlineRenameInputRef.current?.focus();
            groupInlineRenameInputRef.current?.select();
        }, 0);
        return () => window.clearTimeout(id);
    }, [groupInlineRename]);

    useEffect(() => {
        if (!activeAnnotationId) return;
        const id = window.setTimeout(() => {
            annotationEditorRef.current?.focus();
            annotationEditorRef.current?.setSelectionRange(
                annotationEditorRef.current.value.length,
                annotationEditorRef.current.value.length
            );
        }, 0);
        return () => window.clearTimeout(id);
    }, [activeAnnotationId]);

    useEffect(() => {
        if (!activeAnnotationId) return;
        if (annotationLoadedKeyRef.current !== activeAnnotationsStorageKey) return;
        const active = annotations.find((item) => item.id === activeAnnotationId);
        if (active && active.kind === annotationKindForMode) return;
        setActiveAnnotationId(null);
    }, [annotations, activeAnnotationId, annotationKindForMode, activeAnnotationsStorageKey]);

    useEffect(() => {
        if (!editingAnnotationTitleId) return;
        if (annotations.some((item) => item.id === editingAnnotationTitleId)) return;
        setEditingAnnotationTitleId(null);
    }, [annotations, editingAnnotationTitleId]);

    useEffect(() => {
        if (!annotationItemMenu) return;
        const target = annotations.find((item) => item.id === annotationItemMenu.annotationId);
        if (target && target.kind === annotationKindForMode) return;
        setAnnotationItemMenu(null);
    }, [annotations, annotationItemMenu, annotationKindForMode]);

    useEffect(() => {
        if (!editingAnnotationTitleId) return;
        const id = window.setTimeout(() => {
            annotationTitleInputRef.current?.focus();
            annotationTitleInputRef.current?.select();
        }, 0);
        return () => window.clearTimeout(id);
    }, [editingAnnotationTitleId]);

    useEffect(() => {
        if (!activeItemCommentKey) return;
        const id = window.setTimeout(() => {
            itemCommentInputRef.current?.focus();
            itemCommentInputRef.current?.setSelectionRange(
                itemCommentInputRef.current.value.length,
                itemCommentInputRef.current.value.length
            );
        }, 0);
        return () => window.clearTimeout(id);
    }, [activeItemCommentKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const saved = String(window.localStorage.getItem(activeAnnotationStorageKey) || "").trim();
        setActiveAnnotationId(saved || null);
        setEditingAnnotationTitleId(null);
        activeAnnotationLoadedKeyRef.current = activeAnnotationStorageKey;
    }, [activeAnnotationStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (activeAnnotationLoadedKeyRef.current !== activeAnnotationStorageKey) return;
        if (activeAnnotationId) {
            window.localStorage.setItem(activeAnnotationStorageKey, activeAnnotationId);
            return;
        }
        window.localStorage.removeItem(activeAnnotationStorageKey);
    }, [activeAnnotationId, activeAnnotationStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const saved = parseSavedPositions(window.localStorage.getItem(activeFileLayoutStorageKey));
        setCanvasFilePositions(saved);
        fileLayoutLoadedKeyRef.current = activeFileLayoutStorageKey;
    }, [activeFileLayoutStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (fileLayoutLoadedKeyRef.current !== activeFileLayoutStorageKey) return;
        window.localStorage.setItem(activeFileLayoutStorageKey, JSON.stringify(canvasFilePositions));
    }, [canvasFilePositions, activeFileLayoutStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const saved = parseSavedPositions(window.localStorage.getItem(activeMemberLayoutStorageKey));
        setCanvasMemberPositions(saved);
        memberLayoutLoadedKeyRef.current = activeMemberLayoutStorageKey;
    }, [activeMemberLayoutStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (memberLayoutLoadedKeyRef.current !== activeMemberLayoutStorageKey) return;
        window.localStorage.setItem(activeMemberLayoutStorageKey, JSON.stringify(canvasMemberPositions));
    }, [canvasMemberPositions, activeMemberLayoutStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!isStorageKeyReady(activeMemberOwnersStorageKey)) return;
        const saved = parseSavedStringRecord(window.localStorage.getItem(activeMemberOwnersStorageKey));
        memberOwnersLoadedKeyRef.current = activeMemberOwnersStorageKey;
        setMemberOwnersHydratedStorageKey(null);
        setCanvasMemberPlacementOwners(saved);
        setMemberOwnersHydratedStorageKey(activeMemberOwnersStorageKey);
    }, [activeMemberOwnersStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!isStorageKeyReady(activeMemberOwnersStorageKey)) return;
        if (memberOwnersLoadedKeyRef.current !== activeMemberOwnersStorageKey) return;
        if (memberOwnersHydratedStorageKey !== activeMemberOwnersStorageKey) return;
        window.localStorage.setItem(activeMemberOwnersStorageKey, JSON.stringify(canvasMemberPlacementOwners));
    }, [canvasMemberPlacementOwners, activeMemberOwnersStorageKey, memberOwnersHydratedStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const saved = parseSavedAnnotations(window.localStorage.getItem(activeAnnotationsStorageKey));
        setAnnotations(saved);
        annotationLoadedKeyRef.current = activeAnnotationsStorageKey;
    }, [activeAnnotationsStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (annotationLoadedKeyRef.current !== activeAnnotationsStorageKey) return;
        window.localStorage.setItem(activeAnnotationsStorageKey, JSON.stringify(annotations));
    }, [annotations, activeAnnotationsStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!isStorageKeyReady(activeItemCommentsStorageKey)) return;
        const saved = parseSavedItemComments(window.localStorage.getItem(activeItemCommentsStorageKey));
        setItemComments(saved);
        itemCommentsLoadedKeyRef.current = activeItemCommentsStorageKey;
    }, [activeItemCommentsStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!isStorageKeyReady(activeItemCommentsStorageKey)) return;
        if (itemCommentsLoadedKeyRef.current !== activeItemCommentsStorageKey) return;
        window.localStorage.setItem(activeItemCommentsStorageKey, JSON.stringify(itemComments));
    }, [itemComments, activeItemCommentsStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!isStorageKeyReady(activeGroupsStorageKey)) return;
        const activeRawGroups = window.localStorage.getItem(activeGroupsStorageKey);
        let saved = parseSavedGroups(activeRawGroups);
        // Only migrate legacy keys when the active key is truly missing.
        // If active key exists as [], respect that (user intentionally removed groups).
        if (activeRawGroups === null && saved.length === 0) {
            const fallbackStorageKeys = [teamGroupsStorageKey, myGroupsStorageKey];
            for (const fallbackStorageKey of fallbackStorageKeys) {
                if (
                    !fallbackStorageKey ||
                    fallbackStorageKey === activeGroupsStorageKey ||
                    !isStorageKeyReady(fallbackStorageKey)
                ) {
                    continue;
                }

                const fallbackSaved = parseSavedGroups(window.localStorage.getItem(fallbackStorageKey));
                if (fallbackSaved.length > 0) {
                    saved = fallbackSaved;
                    // Migrate legacy groups so sidebar/canvas keeps a single active source.
                    window.localStorage.setItem(activeGroupsStorageKey, JSON.stringify(fallbackSaved));
                    break;
                }
            }
        }
        groupsLoadedKeyRef.current = activeGroupsStorageKey;
        setGroupsHydratedStorageKey(null);
        setWorkspaceGroups(saved);
        setGroupsHydratedStorageKey(activeGroupsStorageKey);
    }, [activeGroupsStorageKey, myGroupsStorageKey, teamGroupsStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!isStorageKeyReady(activeGroupsStorageKey)) return;
        if (groupsLoadedKeyRef.current !== activeGroupsStorageKey) return;
        if (groupsHydratedStorageKey !== activeGroupsStorageKey) return;
        window.localStorage.setItem(activeGroupsStorageKey, JSON.stringify(workspaceGroups));
    }, [workspaceGroups, activeGroupsStorageKey, groupsHydratedStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!isStorageKeyReady(activeHiddenCanvasGroupsStorageKey)) return;
        const saved = parseSavedStringArray(window.localStorage.getItem(activeHiddenCanvasGroupsStorageKey));
        hiddenGroupsLoadedKeyRef.current = activeHiddenCanvasGroupsStorageKey;
        setHiddenGroupsHydratedStorageKey(null);
        setHiddenCanvasGroupIds(saved);
        setHiddenGroupsHydratedStorageKey(activeHiddenCanvasGroupsStorageKey);
    }, [activeHiddenCanvasGroupsStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!isStorageKeyReady(activeHiddenCanvasGroupsStorageKey)) return;
        if (hiddenGroupsLoadedKeyRef.current !== activeHiddenCanvasGroupsStorageKey) return;
        if (hiddenGroupsHydratedStorageKey !== activeHiddenCanvasGroupsStorageKey) return;
        window.localStorage.setItem(activeHiddenCanvasGroupsStorageKey, JSON.stringify(hiddenCanvasGroupIds));
    }, [hiddenCanvasGroupIds, activeHiddenCanvasGroupsStorageKey, hiddenGroupsHydratedStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!isStorageKeyReady(activeHiddenCanvasItemsStorageKey)) return;
        const saved = parseSavedStringArray(window.localStorage.getItem(activeHiddenCanvasItemsStorageKey));
        hiddenItemsLoadedKeyRef.current = activeHiddenCanvasItemsStorageKey;
        setHiddenItemsHydratedStorageKey(null);
        setHiddenCanvasItemKeys(saved);
        setHiddenItemsHydratedStorageKey(activeHiddenCanvasItemsStorageKey);
    }, [activeHiddenCanvasItemsStorageKey]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!isStorageKeyReady(activeHiddenCanvasItemsStorageKey)) return;
        if (hiddenItemsLoadedKeyRef.current !== activeHiddenCanvasItemsStorageKey) return;
        if (hiddenItemsHydratedStorageKey !== activeHiddenCanvasItemsStorageKey) return;
        window.localStorage.setItem(activeHiddenCanvasItemsStorageKey, JSON.stringify(hiddenCanvasItemKeys));
    }, [hiddenCanvasItemKeys, activeHiddenCanvasItemsStorageKey, hiddenItemsHydratedStorageKey]);

    const currentFiles = useMemo(() => data?.myFiles || [], [data?.myFiles]);
    const modeCanvasFiles = useMemo(
        () => (workspaceMode === "my" ? data?.myFiles || [] : data?.files || []),
        [workspaceMode, data?.myFiles, data?.files]
    );
    const canvasAvailableFiles = useMemo(() => {
        if (workspaceMode === "my") return modeCanvasFiles;
        const merged = new Map<string, WorkspaceFile>();
        for (const file of modeCanvasFiles) {
            merged.set(file.id, file);
        }
        for (const file of currentFiles) {
            if (!merged.has(file.id)) {
                merged.set(file.id, file);
            }
        }
        return Array.from(merged.values());
    }, [workspaceMode, modeCanvasFiles, currentFiles]);
    const canvasFileByIdMap = useMemo(
        () => new Map(canvasAvailableFiles.map((file) => [file.id, file])),
        [canvasAvailableFiles]
    );
    const teamFileByIdMap = useMemo(
        () => new Map((data?.files || []).map((file) => [file.id, file])),
        [data?.files]
    );
    const members = useMemo(() => (Array.isArray(data?.members) ? data.members : []), [data?.members]);
    const itemCommentsByKey = useMemo(() => {
        const next = new Map<string, WorkspaceItemComment[]>();
        for (const comment of itemComments) {
            const itemKey = String(comment.itemKey || "").trim();
            if (!parseCanvasItemKey(itemKey)) continue;
            if (!next.has(itemKey)) {
                next.set(itemKey, []);
            }
            next.get(itemKey)?.push(comment);
        }
        for (const comments of next.values()) {
            comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        }
        return next;
    }, [itemComments]);
    const annotationsForCurrentMode = useMemo(
        () => annotations.filter((annotation) => annotation.kind === annotationKindForMode),
        [annotations, annotationKindForMode]
    );
    const annotationsForSidebarGroups = useMemo(
        () => annotations.filter((annotation) => annotation.kind === "memo"),
        [annotations]
    );
    const hiddenCanvasGroupIdSet = useMemo(
        () => new Set(hiddenCanvasGroupIds),
        [hiddenCanvasGroupIds]
    );
    const hiddenCanvasItemKeySet = useMemo(
        () => new Set(hiddenCanvasItemKeys),
        [hiddenCanvasItemKeys]
    );
    const allCanvasSelectableItems = useMemo(() => {
        const next: CanvasSelectableItem[] = [];

        for (const [filePlacementId, position] of Object.entries(canvasFilePositions)) {
            const fileId = extractCanvasPlacementSourceId(filePlacementId);
            const file = canvasFileByIdMap.get(fileId);
            if (!file) continue;
            next.push({
                key: buildCanvasItemKey("file", filePlacementId),
                kind: "file",
                id: file.id,
                label: file.title || "File",
                bounds: {
                    x: position.x,
                    y: position.y,
                    width: CANVAS_FILE_WIDTH,
                    height: CANVAS_FILE_HEIGHT,
                },
            });
        }

        for (const [memberPlacementId, position] of Object.entries(canvasMemberPositions)) {
            const memberId = extractCanvasPlacementSourceId(memberPlacementId);
            const member = members.find((item) => item.id === memberId);
            if (!member) continue;
            const width = getMemberCardWidth(member.username || member.userId);
            next.push({
                key: buildCanvasItemKey("member", memberPlacementId),
                kind: "member",
                id: member.id,
                label: member.username || member.userId,
                bounds: {
                    x: position.x,
                    y: position.y,
                    width,
                    height: CANVAS_MEMBER_HEIGHT,
                },
            });
        }

        for (const annotation of annotationsForCurrentMode) {
            const isExpanded = activeAnnotationId === annotation.id;
            const width = isExpanded
                ? annotation.width
                : annotation.kind === "comment"
                    ? CANVAS_COMMENT_PREVIEW_WIDTH
                    : CANVAS_ANNOTATION_SIZE;
            const height = isExpanded
                ? annotation.height
                : annotation.kind === "comment"
                    ? CANVAS_COMMENT_PREVIEW_HEIGHT
                    : CANVAS_ANNOTATION_SIZE;
            next.push({
                key: buildCanvasItemKey("annotation", annotation.id),
                kind: "annotation",
                id: annotation.id,
                label: annotation.title || getDefaultAnnotationTitle(annotation.kind, t),
                bounds: {
                    x: annotation.x,
                    y: annotation.y,
                    width,
                    height,
                },
            });
        }

        return next;
    }, [
        canvasFilePositions,
        canvasFileByIdMap,
        canvasMemberPositions,
        members,
        annotationsForCurrentMode,
        activeAnnotationId,
        t,
    ]);
    const selectableCanvasItems = useMemo(
        () => allCanvasSelectableItems.filter((item) => !hiddenCanvasItemKeySet.has(item.key)),
        [allCanvasSelectableItems, hiddenCanvasItemKeySet]
    );
    const selectableCanvasItemMap = useMemo(
        () => new Map(selectableCanvasItems.map((item) => [item.key, item])),
        [selectableCanvasItems]
    );
    useEffect(() => {
        if (!activeItemCommentKey) return;
        const canAddCommentFromAnnotations = (itemKey: string) => {
            const normalizedKey = String(itemKey || "").trim();
            const parsed = parseCanvasItemKey(normalizedKey);
            if (!parsed) return false;
            if (parsed.kind !== "annotation") return true;
            const annotationId = extractCanvasPlacementSourceId(parsed.id);
            const targetAnnotation = annotations.find(
                (item) => item.id === parsed.id || item.id === annotationId
            );
            return Boolean(targetAnnotation && targetAnnotation.kind !== "comment");
        };
        if (
            selectableCanvasItemMap.has(activeItemCommentKey) &&
            canAddCommentFromAnnotations(activeItemCommentKey)
        ) {
            return;
        }
        setActiveItemCommentKey(null);
        setItemCommentDraft("");
    }, [activeItemCommentKey, selectableCanvasItemMap, annotations]);
    const selectedCanvasItemKeySet = useMemo(
        () => new Set(selectedCanvasItemKeys),
        [selectedCanvasItemKeys]
    );
    const selectedSidebarFileIdSet = useMemo(
        () => new Set(selectedSidebarFileIds),
        [selectedSidebarFileIds]
    );
    const selectedSidebarGroupItemKeySet = useMemo(
        () => new Set(selectedSidebarGroupItemKeys),
        [selectedSidebarGroupItemKeys]
    );
    const groupedItemKeySet = useMemo(
        () => new Set(workspaceGroups.flatMap((group) => group.itemKeys)),
        [workspaceGroups]
    );
    const canViewerRemoveFileFromWorkspace = React.useCallback(
        (filePlacementOrSourceId: string) => {
            const normalized = String(filePlacementOrSourceId || "").trim();
            if (!normalized) return false;
            const sourceFileId = extractCanvasPlacementSourceId(normalized);
            if (!sourceFileId) return false;
            if (workspaceMode !== "team") return true;

            const viewerUserIdForCheck = String(data?.viewerUserId || "").trim();
            const viewerMember = members.find((m) => String(m.userId || "").trim() === viewerUserIdForCheck);
            if (viewerMember?.role === "Owner" || viewerMember?.role === "Admin") return true;

            // Restrict team-canvas file removal to the original uploader.
            const teamFile = teamFileByIdMap.get(sourceFileId);
            if (!teamFile) return true;
            const ownerUserId = String(teamFile.ownerUserId || "").trim();
            return Boolean(ownerUserId && viewerUserIdForCheck && ownerUserId === viewerUserIdForCheck);
        },
        [workspaceMode, teamFileByIdMap, data?.viewerUserId, members]
    );
    const canViewerModifyMemberPlacement = React.useCallback(
        (memberPlacementOrSourceId: string) => {
            const normalized = String(memberPlacementOrSourceId || "").trim();
            if (!normalized) return false;
            if (workspaceMode !== "team") return true;

            const viewerUserIdForCheck = String(data?.viewerUserId || "").trim();
            if (!viewerUserIdForCheck) return false;

            const viewerMember = members.find((m) => String(m.userId || "").trim() === viewerUserIdForCheck);
            if (viewerMember?.role === "Owner" || viewerMember?.role === "Admin") return true;

            const directOwnerUserId = String(canvasMemberPlacementOwners[normalized] || "").trim();
            if (directOwnerUserId) {
                return directOwnerUserId === viewerUserIdForCheck;
            }

            const sourceMemberId = extractCanvasPlacementSourceId(normalized);
            const matchedOwnerUserIds = Object.entries(canvasMemberPlacementOwners)
                .filter(([placementId]) => extractCanvasPlacementSourceId(placementId) === sourceMemberId)
                .map(([, ownerUserId]) => String(ownerUserId || "").trim())
                .filter(Boolean);
            if (matchedOwnerUserIds.length > 0) {
                return matchedOwnerUserIds.every((ownerUserId) => ownerUserId === viewerUserIdForCheck);
            }

            // Legacy fallback for placements created before owner metadata existed.
            const sourceMember = members.find((member) => member.id === sourceMemberId);
            const sourceMemberUserId = String(sourceMember?.userId || "").trim();
            return Boolean(sourceMemberUserId && sourceMemberUserId === viewerUserIdForCheck);
        },
        [workspaceMode, data?.viewerUserId, canvasMemberPlacementOwners, members]
    );
    const canViewerMoveCanvasItem = React.useCallback(
        (itemKey: string) => {
            const parsed = parseCanvasItemKey(itemKey);
            if (!parsed) return false;
            if (parsed.kind === "file") return canViewerRemoveFileFromWorkspace(parsed.id);
            if (parsed.kind === "member") return canViewerModifyMemberPlacement(parsed.id);
            return true;
        },
        [canViewerRemoveFileFromWorkspace, canViewerModifyMemberPlacement]
    );

    const resolvedWorkspaceGroups = useMemo(
        () =>
            workspaceGroups
                .map((group) => ({
                    ...group,
                    items: group.itemKeys
                        .map((itemKey) => {
                            const direct = selectableCanvasItemMap.get(itemKey);
                            if (direct) return direct;

                            const parsed = parseCanvasItemKey(itemKey);
                            if (!parsed) return null;

                            if (parsed.kind === "file") {
                                const sourceFileId = extractCanvasPlacementSourceId(parsed.id);
                                const file = canvasFileByIdMap.get(sourceFileId);
                                if (!file) return null;
                                const label = isFolderEntry(file)
                                    ? getFolderDisplayName(file.title, folderLabel)
                                    : file.title || t("workspace.untitled");
                                return {
                                    key: itemKey,
                                    kind: "file" as const,
                                    id: sourceFileId,
                                    label,
                                    bounds: {
                                        x: CANVAS_PADDING,
                                        y: CANVAS_PADDING,
                                        width: CANVAS_FILE_WIDTH,
                                        height: CANVAS_FILE_HEIGHT,
                                    },
                                };
                            }

                            if (parsed.kind === "member") {
                                const sourceMemberId = extractCanvasPlacementSourceId(parsed.id);
                                const member = members.find((item) => item.id === sourceMemberId);
                                if (!member) return null;
                                return {
                                    key: itemKey,
                                    kind: "member" as const,
                                    id: sourceMemberId,
                                    label: member.username || member.userId,
                                    bounds: {
                                        x: CANVAS_PADDING,
                                        y: CANVAS_PADDING,
                                        width: getMemberCardWidth(member.username || member.userId),
                                        height: CANVAS_MEMBER_HEIGHT,
                                    },
                                };
                            }

                            if (parsed.kind === "annotation") {
                                const annotation = annotationsForSidebarGroups.find((item) => item.id === parsed.id);
                                if (!annotation) return null;
                                const isExpanded = activeAnnotationId === annotation.id;
                                const width = isExpanded
                                    ? annotation.width
                                    : annotation.kind === "comment"
                                        ? CANVAS_COMMENT_PREVIEW_WIDTH
                                        : CANVAS_ANNOTATION_SIZE;
                                const height = isExpanded
                                    ? annotation.height
                                    : annotation.kind === "comment"
                                        ? CANVAS_COMMENT_PREVIEW_HEIGHT
                                        : CANVAS_ANNOTATION_SIZE;
                                return {
                                    key: itemKey,
                                    kind: "annotation" as const,
                                    id: annotation.id,
                                    label: annotation.title || getDefaultAnnotationTitle(annotation.kind, t),
                                    bounds: {
                                        x: annotation.x,
                                        y: annotation.y,
                                        width,
                                        height,
                                    },
                                };
                            }

                            return null;
                        })
                        .filter(Boolean) as CanvasSelectableItem[],
                })),
        [
            workspaceGroups,
            selectableCanvasItemMap,
            canvasFileByIdMap,
            members,
            annotationsForSidebarGroups,
            activeAnnotationId,
            folderLabel,
            t,
        ]
    );
    const canvasGroupOutlines = useMemo(() => {
        return resolvedWorkspaceGroups
            .map((group) => {
                const canvasItems = group.items.filter((item) => selectableCanvasItemMap.has(item.key));
                if (canvasItems.length === 0) return null;
                if (hiddenCanvasGroupIdSet.has(group.id)) return null;

                let minX = Number.POSITIVE_INFINITY;
                let minY = Number.POSITIVE_INFINITY;
                let maxX = Number.NEGATIVE_INFINITY;
                let maxY = Number.NEGATIVE_INFINITY;

                for (const item of canvasItems) {
                    minX = Math.min(minX, item.bounds.x);
                    minY = Math.min(minY, item.bounds.y);
                    maxX = Math.max(maxX, item.bounds.x + item.bounds.width);
                    maxY = Math.max(maxY, item.bounds.y + item.bounds.height);
                }

                if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
                    return null;
                }

                const padding = 14;
                const left = Math.max(4, Math.round(minX - padding));
                const top = Math.max(4, Math.round(minY - padding));
                const right = Math.round(maxX + padding);
                const bottom = Math.round(maxY + padding);

                return {
                    id: group.id,
                    name: String(group.name || "").trim() || t("workspace.group"),
                    left,
                    top,
                    width: Math.max(48, right - left),
                    height: Math.max(48, bottom - top),
                };
            })
            .filter(Boolean) as Array<{
                id: string;
                name: string;
                left: number;
                top: number;
                width: number;
                height: number;
            }>;
    }, [resolvedWorkspaceGroups, hiddenCanvasGroupIdSet, selectableCanvasItemMap, t]);
    const resolvedSidebarGroupItemKeys = useMemo(
        () => resolvedWorkspaceGroups.flatMap((group) => group.items.map((item) => item.key)),
        [resolvedWorkspaceGroups]
    );
    const folderItems = useMemo(
        () => currentFiles.filter((file) => isFolderEntry(file)),
        [currentFiles]
    );
    const validFolderIds = useMemo(
        () => new Set(folderItems.map((file) => file.id)),
        [folderItems]
    );
    const filesByFolder = useMemo(() => {
        const grouped: Record<string, WorkspaceFile[]> = {};
        for (const file of currentFiles) {
            if (isFolderEntry(file)) continue;
            const targetFolderId = String(file.folderId || "").trim();
            if (!targetFolderId || !validFolderIds.has(targetFolderId)) continue;
            if (!grouped[targetFolderId]) grouped[targetFolderId] = [];
            grouped[targetFolderId].push(file);
        }
        return grouped;
    }, [currentFiles, validFolderIds]);
    const fileByIdMap = useMemo(
        () => new Map(currentFiles.map((file) => [file.id, file])),
        [currentFiles]
    );
    const rootFiles = useMemo(
        () =>
            currentFiles.filter((file) => {
                if (isFolderEntry(file)) return false;
                const targetFolderId = String(file.folderId || "").trim();
                return !targetFolderId || !validFolderIds.has(targetFolderId);
            }),
        [currentFiles, validFolderIds]
    );
    const canvasFolderIds = useMemo(
        () => new Set(canvasAvailableFiles.filter((file) => isFolderEntry(file)).map((file) => file.id)),
        [canvasAvailableFiles]
    );
    const canvasFilesByFolder = useMemo(() => {
        const grouped: Record<string, WorkspaceFile[]> = {};
        for (const file of canvasAvailableFiles) {
            if (isFolderEntry(file)) continue;
            const targetFolderId = String(file.folderId || "").trim();
            if (!targetFolderId || !canvasFolderIds.has(targetFolderId)) continue;
            if (!grouped[targetFolderId]) grouped[targetFolderId] = [];
            grouped[targetFolderId].push(file);
        }
        return grouped;
    }, [canvasAvailableFiles, canvasFolderIds]);

    useEffect(() => {
        if (loading) return;
        if (!data) return;
        if (fileLayoutLoadedKeyRef.current !== activeFileLayoutStorageKey) return;

        const validFileIds = new Set(canvasAvailableFiles.map((file) => file.id));

        setCanvasFilePositions((prev) => {
            let changed = false;
            const next: Record<string, CanvasPosition> = {};
            for (const [placementId, position] of Object.entries(prev)) {
                const sourceFileId = extractCanvasPlacementSourceId(placementId);
                if (!validFileIds.has(sourceFileId)) {
                    changed = true;
                    continue;
                }
                next[placementId] = position;
            }
            return changed ? next : prev;
        });
    }, [canvasAvailableFiles, loading, data, activeFileLayoutStorageKey]);

    useEffect(() => {
        const validFileIds = new Set(currentFiles.map((file) => file.id));
        setSelectedSidebarFileIds((prev) => {
            const next = prev.filter((fileId) => validFileIds.has(fileId));
            return next.length === prev.length ? prev : next;
        });
    }, [currentFiles]);

    useEffect(() => {
        const validGroupItemKeys = new Set(resolvedSidebarGroupItemKeys);
        setSelectedSidebarGroupItemKeys((prev) => {
            const next = prev.filter((itemKey) => validGroupItemKeys.has(itemKey));
            return next.length === prev.length ? prev : next;
        });
    }, [resolvedSidebarGroupItemKeys]);

    useEffect(() => {
        if (activeSection === "files") return;
        if (selectedSidebarFileIds.length > 0) {
            setSelectedSidebarFileIds([]);
        }
    }, [activeSection, selectedSidebarFileIds]);

    useEffect(() => {
        if (activeSection === "groups") return;
        if (selectedSidebarGroupItemKeys.length > 0) {
            setSelectedSidebarGroupItemKeys([]);
        }
    }, [activeSection, selectedSidebarGroupItemKeys]);

    useEffect(() => {
        if (!inlineRename) return;
        if (currentFiles.some((file) => file.id === inlineRename.fileId)) return;
        setInlineRename(null);
    }, [inlineRename, currentFiles]);

    useEffect(() => {
        setClosedFolders((prev) => {
            let changed = false;
            const next: Record<string, boolean> = {};
            for (const [folderId, closed] of Object.entries(prev)) {
                if (!validFolderIds.has(folderId)) {
                    changed = true;
                    continue;
                }
                next[folderId] = closed;
            }
            return changed ? next : prev;
        });
    }, [validFolderIds]);

    useEffect(() => {
        setOpenCanvasFolders((prev) => {
            let changed = false;
            const next: Record<string, boolean> = {};
            for (const [folderId, isOpen] of Object.entries(prev)) {
                if (!canvasFolderIds.has(folderId)) {
                    changed = true;
                    continue;
                }
                next[folderId] = isOpen;
            }
            return changed ? next : prev;
        });
    }, [canvasFolderIds]);

    useEffect(() => {
        const validKeys = new Set<string>();
        for (const group of resolvedWorkspaceGroups) {
            for (const item of group.items) {
                if (item.kind !== "file") continue;
                const targetFile = canvasFileByIdMap.get(item.id) || fileByIdMap.get(item.id);
                if (!targetFile || !isFolderEntry(targetFile)) continue;
                validKeys.add(`${group.id}:${item.key}`);
            }
        }

        setOpenGroupFolderItems((prev) => {
            let changed = false;
            const next: Record<string, boolean> = {};
            for (const [key, open] of Object.entries(prev)) {
                if (!validKeys.has(key)) {
                    changed = true;
                    continue;
                }
                next[key] = open;
            }
            return changed ? next : prev;
        });
    }, [resolvedWorkspaceGroups, canvasFileByIdMap, fileByIdMap]);

    useEffect(() => {
        const validItemKeys = new Set(selectableCanvasItems.map((item) => item.key));

        setSelectedCanvasItemKeys((prev) => {
            const next = prev.filter((itemKey) => validItemKeys.has(itemKey));
            if (next.length === prev.length) return prev;
            return next;
        });
    }, [selectableCanvasItems]);

    useEffect(() => {
        const validGroupIds = new Set(workspaceGroups.map((group) => group.id));
        setClosedGroups((prev) => {
            let changed = false;
            const next: Record<string, boolean> = {};
            for (const [groupId, closed] of Object.entries(prev)) {
                if (!validGroupIds.has(groupId)) {
                    changed = true;
                    continue;
                }
                next[groupId] = closed;
            }
            return changed ? next : prev;
        });
    }, [workspaceGroups]);

    useEffect(() => {
        if (!isStorageKeyReady(activeGroupsStorageKey)) return;
        if (groupsLoadedKeyRef.current !== activeGroupsStorageKey) return;
        if (groupsHydratedStorageKey !== activeGroupsStorageKey) return;
        if (hiddenGroupsHydratedStorageKey !== activeHiddenCanvasGroupsStorageKey) return;
        const validGroupIds = new Set(workspaceGroups.map((group) => group.id));
        setHiddenCanvasGroupIds((prev) => {
            const next = prev.filter((groupId) => validGroupIds.has(groupId));
            return next.length === prev.length ? prev : next;
        });
    }, [
        workspaceGroups,
        activeGroupsStorageKey,
        activeHiddenCanvasGroupsStorageKey,
        groupsHydratedStorageKey,
        hiddenGroupsHydratedStorageKey,
    ]);

    useEffect(() => {
        if (!isStorageKeyReady(activeHiddenCanvasItemsStorageKey)) return;
        if (hiddenItemsLoadedKeyRef.current !== activeHiddenCanvasItemsStorageKey) return;
        if (hiddenItemsHydratedStorageKey !== activeHiddenCanvasItemsStorageKey) return;
        if (loading) return;

        const aliveItemKeys = new Set(allCanvasSelectableItems.map((item) => item.key));
        // Keep source file keys alive so "remove from workspace" survives until the file set changes.
        for (const file of canvasAvailableFiles) {
            aliveItemKeys.add(buildCanvasItemKey("file", file.id));
        }
        setHiddenCanvasItemKeys((prev) => {
            const next = prev.filter((itemKey) => aliveItemKeys.has(itemKey));
            return next.length === prev.length ? prev : next;
        });
    }, [
        allCanvasSelectableItems,
        canvasAvailableFiles,
        activeHiddenCanvasItemsStorageKey,
        hiddenItemsHydratedStorageKey,
        loading,
    ]);

    useEffect(() => {
        setSelectedCanvasItemKeys((prev) => {
            const next = prev.filter((itemKey) => !hiddenCanvasItemKeySet.has(itemKey));
            return next.length === prev.length ? prev : next;
        });
    }, [hiddenCanvasItemKeySet]);

    useEffect(() => {
        if (!groupEntryMenu) return;
        const targetGroup = workspaceGroups.find((group) => group.id === groupEntryMenu.groupId);
        if (!targetGroup || !targetGroup.itemKeys.includes(groupEntryMenu.itemKey)) {
            setGroupEntryMenu(null);
        }
    }, [groupEntryMenu, workspaceGroups]);

    useEffect(() => {
        if (!groupInlineRename) return;
        if (workspaceGroups.some((group) => group.id === groupInlineRename.groupId)) return;
        setGroupInlineRename(null);
    }, [groupInlineRename, workspaceGroups]);

    useEffect(() => {
        if (loading) return;
        if (!data) return;
        if (memberLayoutLoadedKeyRef.current !== activeMemberLayoutStorageKey) return;

        const members = Array.isArray(data?.members) ? data.members : [];
        const validMemberIds = new Set(members.map((member) => member.id));
        setCanvasMemberPositions((prev) => {
            let changed = false;
            const next: Record<string, CanvasPosition> = {};
            for (const [placementId, position] of Object.entries(prev)) {
                const sourceMemberId = extractCanvasPlacementSourceId(placementId);
                if (!validMemberIds.has(sourceMemberId)) {
                    changed = true;
                    continue;
                }
                next[placementId] = position;
            }
            return changed ? next : prev;
        });
    }, [data, data?.members, loading, activeMemberLayoutStorageKey]);

    useEffect(() => {
        const validPlacementIds = new Set(Object.keys(canvasMemberPositions));
        setCanvasMemberPlacementOwners((prev) => {
            let changed = false;
            const next: Record<string, string> = {};
            for (const [placementId, ownerUserId] of Object.entries(prev)) {
                if (!validPlacementIds.has(placementId)) {
                    changed = true;
                    continue;
                }
                next[placementId] = ownerUserId;
            }
            return changed ? next : prev;
        });
    }, [canvasMemberPositions]);

    useEffect(() => {
        if (!movingFile && !movingMember && !movingAnnotation && !movingSelection && !resizingAnnotation) return;

        const handlePointerMove = (event: PointerEvent) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const currentMembers = Array.isArray(data?.members) ? data.members : [];

            const rect = canvas.getBoundingClientRect();
            const pointer = annotationPointerRef.current;
            if (pointer && !pointer.moved && (movingAnnotation || movingSelection)) {
                const movedX = Math.abs(event.clientX - pointer.startX);
                const movedY = Math.abs(event.clientY - pointer.startY);
                if (movedX > 4 || movedY > 4) {
                    annotationPointerRef.current = { ...pointer, moved: true };
                }
            }

            const canDropToGroup =
                isSidebarOpen &&
                activeSection === "groups" &&
                (movingFile || movingMember || movingAnnotation || movingSelection);
            const activeDragKeys = movingSelection
                ? movingSelection.items.map((item) => item.key)
                : movingFile
                    ? [buildCanvasItemKey("file", movingFile.fileId)]
                    : movingMember
                        ? [buildCanvasItemKey("member", movingMember.memberId)]
                        : movingAnnotation
                            ? [buildCanvasItemKey("annotation", movingAnnotation.annotationId)]
                            : [];
            const normalizedActiveDragKeys = Array.from(
                new Set(activeDragKeys.filter((itemKey) => selectableCanvasItemMap.has(itemKey)))
            );
            const isGroupDrag = canDropToGroup && event.ctrlKey && normalizedActiveDragKeys.length > 0;

            if (canDropToGroup && event.ctrlKey) {
                const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
                const dropTarget = element?.closest("[data-group-drop-target='true']") as HTMLElement | null;
                const targetGroupId = String(dropTarget?.dataset.groupId || "").trim() || null;
                if (hoveredGroupId !== targetGroupId) {
                    setHoveredGroupId(targetGroupId);
                }
            } else if (hoveredGroupId !== null) {
                setHoveredGroupId(null);
            }

            if (isGroupDrag) {
                const firstItem = selectableCanvasItemMap.get(normalizedActiveDragKeys[0]) || null;
                const firstKind = firstItem?.kind;
                const allSameKind =
                    Boolean(firstKind) &&
                    normalizedActiveDragKeys.every(
                        (itemKey) => selectableCanvasItemMap.get(itemKey)?.kind === firstKind
                    );
                const kind: WorkspaceGroupItemKind | "mixed" =
                    firstItem ? (allSameKind ? firstItem.kind : "mixed") : "mixed";
                const label =
                    normalizedActiveDragKeys.length === 1
                        ? (firstItem?.label || t("workspace.item"))
                        : t("workspace.items", { count: normalizedActiveDragKeys.length });
                const nextPreview: GroupDragPreviewState = {
                    x: event.clientX + 14,
                    y: event.clientY + 16,
                    kind,
                    label,
                    count: normalizedActiveDragKeys.length,
                };
                setGroupDragPreview(nextPreview);
                return;
            }
            setGroupDragPreview((prev) => (prev ? null : prev));

            if (movingSelection) {
                const anchor =
                    movingSelection.items.find((item) => item.key === movingSelection.anchorKey) ||
                    movingSelection.items[0];
                if (!anchor) return;

                const rawAnchorX = event.clientX - rect.left - movingSelection.pointerOffsetX;
                const rawAnchorY = event.clientY - rect.top - movingSelection.pointerOffsetY;
                const clampedAnchor = clampToCanvas(
                    { x: rawAnchorX, y: rawAnchorY },
                    rect.width,
                    rect.height,
                    anchor.width,
                    anchor.height
                );

                const desiredDeltaX = clampedAnchor.x - anchor.startX;
                const desiredDeltaY = clampedAnchor.y - anchor.startY;

                let minDeltaX = Number.NEGATIVE_INFINITY;
                let maxDeltaX = Number.POSITIVE_INFINITY;
                let minDeltaY = Number.NEGATIVE_INFINITY;
                let maxDeltaY = Number.POSITIVE_INFINITY;

                for (const item of movingSelection.items) {
                    const itemMinDeltaX = CANVAS_PADDING - item.startX;
                    const itemMaxDeltaX = rect.width - item.width - CANVAS_PADDING - item.startX;
                    const itemMinDeltaY = CANVAS_PADDING - item.startY;
                    const itemMaxDeltaY = rect.height - item.height - CANVAS_PADDING - item.startY;
                    minDeltaX = Math.max(minDeltaX, itemMinDeltaX);
                    maxDeltaX = Math.min(maxDeltaX, itemMaxDeltaX);
                    minDeltaY = Math.max(minDeltaY, itemMinDeltaY);
                    maxDeltaY = Math.min(maxDeltaY, itemMaxDeltaY);
                }

                const nextDeltaX = minDeltaX <= maxDeltaX
                    ? clampNumber(desiredDeltaX, minDeltaX, maxDeltaX)
                    : desiredDeltaX;
                const nextDeltaY = minDeltaY <= maxDeltaY
                    ? clampNumber(desiredDeltaY, minDeltaY, maxDeltaY)
                    : desiredDeltaY;

                const nextFilePositions: Record<string, CanvasPosition> = {};
                const nextMemberPositions: Record<string, CanvasPosition> = {};
                const nextAnnotationPositions: Record<string, CanvasPosition> = {};

                for (const item of movingSelection.items) {
                    const nextPosition: CanvasPosition = {
                        x: Math.round(item.startX + nextDeltaX),
                        y: Math.round(item.startY + nextDeltaY),
                    };
                    if (item.kind === "file") {
                        nextFilePositions[item.id] = nextPosition;
                    } else if (item.kind === "member") {
                        nextMemberPositions[item.id] = nextPosition;
                    } else {
                        nextAnnotationPositions[item.id] = nextPosition;
                    }
                }

                if (Object.keys(nextFilePositions).length > 0) {
                    setCanvasFilePositions((prev) => {
                        let changed = false;
                        const next = { ...prev };
                        for (const [id, pos] of Object.entries(nextFilePositions)) {
                            const prevPos = prev[id];
                            if (!prevPos || prevPos.x !== pos.x || prevPos.y !== pos.y) {
                                next[id] = pos;
                                changed = true;
                            }
                        }
                        return changed ? next : prev;
                    });
                }

                if (Object.keys(nextMemberPositions).length > 0) {
                    setCanvasMemberPositions((prev) => {
                        let changed = false;
                        const next = { ...prev };
                        for (const [id, pos] of Object.entries(nextMemberPositions)) {
                            const prevPos = prev[id];
                            if (!prevPos || prevPos.x !== pos.x || prevPos.y !== pos.y) {
                                next[id] = pos;
                                changed = true;
                            }
                        }
                        return changed ? next : prev;
                    });
                }

                if (Object.keys(nextAnnotationPositions).length > 0) {
                    setAnnotations((prev) =>
                        prev.map((item) => {
                            const nextPos = nextAnnotationPositions[item.id];
                            if (!nextPos) return item;
                            if (item.x === nextPos.x && item.y === nextPos.y) return item;
                            return { ...item, x: nextPos.x, y: nextPos.y };
                        })
                    );
                }
                return;
            }

            if (movingFile) {
                const rawX = event.clientX - rect.left - movingFile.offsetX;
                const rawY = event.clientY - rect.top - movingFile.offsetY;
                const nextPosition = clampToCanvas({ x: rawX, y: rawY }, rect.width, rect.height);

                setCanvasFilePositions((prev) => ({
                    ...prev,
                    [movingFile.fileId]: nextPosition,
                }));
            }

            if (movingMember) {
                const sourceMemberId = extractCanvasPlacementSourceId(movingMember.memberId);
                const targetMember = currentMembers.find((member) => member.id === sourceMemberId);
                const targetName = targetMember?.username || targetMember?.userId || "";
                const memberWidth = getMemberCardWidth(targetName);
                const rawX = event.clientX - rect.left - movingMember.offsetX;
                const rawY = event.clientY - rect.top - movingMember.offsetY;
                const nextPosition = clampToCanvas(
                    { x: rawX, y: rawY },
                    rect.width,
                    rect.height,
                    memberWidth,
                    CANVAS_MEMBER_HEIGHT
                );

                setCanvasMemberPositions((prev) => ({
                    ...prev,
                    [movingMember.memberId]: nextPosition,
                }));
            }

            if (movingAnnotation) {
                const rawX = event.clientX - rect.left - movingAnnotation.offsetX;
                const rawY = event.clientY - rect.top - movingAnnotation.offsetY;
                const nextPosition = clampToCanvas(
                    { x: rawX, y: rawY },
                    rect.width,
                    rect.height,
                    movingAnnotation.width,
                    movingAnnotation.height
                );

                setAnnotations((prev) =>
                    prev.map((item) =>
                        item.id === movingAnnotation.annotationId
                            ? { ...item, x: nextPosition.x, y: nextPosition.y }
                            : item
                    )
                );
            }

            if (resizingAnnotation) {
                const deltaX = event.clientX - resizingAnnotation.startClientX;
                const deltaY = event.clientY - resizingAnnotation.startClientY;

                const widthLimitByCanvas = Math.max(
                    CANVAS_ANNOTATION_MIN_WIDTH,
                    rect.width - resizingAnnotation.originX - CANVAS_PADDING
                );
                const heightLimitByCanvas = Math.max(
                    CANVAS_ANNOTATION_MIN_HEIGHT,
                    rect.height - resizingAnnotation.originY - CANVAS_PADDING
                );

                const widthMax = Math.min(CANVAS_ANNOTATION_MAX_WIDTH, widthLimitByCanvas);
                const heightMax = Math.min(CANVAS_ANNOTATION_MAX_HEIGHT, heightLimitByCanvas);

                const nextWidth = Math.round(
                    clampNumber(resizingAnnotation.startWidth + deltaX, CANVAS_ANNOTATION_MIN_WIDTH, widthMax)
                );
                const nextHeight = Math.round(
                    clampNumber(resizingAnnotation.startHeight + deltaY, CANVAS_ANNOTATION_MIN_HEIGHT, heightMax)
                );

                setAnnotations((prev) =>
                    prev.map((item) =>
                        item.id === resizingAnnotation.annotationId
                            ? { ...item, width: nextWidth, height: nextHeight }
                            : item
                    )
                );
            }
        };

        const handlePointerUp = (event: PointerEvent) => {
            const dropTargetGroupId =
                isSidebarOpen &&
                    activeSection === "groups" &&
                    event.ctrlKey &&
                    hoveredGroupId
                    ? hoveredGroupId
                    : null;
            if (dropTargetGroupId) {
                const candidateKeys = movingSelection
                    ? movingSelection.items.map((item) => item.key)
                    : movingFile
                        ? [buildCanvasItemKey("file", movingFile.fileId)]
                        : movingMember
                            ? [buildCanvasItemKey("member", movingMember.memberId)]
                            : movingAnnotation
                                ? [buildCanvasItemKey("annotation", movingAnnotation.annotationId)]
                                : [];
                const normalizedKeys = Array.from(
                    new Set(candidateKeys.filter((itemKey) => selectableCanvasItemMap.has(itemKey)))
                );
                if (normalizedKeys.length > 0) {
                    triggerGroupDropAnimation(normalizedKeys, dropTargetGroupId, {
                        originClientX: event.clientX,
                        originClientY: event.clientY,
                    });
                    const selectedSet = new Set(normalizedKeys);
                    setWorkspaceGroups((prev) =>
                        prev.map((group) => {
                            const filtered = group.itemKeys.filter((itemKey) => !selectedSet.has(itemKey));
                            if (group.id !== dropTargetGroupId) {
                                return filtered.length === group.itemKeys.length
                                    ? group
                                    : { ...group, itemKeys: filtered };
                            }
                            const merged = [...filtered, ...normalizedKeys.filter((itemKey) => !filtered.includes(itemKey))];
                            return { ...group, itemKeys: merged };
                        })
                    );
                }
            }

            const pointer = annotationPointerRef.current;
            if (pointer?.moved) {
                suppressAnnotationClickIdRef.current = pointer.id;
            } else {
                suppressAnnotationClickIdRef.current = null;
            }
            annotationPointerRef.current = null;
            setHoveredGroupId(null);
            setGroupDragPreview(null);
            setMovingFile(null);
            setMovingMember(null);
            setMovingAnnotation(null);
            setMovingSelection(null);
            setResizingAnnotation(null);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        movingFile,
        movingMember,
        movingAnnotation,
        movingSelection,
        resizingAnnotation,
        data?.members,
        isSidebarOpen,
        activeSection,
        hoveredGroupId,
        selectableCanvasItemMap,
    ]);

    useEffect(() => {
        if (!canvasSelection) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handlePointerMove = (event: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            const currentX = clampNumber(event.clientX - rect.left, 0, rect.width);
            const currentY = clampNumber(event.clientY - rect.top, 0, rect.height);
            const nextSelection: CanvasSelectionState = {
                ...canvasSelection,
                currentX,
                currentY,
            };
            const selectionBounds = normalizeSelectionBounds(nextSelection);
            setCanvasSelection(nextSelection);

            if (selectionBounds.width < 2 && selectionBounds.height < 2) {
                setSelectedCanvasItemKeys([]);
                return;
            }

            const nextSelectedKeys = selectableCanvasItems
                .filter((item) => hasRectIntersection(selectionBounds, item.bounds))
                .map((item) => item.key);
            setSelectedCanvasItemKeys(nextSelectedKeys);
        };

        const handlePointerUp = () => {
            setCanvasSelection(null);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };
    }, [canvasSelection, selectableCanvasItems]);

    useEffect(() => {
        if (!sidebarSelection) return;
        const container =
            sidebarSelection.section === "files"
                ? filesSidebarSelectionRef.current
                : groupsSidebarSelectionRef.current;
        if (!container) return;

        const handlePointerMove = (event: PointerEvent) => {
            const rect = container.getBoundingClientRect();
            const currentX = clampNumber(event.clientX - rect.left, 0, rect.width);
            const currentY = clampNumber(event.clientY - rect.top, 0, rect.height);
            const nextSelection: SidebarSelectionState = {
                ...sidebarSelection,
                currentX,
                currentY,
            };
            const selectionBounds = normalizePointerSelectionBounds(nextSelection);
            setSidebarSelection(nextSelection);

            if (selectionBounds.width < 2 && selectionBounds.height < 2) {
                if (sidebarSelection.section === "files") setSelectedSidebarFileIds([]);
                else setSelectedSidebarGroupItemKeys([]);
                return;
            }

            const nodes = Array.from(
                container.querySelectorAll<HTMLElement>("[data-sidebar-select-item='true']")
            );
            if (sidebarSelection.section === "files") {
                const selectedIds = nodes
                    .map((node) => {
                        const fileId = String(node.dataset.sidebarFileId || "").trim();
                        if (!fileId) return null;
                        const nodeRect = node.getBoundingClientRect();
                        const localBounds: CanvasBounds = {
                            x: nodeRect.left - rect.left,
                            y: nodeRect.top - rect.top,
                            width: nodeRect.width,
                            height: nodeRect.height,
                        };
                        return hasRectIntersection(selectionBounds, localBounds) ? fileId : null;
                    })
                    .filter(Boolean) as string[];
                setSelectedSidebarFileIds(Array.from(new Set(selectedIds)));
            } else {
                const selectedKeys = nodes
                    .map((node) => {
                        const itemKey = String(node.dataset.sidebarGroupItemKey || "").trim();
                        if (!itemKey) return null;
                        const nodeRect = node.getBoundingClientRect();
                        const localBounds: CanvasBounds = {
                            x: nodeRect.left - rect.left,
                            y: nodeRect.top - rect.top,
                            width: nodeRect.width,
                            height: nodeRect.height,
                        };
                        return hasRectIntersection(selectionBounds, localBounds) ? itemKey : null;
                    })
                    .filter(Boolean) as string[];
                setSelectedSidebarGroupItemKeys(Array.from(new Set(selectedKeys)));
            }
        };

        const handlePointerUp = () => {
            setSidebarSelection(null);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };
    }, [sidebarSelection]);

    const createWorkspaceFileRecord = async (
        title: string,
        url = "",
        scope: WorkspaceMode = sidebarFileScope
    ) => {
        if (!teamId) return null;

        const normalizedTitle = String(title || "").trim().replace(/\s+/g, " ").slice(0, 120);
        if (!normalizedTitle) return null;

        const res = await fetch(`/api/workspace/${teamId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: "FILE",
                title: normalizedTitle,
                url: String(url || ""),
                scope,
            }),
        });
        if (!res.ok) return null;
        try {
            const payload = await res.json();
            return typeof payload?.id === "string" ? payload.id : null;
        } catch {
            return null;
        }
    };

    const normalizeFileIdentityTitle = (value: string | undefined) =>
        String(value || "").trim().replace(/\s+/g, " ").slice(0, 120);
    const normalizeFileIdentityUrl = (value: string | undefined) => String(value || "").trim();

    const shareMyFileToTeamWorkspace = async (sourceFileId: string) => {
        if (!teamId) return null;
        const normalizedSourceFileId = String(sourceFileId || "").trim();
        if (!normalizedSourceFileId) return null;

        const res = await fetch(`/api/workspace/${teamId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: "FILE_SHARE_TO_TEAM",
                id: normalizedSourceFileId,
            }),
        });
        if (!res.ok) return null;
        try {
            const payload = await res.json();
            return typeof payload?.id === "string" ? payload.id : null;
        } catch {
            return null;
        }
    };

    const ensureTeamCanvasFileFromSource = async (source: WorkspaceFile) => {
        const sharedTeamFileId = await shareMyFileToTeamWorkspace(source.id);
        if (!sharedTeamFileId) return null;

        const existingTeamFile = (data?.files || []).find((file) => file.id === sharedTeamFileId);
        if (existingTeamFile) return existingTeamFile;

        const created: WorkspaceFile = {
            id: sharedTeamFileId,
            title: normalizeFileIdentityTitle(source.title),
            url: normalizeFileIdentityUrl(source.url),
            ownerUserId: data?.viewerUserId,
            createdAt: new Date().toISOString(),
        };

        setData((prev) => {
            if (!prev) return prev;
            if ((prev.files || []).some((file) => file.id === sharedTeamFileId)) return prev;
            return {
                ...prev,
                files: [...(prev.files || []), created],
            };
        });

        return created;
    };

    const resolveCanvasDropFile = async (fileId: string): Promise<WorkspaceFile | null> => {
        const normalizedFileId = String(fileId || "").trim();
        if (!normalizedFileId) return null;

        if (workspaceMode !== "team") {
            return currentFiles.find((file) => file.id === normalizedFileId) || null;
        }

        const existingTeamFile = (data?.files || []).find((file) => file.id === normalizedFileId);
        if (existingTeamFile) return existingTeamFile;

        const source = currentFiles.find((file) => file.id === normalizedFileId);
        if (!source) return null;
        return ensureTeamCanvasFileFromSource(source);
    };

    const uploadWorkspaceFileRecord = async (file: File, folderId?: string) => {
        if (!teamId) return false;
        const form = new FormData();
        form.append("file", file);
        form.append("scope", sidebarFileScope);
        if (folderId) {
            form.append("folderId", folderId);
        }

        const res = await fetch(`/api/workspace/${teamId}/files/upload`, {
            method: "POST",
            body: form,
        });
        return res.ok;
    };

    const openInNewTab = (url: string) => {
        if (typeof window === "undefined") return false;
        try {
            const popup = window.open("", "_blank");
            if (popup) {
                popup.opener = null;
                popup.location.href = url;
                return true;
            }

            // Some browsers can open a tab via anchor click but still return null from window.open.
            const link = window.document.createElement("a");
            link.href = url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.style.display = "none";
            window.document.body.appendChild(link);
            link.click();
            link.remove();
            return true;
        } catch {
            return false;
        }
    };

    const openWorkspaceFile = (file: WorkspaceFile) => {
        const isFolder = String(file.title || "").startsWith("Folder: ");
        if (isFolder) {
            setNotice({
                open: true,
                title: t("workspace.folder"),
                message: t("workspace.folderCannotOpen"),
            });
            return;
        }

        const url = String(file.url || "").trim();
        if (!url) {
            setNotice({
                open: true,
                title: t("workspace.openUnavailableTitle"),
                message: t("workspace.openUnavailableNoSource"),
            });
            return;
        }

        if (
            url.startsWith("data:") ||
            url.startsWith("blob:") ||
            url.startsWith("http://") ||
            url.startsWith("https://")
        ) {
            const opened = openInNewTab(url);
            if (!opened) {
                setNotice({
                    open: true,
                    title: t("workspace.popupBlockedTitle"),
                    message: t("workspace.popupBlockedMessage"),
                });
            }
            return;
        }

        setNotice({
            open: true,
            title: t("workspace.openUnavailableTitle"),
            message: t("workspace.openUnavailableUnsupported"),
        });
    };

    const openCreateEntry = () => {
        trackMyTeamAction("myteam.create_folder", { source: "canvas_menu" });
        setCanvasMenu(null);
        setFileItemMenu(null);
        setCanvasFileItemMenu(null);
        setWorkspaceCanvasMenu(null);
        setAnnotationItemMenu(null);
        setCreateEntryModal({
            open: true,
            name: "",
            sourceFileId: "",
            isSubmitting: false,
            error: "",
        });
    };

    const openCreateEntryForFileFromMenu = () => {
        if (!fileItemMenu) return;
        const targetFile = currentFiles.find((file) => file.id === fileItemMenu.fileId);
        if (!targetFile || isFolderEntry(targetFile)) return;
        trackMyTeamAction("myteam.create_folder", { source: "file_menu", fileId: targetFile.id });

        setCanvasMenu(null);
        setFileItemMenu(null);
        setCanvasFileItemMenu(null);
        setWorkspaceCanvasMenu(null);
        setAnnotationItemMenu(null);
        setCreateEntryModal({
            open: true,
            name: "",
            sourceFileId: targetFile.id,
            isSubmitting: false,
            error: "",
        });
    };

    const closeCreateEntry = () => {
        setCreateEntryModal((prev) =>
            prev.isSubmitting ? prev : { ...prev, open: false, sourceFileId: "", error: "" }
        );
    };

    const submitCreateEntry = async () => {
        if (createEntryModal.isSubmitting) return;
        const trimmedName = createEntryModal.name.trim().replace(/\s+/g, " ");
        if (!trimmedName) {
            setCreateEntryModal((prev) => ({ ...prev, error: t("workspace.error.nameRequired") }));
            return;
        }

        setCreateEntryModal((prev) => ({ ...prev, isSubmitting: true, error: "" }));

        const title = `Folder: ${trimmedName}`;

        try {
            const createdFolderId = await createWorkspaceFileRecord(title);
            if (!createdFolderId) {
                setCreateEntryModal((prev) => ({
                    ...prev,
                    isSubmitting: false,
                    error: t("workspace.error.createItem"),
                }));
                return;
            }

            if (createEntryModal.sourceFileId) {
                const moved = await moveFileIntoFolder(createEntryModal.sourceFileId, createdFolderId);
                if (!moved) {
                    setCreateEntryModal((prev) => ({
                        ...prev,
                        isSubmitting: false,
                        error: t("workspace.error.createFolderMoveFailed"),
                    }));
                    return;
                }
            }

            setCreateEntryModal((prev) => ({
                ...prev,
                open: false,
                name: "",
                sourceFileId: "",
                isSubmitting: false,
                error: "",
            }));
            void fetchData({ silent: true });
        } catch {
            setCreateEntryModal((prev) => ({
                ...prev,
                isSubmitting: false,
                error: t("workspace.error.createItem"),
            }));
        }
    };

    const triggerImportFiles = () => {
        trackMyTeamAction("myteam.import_file");
        setCanvasMenu(null);
        importFileInputRef.current?.click();
    };

    const triggerImportFolders = () => {
        trackMyTeamAction("myteam.import_folder");
        setCanvasMenu(null);
        importFolderInputRef.current?.click();
    };

    const handleImportFilesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        event.target.value = "";
        if (!files.length) return;

        setWorkspaceActionPendingCount((prev) => prev + 1);
        try {
            let successCount = 0;
            let failedCount = 0;
            const limitedFiles = files.slice(0, 30);
            for (const file of limitedFiles) {
                const ok = await uploadWorkspaceFileRecord(file);
                if (ok) successCount += 1;
                else failedCount += 1;
            }

            if (successCount > 0) {
                void fetchData({ silent: true });
                setNotice({
                    open: true,
                    title: t("workspace.notice.importCompletedTitle"),
                    message:
                        failedCount > 0
                            ? t("workspace.notice.importFilesPartial", { successCount, failedCount })
                            : t("workspace.notice.importFilesSuccess", { successCount }),
                });
            }

            if (files.length > limitedFiles.length) {
                setNotice({
                    open: true,
                    title: t("workspace.notice.importCompletedTitle"),
                    message: t("workspace.notice.importFilesLimit", { successCount }),
                });
                return;
            }

            if (successCount === 0) {
                setNotice({
                    open: true,
                    title: t("workspace.notice.importFailedTitle"),
                    message:
                        failedCount > 0
                            ? t("workspace.notice.importFilesAllFailed", { failedCount })
                            : t("workspace.notice.importNoFiles"),
                });
            }
        } finally {
            setWorkspaceActionPendingCount((prev) => (prev > 0 ? prev - 1 : 0));
        }
    };

    const handleImportFoldersChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        event.target.value = "";
        if (!files.length) return;

        setWorkspaceActionPendingCount((prev) => prev + 1);
        try {
            const folderEntries = files
                .map((file) => {
                    const rootFolderName = String(file.webkitRelativePath || "")
                        .split("/")
                        .map((segment) => String(segment || "").trim())
                        .filter(Boolean)[0];
                    return { file, rootFolderName: String(rootFolderName || "").trim() };
                })
                .filter((entry) => Boolean(entry.rootFolderName));

            const folderNames = Array.from(new Set(folderEntries.map((entry) => entry.rootFolderName))).slice(0, 30);

            if (!folderNames.length) {
                setNotice({
                    open: true,
                    title: t("workspace.notice.importFailedTitle"),
                    message: t("workspace.notice.importNoFolderNames"),
                });
                return;
            }

            const folderIdByName = new Map<string, string>();
            let folderSuccessCount = 0;
            for (const folderName of folderNames) {
                const createdId = await createWorkspaceFileRecord(`Folder: ${folderName}`);
                if (createdId) {
                    folderSuccessCount += 1;
                    folderIdByName.set(folderName, createdId);
                }
            }

            const validEntries = folderEntries.filter((entry) => folderIdByName.has(entry.rootFolderName));
            const limitedEntries = validEntries.slice(0, 120);
            let fileSuccessCount = 0;
            let fileFailedCount = 0;

            for (const entry of limitedEntries) {
                const folderId = folderIdByName.get(entry.rootFolderName);
                if (!folderId) {
                    fileFailedCount += 1;
                    continue;
                }
                const ok = await uploadWorkspaceFileRecord(entry.file, folderId);
                if (ok) fileSuccessCount += 1;
                else fileFailedCount += 1;
            }

            if (folderSuccessCount > 0 || fileSuccessCount > 0) {
                void fetchData({ silent: true });
                setNotice({
                    open: true,
                    title: t("workspace.notice.importCompletedTitle"),
                    message:
                        fileFailedCount > 0
                            ? t("workspace.notice.importFoldersPartial", {
                                folderSuccessCount,
                                fileSuccessCount,
                                fileFailedCount,
                            })
                            : t("workspace.notice.importFoldersSuccess", { folderSuccessCount, fileSuccessCount }),
                });
            } else {
                setNotice({
                    open: true,
                    title: t("workspace.notice.importFailedTitle"),
                    message: t("workspace.notice.importNoFolders"),
                });
            }

            if (validEntries.length > limitedEntries.length) {
                setNotice({
                    open: true,
                    title: t("workspace.notice.importCompletedTitle"),
                    message: t("workspace.notice.importFoldersLimit", { folderSuccessCount, fileSuccessCount }),
                });
            }
        } finally {
            setWorkspaceActionPendingCount((prev) => (prev > 0 ? prev - 1 : 0));
        }
    };

    const moveFileIntoFolder = async (
        fileId: string,
        nextFolderId?: string | null,
        options?: { scope?: WorkspaceMode; suppressNotice?: boolean }
    ) => {
        if (!teamId || !fileId) return false;
        const normalizedFolderId = String(nextFolderId || "").trim() || null;
        const requestScope = options?.scope || sidebarFileScope;
        const suppressNotice = Boolean(options?.suppressNotice);

        try {
            const res = await fetch(`/api/workspace/${teamId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "FILE_FOLDER",
                    id: fileId,
                    folderId: normalizedFolderId,
                    scope: requestScope,
                }),
            });

            if (!res.ok) {
                const errorMessage = t("workspace.error.moveFile");
                if (!suppressNotice) {
                    setNotice({
                        open: true,
                        title: t("workspace.notice.moveFailedTitle"),
                        message: errorMessage,
                    });
                }
                return false;
            }

            setData((prev) => {
                if (!prev) return prev;
                if (requestScope === "my") {
                    return {
                        ...prev,
                        myFiles: (prev.myFiles || []).map((file) =>
                            file.id === fileId
                                ? { ...file, folderId: normalizedFolderId || undefined }
                                : file
                        ),
                    };
                }
                return {
                    ...prev,
                    files: (prev.files || []).map((file) =>
                        file.id === fileId
                            ? { ...file, folderId: normalizedFolderId || undefined }
                            : file
                    ),
                };
            });
            return true;
        } catch {
            if (!suppressNotice) {
                setNotice({
                    open: true,
                    title: t("workspace.notice.moveFailedTitle"),
                    message: t("workspace.error.moveFile"),
                });
            }
            return false;
        }
    };

    const renameWorkspaceFileRecord = async (fileId: string, nextTitle: string) => {
        if (!teamId || !fileId) return false;
        const normalizedTitle = String(nextTitle || "").trim().replace(/\s+/g, " ").slice(0, 120);
        if (!normalizedTitle) return false;

        try {
            const res = await fetch(`/api/workspace/${teamId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "FILE_RENAME",
                    id: fileId,
                    title: normalizedTitle,
                    scope: sidebarFileScope,
                }),
            });

            if (!res.ok) return false;

            setData((prev) => {
                if (!prev) return prev;
                if (sidebarFileScope === "my") {
                    return {
                        ...prev,
                        myFiles: (prev.myFiles || []).map((file) =>
                            file.id === fileId ? { ...file, title: normalizedTitle } : file
                        ),
                    };
                }
                return {
                    ...prev,
                    files: (prev.files || []).map((file) =>
                        file.id === fileId ? { ...file, title: normalizedTitle } : file
                    ),
                };
            });
            return true;
        } catch {
            return false;
        }
    };

    const startInlineRenameFromMenu = () => {
        if (!fileItemMenu) return;
        const targetFile = currentFiles.find((file) => file.id === fileItemMenu.fileId);
        if (!targetFile) return;
        const isFolder = isFolderEntry(targetFile);

        setFileItemMenu(null);
        setInlineRename({
            fileId: targetFile.id,
            isFolder,
            name: isFolder ? getFolderLabel(targetFile.title) : targetFile.title,
            originalName: isFolder ? getFolderLabel(targetFile.title) : targetFile.title,
            isSubmitting: false,
            error: "",
        });
    };

    const cancelInlineRename = () => {
        setInlineRename((prev) => (prev?.isSubmitting ? prev : null));
    };

    const submitInlineRename = async () => {
        if (!inlineRename || inlineRename.isSubmitting) return;
        const trimmedName = String(inlineRename.name || "").trim().replace(/\s+/g, " ").slice(0, 120);
        if (!trimmedName) {
            setInlineRename((prev) => (prev ? { ...prev, error: t("workspace.error.nameRequired") } : prev));
            return;
        }

        if (trimmedName === inlineRename.originalName.trim()) {
            setInlineRename(null);
            return;
        }

        const nextTitle = inlineRename.isFolder ? `Folder: ${trimmedName}` : trimmedName;

        setInlineRename((prev) => (prev ? { ...prev, isSubmitting: true, error: "" } : prev));
        const ok = await renameWorkspaceFileRecord(inlineRename.fileId, nextTitle);

        if (!ok) {
            setInlineRename((prev) =>
                prev
                    ? {
                        ...prev,
                        isSubmitting: false,
                        error: t("workspace.error.renameItem"),
                    }
                    : prev
            );
            return;
        }

        setInlineRename(null);
    };

    const openMoveFileFromMenu = () => {
        if (!fileItemMenu) return;
        const targetFile = currentFiles.find((file) => file.id === fileItemMenu.fileId);
        if (!targetFile || isFolderEntry(targetFile)) return;

        setFileItemMenu(null);
        setMoveFileModal({
            open: true,
            fileId: targetFile.id,
            folderId: String(targetFile.folderId || "").trim(),
            isSubmitting: false,
            error: "",
        });
    };

    const moveFileToFolderFromMenu = async (folderId?: string | null) => {
        if (!fileItemMenu) return;
        const targetFile = currentFiles.find((file) => file.id === fileItemMenu.fileId);
        if (!targetFile || isFolderEntry(targetFile)) return;

        const nextFolderId = String(folderId || "").trim() || null;
        const currentFolderId = String(targetFile.folderId || "").trim() || null;
        setFileItemMenu(null);
        if (nextFolderId === currentFolderId) return;
        await moveFileIntoFolder(targetFile.id, nextFolderId);
    };

    const closeMoveFile = () => {
        setMoveFileModal((prev) => (prev.isSubmitting ? prev : { ...prev, open: false, error: "" }));
    };

    const submitMoveFile = async () => {
        if (moveFileModal.isSubmitting) return;
        setMoveFileModal((prev) => ({ ...prev, isSubmitting: true, error: "" }));

        const ok = await moveFileIntoFolder(moveFileModal.fileId, moveFileModal.folderId || null);
        if (!ok) {
            setMoveFileModal((prev) => ({
                ...prev,
                isSubmitting: false,
                error: t("workspace.error.moveFile"),
            }));
            return;
        }

        setMoveFileModal({
            open: false,
            fileId: "",
            folderId: "",
            isSubmitting: false,
            error: "",
        });
    };

    const startGroupInlineRename = (groupId: string) => {
        const targetGroup = workspaceGroups.find((group) => group.id === groupId);
        if (!targetGroup) return;

        const originalName = String(targetGroup.name || "").trim() || t("workspace.group");
        setGroupInlineRename({
            groupId,
            name: originalName,
            originalName,
            error: "",
        });
    };

    const cancelGroupInlineRename = () => {
        setGroupInlineRename(null);
    };

    const submitGroupInlineRename = () => {
        if (!groupInlineRename) return;
        const trimmedName = String(groupInlineRename.name || "")
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 60);

        if (!trimmedName) {
            setGroupInlineRename((prev) => (prev ? { ...prev, error: t("workspace.error.groupNameRequired") } : prev));
            return;
        }

        if (trimmedName === groupInlineRename.originalName) {
            setGroupInlineRename(null);
            return;
        }

        setWorkspaceGroups((prev) =>
            prev.map((group) =>
                group.id === groupInlineRename.groupId ? { ...group, name: trimmedName } : group
            )
        );
        setGroupInlineRename(null);
    };

    const handleGroupDragStart = (event: React.DragEvent<HTMLElement>, groupId: string) => {
        const targetGroup = resolvedWorkspaceGroups.find((group) => group.id === groupId);
        if (!targetGroup || targetGroup.items.length === 0) {
            event.preventDefault();
            return;
        }
        trackMyTeamAction("myteam.drag_group", { groupId, source: "sidebar" });
        event.dataTransfer.setData("application/x-onbure-group-id", groupId);
        event.dataTransfer.setData("text/plain", `__onbure_group_id__=${groupId}`);
        event.dataTransfer.effectAllowed = "move";
        setDraggingSidebarGroupId(groupId);
    };

    const handleGroupDragEnd = () => {
        setDraggingSidebarGroupId(null);
    };

    const parseDraggedGroupIdFromTransfer = (
        event: Pick<React.DragEvent<HTMLElement>, "dataTransfer">
    ): string | null => {
        const direct = String(event.dataTransfer.getData("application/x-onbure-group-id") || "").trim();
        if (direct) return direct;

        const plain = String(event.dataTransfer.getData("text/plain") || "").trim();
        const prefix = "__onbure_group_id__=";
        if (plain.startsWith(prefix)) {
            const fromText = plain.slice(prefix.length).trim();
            return fromText || null;
        }
        return null;
    };

    const parseDraggedSidebarFileIdsFromTransfer = (
        event: Pick<React.DragEvent<HTMLElement>, "dataTransfer">
    ): string[] => {
        const rawMulti = String(event.dataTransfer.getData("application/x-onbure-file-ids") || "").trim();
        if (rawMulti) {
            try {
                const parsed = JSON.parse(rawMulti) as unknown;
                if (Array.isArray(parsed)) {
                    const normalized = Array.from(
                        new Set(parsed.map((value) => String(value || "").trim()).filter(Boolean))
                    );
                    if (normalized.length > 0) return normalized;
                }
            } catch {
                // ignore parse error
            }
        }

        const single = String(event.dataTransfer.getData("application/x-onbure-file-id") || "").trim();
        return single ? [single] : [];
    };

    const expandFolderBundleSourceIds = (rootIds: string[]): string[] => {
        const normalizedRoots = Array.from(new Set(rootIds.map((id) => String(id || "").trim()).filter(Boolean)));
        if (normalizedRoots.length === 0) return [];

        const collected = new Set<string>();
        const queue = [...normalizedRoots];
        while (queue.length > 0) {
            const currentId = String(queue.shift() || "").trim();
            if (!currentId || collected.has(currentId)) continue;
            const currentFile = fileByIdMap.get(currentId);
            if (!currentFile) continue;

            collected.add(currentId);
            if (!isFolderEntry(currentFile)) continue;

            for (const candidate of currentFiles) {
                const parentFolderId = String(candidate.folderId || "").trim();
                if (!parentFolderId || parentFolderId !== currentId) continue;
                if (!collected.has(candidate.id)) {
                    queue.push(candidate.id);
                }
            }
        }

        return Array.from(collected);
    };

    const placeGroupItemsOnCanvas = async (groupId: string, clientX: number, clientY: number) => {
        const targetGroup = resolvedWorkspaceGroups.find((group) => group.id === groupId);
        if (!targetGroup || targetGroup.items.length === 0) return;

        let itemsToPlace = targetGroup.items;
        let visibleItemKeySet = new Set(itemsToPlace.map((item) => item.key));
        const groupItemKeyReplacements = new Map<string, string>();

        if (workspaceMode === "team") {
            const groupFileSourceIds = Array.from(
                new Set(
                    targetGroup.items
                        .filter((item) => item.kind === "file")
                        .map((item) => {
                            const parsedItemKey = parseCanvasItemKey(item.key);
                            return extractCanvasPlacementSourceId(parsedItemKey?.id || item.id);
                        })
                        .filter(Boolean)
                )
            );

            if (groupFileSourceIds.length > 0) {
                const sourceIdsForTeamShare = expandFolderBundleSourceIds(groupFileSourceIds);
                const resolvedEntries = await Promise.all(
                    sourceIdsForTeamShare.map(async (sourceId) => {
                        const resolvedFile = await resolveCanvasDropFile(sourceId);
                        if (!resolvedFile) return null;
                        return { sourceId, resolvedFile };
                    })
                );
                const resolvedBySourceId = new Map<string, WorkspaceFile>();
                for (const entry of resolvedEntries) {
                    if (!entry) continue;
                    resolvedBySourceId.set(entry.sourceId, entry.resolvedFile);
                }

                const sourceIdSet = new Set(sourceIdsForTeamShare);
                await Promise.all(
                    sourceIdsForTeamShare.map(async (sourceId) => {
                        const sourceFile = fileByIdMap.get(sourceId);
                        if (!sourceFile) return;
                        const sourceFolderId = String(sourceFile.folderId || "").trim();
                        if (!sourceFolderId || !sourceIdSet.has(sourceFolderId)) return;

                        const teamChildFile = resolvedBySourceId.get(sourceId);
                        const teamFolderFile = resolvedBySourceId.get(sourceFolderId);
                        if (!teamChildFile || !teamFolderFile || teamChildFile.id === teamFolderFile.id) return;

                        await moveFileIntoFolder(teamChildFile.id, teamFolderFile.id, {
                            scope: "team",
                            suppressNotice: true,
                        });
                    })
                );

                itemsToPlace = targetGroup.items.map((item) => {
                    if (item.kind !== "file") return item;
                    const parsedItemKey = parseCanvasItemKey(item.key);
                    const sourceFileId = extractCanvasPlacementSourceId(parsedItemKey?.id || item.id);
                    const resolvedTeamFile = resolvedBySourceId.get(sourceFileId);
                    if (!resolvedTeamFile) return item;
                    const mappedKey = buildCanvasItemKey("file", resolvedTeamFile.id);
                    visibleItemKeySet.add(mappedKey);
                    if (mappedKey !== item.key) {
                        groupItemKeyReplacements.set(item.key, mappedKey);
                    }
                    return {
                        ...item,
                        id: resolvedTeamFile.id,
                        key: mappedKey,
                    };
                });

                if (groupItemKeyReplacements.size > 0) {
                    setWorkspaceGroups((prev) =>
                        prev.map((group) => {
                            if (group.id !== groupId) return group;
                            const nextKeys = group.itemKeys.map(
                                (itemKey) => groupItemKeyReplacements.get(itemKey) || itemKey
                            );
                            const dedupedNextKeys = Array.from(new Set(nextKeys));
                            const unchanged =
                                dedupedNextKeys.length === group.itemKeys.length &&
                                dedupedNextKeys.every((itemKey, index) => itemKey === group.itemKeys[index]);
                            return unchanged ? group : { ...group, itemKeys: dedupedNextKeys };
                        })
                    );
                }
            }
        }

        itemsToPlace = itemsToPlace.filter((item) => canViewerMoveCanvasItem(item.key));
        if (itemsToPlace.length === 0) return;
        visibleItemKeySet = new Set(itemsToPlace.map((item) => item.key));

        setHiddenCanvasGroupIds((prev) => prev.filter((id) => id !== groupId));
        setHiddenCanvasItemKeys((prev) =>
            prev.filter((itemKey) => !visibleItemKeySet.has(itemKey))
        );

        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const centerX = clientX - rect.left;
        const centerY = clientY - rect.top;

        const count = itemsToPlace.length;
        const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(count))));
        const gap = 26;
        const fileUpdates: Record<string, CanvasPosition> = {};
        const memberUpdates: Record<string, CanvasPosition> = {};
        const annotationUpdates = new Map<string, CanvasPosition>();

        itemsToPlace.forEach((item, index) => {
            const parsedItemKey = parseCanvasItemKey(item.key);
            const placementOrItemId = parsedItemKey?.id || item.id;
            const row = Math.floor(index / cols);
            const col = index % cols;
            const cellCenterX = centerX + (col - (cols - 1) / 2) * gap;
            const cellCenterY = centerY + row * gap;

            if (item.kind === "file") {
                const width = CANVAS_FILE_WIDTH;
                const height = CANVAS_FILE_HEIGHT;
                fileUpdates[placementOrItemId] = clampToCanvas(
                    { x: cellCenterX - width / 2, y: cellCenterY - height / 2 },
                    rect.width,
                    rect.height,
                    width,
                    height
                );
                return;
            }

            if (item.kind === "member") {
                const targetMember = members.find((member) => member.id === item.id);
                if (!targetMember) return;
                const width = getMemberCardWidth(targetMember.username || targetMember.userId);
                const height = CANVAS_MEMBER_HEIGHT;
                memberUpdates[placementOrItemId] = clampToCanvas(
                    { x: cellCenterX - width / 2, y: cellCenterY - height / 2 },
                    rect.width,
                    rect.height,
                    width,
                    height
                );
                return;
            }

            if (item.kind === "annotation") {
                const width = item.bounds.width;
                const height = item.bounds.height;
                annotationUpdates.set(
                    item.id,
                    clampToCanvas(
                        { x: cellCenterX - width / 2, y: cellCenterY - height / 2 },
                        rect.width,
                        rect.height,
                        width,
                        height
                    )
                );
            }
        });

        if (Object.keys(fileUpdates).length > 0) {
            setCanvasFilePositions((prev) => ({ ...prev, ...fileUpdates }));
        }
        if (Object.keys(memberUpdates).length > 0) {
            setCanvasMemberPositions((prev) => ({ ...prev, ...memberUpdates }));
            const viewerUserIdForPlacement = String(data?.viewerUserId || "").trim();
            if (workspaceMode === "team" && viewerUserIdForPlacement) {
                setCanvasMemberPlacementOwners((prev) => {
                    let changed = false;
                    const next = { ...prev };
                    for (const placementId of Object.keys(memberUpdates)) {
                        if (next[placementId] || canvasMemberPositions[placementId]) continue;
                        next[placementId] = viewerUserIdForPlacement;
                        changed = true;
                    }
                    return changed ? next : prev;
                });
            }
        }
        if (annotationUpdates.size > 0) {
            const now = new Date().toISOString();
            setAnnotations((prev) =>
                prev.map((annotation) => {
                    const nextPosition = annotationUpdates.get(annotation.id);
                    if (!nextPosition) return annotation;
                    return {
                        ...annotation,
                        x: nextPosition.x,
                        y: nextPosition.y,
                        updatedAt: now,
                    };
                })
            );
        }

        setSelectedCanvasItemKeys(itemsToPlace.map((item) => item.key));
    };

    const handleFileDragStart = (event: React.DragEvent<HTMLElement>, file: WorkspaceFile) => {
        const selectedIds = Array.from(
            new Set(selectedSidebarFileIds.map((fileId) => String(fileId || "").trim()).filter(Boolean))
        );
        const useSelectedBundle = selectedIds.length > 1 && selectedIds.includes(file.id);
        const draggedFileIds = useSelectedBundle
            ? selectedIds.filter((selectedId) => currentFiles.some((item) => item.id === selectedId))
            : [file.id];

        trackMyTeamAction("myteam.drag_file", {
            fileId: file.id,
            bundleCount: draggedFileIds.length,
        });
        event.dataTransfer.setData("application/x-onbure-file-id", file.id);
        event.dataTransfer.setData("application/x-onbure-file-ids", JSON.stringify(draggedFileIds));
        event.dataTransfer.setData("text/plain", file.title);
        event.dataTransfer.effectAllowed = "move";
        setDraggingSidebarFileId(file.id);
        setHoveredFolderId(null);
    };

    const handleFileDragEnd = () => {
        setDraggingSidebarFileId(null);
        setHoveredFolderId(null);
    };

    const handleFilesRootDragOver = (event: React.DragEvent<HTMLElement>) => {
        if (!event.dataTransfer.types.includes("application/x-onbure-file-id")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setHoveredFolderId(null);
    };

    const handleFilesRootDrop = async (event: React.DragEvent<HTMLElement>) => {
        const fileId = event.dataTransfer.getData("application/x-onbure-file-id");
        if (!fileId) {
            setHoveredFolderId(null);
            setDraggingSidebarFileId(null);
            return;
        }
        event.preventDefault();
        setHoveredFolderId(null);
        setDraggingSidebarFileId(null);

        const targetFile = currentFiles.find((file) => file.id === fileId);
        if (!targetFile || isFolderEntry(targetFile)) return;

        const currentFolderId = String(targetFile.folderId || "").trim();
        if (!currentFolderId) return;

        await moveFileIntoFolder(fileId, null);
    };

    const handleFolderDragOver = (event: React.DragEvent<HTMLElement>, folderId: string) => {
        if (!event.dataTransfer.types.includes("application/x-onbure-file-id")) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        if (hoveredFolderId !== folderId) {
            setHoveredFolderId(folderId);
        }
    };

    const handleFolderDrop = async (event: React.DragEvent<HTMLElement>, folderId: string) => {
        const fileId = event.dataTransfer.getData("application/x-onbure-file-id");
        if (!fileId) {
            setHoveredFolderId(null);
            setDraggingSidebarFileId(null);
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        setHoveredFolderId(null);
        setDraggingSidebarFileId(null);

        if (!folderId || fileId === folderId) return;
        const targetFile = currentFiles.find((file) => file.id === fileId);
        if (!targetFile || isFolderEntry(targetFile)) return;

        const currentFolderId = String(targetFile.folderId || "").trim();
        if (currentFolderId === folderId) return;

        await moveFileIntoFolder(fileId, folderId);
    };

    const handleMemberDragStart = (event: React.DragEvent<HTMLElement>, member: WorkspaceMember) => {
        trackMyTeamAction("myteam.drag_member", { memberUserId: member.userId });
        event.dataTransfer.setData("application/x-onbure-member-id", member.id);
        event.dataTransfer.setData("text/plain", member.username || member.userId);
        event.dataTransfer.effectAllowed = "move";
    };

    const handleCanvasDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();

        const groupId = parseDraggedGroupIdFromTransfer(event);
        if (groupId) {
            setDraggingSidebarGroupId(null);
            setWorkspaceActionPendingCount((prev) => prev + 1);
            try {
                await placeGroupItemsOnCanvas(groupId, event.clientX, event.clientY);
            } finally {
                setWorkspaceActionPendingCount((prev) => (prev > 0 ? prev - 1 : 0));
            }
            return;
        }
        const groupEntryPrimary = String(
            event.dataTransfer.getData("application/x-onbure-group-entry-reorder") || ""
        ).trim();
        const groupEntryLegacy = String(event.dataTransfer.getData("text/plain") || "").trim();
        const isFromGroupEntryDrag =
            Boolean(groupEntryPrimary) ||
            groupEntryLegacy.startsWith("__onbure_group_entry_reorder__=");

        const memberId = event.dataTransfer.getData("application/x-onbure-member-id");
        if (memberId) {
            const member = members.find((item) => item.id === memberId);
            if (!member) return;
            const memberWidth = getMemberCardWidth(member.username || member.userId);
            const requestedPlacementId = String(
                event.dataTransfer.getData("application/x-onbure-member-placement-id") || ""
            ).trim();
            const memberPlacementId =
                !isFromGroupEntryDrag &&
                    requestedPlacementId &&
                    extractCanvasPlacementSourceId(requestedPlacementId) === memberId
                    ? requestedPlacementId
                    : createCanvasPlacementId(memberId);

            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const rawX = event.clientX - rect.left - memberWidth / 2;
            const rawY = event.clientY - rect.top - CANVAS_MEMBER_HEIGHT / 2;
            const position = clampToCanvas(
                { x: rawX, y: rawY },
                rect.width,
                rect.height,
                memberWidth,
                CANVAS_MEMBER_HEIGHT
            );

            setCanvasMemberPositions((prev) => ({
                ...prev,
                [memberPlacementId]: position,
            }));
            const viewerUserIdForPlacement = String(data?.viewerUserId || "").trim();
            if (viewerUserIdForPlacement) {
                setCanvasMemberPlacementOwners((prev) => {
                    if (prev[memberPlacementId] === viewerUserIdForPlacement) return prev;
                    return {
                        ...prev,
                        [memberPlacementId]: viewerUserIdForPlacement,
                    };
                });
            }
            setHiddenCanvasItemKeys((prev) =>
                prev.filter((itemKey) => itemKey !== buildCanvasItemKey("member", memberPlacementId))
            );
            return;
        }

        const annotationId = String(event.dataTransfer.getData("application/x-onbure-annotation-id") || "").trim();
        if (annotationId) {
            const targetAnnotation = annotations.find((annotation) => annotation.id === annotationId);
            if (!targetAnnotation) return;

            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const rawX = event.clientX - rect.left - targetAnnotation.width / 2;
            const rawY = event.clientY - rect.top - targetAnnotation.height / 2;
            const position = clampToCanvas(
                { x: rawX, y: rawY },
                rect.width,
                rect.height,
                targetAnnotation.width,
                targetAnnotation.height
            );
            const now = new Date().toISOString();
            setAnnotations((prev) =>
                prev.map((annotation) =>
                    annotation.id === annotationId
                        ? { ...annotation, x: position.x, y: position.y, updatedAt: now }
                        : annotation
                )
            );
            setHiddenCanvasItemKeys((prev) =>
                prev.filter((itemKey) => itemKey !== buildCanvasItemKey("annotation", annotationId))
            );
            return;
        }

        const hasFilePayload =
            event.dataTransfer.types.includes("application/x-onbure-file-id") ||
            event.dataTransfer.types.includes("application/x-onbure-file-ids");
        if (!hasFilePayload) return;

        setWorkspaceActionPendingCount((prev) => prev + 1);
        try {
            const rawDraggedSidebarFileIds = parseDraggedSidebarFileIdsFromTransfer(event);
            const draggedSidebarRootIds = Array.from(
                new Set(rawDraggedSidebarFileIds.map((id) => String(id || "").trim()).filter(Boolean))
            );
            const sourceIdsForTeamShare =
                workspaceMode === "team"
                    ? expandFolderBundleSourceIds(draggedSidebarRootIds)
                    : draggedSidebarRootIds;

            const resolvedEntries = await Promise.all(
                sourceIdsForTeamShare.map(async (sourceFileId) => {
                    const resolvedFile = await resolveCanvasDropFile(sourceFileId);
                    if (!resolvedFile) return null;
                    return { sourceFileId, resolvedFile };
                })
            );
            const resolvedBySourceId = new Map<string, WorkspaceFile>();
            for (const entry of resolvedEntries) {
                if (!entry) continue;
                resolvedBySourceId.set(entry.sourceFileId, entry.resolvedFile);
            }

            if (workspaceMode === "team" && resolvedBySourceId.size > 0) {
                const sourceIdSet = new Set(sourceIdsForTeamShare);
                await Promise.all(
                    sourceIdsForTeamShare.map(async (sourceFileId) => {
                        const sourceFile = fileByIdMap.get(sourceFileId);
                        if (!sourceFile) return;
                        const sourceFolderId = String(sourceFile.folderId || "").trim();
                        if (!sourceFolderId || !sourceIdSet.has(sourceFolderId)) return;

                        const teamChildFile = resolvedBySourceId.get(sourceFileId);
                        const teamFolderFile = resolvedBySourceId.get(sourceFolderId);
                        if (!teamChildFile || !teamFolderFile || teamChildFile.id === teamFolderFile.id) return;

                        await moveFileIntoFolder(teamChildFile.id, teamFolderFile.id, {
                            scope: "team",
                            suppressNotice: true,
                        });
                    })
                );

                const nestedTeamFileIds = sourceIdsForTeamShare
                    .filter((sourceFileId) => {
                        const sourceFile = fileByIdMap.get(sourceFileId);
                        const sourceFolderId = String(sourceFile?.folderId || "").trim();
                        return Boolean(sourceFolderId && sourceIdSet.has(sourceFolderId));
                    })
                    .map((sourceFileId) => String(resolvedBySourceId.get(sourceFileId)?.id || "").trim())
                    .filter(Boolean);

                if (nestedTeamFileIds.length > 0) {
                    const nestedTeamFileIdSet = new Set(nestedTeamFileIds);
                    setCanvasFilePositions((prev) => {
                        let changed = false;
                        const next: Record<string, CanvasPosition> = {};
                        for (const [placementId, position] of Object.entries(prev)) {
                            const sourceId = extractCanvasPlacementSourceId(placementId);
                            if (nestedTeamFileIdSet.has(sourceId)) {
                                changed = true;
                                continue;
                            }
                            next[placementId] = position;
                        }
                        return changed ? next : prev;
                    });
                    setHiddenCanvasItemKeys((prev) =>
                        Array.from(
                            new Set([
                                ...prev,
                                ...nestedTeamFileIds.map((teamFileId) => buildCanvasItemKey("file", teamFileId)),
                            ])
                        )
                    );
                }
            }

            const resolvedDraggedFiles = draggedSidebarRootIds
                .map((sourceFileId) => resolvedBySourceId.get(sourceFileId))
                .filter(Boolean) as WorkspaceFile[];
            const draggedFileIds = Array.from(new Set(resolvedDraggedFiles.map((file) => file.id)));
            if (draggedFileIds.length > 1) {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const rect = canvas.getBoundingClientRect();
                const centerX = event.clientX - rect.left;
                const centerY = event.clientY - rect.top;
                const count = draggedFileIds.length;
                const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(count))));
                const rows = Math.max(1, Math.ceil(count / cols));
                const gapX = CANVAS_FILE_WIDTH + 20;
                const gapY = CANVAS_FILE_HEIGHT + 18;
                const fileUpdates: Record<string, CanvasPosition> = {};
                const createdItemKeys: string[] = [];

                draggedFileIds.forEach((sourceFileId, index) => {
                    const col = index % cols;
                    const row = Math.floor(index / cols);
                    const x =
                        centerX + (col - (cols - 1) / 2) * gapX - CANVAS_FILE_WIDTH / 2;
                    const y =
                        centerY + (row - (rows - 1) / 2) * gapY - CANVAS_FILE_HEIGHT / 2;
                    const placementId = createCanvasPlacementId(sourceFileId);
                    fileUpdates[placementId] = clampToCanvas({ x, y }, rect.width, rect.height);
                    createdItemKeys.push(buildCanvasItemKey("file", placementId));
                });

                setCanvasFilePositions((prev) => ({ ...prev, ...fileUpdates }));
                if (createdItemKeys.length > 0) {
                    const visibleSet = new Set(createdItemKeys);
                    setHiddenCanvasItemKeys((prev) => prev.filter((itemKey) => !visibleSet.has(itemKey)));
                    setSelectedCanvasItemKeys(createdItemKeys);
                }
                return;
            }

            const rawSingleFileId = String(event.dataTransfer.getData("application/x-onbure-file-id") || "").trim();
            let fileId = draggedFileIds[0] || "";
            if (!fileId && rawSingleFileId) {
                const resolvedSingleFile =
                    resolvedBySourceId.get(rawSingleFileId) || (await resolveCanvasDropFile(rawSingleFileId));
                fileId = resolvedSingleFile?.id || (canvasFileByIdMap.has(rawSingleFileId) ? rawSingleFileId : "");
            }
            if (!fileId) return;
            if (workspaceMode !== "team" && !canvasFileByIdMap.has(fileId)) return;
            const requestedPlacementId = String(
                event.dataTransfer.getData("application/x-onbure-file-placement-id") || ""
            ).trim();
            const filePlacementId =
                !isFromGroupEntryDrag &&
                    requestedPlacementId &&
                    extractCanvasPlacementSourceId(requestedPlacementId) === fileId
                    ? requestedPlacementId
                    : createCanvasPlacementId(fileId);

            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const rawX = event.clientX - rect.left - CANVAS_FILE_WIDTH / 2;
            const rawY = event.clientY - rect.top - CANVAS_FILE_HEIGHT / 2;
            const position = clampToCanvas({ x: rawX, y: rawY }, rect.width, rect.height);

            setCanvasFilePositions((prev) => ({
                ...prev,
                [filePlacementId]: position,
            }));
            setHiddenCanvasItemKeys((prev) =>
                prev.filter(
                    (itemKey) =>
                        itemKey !== buildCanvasItemKey("file", filePlacementId) &&
                        itemKey !== buildCanvasItemKey("file", fileId)
                )
            );
        } finally {
            setWorkspaceActionPendingCount((prev) => (prev > 0 ? prev - 1 : 0));
        }
    };

    const handleCanvasDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    };

    const handlePlacedFilePointerDown = (
        event: React.PointerEvent<HTMLElement>,
        fileId: string,
        position: CanvasPosition
    ) => {
        if (event.button !== 0) return;
        if (!canViewerRemoveFileFromWorkspace(fileId)) return;
        const key = buildCanvasItemKey("file", fileId);
        if (beginSelectedItemsDrag(event, key)) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        setMovingFile({
            fileId,
            offsetX: event.clientX - rect.left - position.x,
            offsetY: event.clientY - rect.top - position.y,
        });
    };

    const handlePlacedMemberPointerDown = (
        event: React.PointerEvent<HTMLElement>,
        memberId: string,
        position: CanvasPosition
    ) => {
        if (event.button !== 0) return;
        if (!canViewerModifyMemberPlacement(memberId)) return;
        const key = buildCanvasItemKey("member", memberId);
        if (beginSelectedItemsDrag(event, key)) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        setMovingMember({
            memberId,
            offsetX: event.clientX - rect.left - position.x,
            offsetY: event.clientY - rect.top - position.y,
        });
    };

    const handlePlacedAnnotationPointerDown = (
        event: React.PointerEvent<HTMLElement>,
        annotationId: string,
        position: CanvasPosition
    ) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        const key = buildCanvasItemKey("annotation", annotationId);
        if (beginSelectedItemsDrag(event, key)) {
            annotationPointerRef.current = {
                id: annotationId,
                startX: event.clientX,
                startY: event.clientY,
                moved: false,
            };
            return;
        }
        const canvas = canvasRef.current;
        if (!canvas) return;

        const annotationElement = (event.target as HTMLElement | null)?.closest(
            "[data-workspace-annotation='true']"
        ) as HTMLElement | null;
        const measuredRect = annotationElement?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
        const rect = canvas.getBoundingClientRect();
        annotationPointerRef.current = {
            id: annotationId,
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
        };

        setMovingAnnotation({
            annotationId,
            offsetX: event.clientX - rect.left - position.x,
            offsetY: event.clientY - rect.top - position.y,
            width: Math.max(CANVAS_ANNOTATION_SIZE, Math.round(measuredRect.width)),
            height: Math.max(CANVAS_ANNOTATION_SIZE, Math.round(measuredRect.height)),
        });
    };

    const handlePlacedAnnotationResizePointerDown = (
        event: React.PointerEvent<HTMLElement>,
        annotation: WorkspaceAnnotation
    ) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();

        setResizingAnnotation({
            annotationId: annotation.id,
            startWidth: annotation.width,
            startHeight: annotation.height,
            startClientX: event.clientX,
            startClientY: event.clientY,
            originX: annotation.x,
            originY: annotation.y,
        });
    };

    const removeItemCommentsForKeys = (itemKeys: string[]) => {
        const normalizedKeys = new Set(
            itemKeys
                .map((itemKey) => String(itemKey || "").trim())
                .filter((itemKey) => Boolean(parseCanvasItemKey(itemKey)))
        );
        if (normalizedKeys.size === 0) return;
        setItemComments((prev) =>
            prev.filter((comment) => !normalizedKeys.has(String(comment.itemKey || "").trim()))
        );
        setActiveItemCommentKey((prev) => (prev && normalizedKeys.has(prev) ? null : prev));
        setItemCommentDraft((prev) => (activeItemCommentKey && normalizedKeys.has(activeItemCommentKey) ? "" : prev));
    };

    const canAddCommentToItem = (itemKey: string) => {
        const normalizedKey = String(itemKey || "").trim();
        const parsed = parseCanvasItemKey(normalizedKey);
        if (!parsed) return false;
        if (parsed.kind !== "annotation") return true;
        const annotationId = extractCanvasPlacementSourceId(parsed.id);
        const targetAnnotation = annotations.find(
            (item) => item.id === parsed.id || item.id === annotationId
        );
        return Boolean(targetAnnotation && targetAnnotation.kind !== "comment");
    };

    const openItemCommentComposer = (itemKey: string) => {
        const normalizedKey = String(itemKey || "").trim();
        if (!parseCanvasItemKey(normalizedKey)) return;
        if (!canAddCommentToItem(normalizedKey)) return;
        setActiveItemCommentKey(normalizedKey);
        setItemCommentDraft("");
        setCommentWindowPosition(null);
    };

    const closeItemCommentComposer = () => {
        setActiveItemCommentKey(null);
        setItemCommentDraft("");
    };

    const submitItemComment = (itemKey: string) => {
        const normalizedKey = String(itemKey || "").trim();
        if (!parseCanvasItemKey(normalizedKey)) return;
        if (!canAddCommentToItem(normalizedKey)) return;
        const nextText = String(itemCommentDraft || "").trim().slice(0, 1000);
        if (!nextText) return;

        const authorUserId = String(data?.viewerUserId || "").trim();
        const authorName =
            members.find((member) => member.userId === authorUserId)?.username ||
            authorUserId ||
            t("workspace.unknown");
        const id =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const now = new Date().toISOString();
        const created: WorkspaceItemComment = {
            id,
            itemKey: normalizedKey,
            authorUserId,
            authorName,
            text: nextText,
            createdAt: now,
        };

        setItemComments((prev) => [...prev, created]);
        setItemCommentDraft("");
    };

    const handleRemovePlacedMember = (
        memberPlacementId: string,
        options?: { removeFromGroups?: boolean; bypassPermissionCheck?: boolean }
    ) => {
        const normalizedPlacementId = String(memberPlacementId || "").trim();
        if (!normalizedPlacementId) return;
        const sourceId = extractCanvasPlacementSourceId(normalizedPlacementId);
        if (!options?.bypassPermissionCheck && !canViewerModifyMemberPlacement(sourceId)) {
            setNotice({
                open: true,
                title: t("workspace.notice.deleteFailedTitle"),
                message: t("workspace.error.accessDenied"),
            });
            return;
        }
        const removeBySourceId = sourceId === normalizedPlacementId;
        const shouldRemoveFromGroups = options?.removeFromGroups ?? removeBySourceId;
        const candidatePlacementIds = removeBySourceId
            ? Object.keys(canvasMemberPositions).filter(
                (placementId) => extractCanvasPlacementSourceId(placementId) === sourceId
            )
            : [normalizedPlacementId];

        const groupedMemberItemKeysBySource = removeBySourceId
            ? workspaceGroups.flatMap((group) =>
                group.itemKeys.filter((itemKey) => {
                    const parsed = parseCanvasItemKey(itemKey);
                    return (
                        parsed !== null &&
                        parsed.kind === "member" &&
                        extractCanvasPlacementSourceId(parsed.id) === sourceId
                    );
                })
            )
            : [];

        const itemKeysToRemove = Array.from(
            new Set([
                ...candidatePlacementIds.map((placementId) => buildCanvasItemKey("member", placementId)),
                ...groupedMemberItemKeysBySource,
            ])
        );

        setCanvasMemberPositions((prev) => {
            if (removeBySourceId) {
                let changed = false;
                const next: Record<string, CanvasPosition> = {};
                for (const [placementId, position] of Object.entries(prev)) {
                    if (extractCanvasPlacementSourceId(placementId) === sourceId) {
                        changed = true;
                        continue;
                    }
                    next[placementId] = position;
                }
                return changed ? next : prev;
            }
            if (!prev[normalizedPlacementId]) return prev;
            const next = { ...prev };
            delete next[normalizedPlacementId];
            return next;
        });
        setCanvasMemberPlacementOwners((prev) => {
            let changed = false;
            const next: Record<string, string> = {};
            for (const [placementId, ownerUserId] of Object.entries(prev)) {
                if (extractCanvasPlacementSourceId(placementId) === sourceId) {
                    changed = true;
                    continue;
                }
                next[placementId] = ownerUserId;
            }
            return changed ? next : prev;
        });

        if (itemKeysToRemove.length > 0) {
            removeItemCommentsForKeys(itemKeysToRemove);
        }

        if (shouldRemoveFromGroups && itemKeysToRemove.length > 0) {
            removeItemKeysFromAllGroups(itemKeysToRemove);
        }
    };

    const handleRemovePlacedFile = (
        filePlacementOrSourceId: string,
        options?: { removeFromGroups?: boolean; bypassPermissionCheck?: boolean }
    ) => {
        const normalized = String(filePlacementOrSourceId || "").trim();
        if (!normalized) return;
        const sourceId = extractCanvasPlacementSourceId(normalized);
        if (!options?.bypassPermissionCheck && !canViewerRemoveFileFromWorkspace(sourceId)) {
            setNotice({
                open: true,
                title: t("workspace.notice.deleteFailedTitle"),
                message: t("workspace.error.accessDenied"),
            });
            return;
        }
        const removeBySourceId = sourceId === normalized;
        const shouldRemoveFromGroups = options?.removeFromGroups ?? removeBySourceId;
        const candidatePlacementIds = removeBySourceId
            ? Object.keys(canvasFilePositions).filter(
                (placementId) => extractCanvasPlacementSourceId(placementId) === sourceId
            )
            : [normalized];

        const groupedFileItemKeysBySource = removeBySourceId
            ? workspaceGroups.flatMap((group) =>
                group.itemKeys.filter((itemKey) => {
                    const parsed = parseCanvasItemKey(itemKey);
                    return (
                        parsed !== null &&
                        parsed.kind === "file" &&
                        extractCanvasPlacementSourceId(parsed.id) === sourceId
                    );
                })
            )
            : [];

        const itemKeysToRemove = Array.from(
            new Set([
                ...candidatePlacementIds.map((placementId) => buildCanvasItemKey("file", placementId)),
                ...groupedFileItemKeysBySource,
                buildCanvasItemKey("file", sourceId),
            ])
        );

        if (itemKeysToRemove.length > 0) {
            removeItemCommentsForKeys(itemKeysToRemove);
        }

        if (shouldRemoveFromGroups && itemKeysToRemove.length > 0) {
            removeItemKeysFromAllGroups(itemKeysToRemove);
        }

        setHiddenCanvasItemKeys((prev) => Array.from(new Set([...prev, ...itemKeysToRemove])));

        setCanvasFilePositions((prev) => {
            if (removeBySourceId) {
                let changed = false;
                const next: Record<string, CanvasPosition> = {};
                for (const [placementId, position] of Object.entries(prev)) {
                    if (extractCanvasPlacementSourceId(placementId) === sourceId) {
                        changed = true;
                        continue;
                    }
                    next[placementId] = position;
                }
                return changed ? next : prev;
            }
            if (!prev[normalized]) return prev;
            const next = { ...prev };
            delete next[normalized];
            return next;
        });
    };

    const openMemberProfile = (memberUserId: string) => {
        if (!memberUserId) return;
        if (data?.viewerUserId && memberUserId === data.viewerUserId) {
            router.push("/profile");
            return;
        }
        router.push(`/people/${encodeURIComponent(memberUserId)}`);
    };

    const openMemberChat = (member: WorkspaceMember) => {
        if (!member.userId) return;
        if (data?.viewerUserId && member.userId === data.viewerUserId) return;
        if (typeof window === "undefined") return;
        trackMyTeamAction("myteam.member_click", { memberUserId: member.userId, action: "chat" });

        window.dispatchEvent(
            new CustomEvent("onbure-open-chat-dm", {
                detail: {
                    userId: member.userId,
                    username: member.username || member.userId,
                },
            })
        );
    };

    const beginSelectedItemsDrag = (
        event: React.PointerEvent<HTMLElement>,
        anchorKey: string
    ) => {
        if (!selectedCanvasItemKeySet.has(anchorKey)) return false;
        if (!canViewerMoveCanvasItem(anchorKey)) return false;

        const selectedKeys = Array.from(
            new Set(
                selectedCanvasItemKeys.filter((itemKey) => selectableCanvasItemMap.has(itemKey))
            )
        );
        const movableSelectedKeys = selectedKeys.filter((itemKey) => canViewerMoveCanvasItem(itemKey));
        if (movableSelectedKeys.length < 2) return false;

        const anchorItem = selectableCanvasItemMap.get(anchorKey);
        if (!anchorItem) return false;

        const canvas = canvasRef.current;
        if (!canvas) return false;
        const rect = canvas.getBoundingClientRect();

        const items = movableSelectedKeys
            .map((itemKey) => selectableCanvasItemMap.get(itemKey))
            .filter(Boolean)
            .map((item) => {
                const parsedKey = parseCanvasItemKey(item!.key);
                return {
                    key: item!.key,
                    kind: item!.kind,
                    id: parsedKey?.id || item!.id,
                    startX: item!.bounds.x,
                    startY: item!.bounds.y,
                    width: item!.bounds.width,
                    height: item!.bounds.height,
                };
            }) as MovingSelectionItemState[];

        if (items.length < 2) return false;

        setMovingFile(null);
        setMovingMember(null);
        setMovingAnnotation(null);
        setMovingSelection({
            anchorKey,
            pointerOffsetX: event.clientX - rect.left - anchorItem.bounds.x,
            pointerOffsetY: event.clientY - rect.top - anchorItem.bounds.y,
            items,
        });
        return true;
    };

    const beginGroupDragFromLabel = (
        event: React.PointerEvent<HTMLElement>,
        groupId: string
    ) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();

        const targetGroup = resolvedWorkspaceGroups.find((group) => group.id === groupId);
        if (!targetGroup || targetGroup.items.length === 0) return;
        const canvasItems = targetGroup.items
            .filter((item) => selectableCanvasItemMap.has(item.key))
            .filter((item) => canViewerMoveCanvasItem(item.key));
        if (canvasItems.length === 0) return;
        trackMyTeamAction("myteam.drag_group", { groupId, source: "canvas_outline" });

        const anchorItem = canvasItems[0];
        if (!anchorItem) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();

        const items = canvasItems.map((item) => {
            const parsedKey = parseCanvasItemKey(item.key);
            return {
                key: item.key,
                kind: item.kind,
                id: parsedKey?.id || item.id,
                startX: item.bounds.x,
                startY: item.bounds.y,
                width: item.bounds.width,
                height: item.bounds.height,
            };
        }) as MovingSelectionItemState[];

        if (items.length === 0) return;

        setSelectedCanvasItemKeys(items.map((item) => item.key));
        setMovingFile(null);
        setMovingMember(null);
        setMovingAnnotation(null);
        setMovingSelection({
            anchorKey: anchorItem.key,
            pointerOffsetX: event.clientX - rect.left - anchorItem.bounds.x,
            pointerOffsetY: event.clientY - rect.top - anchorItem.bounds.y,
            items,
        });
    };

    const createNewGroupName = () => {
        const usedNames = new Set(
            workspaceGroups.map((group) =>
                String(group.name || "")
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, "")
            )
        );
        let index = 1;
        while (usedNames.has(`group${index}`)) {
            index += 1;
        }
        return `Group${index}`;
    };

    const createWorkspaceGroup = (itemKeys: string[] = []) => {
        const normalizedKeys = Array.from(
            new Set(itemKeys.filter((itemKey) => selectableCanvasItemMap.has(itemKey)))
        );

        const id =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const createdAt = new Date().toISOString();
        const createdGroup: WorkspaceGroup = {
            id,
            name: createNewGroupName(),
            itemKeys: normalizedKeys,
            createdAt,
        };

        if (normalizedKeys.length > 0) {
            const selectedSet = new Set(normalizedKeys);
            setWorkspaceGroups((prev) => {
                const next = prev.map((group) => {
                    const filtered = group.itemKeys.filter((itemKey) => !selectedSet.has(itemKey));
                    return filtered.length === group.itemKeys.length
                        ? group
                        : { ...group, itemKeys: filtered };
                });
                next.push(createdGroup);
                return next;
            });
        } else {
            setWorkspaceGroups((prev) => [...prev, createdGroup]);
        }

        setClosedGroups((prev) => ({ ...prev, [id]: false }));
        return createdGroup.id;
    };

    const openWorkspaceCanvasMenuAt = (
        clientX: number,
        clientY: number,
        canvasX: number,
        canvasY: number,
        mode: "default" | "groupOnly" = "default"
    ) => {
        const canCreateAnnotation = mode !== "groupOnly";
        const canCreateGroup = workspaceMode === "my" && selectedCanvasItemKeys.length > 0;
        const canMoveToGroup = selectedCanvasItemKeys.length > 0;
        const canRemoveFromWorkspace = selectedCanvasItemKeys.length > 0;
        if (!canCreateAnnotation && !canCreateGroup && !canMoveToGroup && !canRemoveFromWorkspace) return;

        const menuWidth = 186;
        const moveSubmenuWidth = 188;
        const menuRowHeight = 40;
        const menuHeight =
            (canCreateGroup ? menuRowHeight : 0) +
            (canMoveToGroup ? menuRowHeight : 0) +
            (canCreateAnnotation ? menuRowHeight : 0) +
            (canRemoveFromWorkspace ? menuRowHeight : 0);
        const gap = 8;
        const x = Math.min(Math.max(clientX, gap), window.innerWidth - menuWidth - gap);
        const y = Math.min(Math.max(clientY, gap), window.innerHeight - menuHeight - gap);
        const moveSubmenuLeft =
            canMoveToGroup && x + menuWidth + moveSubmenuWidth + gap > window.innerWidth;

        setProfileMenu(null);
        setCanvasMenu(null);
        setFileItemMenu(null);
        setCanvasFileItemMenu(null);
        setAnnotationItemMenu(null);
        setGroupMenu(null);
        setGroupEntryMenu(null);
        setWorkspaceCanvasMenu({ x, y, canvasX, canvasY, mode, moveSubmenuLeft });
    };

    const createGroupFromSelectedCanvasItems = () => {
        const selectedKeys = Array.from(
            new Set(selectedCanvasItemKeys.filter((itemKey) => selectableCanvasItemMap.has(itemKey)))
        );
        if (selectedKeys.length === 0) {
            setWorkspaceCanvasMenu(null);
            return;
        }
        trackMyTeamAction("myteam.create_group", { source: "canvas_context", itemCount: selectedKeys.length });
        createWorkspaceGroup(selectedKeys);
        setWorkspaceCanvasMenu(null);
    };

    const moveSelectedCanvasItemsToGroupFromMenu = (groupId: string) => {
        if (!workspaceCanvasMenu) return;
        const selectedKeys = Array.from(
            new Set(selectedCanvasItemKeys.filter((itemKey) => selectableCanvasItemMap.has(itemKey)))
        );
        if (selectedKeys.length === 0) {
            setWorkspaceCanvasMenu(null);
            return;
        }

        const origin = { x: workspaceCanvasMenu.x + 84, y: workspaceCanvasMenu.y + 16 };
        setWorkspaceCanvasMenu(null);
        moveCanvasItemKeysToGroupFromMenu(selectedKeys, groupId, origin);
    };

    const removeSelectedCanvasItemsFromWorkspace = () => {
        const selectedKeys = Array.from(
            new Set(selectedCanvasItemKeys.filter((itemKey) => selectableCanvasItemMap.has(itemKey)))
        );
        if (selectedKeys.length === 0) {
            setWorkspaceCanvasMenu(null);
            return;
        }

        const filePlacementIds = new Set<string>();
        const memberPlacementIds = new Set<string>();
        const annotationIds = new Set<string>();
        const groupedAnnotationItemKeysToHide = new Set<string>();
        let blockedFileCount = 0;
        let blockedMemberCount = 0;

        for (const itemKey of selectedKeys) {
            const parsed = parseCanvasItemKey(itemKey);
            if (!parsed) continue;
            if (parsed.kind === "file") {
                if (!canViewerRemoveFileFromWorkspace(parsed.id)) {
                    blockedFileCount += 1;
                    continue;
                }
                filePlacementIds.add(parsed.id);
                continue;
            }
            if (parsed.kind === "member") {
                if (!canViewerModifyMemberPlacement(parsed.id)) {
                    blockedMemberCount += 1;
                    continue;
                }
                memberPlacementIds.add(parsed.id);
                continue;
            }
            if (parsed.kind === "annotation") {
                if (groupedItemKeySet.has(itemKey)) {
                    groupedAnnotationItemKeysToHide.add(itemKey);
                } else {
                    annotationIds.add(parsed.id);
                }
            }
        }

        const hasRemovableItem =
            filePlacementIds.size > 0 ||
            memberPlacementIds.size > 0 ||
            annotationIds.size > 0 ||
            groupedAnnotationItemKeysToHide.size > 0;
        if (!hasRemovableItem) {
            if (blockedFileCount > 0 || blockedMemberCount > 0) {
                setNotice({
                    open: true,
                    title: t("workspace.notice.deleteFailedTitle"),
                    message: t("workspace.error.accessDenied"),
                });
            }
            setWorkspaceCanvasMenu(null);
            return;
        }

        filePlacementIds.forEach((placementId) =>
            handleRemovePlacedFile(placementId, { bypassPermissionCheck: true })
        );
        memberPlacementIds.forEach((placementId) =>
            handleRemovePlacedMember(placementId, { bypassPermissionCheck: true })
        );
        if (groupedAnnotationItemKeysToHide.size > 0) {
            const keys = Array.from(groupedAnnotationItemKeysToHide);
            setHiddenCanvasItemKeys((prev) => Array.from(new Set([...prev, ...keys])));
        }
        annotationIds.forEach((annotationId) => removeAnnotationFromWorkspace(annotationId));
        if (blockedFileCount > 0 || blockedMemberCount > 0) {
            setNotice({
                open: true,
                title: t("workspace.notice.deleteFailedTitle"),
                message: t("workspace.error.accessDenied"),
            });
        }

        setSelectedCanvasItemKeys([]);
        setWorkspaceCanvasMenu(null);
    };

    const createEmptyWorkspaceGroupFromSidebar = () => {
        trackMyTeamAction("myteam.create_group", { source: "sidebar_empty" });
        createWorkspaceGroup([]);
        setGroupMenu(null);
        setGroupEntryMenu(null);
    };

    const parseDraggedCanvasItemKeys = (event: React.DragEvent<HTMLElement>) => {
        const raw = event.dataTransfer.getData("application/x-onbure-canvas-item-keys");
        if (raw) {
            try {
                const parsed = JSON.parse(raw) as unknown;
                if (Array.isArray(parsed)) {
                    return Array.from(
                        new Set(
                            parsed
                                .map((value) => String(value || "").trim())
                                .filter((value) => selectableCanvasItemMap.has(value))
                        )
                    );
                }
            } catch {
                // ignore parse error
            }
        }

        const plain = String(event.dataTransfer.getData("text/plain") || "").trim();
        const prefix = "__onbure_canvas_keys__=";
        if (plain.startsWith(prefix)) {
            const rawKeys = plain.slice(prefix.length);
            try {
                const parsed = JSON.parse(rawKeys) as unknown;
                if (Array.isArray(parsed)) {
                    return Array.from(
                        new Set(
                            parsed
                                .map((value) => String(value || "").trim())
                                .filter((value) => selectableCanvasItemMap.has(value))
                        )
                    );
                }
            } catch {
                // ignore parse error
            }
        }

        const fileId = String(event.dataTransfer.getData("application/x-onbure-file-id") || "").trim();
        const filePlacementId = String(
            event.dataTransfer.getData("application/x-onbure-file-placement-id") || ""
        ).trim();
        if (filePlacementId) {
            const fileKey = buildCanvasItemKey("file", filePlacementId);
            return selectableCanvasItemMap.has(fileKey) ? [fileKey] : [];
        }
        if (fileId) {
            const matched = selectableCanvasItems.find(
                (item) =>
                    item.kind === "file" &&
                    extractCanvasPlacementSourceId(parseCanvasItemKey(item.key)?.id || "") === fileId
            );
            return matched ? [matched.key] : [];
        }

        const memberId = String(event.dataTransfer.getData("application/x-onbure-member-id") || "").trim();
        const memberPlacementId = String(
            event.dataTransfer.getData("application/x-onbure-member-placement-id") || ""
        ).trim();
        if (memberPlacementId) {
            const memberKey = buildCanvasItemKey("member", memberPlacementId);
            return selectableCanvasItemMap.has(memberKey) ? [memberKey] : [];
        }
        if (memberId) {
            const matched = selectableCanvasItems.find(
                (item) =>
                    item.kind === "member" &&
                    extractCanvasPlacementSourceId(parseCanvasItemKey(item.key)?.id || "") === memberId
            );
            return matched ? [matched.key] : [];
        }

        const annotationId = String(event.dataTransfer.getData("application/x-onbure-annotation-id") || "").trim();
        if (annotationId) {
            const annotationKey = buildCanvasItemKey("annotation", annotationId);
            return selectableCanvasItemMap.has(annotationKey) ? [annotationKey] : [];
        }

        return [];
    };

    const moveCanvasItemsToGroup = (
        groupId: string,
        itemKeys: string[],
        options?: { skipCanvasPresenceCheck?: boolean }
    ) => {
        const normalizedKeys = Array.from(
            new Set(
                itemKeys
                    .map((itemKey) => String(itemKey || "").trim())
                    .filter((itemKey) =>
                        options?.skipCanvasPresenceCheck ? Boolean(itemKey) : selectableCanvasItemMap.has(itemKey)
                    )
            )
        );
        if (!groupId || normalizedKeys.length === 0) return;
        const selectedSet = new Set(normalizedKeys);

        // Ensure moved items are visible and the target group outline is shown on canvas.
        setHiddenCanvasGroupIds((prev) => prev.filter((id) => id !== groupId));
        setHiddenCanvasItemKeys((prev) => prev.filter((itemKey) => !selectedSet.has(itemKey)));

        setWorkspaceGroups((prev) =>
            prev.map((group) => {
                const filtered = group.itemKeys.filter((itemKey) => !selectedSet.has(itemKey));
                if (group.id !== groupId) {
                    return filtered.length === group.itemKeys.length
                        ? group
                        : { ...group, itemKeys: filtered };
                }
                const merged = [...filtered, ...normalizedKeys.filter((itemKey) => !filtered.includes(itemKey))];
                return { ...group, itemKeys: merged };
            })
        );
    };

    const triggerGroupDropAnimation = React.useCallback(
        (
            itemKeys: string[],
            groupId: string,
            options?: {
                originClientX?: number;
                originClientY?: number;
            }
        ) => {
            if (typeof window === "undefined") return;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const target = document.querySelector(`[data-group-id="${groupId}"]`) as HTMLElement | null;
            if (!target) return;

            const canvasRect = canvas.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const baseX = Math.round(targetRect.left + 14);
            const baseY = Math.round(targetRect.top + Math.max(8, Math.min(18, targetRect.height - 10)));
            const hasOrigin =
                Number.isFinite(options?.originClientX) &&
                Number.isFinite(options?.originClientY);
            const useOriginForSingle = hasOrigin && itemKeys.length === 1;

            const animations = itemKeys
                .map((itemKey, index) => {
                    const source = selectableCanvasItemMap.get(itemKey);
                    if (!source && !useOriginForSingle) return null;
                    const id =
                        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                            ? crypto.randomUUID()
                            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${index}`;

                    const kind = source?.kind || "file";
                    const fromWidth = Math.round(clampNumber(source?.bounds.width ?? 84, 42, 120));
                    const fromHeight = Math.round(clampNumber(source?.bounds.height ?? 56, 28, 72));
                    const toX = baseX + (index % 3) * 5;
                    const toY = baseY + Math.floor(index / 3) * 4;

                    let fromX = Math.round(canvasRect.left + (source?.bounds.x ?? 0));
                    let fromY = Math.round(canvasRect.top + (source?.bounds.y ?? 0));
                    if (useOriginForSingle) {
                        fromX = Math.round(Number(options?.originClientX) - fromWidth / 2);
                        fromY = Math.round(Number(options?.originClientY) - fromHeight / 2);
                        const distance = Math.hypot(toX - fromX, toY - fromY);
                        if (distance < 26) {
                            fromX += 26;
                            fromY += 14;
                        }
                    }

                    return {
                        id,
                        kind,
                        fromX,
                        fromY,
                        fromWidth,
                        fromHeight,
                        toX,
                        toY,
                        started: false,
                    } satisfies GroupDropAnimation;
                })
                .filter(Boolean) as GroupDropAnimation[];

            if (!animations.length) return;
            const ids = new Set(animations.map((item) => item.id));
            setGroupDropAnimations((prev) => [...prev, ...animations]);
            window.requestAnimationFrame(() => {
                setGroupDropAnimations((prev) =>
                    prev.map((item) => (ids.has(item.id) ? { ...item, started: true } : item))
                );
            });
            window.setTimeout(() => {
                setGroupDropAnimations((prev) => prev.filter((item) => !ids.has(item.id)));
            }, 320);
        },
        [selectableCanvasItemMap]
    );

    const moveCanvasItemKeysToGroupFromMenu = (
        itemKeys: string[],
        groupId: string,
        origin?: { x: number; y: number }
    ) => {
        const targetGroupId = String(groupId || "").trim();
        if (!targetGroupId) return;
        const normalizedKeys = Array.from(
            new Set(itemKeys.filter((itemKey) => selectableCanvasItemMap.has(itemKey)))
        );
        if (!normalizedKeys.length) return;
        if (origin) {
            triggerGroupDropAnimation(normalizedKeys, targetGroupId, {
                originClientX: origin.x,
                originClientY: origin.y,
            });
        }
        moveCanvasItemsToGroup(targetGroupId, normalizedKeys);
    };

    const openGroupsContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const menuWidth = 148;
        const menuHeight = 44;
        const gap = 8;
        const x = Math.min(Math.max(event.clientX, gap), window.innerWidth - menuWidth - gap);
        const y = Math.min(Math.max(event.clientY, gap), window.innerHeight - menuHeight - gap);
        setProfileMenu(null);
        setCanvasMenu(null);
        setFileItemMenu(null);
        setCanvasFileItemMenu(null);
        setWorkspaceCanvasMenu(null);
        setAnnotationItemMenu(null);
        setGroupEntryMenu(null);
        setGroupMenu({ x, y, source: "sidebar" });
    };

    const openGroupItemMenu = (event: React.MouseEvent, groupId: string) => {
        event.preventDefault();
        event.stopPropagation();
        const menuWidth = 156;
        const menuHeight = 86;
        const gap = 8;
        const x = Math.min(Math.max(event.clientX, gap), window.innerWidth - menuWidth - gap);
        const y = Math.min(Math.max(event.clientY, gap), window.innerHeight - menuHeight - gap);
        setProfileMenu(null);
        setCanvasMenu(null);
        setFileItemMenu(null);
        setCanvasFileItemMenu(null);
        setWorkspaceCanvasMenu(null);
        setAnnotationItemMenu(null);
        setGroupEntryMenu(null);
        setGroupMenu({ x, y, groupId, source: "sidebar" });
    };

    const openCanvasGroupItemMenu = (event: React.MouseEvent, groupId: string) => {
        event.preventDefault();
        event.stopPropagation();
        const menuWidth = 156;
        const menuHeight = 44;
        const gap = 8;
        const x = Math.min(Math.max(event.clientX, gap), window.innerWidth - menuWidth - gap);
        const y = Math.min(Math.max(event.clientY, gap), window.innerHeight - menuHeight - gap);
        setProfileMenu(null);
        setCanvasMenu(null);
        setFileItemMenu(null);
        setCanvasFileItemMenu(null);
        setWorkspaceCanvasMenu(null);
        setAnnotationItemMenu(null);
        setGroupEntryMenu(null);
        setGroupMenu({ x, y, groupId, source: "canvas" });
    };

    const startGroupInlineRenameFromMenu = () => {
        if (!groupMenu?.groupId) return;
        const targetGroupId = groupMenu.groupId;
        setGroupMenu(null);
        startGroupInlineRename(targetGroupId);
    };

    const openGroupEntryItemMenu = (event: React.MouseEvent, groupId: string, itemKey: string) => {
        event.preventDefault();
        event.stopPropagation();
        const menuWidth = 156;
        const menuHeight = 44;
        const gap = 8;
        const x = Math.min(Math.max(event.clientX, gap), window.innerWidth - menuWidth - gap);
        const y = Math.min(Math.max(event.clientY, gap), window.innerHeight - menuHeight - gap);
        setProfileMenu(null);
        setCanvasMenu(null);
        setFileItemMenu(null);
        setCanvasFileItemMenu(null);
        setWorkspaceCanvasMenu(null);
        setAnnotationItemMenu(null);
        setGroupMenu(null);
        setGroupEntryMenu({ x, y, groupId, itemKey });
    };

    const handleRemoveGroupEntryFromMenu = () => {
        if (!groupEntryMenu) return;
        const { groupId, itemKey } = groupEntryMenu;
        const isVisibleOnCanvas =
            selectableCanvasItemMap.has(itemKey) && !hiddenCanvasItemKeySet.has(itemKey);
        setGroupEntryMenu(null);
        setSelectedCanvasItemKeys((prev) => prev.filter((candidate) => candidate !== itemKey));
        if (!isVisibleOnCanvas) {
            setHiddenCanvasItemKeys((prev) => (prev.includes(itemKey) ? prev : [...prev, itemKey]));
        }
        setWorkspaceGroups((prev) =>
            prev.map((group) =>
                group.id === groupId
                    ? { ...group, itemKeys: group.itemKeys.filter((candidate) => candidate !== itemKey) }
                    : group
            )
        );
    };

    const parseGroupEntryReorderDragPayload = (
        event: Pick<React.DragEvent<HTMLElement>, "dataTransfer">
    ): GroupEntryReorderDragState | null => {
        const primary = String(
            event.dataTransfer.getData("application/x-onbure-group-entry-reorder") || ""
        ).trim();
        const legacy = String(event.dataTransfer.getData("text/plain") || "").trim();
        const prefix = "__onbure_group_entry_reorder__=";
        const raw = primary || (legacy.startsWith(prefix) ? legacy.slice(prefix.length) : "");
        if (!raw) {
            if (groupEntryReorderDrag?.groupId && groupEntryReorderDrag.itemKey) {
                return {
                    groupId: groupEntryReorderDrag.groupId,
                    itemKey: groupEntryReorderDrag.itemKey,
                };
            }
            return null;
        }

        try {
            const parsed = JSON.parse(raw) as { groupId?: string; itemKey?: string };
            const groupId = String(parsed?.groupId || "").trim();
            const itemKey = String(parsed?.itemKey || "").trim();
            if (!groupId || !itemKey) return null;
            return { groupId, itemKey };
        } catch {
            if (groupEntryReorderDrag?.groupId && groupEntryReorderDrag.itemKey) {
                return {
                    groupId: groupEntryReorderDrag.groupId,
                    itemKey: groupEntryReorderDrag.itemKey,
                };
            }
            return null;
        }
    };

    const handleGroupEntryReorderDragStart = (
        event: React.DragEvent<HTMLElement>,
        groupId: string,
        itemKey: string
    ) => {
        const payload = JSON.stringify({ groupId, itemKey });
        const parsedItemKey = parseCanvasItemKey(itemKey);
        event.stopPropagation();
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/x-onbure-group-entry-reorder", payload);
        event.dataTransfer.setData("text/plain", `__onbure_group_entry_reorder__=${payload}`);
        if (parsedItemKey?.kind === "file") {
            const sourceFileId = extractCanvasPlacementSourceId(parsedItemKey.id);
            event.dataTransfer.setData("application/x-onbure-file-id", sourceFileId);
            event.dataTransfer.setData("application/x-onbure-file-placement-id", parsedItemKey.id);
        } else if (parsedItemKey?.kind === "member") {
            const sourceMemberId = extractCanvasPlacementSourceId(parsedItemKey.id);
            event.dataTransfer.setData("application/x-onbure-member-id", sourceMemberId);
            event.dataTransfer.setData("application/x-onbure-member-placement-id", parsedItemKey.id);
        } else if (parsedItemKey?.kind === "annotation") {
            event.dataTransfer.setData("application/x-onbure-annotation-id", parsedItemKey.id);
        }
        setGroupEntryReorderDrag({ groupId, itemKey });
        setGroupEntryReorderHover(null);
    };

    const handleGroupEntryReorderDragEnd = () => {
        setGroupEntryReorderDrag(null);
        setGroupEntryReorderHover(null);
    };

    const handleGroupEntryReorderDragOver = (
        event: React.DragEvent<HTMLElement>,
        groupId: string,
        itemKey: string
    ) => {
        const payload = parseGroupEntryReorderDragPayload(event);
        if (!payload || payload.groupId !== groupId || payload.itemKey === itemKey) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";

        const rect = event.currentTarget.getBoundingClientRect();
        const y = event.clientY - rect.top;
        const position: "before" | "after" = y > rect.height / 2 ? "after" : "before";
        setGroupEntryReorderHover((prev) => {
            if (
                prev &&
                prev.groupId === groupId &&
                prev.itemKey === itemKey &&
                prev.position === position
            ) {
                return prev;
            }
            return { groupId, itemKey, position };
        });
    };

    const handleGroupEntryReorderDragLeave = (
        event: React.DragEvent<HTMLElement>,
        groupId: string,
        itemKey: string
    ) => {
        event.stopPropagation();
        const related = event.relatedTarget as Node | null;
        if (related && event.currentTarget.contains(related)) return;
        setGroupEntryReorderHover((prev) => {
            if (!prev) return prev;
            if (prev.groupId !== groupId || prev.itemKey !== itemKey) return prev;
            return null;
        });
    };

    const handleGroupEntryReorderDrop = (
        event: React.DragEvent<HTMLElement>,
        groupId: string,
        targetItemKey: string
    ) => {
        const payload = parseGroupEntryReorderDragPayload(event);
        if (!payload || payload.groupId !== groupId || payload.itemKey === targetItemKey) return;
        event.preventDefault();
        event.stopPropagation();

        const rect = event.currentTarget.getBoundingClientRect();
        const y = event.clientY - rect.top;
        const fallbackPosition: "before" | "after" = y > rect.height / 2 ? "after" : "before";
        const position =
            groupEntryReorderHover &&
                groupEntryReorderHover.groupId === groupId &&
                groupEntryReorderHover.itemKey === targetItemKey
                ? groupEntryReorderHover.position
                : fallbackPosition;

        setWorkspaceGroups((prev) =>
            prev.map((group) => {
                if (group.id !== groupId) return group;
                const nextKeys = reorderGroupItemKeys(
                    group.itemKeys,
                    payload.itemKey,
                    targetItemKey,
                    position
                );
                if (nextKeys.length === group.itemKeys.length) {
                    const sameOrder = nextKeys.every((itemKey, idx) => itemKey === group.itemKeys[idx]);
                    if (sameOrder) return group;
                }
                return { ...group, itemKeys: nextKeys };
            })
        );

        setGroupEntryReorderDrag(null);
        setGroupEntryReorderHover(null);
    };

    const removeItemKeysFromAllGroups = (itemKeys: string[]) => {
        const normalizedKeys = Array.from(
            new Set(itemKeys.map((itemKey) => String(itemKey || "").trim()).filter(Boolean))
        );
        if (normalizedKeys.length === 0) return;
        const keySet = new Set(normalizedKeys);
        setWorkspaceGroups((prev) =>
            prev.map((group) => {
                const filteredKeys = group.itemKeys.filter((itemKey) => !keySet.has(itemKey));
                return filteredKeys.length === group.itemKeys.length
                    ? group
                    : { ...group, itemKeys: filteredKeys };
            })
        );
    };

    const handleDeleteGroupFromMenu = () => {
        if (!groupMenu?.groupId) return;
        const targetGroupId = groupMenu.groupId;
        setGroupMenu(null);
        setGroupEntryMenu((prev) => (prev?.groupId === targetGroupId ? null : prev));
        setGroupEntryReorderDrag((prev) => (prev?.groupId === targetGroupId ? null : prev));
        setGroupEntryReorderHover((prev) => (prev?.groupId === targetGroupId ? null : prev));
        setWorkspaceGroups((prev) => prev.filter((group) => group.id !== targetGroupId));
        setClosedGroups((prev) => {
            if (!Object.prototype.hasOwnProperty.call(prev, targetGroupId)) return prev;
            const next = { ...prev };
            delete next[targetGroupId];
            return next;
        });
        setHoveredGroupId((prev) => (prev === targetGroupId ? null : prev));
    };

    const handleHideCanvasGroupFromMenu = () => {
        if (!groupMenu?.groupId) return;
        const targetGroupId = groupMenu.groupId;
        const targetGroup = workspaceGroups.find((group) => group.id === targetGroupId);
        const targetItemKeys = targetGroup?.itemKeys || [];
        setGroupMenu(null);

        // Hide the group from the canvas, but keep it in the sidebar.
        setHiddenCanvasGroupIds((prev) => {
            const next = prev.includes(targetGroupId) ? prev : [...prev, targetGroupId];
            if (typeof window !== "undefined" && isStorageKeyReady(activeHiddenCanvasGroupsStorageKey)) {
                window.localStorage.setItem(activeHiddenCanvasGroupsStorageKey, JSON.stringify(next));
            }
            return next;
        });

        if (targetItemKeys.length > 0) {
            const targetSet = new Set(targetItemKeys);
            setSelectedCanvasItemKeys((prev) => prev.filter((itemKey) => !targetSet.has(itemKey)));

            setHiddenCanvasItemKeys((prev) => {
                const next = Array.from(new Set([...prev, ...targetItemKeys]));
                if (typeof window !== "undefined" && isStorageKeyReady(activeHiddenCanvasItemsStorageKey)) {
                    window.localStorage.setItem(activeHiddenCanvasItemsStorageKey, JSON.stringify(next));
                }
                return next;
            });
        }
    };

    const handleGroupDragOver = (event: React.DragEvent<HTMLElement>, groupId: string) => {
        const hasDragKeys =
            event.dataTransfer.types.includes("application/x-onbure-file-id") ||
            event.dataTransfer.types.includes("application/x-onbure-member-id") ||
            event.dataTransfer.types.includes("application/x-onbure-annotation-id");
        if (!hasDragKeys) return;
        if (!event.ctrlKey) {
            if (hoveredGroupId === groupId) {
                setHoveredGroupId(null);
            }
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        if (hoveredGroupId !== groupId) {
            setHoveredGroupId(groupId);
        }
    };

    const handleGroupDragLeave = (event: React.DragEvent<HTMLElement>, groupId: string) => {
        event.stopPropagation();
        if (hoveredGroupId === groupId) {
            setHoveredGroupId(null);
        }
    };

    const handleGroupDrop = (event: React.DragEvent<HTMLElement>, groupId: string) => {
        const keys = parseDraggedCanvasItemKeys(event);
        event.preventDefault();
        event.stopPropagation();
        setHoveredGroupId(null);
        if (!event.ctrlKey) return;
        if (!keys.length) return;
        trackMyTeamAction("myteam.ctrl_drag_add_to_group", { groupId, itemCount: keys.length });
        triggerGroupDropAnimation(keys, groupId, {
            originClientX: event.clientX,
            originClientY: event.clientY,
        });
        moveCanvasItemsToGroup(groupId, keys);
    };

    const handleSidebarSelectionPointerDown = (
        section: "files" | "groups",
        event: React.PointerEvent<HTMLDivElement>
    ) => {
        if (event.button !== 0) return;
        const target = event.target as HTMLElement | null;
        if (!target) return;
        if (target.closest("[data-sidebar-select-item='true']")) return;
        if (
            target.closest(
                "button, input, textarea, a, [data-workspace-canvas-menu='true'], [data-workspace-group-menu='true'], [data-workspace-group-entry-menu='true']"
            )
        ) {
            return;
        }

        const hasOpenMenu = Boolean(
            canvasMenu ||
            groupMenu ||
            groupEntryMenu ||
            fileItemMenu ||
            canvasFileItemMenu ||
            profileMenu ||
            annotationItemMenu ||
            workspaceCanvasMenu
        );
        if (hasOpenMenu) {
            setCanvasMenu(null);
            setGroupMenu(null);
            setGroupEntryMenu(null);
            setFileItemMenu(null);
            setCanvasFileItemMenu(null);
            setProfileMenu(null);
            setAnnotationItemMenu(null);
            setWorkspaceCanvasMenu(null);
            return;
        }

        const container =
            section === "files" ? filesSidebarSelectionRef.current : groupsSidebarSelectionRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const startX = clampNumber(event.clientX - rect.left, 0, rect.width);
        const startY = clampNumber(event.clientY - rect.top, 0, rect.height);
        event.preventDefault();
        setSidebarSelection({
            section,
            startX,
            startY,
            currentX: startX,
            currentY: startY,
        });
        if (section === "files") {
            setSelectedSidebarFileIds([]);
        } else {
            setSelectedSidebarGroupItemKeys([]);
        }
    };

    const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        if (movingFile || movingMember || movingAnnotation || movingSelection || resizingAnnotation) return;
        const target = event.target as HTMLElement | null;
        if (!target) return;
        if (target.closest("[data-workspace-item='file']")) return;
        if (target.closest("[data-workspace-item='member']")) return;
        if (target.closest("[data-workspace-annotation='true']")) return;
        if (target.closest("[data-workspace-canvas-context-menu='true']")) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const startX = clampNumber(event.clientX - rect.left, 0, rect.width);
        const startY = clampNumber(event.clientY - rect.top, 0, rect.height);

        setCanvasSelection({
            startX,
            startY,
            currentX: startX,
            currentY: startY,
        });
        setSelectedCanvasItemKeys([]);
        setWorkspaceCanvasMenu(null);
    };

    const openWorkspaceCanvasContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest("[data-workspace-item='file']")) return;
        if (target?.closest("[data-workspace-item='member']")) return;
        if (target?.closest("[data-workspace-annotation='true']")) return;
        if (target?.closest("[data-workspace-group-label='true']")) return;
        if (target?.closest("[data-workspace-group-outline='true']")) return;

        event.preventDefault();
        event.stopPropagation();

        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();

        const rawX = event.clientX - rect.left - CANVAS_ANNOTATION_SIZE / 2;
        const rawY = event.clientY - rect.top - CANVAS_ANNOTATION_SIZE / 2;
        const clamped = clampToCanvas(
            { x: rawX, y: rawY },
            rect.width,
            rect.height,
            CANVAS_ANNOTATION_SIZE,
            CANVAS_ANNOTATION_SIZE
        );
        openWorkspaceCanvasMenuAt(event.clientX, event.clientY, clamped.x, clamped.y);
    };

    const openCanvasFileContextMenu = (event: React.MouseEvent, fileId: string) => {
        event.preventDefault();
        event.stopPropagation();
        if (selectedCanvasItemKeys.length > 1) {
            openGroupOnlyCanvasMenuAtPointer(event);
            return;
        }

        const sourceFileId = extractCanvasPlacementSourceId(fileId);
        const targetFile = canvasFileByIdMap.get(sourceFileId);
        const canSendFileFromMenu = Boolean(
            workspaceMode === "my" &&
            targetFile &&
            members.some((member) => member.userId !== data?.viewerUserId)
        );
        const fileItemKey = buildCanvasItemKey("file", fileId);
        const canUngroupFromMenu = groupedItemKeySet.has(fileItemKey);
        const menuWidth = 172;
        const submenuWidth = 188;
        const menuHeight = (canUngroupFromMenu ? 154 : 116) + (canSendFileFromMenu ? 34 : 0);
        const gap = 8;
        const x = Math.min(Math.max(event.clientX, gap), window.innerWidth - menuWidth - gap);
        const y = Math.min(Math.max(event.clientY, gap), window.innerHeight - menuHeight - gap);
        const shareSubmenuLeft =
            canSendFileFromMenu && x + menuWidth + submenuWidth + gap > window.innerWidth;
        setProfileMenu(null);
        setCanvasMenu(null);
        setFileItemMenu(null);
        setFileShareDrag(null);
        setWorkspaceCanvasMenu(null);
        setAnnotationItemMenu(null);
        setGroupMenu(null);
        setGroupEntryMenu(null);
        setCanvasFileItemMenu({ x, y, fileId, shareSubmenuLeft });
    };

    const openGroupOnlyCanvasMenuAtPointer = (event: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const rawX = event.clientX - rect.left - CANVAS_ANNOTATION_SIZE / 2;
        const rawY = event.clientY - rect.top - CANVAS_ANNOTATION_SIZE / 2;
        const clamped = clampToCanvas(
            { x: rawX, y: rawY },
            rect.width,
            rect.height,
            CANVAS_ANNOTATION_SIZE,
            CANVAS_ANNOTATION_SIZE
        );
        openWorkspaceCanvasMenuAt(event.clientX, event.clientY, clamped.x, clamped.y, "groupOnly");
    };

    const openAnnotationItemMenu = (event: React.MouseEvent, annotationId: string) => {
        event.preventDefault();
        event.stopPropagation();
        if (selectedCanvasItemKeys.length > 1) {
            openGroupOnlyCanvasMenuAtPointer(event);
            return;
        }
        const annotationItemKey = buildCanvasItemKey("annotation", annotationId);
        const canUngroupFromMenu = groupedItemKeySet.has(annotationItemKey);
        const targetAnnotation = annotations.find((item) => item.id === annotationId);
        const canLeaveCommentFromMenu = Boolean(targetAnnotation && targetAnnotation.kind !== "comment");
        const menuWidth = 132;
        const menuHeight = canUngroupFromMenu
            ? canLeaveCommentFromMenu
                ? 156
                : 122
            : canLeaveCommentFromMenu
                ? 122
                : 88;
        const gap = 8;
        const x = Math.min(Math.max(event.clientX, gap), window.innerWidth - menuWidth - gap);
        const y = Math.min(Math.max(event.clientY, gap), window.innerHeight - menuHeight - gap);
        setProfileMenu(null);
        setCanvasMenu(null);
        setFileItemMenu(null);
        setCanvasFileItemMenu(null);
        setWorkspaceCanvasMenu(null);
        setGroupMenu(null);
        setGroupEntryMenu(null);
        setAnnotationItemMenu({ x, y, annotationId });
    };

    const moveCanvasFileItemToGroupFromMenu = (groupId: string) => {
        if (!canvasFileItemMenu) return;
        const fileKey = buildCanvasItemKey("file", canvasFileItemMenu.fileId);
        const origin = { x: canvasFileItemMenu.x + 76, y: canvasFileItemMenu.y + 16 };
        setCanvasFileItemMenu(null);
        moveCanvasItemKeysToGroupFromMenu([fileKey], groupId, origin);
    };

    const removeCanvasFileItemFromGroupsFromMenu = () => {
        if (!canvasFileItemMenu) return;
        const fileKey = buildCanvasItemKey("file", canvasFileItemMenu.fileId);
        setCanvasFileItemMenu(null);
        removeItemKeysFromAllGroups([fileKey]);
        setHiddenCanvasItemKeys((prev) => Array.from(new Set([...prev, fileKey])));
    };

    const removeCanvasFileItemFromWorkspaceFromMenu = () => {
        if (!canvasFileItemMenu) return;
        const filePlacementId = canvasFileItemMenu.fileId;
        if (!canViewerRemoveFileFromWorkspace(filePlacementId)) {
            setCanvasFileItemMenu(null);
            setNotice({
                open: true,
                title: t("workspace.notice.deleteFailedTitle"),
                message: t("workspace.error.accessDenied"),
            });
            return;
        }
        setCanvasFileItemMenu(null);
        handleRemovePlacedFile(filePlacementId, { bypassPermissionCheck: true });
    };

    const openCanvasFileItemCommentFromMenu = () => {
        if (!canvasFileItemMenu) return;
        const fileItemKey = buildCanvasItemKey("file", canvasFileItemMenu.fileId);
        setCanvasFileItemMenu(null);
        openItemCommentComposer(fileItemKey);
    };

    const moveAnnotationItemToGroupFromMenu = (groupId: string) => {
        if (!annotationItemMenu) return;
        const annotationKey = buildCanvasItemKey("annotation", annotationItemMenu.annotationId);
        const origin = { x: annotationItemMenu.x + 78, y: annotationItemMenu.y + 16 };
        setAnnotationItemMenu(null);
        moveCanvasItemKeysToGroupFromMenu([annotationKey], groupId, origin);
    };

    const removeAnnotationItemFromGroupsFromMenu = () => {
        if (!annotationItemMenu) return;
        const annotationKey = buildCanvasItemKey("annotation", annotationItemMenu.annotationId);
        setAnnotationItemMenu(null);
        removeItemKeysFromAllGroups([annotationKey]);
        setHiddenCanvasItemKeys((prev) => Array.from(new Set([...prev, annotationKey])));
    };

    const openAnnotationItemCommentFromMenu = () => {
        if (!annotationItemMenu) return;
        const targetAnnotation = annotations.find((item) => item.id === annotationItemMenu.annotationId);
        if (!targetAnnotation || targetAnnotation.kind === "comment") return;
        const annotationKey = buildCanvasItemKey("annotation", annotationItemMenu.annotationId);
        setAnnotationItemMenu(null);
        openItemCommentComposer(annotationKey);
    };

    const openAnnotationEditor = (annotationId: string) => {
        const target = annotations.find((item) => item.id === annotationId);
        if (!target) return;
        setAnnotationItemMenu(null);
        setEditingAnnotationTitleId(null);
        setActiveAnnotationId(target.id);
    };

    const createWorkspaceAnnotation = () => {
        if (!workspaceCanvasMenu) return;
        const kind = annotationKindForMode;
        trackMyTeamAction(kind === "memo" ? "myteam.create_memo" : "myteam.create_comment");
        const membersForAuthor = Array.isArray(data?.members) ? data.members : [];
        const authorUserId = String(data?.viewerUserId || "");
        const authorName =
            membersForAuthor.find((member) => member.userId === authorUserId)?.username ||
            authorUserId ||
            t("workspace.unknown");
        const id =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const now = new Date().toISOString();
        const created: WorkspaceAnnotation = {
            id,
            kind,
            title: getDefaultAnnotationTitle(kind, t),
            authorUserId,
            authorName,
            x: workspaceCanvasMenu.canvasX,
            y: workspaceCanvasMenu.canvasY,
            width: CANVAS_ANNOTATION_DEFAULT_WIDTH,
            height: CANVAS_ANNOTATION_DEFAULT_HEIGHT,
            text: "",
            createdAt: now,
            updatedAt: now,
        };
        setAnnotations((prev) => [...prev, created]);
        setWorkspaceCanvasMenu(null);
        setAnnotationItemMenu(null);
        setActiveAnnotationId(created.id);
    };

    const closeAnnotationEditor = () => {
        setActiveAnnotationId(null);
        setEditingAnnotationTitleId(null);
    };

    const updateAnnotationTitle = (annotationId: string, title: string, options?: { finalize?: boolean }) => {
        const now = new Date().toISOString();
        const finalize = Boolean(options?.finalize);
        setAnnotations((prev) =>
            prev.map((item) => {
                if (item.id !== annotationId) return item;
                const base = String(title ?? "");
                const nextTitle = finalize
                    ? base.trim().replace(/\s+/g, " ").slice(0, 40) || getDefaultAnnotationTitle(item.kind, t)
                    : base.slice(0, 40);
                return { ...item, title: nextTitle, updatedAt: now };
            })
        );
    };

    const updateAnnotationText = (annotationId: string, text: string) => {
        const now = new Date().toISOString();
        setAnnotations((prev) =>
            prev.map((item) =>
                item.id === annotationId
                    ? { ...item, text, updatedAt: now }
                    : item
            )
        );
    };

    const removeAnnotationFromWorkspace = (annotationId: string) => {
        const targetId = String(annotationId || "").trim();
        if (!targetId) return;
        const targetItemKey = buildCanvasItemKey("annotation", targetId);
        setAnnotations((prev) => prev.filter((item) => item.id !== targetId));
        setActiveAnnotationId((prev) => (prev === targetId ? null : prev));
        setEditingAnnotationTitleId((prev) => (prev === targetId ? null : prev));
        removeItemCommentsForKeys([targetItemKey]);
        removeItemKeysFromAllGroups([targetItemKey]);
        setHiddenCanvasItemKeys((prev) => Array.from(new Set([...prev, targetItemKey])));
    };

    const handleDeleteAnnotationFromMenu = () => {
        if (!annotationItemMenu) return;
        const targetId = annotationItemMenu.annotationId;
        setAnnotationItemMenu(null);
        removeAnnotationFromWorkspace(targetId);
    };

    const openProfileMenu = (
        event: React.MouseEvent,
        memberUserId: string,
        options?: { canvasItemKey?: string }
    ) => {
        if (!memberUserId) return;
        trackMyTeamAction("myteam.member_click", { memberUserId, action: "context_menu" });
        event.preventDefault();
        event.stopPropagation();

        const target = event.target as HTMLElement | null;
        const isCanvasMemberContext = Boolean(target?.closest("[data-workspace-item='member']"));
        if (isCanvasMemberContext && selectedCanvasItemKeys.length > 1) {
            openGroupOnlyCanvasMenuAtPointer(event);
            return;
        }

        const membersForMenu = Array.isArray(data?.members) ? data.members : [];
        const viewerUserIdForMenu = String(data?.viewerUserId || "");
        const viewerMemberForMenu = membersForMenu.find((member) => member.userId === viewerUserIdForMenu);
        const targetMemberForMenu = membersForMenu.find((member) => member.userId === memberUserId);
        const canManageRoleForMenu = Boolean(
            viewerMemberForMenu?.role === "Owner" &&
            targetMemberForMenu &&
            targetMemberForMenu.role !== "Owner" &&
            targetMemberForMenu.userId !== viewerUserIdForMenu
        );
        const targetMemberSourceId = String(targetMemberForMenu?.id || "").trim();
        const requestedCanvasItemKey = String(options?.canvasItemKey || "").trim();
        const existingMemberItemKey = targetMemberSourceId
            ? selectableCanvasItems.find((item) => {
                if (item.kind !== "member") return false;
                const parsed = parseCanvasItemKey(item.key);
                if (!parsed || parsed.kind !== "member") return false;
                return extractCanvasPlacementSourceId(parsed.id) === targetMemberSourceId;
            })?.key || ""
            : "";
        const memberCanvasItemKey =
            requestedCanvasItemKey && selectableCanvasItemMap.has(requestedCanvasItemKey)
                ? requestedCanvasItemKey
                : existingMemberItemKey;
        const canMoveToGroupForMenu = Boolean(memberCanvasItemKey || targetMemberSourceId);
        const targetMemberItemKey = memberCanvasItemKey || null;
        const canUngroupFromMenu = Boolean(
            targetMemberItemKey && groupedItemKeySet.has(targetMemberItemKey)
        );
        const canLeaveCommentFromMenu = Boolean(
            targetMemberItemKey && parseCanvasItemKey(targetMemberItemKey)?.kind === "member"
        );
        const canRemoveFromWorkspaceMenu = Boolean(
            targetMemberItemKey && parseCanvasItemKey(targetMemberItemKey)?.kind === "member"
        );

        const menuWidth = 168;
        const submenuWidth = 156;
        const menuHeight =
            44 +
            (canMoveToGroupForMenu ? 34 : 0) +
            (canUngroupFromMenu ? 34 : 0) +
            (canLeaveCommentFromMenu ? 34 : 0) +
            (canRemoveFromWorkspaceMenu ? 34 : 0) +
            (canManageRoleForMenu ? 34 : 0);
        const gap = 8;
        const x = Math.min(Math.max(event.clientX, gap), window.innerWidth - menuWidth - gap);
        const y = Math.min(Math.max(event.clientY, gap), window.innerHeight - menuHeight - gap);
        const roleSubmenuLeft = canManageRoleForMenu
            ? x + menuWidth + submenuWidth + gap > window.innerWidth
            : false;
        setCanvasMenu(null);
        setFileItemMenu(null);
        setCanvasFileItemMenu(null);
        setFileShareDrag(null);
        setWorkspaceCanvasMenu(null);
        setAnnotationItemMenu(null);
        setGroupMenu(null);
        setGroupEntryMenu(null);
        setProfileMenu({
            x,
            y,
            userId: memberUserId,
            roleSubmenuLeft,
            itemKey:
                canMoveToGroupForMenu && memberCanvasItemKey
                    ? memberCanvasItemKey
                    : undefined,
            memberSourceId: targetMemberSourceId || undefined,
        });
    };

    const moveProfileItemToGroupFromMenu = (groupId: string) => {
        if (!profileMenu) return;
        const { x, y, itemKey, memberSourceId } = profileMenu;
        const targetGroupId = String(groupId || "").trim();
        if (!targetGroupId) {
            setProfileMenu(null);
            return;
        }

        let nextItemKey = String(itemKey || "").trim();
        if (nextItemKey && !selectableCanvasItemMap.has(nextItemKey)) {
            nextItemKey = "";
        }

        if (!nextItemKey && memberSourceId) {
            const sourceId = String(memberSourceId || "").trim();
            const targetMember = members.find((member) => member.id === sourceId);
            if (targetMember) {
                const placementId = createCanvasPlacementId(sourceId);
                const memberWidth = getMemberCardWidth(targetMember.username || targetMember.userId);
                const canvas = canvasRef.current;
                let placement: CanvasPosition = { x: CANVAS_PADDING, y: CANVAS_PADDING };
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    const targetGroup = resolvedWorkspaceGroups.find((group) => group.id === targetGroupId);
                    const anchorItem = targetGroup?.items.find((candidate) =>
                        selectableCanvasItemMap.has(candidate.key)
                    );
                    const rawX =
                        anchorItem
                            ? anchorItem.bounds.x + Math.min(24, Math.max(8, anchorItem.bounds.width - memberWidth))
                            : x - rect.left - memberWidth / 2;
                    const rawY =
                        anchorItem
                            ? anchorItem.bounds.y + Math.max(12, CANVAS_MEMBER_HEIGHT / 4)
                            : y - rect.top - CANVAS_MEMBER_HEIGHT / 2;
                    placement = clampToCanvas(
                        { x: rawX, y: rawY },
                        rect.width,
                        rect.height,
                        memberWidth,
                        CANVAS_MEMBER_HEIGHT
                    );
                }
                setCanvasMemberPositions((prev) => ({
                    ...prev,
                    [placementId]: placement,
                }));
                const viewerUserIdForPlacement = String(data?.viewerUserId || "").trim();
                if (viewerUserIdForPlacement) {
                    setCanvasMemberPlacementOwners((prev) => ({
                        ...prev,
                        [placementId]: viewerUserIdForPlacement,
                    }));
                }
                nextItemKey = buildCanvasItemKey("member", placementId);
                setHiddenCanvasItemKeys((prev) =>
                    prev.filter((candidateKey) => candidateKey !== nextItemKey)
                );
            }
        }

        setProfileMenu(null);
        if (!nextItemKey) return;

        if (selectableCanvasItemMap.has(nextItemKey)) {
            moveCanvasItemKeysToGroupFromMenu([nextItemKey], targetGroupId, { x: x + 84, y: y + 16 });
            return;
        }

        moveCanvasItemsToGroup(targetGroupId, [nextItemKey], { skipCanvasPresenceCheck: true });
        setSelectedCanvasItemKeys([nextItemKey]);
    };

    const removeProfileItemFromGroupsFromMenu = () => {
        if (!profileMenu?.itemKey) return;
        const itemKey = profileMenu.itemKey;
        setProfileMenu(null);
        removeItemKeysFromAllGroups([itemKey]);
        setHiddenCanvasItemKeys((prev) => Array.from(new Set([...prev, itemKey])));
    };

    const removeProfileItemFromWorkspaceFromMenu = () => {
        if (!profileMenu?.itemKey) return;
        const parsed = parseCanvasItemKey(profileMenu.itemKey);
        if (!parsed || parsed.kind !== "member") return;
        const memberPlacementId = parsed.id;
        if (!canViewerModifyMemberPlacement(memberPlacementId)) {
            setProfileMenu(null);
            setNotice({
                open: true,
                title: t("workspace.notice.deleteFailedTitle"),
                message: t("workspace.error.accessDenied"),
            });
            return;
        }
        setProfileMenu(null);
        handleRemovePlacedMember(memberPlacementId, { bypassPermissionCheck: true });
    };

    const openProfileItemCommentFromMenu = () => {
        if (!profileMenu?.itemKey) return;
        const memberItemKey = profileMenu.itemKey;
        setProfileMenu(null);
        openItemCommentComposer(memberItemKey);
    };

    const openFilesActionMenuAt = (clientX: number, clientY: number) => {
        const menuWidth = 176;
        const menuHeight = 122;
        const gap = 8;
        const x = Math.min(Math.max(clientX, gap), window.innerWidth - menuWidth - gap);
        const y = Math.min(Math.max(clientY, gap), window.innerHeight - menuHeight - gap);
        setProfileMenu(null);
        setFileItemMenu(null);
        setCanvasFileItemMenu(null);
        setFileShareDrag(null);
        setWorkspaceCanvasMenu(null);
        setAnnotationItemMenu(null);
        setGroupMenu(null);
        setGroupEntryMenu(null);
        setCanvasMenu({ x, y });
    };

    const openFilesContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        openFilesActionMenuAt(event.clientX, event.clientY);
    };

    const openFilesActionMenuFromButton = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        trackMyTeamAction("myteam.open_files_menu");
        const rect = event.currentTarget.getBoundingClientRect();
        openFilesActionMenuAt(rect.left, rect.bottom + 6);
    };

    const openFileItemMenu = (event: React.MouseEvent, fileId: string) => {
        event.preventDefault();
        event.stopPropagation();
        const targetFile = currentFiles.find((file) => file.id === fileId);
        const isFolder = Boolean(targetFile && isFolderEntry(targetFile));
        const canMoveToFolder = Boolean(targetFile && !isFolder);
        const canSendFileFromMenu = Boolean(
            workspaceMode === "my" &&
            targetFile &&
            members.some((member) => member.userId !== data?.viewerUserId)
        );
        const menuWidth = 172;
        const moveSubmenuWidth = 188;
        const submenuWidth = 188;
        const menuHeight = isFolder ? 116 : 188 + (canSendFileFromMenu ? 34 : 0);
        const gap = 8;
        const x = Math.min(Math.max(event.clientX, gap), window.innerWidth - menuWidth - gap);
        const y = Math.min(Math.max(event.clientY, gap), window.innerHeight - menuHeight - gap);
        const moveSubmenuLeft =
            canMoveToFolder && x + menuWidth + moveSubmenuWidth + gap > window.innerWidth;
        const shareSubmenuLeft =
            canSendFileFromMenu && x + menuWidth + submenuWidth + gap > window.innerWidth;
        setProfileMenu(null);
        setCanvasMenu(null);
        setCanvasFileItemMenu(null);
        setFileShareDrag(null);
        setWorkspaceCanvasMenu(null);
        setAnnotationItemMenu(null);
        setGroupMenu(null);
        setGroupEntryMenu(null);
        setFileItemMenu({ x, y, fileId, moveSubmenuLeft, shareSubmenuLeft });
    };

    const handleDeleteFileFromMenu = async () => {
        if (!teamId || !fileItemMenu) return;
        const targetFileId = String(fileItemMenu.fileId || "").trim();
        const selectedFileIds = Array.from(
            new Set(
                selectedSidebarFileIds
                    .map((fileId) => String(fileId || "").trim())
                    .filter(Boolean)
            )
        );
        const targetFileIds =
            selectedFileIds.length > 1 && selectedFileIds.includes(targetFileId)
                ? selectedFileIds
                : [targetFileId];
        setFileItemMenu(null);

        if (workspaceMode === "team") {
            const unauthorized = targetFileIds.some((id) => !canViewerRemoveFileFromWorkspace(id));
            if (unauthorized) {
                setNotice({
                    open: true,
                    title: t("workspace.notice.deleteFailedTitle"),
                    message: t("workspace.error.accessDenied"),
                });
                return;
            }
        }

        let successCount = 0;
        let failedCount = 0;

        for (const fileId of targetFileIds) {
            try {
                const res = await fetch(`/api/workspace/${teamId}`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type: "FILE", id: fileId, scope: sidebarFileScope }),
                });

                if (!res.ok) {
                    failedCount += 1;
                    continue;
                }

                handleRemovePlacedFile(fileId);
                successCount += 1;
            } catch {
                failedCount += 1;
            }
        }

        if (successCount > 0) {
            const deletedSet = new Set(targetFileIds);
            setSelectedSidebarFileIds((prev) => prev.filter((fileId) => !deletedSet.has(fileId)));
            void fetchData({ silent: true });
        }

        if (failedCount > 0) {
            setNotice({
                open: true,
                title: t("workspace.notice.deleteFailedTitle"),
                message:
                    successCount > 0
                        ? t("workspace.notice.deleteFailedPartial", { successCount, failedCount })
                        : t("workspace.error.deleteItem"),
            });
            return;
        }

        if (targetFileIds.length > 1) {
            setNotice({
                open: true,
                title: t("workspace.notice.deleteCompleteTitle"),
                message: t("workspace.notice.deleteCompleteMessage", { successCount }),
            });
        }
    };

    const openFileShareConfirm = (file: WorkspaceFile, toUserId: string) => {
        const targetUserId = String(toUserId || "").trim();
        const targetMember = members.find((member) => member.userId === targetUserId);
        if (!targetUserId || !targetMember) return;
        if (targetUserId === data?.viewerUserId) return;

        const rawTitle = String(file.title || "").trim();
        const displayName = isFolderEntry(file)
            ? getFolderLabel(rawTitle || folderLabel)
            : rawTitle || t("workspace.untitled");
        setFileShareConfirm({
            open: true,
            fileId: file.id,
            fileName: displayName,
            toUserId: targetUserId,
            toUsername: targetMember.username || targetUserId,
            isSubmitting: false,
            isResend: false,
        });
    };

    const beginFileShareDrag = (event: React.PointerEvent<HTMLElement>, file: WorkspaceFile) => {
        event.preventDefault();
        event.stopPropagation();
        if (workspaceMode !== "my") return;
        if (fileShareTargetMembers.length === 0) return;

        const triggerRect = event.currentTarget.getBoundingClientRect();
        const originX = triggerRect.left + triggerRect.width / 2;
        const originY = triggerRect.top + triggerRect.height / 2;

        setProfileMenu(null);
        setCanvasMenu(null);
        setFileItemMenu(null);
        setCanvasFileItemMenu(null);
        setFileShareDrag({
            fileId: file.id,
            fileName: String(file.title || "").trim() || t("workspace.untitled"),
            startX: originX,
            startY: originY,
            currentX: event.clientX,
            currentY: event.clientY,
            hoverUserId: null,
            hoverUsername: "",
        });
        setWorkspaceCanvasMenu(null);
        setAnnotationItemMenu(null);
        setGroupMenu(null);
        setGroupEntryMenu(null);
    };

    const openFileShareFromSidebarMenu = (toUserId: string) => {
        if (!fileItemMenu) return;
        const targetFile = currentFiles.find((file) => file.id === fileItemMenu.fileId);
        setFileItemMenu(null);
        if (!targetFile || workspaceMode !== "my") return;
        openFileShareConfirm(targetFile, toUserId);
    };

    const openFileShareFromCanvasMenu = (toUserId: string) => {
        if (!canvasFileItemMenu) return;
        const sourceFileId = extractCanvasPlacementSourceId(canvasFileItemMenu.fileId);
        const targetFile = canvasFileByIdMap.get(sourceFileId);
        setCanvasFileItemMenu(null);
        if (!targetFile || workspaceMode !== "my") return;
        openFileShareConfirm(targetFile, toUserId);
    };

    const closeFileShareConfirm = () => {
        setFileShareConfirm((prev) => (prev.isSubmitting ? prev : { ...prev, open: false }));
    };

    const submitFileShareConfirm = async () => {
        if (!teamId || !fileShareConfirm.open || fileShareConfirm.isSubmitting) return;
        const fileId = String(fileShareConfirm.fileId || "").trim();
        const toUserId = String(fileShareConfirm.toUserId || "").trim();
        if (!fileId || !toUserId) return;

        setFileShareConfirm((prev) => ({ ...prev, isSubmitting: true }));
        try {
            const res = await fetch("/api/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "FILE",
                    teamId,
                    fileId,
                    fileName: fileShareConfirm.fileName,
                    toId: toUserId,
                    message: "",
                    forceResend: fileShareConfirm.isResend,
                }),
            });
            const payload = await res.json().catch(() => ({}));

            if (res.ok) {
                setFileShareConfirm({
                    open: false,
                    fileId: "",
                    fileName: "",
                    toUserId: "",
                    toUsername: "",
                    isSubmitting: false,
                    isResend: false,
                });
                setNotice({
                    open: true,
                    title: t("workspace.notice.fileRequestSentTitle"),
                    message: t("workspace.notice.fileRequestSentMessage", { username: fileShareConfirm.toUsername }),
                });
                return;
            }

            if (res.status === 409 && payload?.code === "FILE_ALREADY_SENT" && !fileShareConfirm.isResend) {
                setFileShareConfirm((prev) => ({
                    ...prev,
                    isSubmitting: false,
                    isResend: true,
                }));
                return;
            }

            setNotice({
                open: true,
                title: t("workspace.notice.fileRequestFailedTitle"),
                message: t("workspace.error.fileRequest"),
            });
            setFileShareConfirm((prev) => ({ ...prev, isSubmitting: false }));
        } catch {
            setNotice({
                open: true,
                title: t("workspace.notice.fileRequestFailedTitle"),
                message: t("workspace.error.fileRequest"),
            });
            setFileShareConfirm((prev) => ({ ...prev, isSubmitting: false }));
        }
    };

    const viewProfileFromMenu = () => {
        if (!profileMenu) return;
        openMemberProfile(profileMenu.userId);
        setProfileMenu(null);
    };

    const openRoleChangeConfirmFromMenu = (nextRole: "Admin" | "Member") => {
        if (!profileMenu) return;
        const targetMember = members.find((member) => member.userId === profileMenu.userId);
        if (!targetMember) return;
        setProfileMenu(null);
        setRoleChangeConfirm({
            open: true,
            targetUserId: targetMember.userId,
            targetUsername: targetMember.username || targetMember.userId,
            nextRole,
            isSubmitting: false,
        });
    };

    const cancelRoleChangeConfirm = () => {
        setRoleChangeConfirm((prev) => (prev.isSubmitting ? prev : { ...prev, open: false }));
    };

    const confirmRoleChange = async () => {
        if (!teamId || !roleChangeConfirm.open || roleChangeConfirm.isSubmitting) return;
        const targetUserId = roleChangeConfirm.targetUserId;
        const nextRole = roleChangeConfirm.nextRole;
        setRoleChangeConfirm((prev) => ({ ...prev, isSubmitting: true }));

        try {
            const res = await fetch(`/api/workspace/${teamId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "MEMBER_ROLE",
                    userId: targetUserId,
                    role: nextRole,
                }),
            });

            if (!res.ok) {
                const errorMessage = t("workspace.error.roleChange");
                setNotice({
                    open: true,
                    title: t("workspace.notice.roleUpdateFailedTitle"),
                    message: errorMessage,
                });
                setRoleChangeConfirm((prev) => ({ ...prev, isSubmitting: false }));
                return;
            }

            setData((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    members: prev.members.map((member) =>
                        member.userId === targetUserId
                            ? { ...member, role: nextRole }
                            : member
                    ),
                };
            });
            trackMyTeamAction("myteam.change_member_role", { targetUserId, nextRole });
            setRoleChangeConfirm((prev) => ({ ...prev, open: false, isSubmitting: false }));
        } catch {
            setNotice({
                open: true,
                title: t("workspace.notice.roleUpdateFailedTitle"),
                message: t("workspace.error.roleChange"),
            });
            setRoleChangeConfirm((prev) => ({ ...prev, isSubmitting: false }));
        }
    };

    if (loading) return <div className="p-8 text-center text-[var(--muted)]">{t("workspace.loading")}</div>;
    if (error) return <div className="p-8 text-center text-rose-500">{error}</div>;
    if (!data) return <div className="p-8 text-center text-[var(--muted)]">{t("workspace.noData")}</div>;

    const { team } = data;
    const viewerMember = members.find((member) => member.userId === data.viewerUserId);
    const isViewerOwner = viewerMember?.role === "Owner";
    const profileMenuTargetMember = profileMenu
        ? members.find((member) => member.userId === profileMenu.userId) || null
        : null;
    const canManageProfileMenuRole = Boolean(
        isViewerOwner &&
        profileMenuTargetMember &&
        profileMenuTargetMember.role !== "Owner" &&
        profileMenuTargetMember.userId !== data.viewerUserId
    );
    const canMoveProfileMenuItem = Boolean(profileMenu?.itemKey || profileMenu?.memberSourceId);
    const canUngroupProfileMenuItem = Boolean(
        profileMenu?.itemKey &&
        selectableCanvasItemMap.has(profileMenu.itemKey) &&
        groupedItemKeySet.has(profileMenu.itemKey)
    );
    const canRemoveProfileMenuItem = Boolean(
        profileMenu?.itemKey &&
        selectableCanvasItemMap.has(profileMenu.itemKey) &&
        parseCanvasItemKey(profileMenu.itemKey)?.kind === "member" &&
        canViewerModifyMemberPlacement(parseCanvasItemKey(profileMenu.itemKey)?.id || "") &&
        !groupedItemKeySet.has(profileMenu.itemKey)
    );
    const canLeaveCommentProfileMenuItem = Boolean(
        profileMenu?.itemKey &&
        selectableCanvasItemMap.has(profileMenu.itemKey) &&
        parseCanvasItemKey(profileMenu.itemKey)?.kind === "member"
    );
    const renderItemCommentWidget = (
        itemKey: string,
        options?: {
            rootClassName?: string;
            buttonClassName?: string;
            panelClassName?: string;
        }
    ) => {
        if (!canAddCommentToItem(itemKey)) return null;
        const comments = itemCommentsByKey.get(itemKey) || [];
        const isOpen = activeItemCommentKey === itemKey;
        return (
            <div className={cn("absolute bottom-0.5 left-0.5 z-20", options?.rootClassName)}>
                <button
                    type="button"
                    onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                    onClick={(event) => {
                        event.stopPropagation();
                        if (isOpen) {
                            closeItemCommentComposer();
                            return;
                        }
                        openItemCommentComposer(itemKey);
                    }}
                    className={cn(
                        "relative inline-flex h-5 w-5 items-center justify-center bg-transparent text-sky-400 hover:text-sky-300",
                        options?.buttonClassName
                    )}
                    aria-label={t("workspace.annotation.createComment")}
                    title={t("workspace.annotation.commentTitle")}
                >
                    <MessageCircle className="h-3 w-3" />
                    {comments.length > 0 && (
                        <span className="absolute -right-1 -top-1 inline-flex min-w-[14px] items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[9px] font-semibold leading-none text-white">
                            {comments.length > 99 ? "99+" : comments.length}
                        </span>
                    )}
                </button>
            </div>
        );
    };
    const sortedMembers = [...members].sort((a, b) => {
        const rank = (presence: Presence) => {
            if (presence === "active") return 0;
            if (presence === "away") return 1;
            return 2;
        };
        const rankDiff = rank(resolvePresence(a.status)) - rank(resolvePresence(b.status));
        if (rankDiff !== 0) return rankDiff;
        return String(a.username || "").localeCompare(String(b.username || ""));
    });
    const placedFiles = Object.entries(canvasFilePositions)
        .map(([placementId, position]) => {
            const itemKey = buildCanvasItemKey("file", placementId);
            if (hiddenCanvasItemKeySet.has(itemKey)) return null;
            const sourceFileId = extractCanvasPlacementSourceId(placementId);
            const file = canvasFileByIdMap.get(sourceFileId);
            if (!file) return null;
            return { placementId, sourceFileId, file, position };
        })
        .filter(Boolean) as Array<{ placementId: string; sourceFileId: string; file: WorkspaceFile; position: CanvasPosition }>;
    const placedMembers = Object.entries(canvasMemberPositions)
        .map(([placementId, position]) => {
            const itemKey = buildCanvasItemKey("member", placementId);
            if (hiddenCanvasItemKeySet.has(itemKey)) return null;
            const sourceMemberId = extractCanvasPlacementSourceId(placementId);
            const member = members.find((item) => item.id === sourceMemberId);
            if (!member) return null;
            const width = getMemberCardWidth(member.username || member.userId);
            return { placementId, sourceMemberId, member, position, width };
        })
        .filter(Boolean) as Array<{ placementId: string; sourceMemberId: string; member: WorkspaceMember; position: CanvasPosition; width: number }>;
    const draggingSidebarFile = draggingSidebarFileId
        ? currentFiles.find((file) => file.id === draggingSidebarFileId)
        : null;
    const isDraggingPlainFile = Boolean(draggingSidebarFile && !isFolderEntry(draggingSidebarFile));
    const fileShareTargetMembers = members.filter((member) => member.userId !== data.viewerUserId);
    const fileMenuTarget = fileItemMenu
        ? currentFiles.find((file) => file.id === fileItemMenu.fileId) || null
        : null;
    const fileMenuCurrentFolderId = String(fileMenuTarget?.folderId || "").trim();
    const fileMenuMoveFolderOptions = fileMenuTarget
        ? folderItems.filter((folder) => folder.id !== fileMenuTarget.id)
        : [];
    const fileMenuTargetIsFolder = Boolean(fileMenuTarget && isFolderEntry(fileMenuTarget));
    const canvasFileMenuSourceId = canvasFileItemMenu
        ? extractCanvasPlacementSourceId(canvasFileItemMenu.fileId)
        : "";
    const canvasFileMenuTarget = canvasFileMenuSourceId
        ? canvasFileByIdMap.get(canvasFileMenuSourceId) || null
        : null;
    const canSendFileFromSidebarMenu = Boolean(
        workspaceMode === "my" &&
        fileMenuTarget &&
        fileShareTargetMembers.length > 0
    );
    const canSendFileFromCanvasMenu = Boolean(
        workspaceMode === "my" &&
        canvasFileMenuTarget &&
        fileShareTargetMembers.length > 0
    );
    const moveFolderOptions = folderItems.filter((folder) => folder.id !== moveFileModal.fileId);
    const canUngroupCanvasFileItem = Boolean(
        canvasFileItemMenu &&
        groupedItemKeySet.has(buildCanvasItemKey("file", canvasFileItemMenu.fileId))
    );
    const canRemoveCanvasFileItemFromWorkspace = Boolean(
        canvasFileItemMenu &&
        !canUngroupCanvasFileItem &&
        canViewerRemoveFileFromWorkspace(canvasFileItemMenu.fileId)
    );
    const removableSelectedCanvasItems = Array.from(
        new Set(
            selectedCanvasItemKeys.filter((itemKey) => {
                if (!selectableCanvasItemMap.has(itemKey)) return false;
                const parsed = parseCanvasItemKey(itemKey);
                if (!parsed) return false;
                if (parsed.kind === "file") return canViewerRemoveFileFromWorkspace(parsed.id);
                if (parsed.kind === "member") return canViewerModifyMemberPlacement(parsed.id);
                return true;
            })
        )
    );
    const canUngroupAnnotationItem = Boolean(
        annotationItemMenu &&
        groupedItemKeySet.has(buildCanvasItemKey("annotation", annotationItemMenu.annotationId))
    );
    const annotationMenuTarget = annotationItemMenu
        ? annotations.find((item) => item.id === annotationItemMenu.annotationId) || null
        : null;
    const canLeaveCommentAnnotationItem = Boolean(
        annotationMenuTarget && annotationMenuTarget.kind !== "comment"
    );
    const canvasSelectionBounds = canvasSelection ? normalizeSelectionBounds(canvasSelection) : null;
    const sidebarSelectionBounds = sidebarSelection ? normalizePointerSelectionBounds(sidebarSelection) : null;

    const renderSidebarContent = () => {
        if (activeSection === "files") {
            const renderFileItem = (file: WorkspaceFile, nested = false) => {
                const isInlineEditing = inlineRename?.fileId === file.id;
                const isSidebarSelected = selectedSidebarFileIdSet.has(file.id);
                if (isInlineEditing) {
                    return (
                        <div
                            key={file.id}
                            data-sidebar-select-item="true"
                            data-sidebar-file-id={file.id}
                            className={cn(
                                "w-full rounded-md border border-[var(--primary)] bg-[var(--card-bg-hover)] px-2 py-1.5",
                                nested && "text-[13px]",
                                isSidebarSelected && "shadow-[0_0_0_1px_var(--primary)]"
                            )}
                            onContextMenu={(event) => openFileItemMenu(event, file.id)}
                        >
                            <div className="flex items-center gap-2">
                                <File className="h-4 w-4 shrink-0 text-[var(--primary)]" />
                                <input
                                    ref={inlineRenameInputRef}
                                    value={inlineRename?.name || ""}
                                    onChange={(event) =>
                                        setInlineRename((prev) =>
                                            prev
                                                ? {
                                                    ...prev,
                                                    name: event.target.value.slice(0, 120),
                                                    error: "",
                                                }
                                                : prev
                                        )
                                    }
                                    onBlur={() => {
                                        void submitInlineRename();
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            void submitInlineRename();
                                        } else if (event.key === "Escape") {
                                            event.preventDefault();
                                            cancelInlineRename();
                                        }
                                    }}
                                    className="h-7 w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-2 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                />
                            </div>
                            {inlineRename?.error && (
                                <p className="mt-1 text-[10px] text-rose-500">{inlineRename.error}</p>
                            )}
                        </div>
                    );
                }

                return (
                    <button
                        key={file.id}
                        type="button"
                        draggable
                        data-sidebar-select-item="true"
                        data-sidebar-file-id={file.id}
                        onDragStart={(event) => handleFileDragStart(event, file)}
                        onDragEnd={handleFileDragEnd}
                        onDoubleClick={() => openWorkspaceFile(file)}
                        onContextMenu={(event) => openFileItemMenu(event, file.id)}
                        className={cn(
                            "w-full cursor-grab rounded-md px-2 py-1.5 text-left text-sm text-[var(--fg)] transition-colors hover:bg-[var(--card-bg-hover)] active:cursor-grabbing",
                            nested && "text-[13px]",
                            draggingSidebarFileId === file.id && "opacity-55",
                            isSidebarSelected && "bg-[var(--card-bg-hover)] text-[var(--primary)] shadow-[inset_0_0_0_1px_var(--primary)]"
                        )}
                        title={`${file.title}\n${t("workspace.doubleClickToOpen")}`}
                    >
                        <span className="flex items-center gap-2 min-w-0">
                            <File className="h-4 w-4 shrink-0 text-[var(--primary)]" />
                            <span className="block truncate">{file.title}</span>
                        </span>
                    </button>
                );
            };

            return (
                <div className="flex h-full min-h-0 flex-col">
                    <div className="mb-2 flex items-center justify-between gap-2 px-1">
                        <p className="text-[11px] font-medium text-[var(--muted)]">{t("workspace.files")}</p>
                        <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] text-[var(--fg)] transition-colors hover:bg-[var(--card-bg-hover)]"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={openFilesActionMenuFromButton}
                            aria-label={t("workspace.fileActions")}
                            title={t("workspace.fileActions")}
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <div
                        ref={filesSidebarSelectionRef}
                        className="relative min-h-[56vh] flex-1"
                        onContextMenu={openFilesContextMenu}
                        onPointerDown={(event) => handleSidebarSelectionPointerDown("files", event)}
                        onDrop={(event) => {
                            void handleFilesRootDrop(event);
                        }}
                        onDragOver={handleFilesRootDragOver}
                    >
                        {sidebarSelection?.section === "files" && sidebarSelectionBounds && (
                            <div
                                className="pointer-events-none absolute z-20 rounded-sm border border-[var(--primary)]/70 bg-[var(--primary)]/15"
                                style={{
                                    left: sidebarSelectionBounds.x,
                                    top: sidebarSelectionBounds.y,
                                    width: sidebarSelectionBounds.width,
                                    height: sidebarSelectionBounds.height,
                                }}
                            />
                        )}
                        {currentFiles.length === 0 ? (
                            <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-[var(--muted)]">
                                {t("workspace.rightClickCreateFile")}
                            </p>
                        ) : (
                            <div className="max-h-[66vh] space-y-1 overflow-auto pr-1">
                                {folderItems.map((folder) => {
                                    const nestedFiles = filesByFolder[folder.id] || [];
                                    const isClosed = Boolean(closedFolders[folder.id]);
                                    const isDropHover = hoveredFolderId === folder.id && isDraggingPlainFile;
                                    const isInlineEditingFolder = inlineRename?.fileId === folder.id;
                                    const isSidebarSelected = selectedSidebarFileIdSet.has(folder.id);
                                    return (
                                        <div key={folder.id} className="space-y-1">
                                            <button
                                                type="button"
                                                draggable
                                                data-sidebar-select-item="true"
                                                data-sidebar-file-id={folder.id}
                                                data-folder-drop-target="true"
                                                onDragStart={(event) => handleFileDragStart(event, folder)}
                                                onDragEnd={handleFileDragEnd}
                                                onContextMenu={(event) => openFileItemMenu(event, folder.id)}
                                                onDragOver={(event) => handleFolderDragOver(event, folder.id)}
                                                onDrop={(event) => {
                                                    void handleFolderDrop(event, folder.id);
                                                }}
                                                onClick={() => {
                                                    if (isInlineEditingFolder) return;
                                                    setClosedFolders((prev) => ({
                                                        ...prev,
                                                        [folder.id]: !Boolean(prev[folder.id]),
                                                    }));
                                                }}
                                                className={cn(
                                                    "w-full cursor-pointer rounded-md border border-transparent px-2 py-1.5 text-left text-sm text-[var(--fg)] transition-colors hover:bg-[var(--card-bg-hover)]",
                                                    isDropHover && "border-[var(--primary)] bg-[var(--card-bg-hover)]",
                                                    isSidebarSelected && "bg-[var(--card-bg-hover)] text-[var(--primary)] shadow-[inset_0_0_0_1px_var(--primary)]"
                                                )}
                                                title={folder.title}
                                            >
                                                <span className="flex items-center gap-2 min-w-0">
                                                    <ChevronRight
                                                        className={cn(
                                                            "h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform",
                                                            !isClosed && "rotate-90"
                                                        )}
                                                    />
                                                    <Folder className="h-4 w-4 shrink-0 text-amber-500" />
                                                    {isInlineEditingFolder ? (
                                                        <input
                                                            ref={inlineRenameInputRef}
                                                            value={inlineRename?.name || ""}
                                                            onClick={(event) => event.stopPropagation()}
                                                            onChange={(event) =>
                                                                setInlineRename((prev) =>
                                                                    prev
                                                                        ? {
                                                                            ...prev,
                                                                            name: event.target.value.slice(0, 120),
                                                                            error: "",
                                                                        }
                                                                        : prev
                                                                )
                                                            }
                                                            onBlur={() => {
                                                                void submitInlineRename();
                                                            }}
                                                            onKeyDown={(event) => {
                                                                if (event.key === "Enter") {
                                                                    event.preventDefault();
                                                                    void submitInlineRename();
                                                                } else if (event.key === "Escape") {
                                                                    event.preventDefault();
                                                                    cancelInlineRename();
                                                                }
                                                            }}
                                                            className="h-7 w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-2 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                                        />
                                                    ) : (
                                                        <span className="block truncate">{getFolderLabel(folder.title)}</span>
                                                    )}
                                                </span>
                                            </button>
                                            {isInlineEditingFolder && inlineRename?.error && (
                                                <p className="pl-7 text-[10px] text-rose-500">{inlineRename.error}</p>
                                            )}
                                            {isDropHover && (
                                                <p className="pl-7 text-[10px] font-medium text-[var(--primary)]">
                                                    {t("workspace.dropFileHere")}
                                                </p>
                                            )}
                                            {!isClosed && (
                                                <div className="ml-5 space-y-1 border-l border-[var(--border)] pl-2">
                                                    {nestedFiles.length === 0 ? (
                                                        <p className="px-2 py-1 text-xs text-[var(--muted)]">{t("workspace.noFiles")}</p>
                                                    ) : (
                                                        nestedFiles.map((file) => renderFileItem(file, true))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {rootFiles.length > 0 && (
                                    <div
                                        className={cn(
                                            "space-y-1",
                                            folderItems.length > 0 && "mt-2 border-t border-[var(--border)] pt-2"
                                        )}
                                    >
                                        {rootFiles.map((file) => renderFileItem(file))}
                                    </div>
                                )}

                                {folderItems.length > 0 && rootFiles.length === 0 && (
                                    <p className="px-2 py-1 text-xs text-[var(--muted)]">
                                        {t("workspace.dropToRoot")}
                                    </p>
                                )}

                            </div>
                        )}
                    </div>
                </div>
            );
        }

        if (activeSection === "groups") {
            return (
                <div className="flex h-full min-h-0 flex-col">
                    <div className="mb-2 flex items-center justify-between gap-2 px-1">
                        <p className="text-[11px] font-medium text-[var(--muted)]">{t("workspace.groups")}</p>
                        <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] text-[var(--fg)] transition-colors hover:bg-[var(--card-bg-hover)]"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                                event.stopPropagation();
                                createEmptyWorkspaceGroupFromSidebar();
                            }}
                            aria-label={t("workspace.createGroup")}
                            title={t("workspace.createGroup")}
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <div
                        ref={groupsSidebarSelectionRef}
                        className="relative min-h-[52vh] flex-1"
                        onContextMenu={openGroupsContextMenu}
                        onPointerDown={(event) => handleSidebarSelectionPointerDown("groups", event)}
                    >
                        {sidebarSelection?.section === "groups" && sidebarSelectionBounds && (
                            <div
                                className="pointer-events-none absolute z-20 rounded-sm border border-[var(--primary)]/70 bg-[var(--primary)]/15"
                                style={{
                                    left: sidebarSelectionBounds.x,
                                    top: sidebarSelectionBounds.y,
                                    width: sidebarSelectionBounds.width,
                                    height: sidebarSelectionBounds.height,
                                }}
                            />
                        )}
                        {resolvedWorkspaceGroups.length === 0 ? (
                            <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-[var(--muted)]">
                                {t("workspace.rightClickCreateGroup")}
                            </p>
                        ) : (
                            <div className="max-h-[66vh] space-y-1 overflow-auto pr-1">
                                {resolvedWorkspaceGroups.map((group) => {
                                    const isClosed = Boolean(closedGroups[group.id]);
                                    const isDropHover = hoveredGroupId === group.id;
                                    const isInlineEditingGroup = groupInlineRename?.groupId === group.id;
                                    return (
                                        <div
                                            key={group.id}
                                            data-group-drop-target="true"
                                            data-group-id={group.id}
                                            className="space-y-1"
                                            onContextMenu={(event) => openGroupItemMenu(event, group.id)}
                                            onDragOver={(event) => handleGroupDragOver(event, group.id)}
                                            onDragLeave={(event) => handleGroupDragLeave(event, group.id)}
                                            onDrop={(event) => handleGroupDrop(event, group.id)}
                                        >
                                            <button
                                                type="button"
                                                draggable={!isInlineEditingGroup}
                                                onDragStart={(event) => handleGroupDragStart(event, group.id)}
                                                onDragEnd={handleGroupDragEnd}
                                                onClick={() =>
                                                    !isInlineEditingGroup &&
                                                    setClosedGroups((prev) => ({
                                                        ...prev,
                                                        [group.id]: !Boolean(prev[group.id]),
                                                    }))
                                                }
                                                className={cn(
                                                    "w-full cursor-pointer rounded-md border px-2 py-1.5 text-left text-sm text-[var(--fg)] transition-colors hover:bg-[var(--card-bg-hover)]",
                                                    isDropHover
                                                        ? "border-[var(--primary)] bg-[var(--card-bg-hover)]"
                                                        : "border-transparent",
                                                    draggingSidebarGroupId === group.id && "opacity-55"
                                                )}
                                                title={group.name}
                                            >
                                                <span className="flex items-center gap-2 min-w-0">
                                                    <ChevronRight
                                                        className={cn(
                                                            "h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform",
                                                            !isClosed && "rotate-90"
                                                        )}
                                                    />
                                                    <Boxes className="h-4 w-4 shrink-0 text-[var(--primary)]" />
                                                    {isInlineEditingGroup ? (
                                                        <input
                                                            ref={groupInlineRenameInputRef}
                                                            value={groupInlineRename?.name || ""}
                                                            onPointerDown={(event) => event.stopPropagation()}
                                                            onClick={(event) => event.stopPropagation()}
                                                            onChange={(event) =>
                                                                setGroupInlineRename((prev) =>
                                                                    prev
                                                                        ? {
                                                                            ...prev,
                                                                            name: event.target.value.slice(0, 60),
                                                                            error: "",
                                                                        }
                                                                        : prev
                                                                )
                                                            }
                                                            onBlur={() => submitGroupInlineRename()}
                                                            onKeyDown={(event) => {
                                                                if (event.key === "Enter") {
                                                                    event.preventDefault();
                                                                    submitGroupInlineRename();
                                                                    return;
                                                                }
                                                                if (event.key === "Escape") {
                                                                    event.preventDefault();
                                                                    cancelGroupInlineRename();
                                                                }
                                                            }}
                                                            className="h-7 flex-1 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-2 text-xs text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                                                        />
                                                    ) : (
                                                        <span className="block truncate">{group.name}</span>
                                                    )}
                                                    {!isInlineEditingGroup && (
                                                        <span className="group relative inline-flex shrink-0 items-center overflow-visible">
                                                            <span
                                                                className="inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-[var(--border)] text-[10px] font-semibold text-[var(--muted)]"
                                                                onPointerDown={(event) => event.stopPropagation()}
                                                                onClick={(event) => event.stopPropagation()}
                                                                onMouseEnter={(event) => {
                                                                    const rect = event.currentTarget.getBoundingClientRect();
                                                                    setGroupHintTooltip({
                                                                        x: rect.right + 8,
                                                                        y: rect.top + rect.height / 2,
                                                                    });
                                                                }}
                                                                onMouseMove={(event) => {
                                                                    const rect = event.currentTarget.getBoundingClientRect();
                                                                    setGroupHintTooltip({
                                                                        x: rect.right + 8,
                                                                        y: rect.top + rect.height / 2,
                                                                    });
                                                                }}
                                                                onMouseLeave={() => setGroupHintTooltip(null)}
                                                                aria-label={t("workspace.ctrlDragGuideAria")}
                                                            >
                                                                !
                                                            </span>
                                                            <span className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded border border-[var(--border)] bg-[var(--card-bg)] px-2 py-1 text-[10px] text-[var(--fg)] shadow-md group-hover:block">
                                                                {groupHintTooltipText}
                                                            </span>
                                                        </span>
                                                    )}
                                                    <span className="ml-auto text-[10px] text-[var(--muted)]">
                                                        {group.items.length}
                                                    </span>
                                                </span>
                                            </button>
                                            {isInlineEditingGroup && groupInlineRename?.error && (
                                                <p className="pl-7 text-[10px] text-rose-500">{groupInlineRename.error}</p>
                                            )}
                                            {isDropHover && (
                                                <p className="pl-7 text-[10px] font-medium text-[var(--primary)]">
                                                    {t("workspace.holdCtrlDrop")}
                                                </p>
                                            )}
                                            {!isClosed && (
                                                <div className="ml-5 space-y-1 border-l border-[var(--border)] pl-2">
                                                    {group.items.length === 0 ? (
                                                        <p className="px-2 py-1 text-xs text-[var(--muted)]">
                                                            {t("workspace.emptyGroup")}
                                                        </p>
                                                    ) : (
                                                        group.items.map((item) => {
                                                            const isReorderSource =
                                                                groupEntryReorderDrag?.groupId === group.id &&
                                                                groupEntryReorderDrag.itemKey === item.key;
                                                            const isSidebarSelected =
                                                                selectedSidebarGroupItemKeySet.has(item.key);
                                                            const itemFile =
                                                                item.kind === "file"
                                                                    ? canvasFileByIdMap.get(item.id) || fileByIdMap.get(item.id) || null
                                                                    : null;
                                                            const isFolderItem = Boolean(
                                                                itemFile && isFolderEntry(itemFile)
                                                            );
                                                            const folderToggleKey = `${group.id}:${item.key}`;
                                                            const isFolderOpen =
                                                                isFolderItem && Boolean(openGroupFolderItems[folderToggleKey]);
                                                            const folderChildren =
                                                                isFolderItem && itemFile
                                                                    ? canvasFilesByFolder[itemFile.id] || filesByFolder[itemFile.id] || []
                                                                    : [];
                                                            const itemLabel =
                                                                isFolderItem && itemFile
                                                                    ? getFolderLabel(itemFile.title)
                                                                    : item.label;
                                                            const reorderHoverPosition =
                                                                groupEntryReorderHover?.groupId === group.id &&
                                                                    groupEntryReorderHover.itemKey === item.key
                                                                    ? groupEntryReorderHover.position
                                                                    : null;
                                                            const reorderStyle =
                                                                reorderHoverPosition === "before"
                                                                    ? ({ boxShadow: "inset 0 2px 0 var(--primary)" } as const)
                                                                    : reorderHoverPosition === "after"
                                                                        ? ({ boxShadow: "inset 0 -2px 0 var(--primary)" } as const)
                                                                        : undefined;
                                                            return (
                                                                <div key={`${group.id}:${item.key}`} className="space-y-1">
                                                                    <button
                                                                        type="button"
                                                                        draggable
                                                                        data-sidebar-select-item="true"
                                                                        data-sidebar-group-item-key={item.key}
                                                                        onDragStart={(event) =>
                                                                            handleGroupEntryReorderDragStart(event, group.id, item.key)
                                                                        }
                                                                        onDragEnd={handleGroupEntryReorderDragEnd}
                                                                        onDragOver={(event) =>
                                                                            handleGroupEntryReorderDragOver(event, group.id, item.key)
                                                                        }
                                                                        onDragLeave={(event) =>
                                                                            handleGroupEntryReorderDragLeave(event, group.id, item.key)
                                                                        }
                                                                        onDrop={(event) =>
                                                                            handleGroupEntryReorderDrop(event, group.id, item.key)
                                                                        }
                                                                        onClick={() => {
                                                                            setSelectedCanvasItemKeys([item.key]);
                                                                            if (isFolderItem) {
                                                                                setOpenGroupFolderItems((prev) => ({
                                                                                    ...prev,
                                                                                    [folderToggleKey]: !Boolean(prev[folderToggleKey]),
                                                                                }));
                                                                            }
                                                                        }}
                                                                        onContextMenu={(event) =>
                                                                            openGroupEntryItemMenu(event, group.id, item.key)
                                                                        }
                                                                        className={cn(
                                                                            "w-full rounded-md px-2 py-1 text-left text-xs text-[var(--fg)] hover:bg-[var(--card-bg-hover)]",
                                                                            selectedCanvasItemKeySet.has(item.key) &&
                                                                            "bg-[var(--card-bg-hover)] text-[var(--primary)]",
                                                                            isSidebarSelected &&
                                                                            "bg-[var(--card-bg-hover)] text-[var(--primary)] shadow-[inset_0_0_0_1px_var(--primary)]",
                                                                            isReorderSource && "opacity-45"
                                                                        )}
                                                                        style={reorderStyle}
                                                                        title={itemLabel}
                                                                    >
                                                                        <span className="flex items-center gap-1.5 min-w-0">
                                                                            {isFolderItem ? (
                                                                                <>
                                                                                    <ChevronRight
                                                                                        className={cn(
                                                                                            "h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform",
                                                                                            isFolderOpen && "rotate-90"
                                                                                        )}
                                                                                    />
                                                                                    {isFolderOpen ? (
                                                                                        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                                                                    ) : (
                                                                                        <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                                                                    )}
                                                                                </>
                                                                            ) : item.kind === "file" ? (
                                                                                <File className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
                                                                            ) : item.kind === "member" ? (
                                                                                <UserRound className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                                                                            ) : (
                                                                                <MessageCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                                                            )}
                                                                            <span className="block truncate">{itemLabel}</span>
                                                                        </span>
                                                                    </button>
                                                                    {isFolderItem && isFolderOpen && (
                                                                        <div className="ml-4 space-y-0.5 border-l border-[var(--border)] pl-2">
                                                                            {folderChildren.length === 0 ? (
                                                                                <p className="px-1 py-0.5 text-[10px] text-[var(--muted)]">
                                                                                    {t("workspace.noFiles")}
                                                                                </p>
                                                                            ) : (
                                                                                folderChildren.map((child) => (
                                                                                    <button
                                                                                        key={child.id}
                                                                                        type="button"
                                                                                        onClick={() => openWorkspaceFile(child)}
                                                                                        className="w-full truncate rounded px-1.5 py-1 text-left text-[11px] text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                                                                        title={child.title}
                                                                                    >
                                                                                        {child.title}
                                                                                    </button>
                                                                                ))
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-2">
                <div className="space-y-1 max-h-[66vh] overflow-auto pr-1">
                    {sortedMembers.length === 0 ? (
                        <p className="text-sm text-[var(--muted)]">{t("workspace.noMembersYet")}</p>
                    ) : (
                        sortedMembers.map((member) => {
                            const presence = resolvePresence(member.status);
                            const isMe = Boolean(data.viewerUserId) && member.userId === data.viewerUserId;
                            const isShareHover = Boolean(
                                fileShareDrag &&
                                fileShareDrag.hoverUserId === member.userId &&
                                member.userId !== data.viewerUserId
                            );
                            const dotClass =
                                presence === "active"
                                    ? "bg-sky-500"
                                    : presence === "away"
                                        ? "bg-amber-400"
                                        : "bg-slate-400";

                            return (
                                <Card
                                    key={member.id}
                                    draggable
                                    data-workspace-member-drop-target="true"
                                    data-member-user-id={member.userId}
                                    data-member-username={member.username || member.userId}
                                    onDragStart={(event) => handleMemberDragStart(event, member)}
                                    onContextMenu={(event) => openProfileMenu(event, member.userId)}
                                    className={cn(
                                        "p-2 cursor-grab active:cursor-grabbing",
                                        isShareHover && "ring-1 ring-[var(--primary)] bg-[var(--card-bg-hover)]"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={cn("inline-block h-2.5 w-2.5 rounded-full", dotClass)} />
                                        <div className="h-7 w-7 rounded-full border border-[var(--border)] bg-[var(--card-bg-hover)] flex items-center justify-center text-[10px] font-semibold text-[var(--fg)] shrink-0">
                                            {(member.username || "?").slice(0, 1).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <p
                                                    className="min-w-0 truncate text-left text-sm text-[var(--fg)]"
                                                    title={member.username || member.userId}
                                                >
                                                    {member.username || member.userId}
                                                </p>
                                                {isMe && (
                                                    <span className="shrink-0 rounded-full border border-[var(--primary)] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[var(--primary)]">
                                                        {t("workspace.my")}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-[var(--muted)]">{getRoleLabel(member.role)}</p>
                                        </div>
                                        {!isMe && (
                                            <button
                                                type="button"
                                                onPointerDown={(event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                }}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    openMemberChat(member);
                                                }}
                                                className="h-7 w-7 shrink-0 rounded-md border border-[var(--border)] bg-[var(--card-bg-hover)] inline-flex items-center justify-center text-[var(--fg)] hover:text-[var(--primary)]"
                                                aria-label={t("workspace.chatWith", { username: member.username || member.userId })}
                                            >
                                                <MessageSquare className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </Card>
                            );
                        })
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="relative h-[calc(100dvh-4rem)] min-h-[calc(100dvh-4rem)] w-full flex bg-[var(--bg)] overflow-hidden">
            <aside
                className={cn(
                    "relative shrink-0 h-full bg-[var(--card-bg)] flex flex-col overflow-hidden transition-[width,padding,border-color] duration-200",
                    isSidebarOpen ? "w-80 border-r border-[var(--border)] py-3 pl-2 pr-3" : "w-0 border-r-0 p-0"
                )}
                aria-hidden={!isSidebarOpen}
            >
                {isSidebarOpen && (
                    <>
                        <div className="flex h-full min-h-0 gap-2">
                            <div className="w-10 shrink-0 pt-0.5">
                                <div className="flex flex-col gap-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            trackMyTeamAction("myteam.open_members_panel");
                                            setActiveSection("members");
                                        }}
                                        className={cn(
                                            "inline-flex h-9 w-full items-center justify-center rounded-md border transition-colors",
                                            activeSection === "members"
                                                ? "border-[var(--primary)] bg-[var(--card-bg-hover)] text-[var(--fg)]"
                                                : "border-transparent text-[var(--muted)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--fg)]"
                                        )}
                                        title={t("workspace.members")}
                                        aria-label={t("workspace.members")}
                                    >
                                        <UserRound className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            trackMyTeamAction("myteam.open_files_panel");
                                            setActiveSection("files");
                                        }}
                                        className={cn(
                                            "inline-flex h-9 w-full items-center justify-center rounded-md border transition-colors",
                                            activeSection === "files"
                                                ? "border-[var(--primary)] bg-[var(--card-bg-hover)] text-[var(--fg)]"
                                                : "border-transparent text-[var(--muted)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--fg)]"
                                        )}
                                        title={t("workspace.files")}
                                        aria-label={t("workspace.files")}
                                    >
                                        <File className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            trackMyTeamAction("myteam.open_groups_panel");
                                            setActiveSection("groups");
                                        }}
                                        className={cn(
                                            "inline-flex h-9 w-full items-center justify-center rounded-md border transition-colors",
                                            activeSection === "groups"
                                                ? "border-[var(--primary)] bg-[var(--card-bg-hover)] text-[var(--fg)]"
                                                : "border-transparent text-[var(--muted)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--fg)]"
                                        )}
                                        title={t("workspace.groups")}
                                        aria-label={t("workspace.groups")}
                                    >
                                        <Boxes className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="min-w-0 flex-1 flex flex-col">
                                <div className="mb-1 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/teams/${encodeURIComponent(teamId || "")}`)}
                                        className="block min-w-0 flex-1 truncate text-left text-xl font-bold text-[var(--fg)] hover:text-[var(--primary)] transition-colors"
                                    >
                                        {team.name}
                                    </button>
                                </div>
                                <p className="text-xs text-[var(--muted)]">
                                    {activeSection === "members"
                                        ? t("workspace.members")
                                        : activeSection === "files"
                                            ? t("workspace.files")
                                            : t("workspace.groups")}
                                </p>
                                <div className="mt-3 pt-3 border-t border-[var(--border)] flex-1 overflow-auto">
                                    {renderSidebarContent()}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </aside>

            <button
                type="button"
                onClick={() => setIsSidebarOpen((prev) => !prev)}
                className={cn(
                    "absolute top-1/2 z-40 flex h-14 w-5 -translate-y-1/2 items-center justify-center rounded-r-[10px] border border-[var(--border)] bg-[var(--card-bg)] text-[var(--muted)] transition-[left,color,background-color] duration-200 hover:text-[var(--fg)] hover:bg-[var(--card-bg-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/35",
                    isSidebarOpen
                        ? "left-[calc(20rem-1px)] border-l-0"
                        : "left-0"
                )}
                aria-label={isSidebarOpen ? t("workspace.closeSidebar") : t("workspace.openSidebar")}
            >
                {isSidebarOpen ? <ChevronLeft className="mx-auto h-4 w-4" /> : <ChevronRight className="mx-auto h-4 w-4" />}
            </button>

            <section className="relative flex-1 min-w-0 min-h-0 flex flex-col">
                <div className="shrink-0 border-b border-[var(--border)] bg-[var(--card-bg)]/80 px-4 py-2 backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--fg)]">{t("workspace.canvasTitle")}</p>
                            <p className="truncate text-[11px] text-[var(--muted)]">
                                {t("workspace.canvasModeHint")}
                            </p>
                        </div>
                        <div className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card-bg)] p-0.5">
                            <button
                                type="button"
                                onClick={() => {
                                    trackMyTeamAction("myteam.switch_my_workspace");
                                    setWorkspaceMode("my");
                                }}
                                className={cn(
                                    "h-7 rounded px-2.5 text-[11px] font-semibold transition-colors",
                                    workspaceMode === "my"
                                        ? "bg-[var(--primary)] text-white"
                                        : "text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                )}
                            >
                                {t("workspace.myCanvas")}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    trackMyTeamAction("myteam.switch_team_workspace");
                                    setWorkspaceMode("team");
                                }}
                                className={cn(
                                    "h-7 rounded px-2.5 text-[11px] font-semibold transition-colors",
                                    workspaceMode === "team"
                                        ? "bg-[var(--primary)] text-white"
                                        : "text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                )}
                            >
                                {t("workspace.teamCanvas")}
                            </button>
                        </div>
                    </div>
                </div>
                <div
                    ref={canvasRef}
                    className="relative flex-1 min-h-0 bg-[var(--bg)] overflow-hidden"
                    onDrop={handleCanvasDrop}
                    onDragOver={handleCanvasDragOver}
                    onContextMenu={openWorkspaceCanvasContextMenu}
                    onPointerDown={handleCanvasPointerDown}
                >
                    <div className="pointer-events-none absolute inset-0 opacity-40 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:24px_24px]" />

                    {canvasSelectionBounds && (
                        <div
                            className="pointer-events-none absolute z-[18] rounded-sm border border-[var(--primary)]/70 bg-[var(--primary)]/15"
                            style={{
                                left: canvasSelectionBounds.x,
                                top: canvasSelectionBounds.y,
                                width: canvasSelectionBounds.width,
                                height: canvasSelectionBounds.height,
                            }}
                        />
                    )}
                    {canvasGroupOutlines.map((outline) => (
                        <div
                            key={outline.id}
                            data-workspace-group-outline="true"
                            className="pointer-events-none absolute z-[8] rounded-lg border-2 border-dashed border-[var(--primary)]/55 bg-[var(--primary)]/5"
                            style={{
                                left: outline.left,
                                top: outline.top,
                                width: outline.width,
                                height: outline.height,
                            }}
                        >
                            <button
                                type="button"
                                data-workspace-group-label="true"
                                onPointerDown={(event) => beginGroupDragFromLabel(event, outline.id)}
                                onContextMenu={(event) => openCanvasGroupItemMenu(event, outline.id)}
                                className="pointer-events-auto absolute -top-2 left-3 cursor-grab select-none rounded-sm border border-[var(--primary)]/45 bg-[var(--card-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)] active:cursor-grabbing"
                                title={t("workspace.dragToMoveGroup")}
                            >
                                {outline.name}
                            </button>
                        </div>
                    ))}

                    {placedFiles.length === 0 && placedMembers.length === 0 && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <p className="text-sm text-[var(--muted)]">{t("workspace.canvasEmptyHint")}</p>
                        </div>
                    )}

                    {placedFiles.map(({ placementId, file, position }) => {
                        const isFolder = isFolderEntry(file);
                        const isFolderOpen = isFolder && Boolean(openCanvasFolders[file.id]);
                        const folderChildren = isFolder ? canvasFilesByFolder[file.id] || [] : [];
                        const displayTitle = isFolder ? getFolderLabel(file.title) : file.title;
                        const fileItemKey = buildCanvasItemKey("file", placementId);
                        const isSelected = selectedCanvasItemKeySet.has(fileItemKey);
                        const canModifyPlacedFile = canViewerRemoveFileFromWorkspace(placementId);
                        return (
                            <div
                                key={placementId}
                                data-workspace-item="file"
                                onPointerDown={(event) => handlePlacedFilePointerDown(event, placementId, position)}
                                onContextMenu={(event) => openCanvasFileContextMenu(event, placementId)}
                                onDoubleClick={() => {
                                    if (isFolder) {
                                        setOpenCanvasFolders((prev) => ({
                                            ...prev,
                                            [file.id]: !Boolean(prev[file.id]),
                                        }));
                                        return;
                                    }
                                    openWorkspaceFile(file);
                                }}
                                className={cn(
                                    "absolute w-28 rounded-md border hover:border-[var(--border)] hover:bg-[var(--card-bg-hover)] p-2 text-left select-none",
                                    canModifyPlacedFile ? "cursor-grab active:cursor-grabbing" : "cursor-default",
                                    isSelected
                                        ? "border-[var(--primary)] bg-[var(--card-bg-hover)] shadow-[0_0_0_1px_var(--primary)]"
                                        : "border-transparent"
                                )}
                                style={{ left: position.x, top: position.y }}
                            >
                                <span className="absolute -top-3.5 left-0 z-10 max-w-[100px] truncate px-1 text-[9px] font-medium text-[var(--muted)] shadow-sm rounded-sm bg-[var(--card-bg)] border border-[var(--border)]">
                                    {members.find((m) => m.userId === file.ownerUserId)?.username || t("workspace.unknownUser")}
                                </span>
                                {canModifyPlacedFile && (
                                    <button
                                        type="button"
                                        onPointerDown={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                        }}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            handleRemovePlacedFile(placementId);
                                        }}
                                        className="absolute right-1 top-1 z-10 inline-flex h-5 w-5 items-center justify-center rounded-sm bg-transparent text-[var(--muted)] hover:text-rose-500 hover:bg-[var(--card-bg-hover)]"
                                        aria-label={t("workspace.removeItem", { title: displayTitle })}
                                        title={t("workspace.removeFromWorkspace")}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                                {workspaceMode === "my" && fileShareTargetMembers.length > 0 && (
                                    <button
                                        type="button"
                                        onPointerDown={(event) => beginFileShareDrag(event, file)}
                                        className="absolute -left-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card-bg)] text-[var(--fg)] shadow-sm hover:border-[var(--primary)] hover:text-[var(--primary)]"
                                        aria-label={t("workspace.shareItem", { title: displayTitle })}
                                        title={t("workspace.sendFile")}
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                    </button>
                                )}
                                {isFolder && (
                                    <button
                                        type="button"
                                        onPointerDown={(event) => event.stopPropagation()}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setOpenCanvasFolders((prev) => ({
                                                ...prev,
                                                [file.id]: !Boolean(prev[file.id]),
                                            }));
                                        }}
                                        className="absolute left-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-sm text-[var(--muted)] hover:bg-[var(--card-bg-hover)] hover:text-[var(--fg)]"
                                        aria-label={
                                            isFolderOpen
                                                ? t("workspace.closeItem", { title: displayTitle })
                                                : t("workspace.openItem", { title: displayTitle })
                                        }
                                    >
                                        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isFolderOpen && "rotate-90")} />
                                    </button>
                                )}
                                <div className="flex flex-col items-center gap-1.5 mt-2">
                                    {isFolder ? (
                                        isFolderOpen ? (
                                            <FolderOpen className="w-8 h-8 text-amber-500" />
                                        ) : (
                                            <Folder className="w-8 h-8 text-amber-500" />
                                        )
                                    ) : (
                                        <File className="w-8 h-8 text-[var(--primary)]" />
                                    )}
                                    <p className="w-full text-center text-xs text-[var(--fg)] truncate">{displayTitle}</p>
                                    <p className="text-[10px] text-[var(--muted)]">
                                        {isFolder
                                            ? t("workspace.items", { count: folderChildren.length })
                                            : file.createdAt
                                                ? new Date(file.createdAt).toLocaleDateString()
                                                : ""}
                                    </p>
                                </div>
                                {isFolder && isFolderOpen && (
                                    <div className="absolute left-full top-0 ml-2 w-56 rounded-md border border-[var(--border)] bg-[var(--card-bg)] p-1.5 shadow-md">
                                        <p className="mb-1 px-1 text-[10px] text-[var(--muted)]">{t("workspace.folder")}</p>
                                        {folderChildren.length === 0 ? (
                                            <p className="px-1 py-1 text-xs text-[var(--muted)]">{t("workspace.noFiles")}</p>
                                        ) : (
                                            <div className="max-h-40 space-y-0.5 overflow-auto">
                                                {folderChildren.map((child) => (
                                                    <button
                                                        key={child.id}
                                                        type="button"
                                                        onPointerDown={(event) => event.stopPropagation()}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            openWorkspaceFile(child);
                                                        }}
                                                        className="w-full truncate rounded px-1.5 py-1 text-left text-xs text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                                        title={child.title}
                                                    >
                                                        {child.title}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {renderItemCommentWidget(fileItemKey)}
                            </div>
                        );
                    })}

                    {placedMembers.map(({ placementId, member, position, width }) => {
                        const memberItemKey = buildCanvasItemKey("member", placementId);
                        const presence = resolvePresence(member.status);
                        const dotClass =
                            presence === "active"
                                ? "bg-sky-500"
                                : presence === "away"
                                    ? "bg-amber-400"
                                    : "bg-slate-400";
                        const isMe = Boolean(data.viewerUserId) && member.userId === data.viewerUserId;
                        const isShareHover = Boolean(
                            fileShareDrag &&
                            fileShareDrag.hoverUserId === member.userId &&
                            member.userId !== data.viewerUserId
                        );
                        const isSelected = selectedCanvasItemKeySet.has(memberItemKey);
                        const canModifyMemberPlacement = canViewerModifyMemberPlacement(placementId);

                        return (
                            <div
                                key={placementId}
                                data-workspace-item="member"
                                data-workspace-member-drop-target="true"
                                data-member-user-id={member.userId}
                                data-member-username={member.username || member.userId}
                                onPointerDown={(event) => handlePlacedMemberPointerDown(event, placementId, position)}
                                onContextMenu={(event) =>
                                    openProfileMenu(event, member.userId, {
                                        canvasItemKey: memberItemKey,
                                    })
                                }
                                className={cn(
                                    "absolute rounded-md border bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] px-2 py-1 text-left select-none shadow-sm",
                                    canModifyMemberPlacement ? "cursor-grab active:cursor-grabbing" : "cursor-default",
                                    isSelected
                                        ? "border-[var(--primary)] shadow-[0_0_0_1px_var(--primary)]"
                                        : "border-[var(--border)]",
                                    isShareHover && "ring-1 ring-[var(--primary)] bg-[var(--card-bg-hover)]"
                                )}
                                style={{ left: position.x, top: position.y, width, height: CANVAS_MEMBER_HEIGHT }}
                            >
                                {canModifyMemberPlacement && (
                                    <button
                                        type="button"
                                        onPointerDown={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                        }}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            handleRemovePlacedMember(placementId, { bypassPermissionCheck: true });
                                        }}
                                        className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-sm bg-transparent text-[var(--muted)] hover:text-rose-500"
                                        aria-label={t("workspace.removeItem", { title: member.username || member.userId })}
                                        title={t("workspace.removeFromWorkspace")}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                                {!isMe && (
                                    <button
                                        type="button"
                                        onPointerDown={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                        }}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            openMemberChat(member);
                                        }}
                                        className="absolute right-1 bottom-1 inline-flex h-5 w-5 items-center justify-center rounded-sm border border-[var(--border)] bg-[var(--card-bg-hover)] text-[var(--fg)] hover:text-[var(--primary)]"
                                        aria-label={t("workspace.chatWith", { username: member.username || member.userId })}
                                    >
                                        <MessageSquare className="h-3.5 w-3.5" />
                                    </button>
                                )}
                                <div className="h-full flex items-center gap-2 pr-5">
                                    <span className={cn("inline-block h-2.5 w-2.5 rounded-full", dotClass)} />
                                    <div className="h-8 w-8 rounded-full border border-[var(--border)] bg-[var(--card-bg-hover)] flex items-center justify-center shrink-0">
                                        <UserRound className="w-4 h-4 text-[var(--muted)]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <p className="text-sm font-medium text-[var(--fg)] whitespace-nowrap">{member.username || member.userId}</p>
                                            {isMe && (
                                                <span className="shrink-0 rounded-full border border-[var(--primary)] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[var(--primary)]">
                                                    {t("workspace.my")}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-[var(--muted)]">{getRoleLabel(member.role)}</p>
                                    </div>
                                </div>
                                {renderItemCommentWidget(memberItemKey)}
                            </div>
                        );
                    })}

                    {annotations
                        .filter((annotation) => annotation.kind === annotationKindForMode)
                        .filter(
                            (annotation) =>
                                !hiddenCanvasItemKeySet.has(buildCanvasItemKey("annotation", annotation.id))
                        )
                        .map((annotation) => {
                            const isComment = annotation.kind === "comment";
                            const annotationItemKey = buildCanvasItemKey("annotation", annotation.id);
                            const isExpanded = activeAnnotationId === annotation.id;
                            const isSelected = selectedCanvasItemKeySet.has(annotationItemKey);
                            return (
                                <div
                                    key={annotation.id}
                                    data-workspace-annotation="true"
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onContextMenu={(event) => openAnnotationItemMenu(event, annotation.id)}
                                    className={cn(
                                        "absolute z-10",
                                        isSelected && "ring-2 ring-[var(--primary)]/70 rounded-xl",
                                        isExpanded
                                            ? cn(
                                                "w-[340px] max-w-[68vw] rounded-xl border shadow-md",
                                                isComment
                                                    ? "border-sky-500/45 bg-[color:rgb(15_23_42_/_0.95)]"
                                                    : "border-amber-500/45 bg-[color:rgb(24_24_27_/_0.95)]"
                                            )
                                            : ""
                                    )}
                                    style={
                                        isExpanded
                                            ? {
                                                left: annotation.x,
                                                top: annotation.y,
                                                width: annotation.width,
                                                height: annotation.height,
                                            }
                                            : { left: annotation.x, top: annotation.y }
                                    }
                                >
                                    {isExpanded ? (
                                        <div className="relative flex h-full w-full flex-col">
                                            <div
                                                className={cn(
                                                    "flex cursor-grab items-center justify-between border-b px-3 py-2 active:cursor-grabbing",
                                                    isComment
                                                        ? "border-sky-500/35 bg-sky-500/10"
                                                        : "border-amber-500/35 bg-amber-500/10"
                                                )}
                                                onPointerDown={(event) =>
                                                    handlePlacedAnnotationPointerDown(event, annotation.id, {
                                                        x: annotation.x,
                                                        y: annotation.y,
                                                    })
                                                }
                                            >
                                                <div className="inline-flex items-center gap-2 text-sm font-medium text-[var(--fg)]">
                                                    <span className="inline-flex h-6 w-6 cursor-grab items-center justify-center rounded-sm border border-transparent text-[var(--muted)] active:cursor-grabbing">
                                                        {isComment ? (
                                                            <MessageCircle className="h-4 w-4 text-sky-300" />
                                                        ) : (
                                                            <NotebookPen className="h-4 w-4 text-amber-300" />
                                                        )}
                                                    </span>
                                                    {editingAnnotationTitleId === annotation.id ? (
                                                        <input
                                                            ref={annotationTitleInputRef}
                                                            type="text"
                                                            value={annotation.title}
                                                            onPointerDown={(event) => event.stopPropagation()}
                                                            onClick={(event) => event.stopPropagation()}
                                                            onChange={(event) =>
                                                                updateAnnotationTitle(annotation.id, event.target.value)
                                                            }
                                                            onBlur={() => {
                                                                updateAnnotationTitle(annotation.id, annotation.title, {
                                                                    finalize: true,
                                                                });
                                                                setEditingAnnotationTitleId(null);
                                                            }}
                                                            onKeyDown={(event) => {
                                                                if (event.key === "Enter") {
                                                                    event.preventDefault();
                                                                    updateAnnotationTitle(annotation.id, annotation.title, {
                                                                        finalize: true,
                                                                    });
                                                                    setEditingAnnotationTitleId(null);
                                                                    return;
                                                                }
                                                                if (event.key === "Escape") {
                                                                    event.preventDefault();
                                                                    updateAnnotationTitle(
                                                                        annotation.id,
                                                                        getDefaultAnnotationTitle(annotation.kind, t),
                                                                        { finalize: true }
                                                                    );
                                                                    setEditingAnnotationTitleId(null);
                                                                }
                                                            }}
                                                            className="h-7 w-40 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-2 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--border)]"
                                                            placeholder={getDefaultAnnotationTitle(annotation.kind, t)}
                                                        />
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onPointerDown={(event) => event.stopPropagation()}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                setEditingAnnotationTitleId(annotation.id);
                                                            }}
                                                            className="truncate rounded-sm px-1 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                                            title={t("workspace.rename")}
                                                        >
                                                            {annotation.title || getDefaultAnnotationTitle(annotation.kind, t)}
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="inline-flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onPointerDown={(event) => event.stopPropagation()}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            closeAnnotationEditor();
                                                        }}
                                                        className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-[var(--muted)] hover:text-[var(--fg)]"
                                                        aria-label={isComment ? t("workspace.minimizeComment") : t("workspace.minimizeMemo")}
                                                        title={t("workspace.minimize")}
                                                    >
                                                        <span className="block h-[2px] w-4 rounded-full bg-current" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onPointerDown={(event) => {
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                        }}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            removeAnnotationFromWorkspace(annotation.id);
                                                        }}
                                                        className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-[var(--muted)] hover:text-rose-400"
                                                        aria-label={t("workspace.removeItem", {
                                                            title: annotation.title || getDefaultAnnotationTitle(annotation.kind, t),
                                                        })}
                                                        title={t("workspace.removeFromWorkspace")}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex-1 p-3">
                                                <textarea
                                                    ref={isExpanded ? annotationEditorRef : undefined}
                                                    value={annotation.text}
                                                    onClick={(event) => event.stopPropagation()}
                                                    onChange={(event) =>
                                                        updateAnnotationText(annotation.id, event.target.value)
                                                    }
                                                    className="h-full w-full resize-none rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--border)]"
                                                    placeholder={
                                                        isComment
                                                            ? t("workspace.annotation.commentPlaceholder")
                                                            : t("workspace.annotation.memoPlaceholder")
                                                    }
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                aria-label={t("workspace.resizeAnnotation")}
                                                onPointerDown={(event) =>
                                                    handlePlacedAnnotationResizePointerDown(event, annotation)
                                                }
                                                className="absolute bottom-1 right-1 inline-flex h-5 w-5 cursor-se-resize items-center justify-center rounded-sm border border-[var(--border)] bg-[var(--card-bg-hover)] text-[var(--muted)] hover:text-[var(--fg)]"
                                            >
                                                <span className="text-[11px] leading-none">+</span>
                                            </button>
                                        </div>
                                    ) : (
                                        isComment ? (
                                            <button
                                                type="button"
                                                onPointerDown={(event) =>
                                                    handlePlacedAnnotationPointerDown(event, annotation.id, {
                                                        x: annotation.x,
                                                        y: annotation.y,
                                                    })
                                                }
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    if (suppressAnnotationClickIdRef.current === annotation.id) {
                                                        suppressAnnotationClickIdRef.current = null;
                                                        return;
                                                    }
                                                    openAnnotationEditor(annotation.id);
                                                }}
                                                className="flex w-56 cursor-grab items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/15 px-2 py-1.5 text-left shadow-sm transition-colors hover:bg-sky-500/20 active:cursor-grabbing"
                                                title={annotation.text || t("workspace.noContent")}
                                            >
                                                <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-sky-500/35 bg-sky-500/20 text-sky-300">
                                                    <MessageCircle className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-[10px] font-medium text-sky-200">
                                                        {annotation.authorName ||
                                                            (viewerMember?.username || data.viewerUserId || t("workspace.unknown"))}
                                                    </p>
                                                    <p className="truncate text-[11px] text-sky-100/90">
                                                        {String(annotation.text || "").trim() || t("workspace.noContent")}
                                                    </p>
                                                </div>
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onPointerDown={(event) =>
                                                    handlePlacedAnnotationPointerDown(event, annotation.id, {
                                                        x: annotation.x,
                                                        y: annotation.y,
                                                    })
                                                }
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    if (suppressAnnotationClickIdRef.current === annotation.id) {
                                                        suppressAnnotationClickIdRef.current = null;
                                                        return;
                                                    }
                                                    openAnnotationEditor(annotation.id);
                                                }}
                                                className="inline-flex h-11 w-11 cursor-grab items-center justify-center rounded-lg border border-amber-500/45 bg-amber-500/16 text-amber-300 shadow-sm transition-colors hover:bg-amber-500/22 active:cursor-grabbing"
                                                title={t("workspace.annotation.memoPreview", { text: annotation.text || t("workspace.empty") })}
                                            >
                                                <NotebookPen className="h-5 w-5" />
                                            </button>
                                        )
                                    )}
                                    {!isComment &&
                                        renderItemCommentWidget(annotationItemKey, {
                                            rootClassName: "left-0.5 bottom-0.5",
                                            buttonClassName: "h-5 w-5",
                                            panelClassName: "z-30",
                                        })}
                                </div>
                            );
                        })}
                </div>
                {isWorkspaceActionPending && (
                    <div className="absolute inset-0 z-[96] flex items-center justify-center bg-[var(--bg)]/38 backdrop-blur-[1px]">
                        <div className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--card-bg)]/95 px-3 py-2 text-xs font-medium text-[var(--fg)] shadow-sm">
                            <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" />
                            <span>{t("common.loading")}</span>
                        </div>
                    </div>
                )}
            </section>

            {fileShareDrag && (
                <div className="pointer-events-none fixed inset-0 z-[90]">
                    <svg className="absolute inset-0 h-full w-full">
                        <line
                            x1={fileShareDrag.startX}
                            y1={fileShareDrag.startY}
                            x2={fileShareDrag.currentX}
                            y2={fileShareDrag.currentY}
                            stroke="var(--primary)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeDasharray="6 6"
                            opacity="0.9"
                        />
                    </svg>
                    <div
                        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--primary)]/45 bg-[var(--card-bg)] p-1 text-[var(--primary)] shadow-sm"
                        style={{ left: fileShareDrag.currentX, top: fileShareDrag.currentY }}
                    >
                        <Plus className="h-4 w-4" />
                    </div>
                    <div
                        className="absolute -translate-x-1/2 rounded-md border border-[var(--border)] bg-[var(--card-bg)]/96 px-2 py-1 text-[11px] text-[var(--fg)] shadow-sm"
                        style={{ left: fileShareDrag.currentX, top: fileShareDrag.currentY + 18 }}
                    >
                        {fileShareDrag.hoverUserId
                            ? t("workspace.sendTo", { username: fileShareDrag.hoverUsername })
                            : t("workspace.dropOnMemberCard")}
                    </div>
                </div>
            )}

            {groupDragPreview && (
                <div
                    className="pointer-events-none fixed z-[89] -translate-x-1/2 -translate-y-1/2 rounded-md border border-[var(--border)] bg-[var(--card-bg)]/96 px-2 py-1 shadow-lg"
                    style={{ left: groupDragPreview.x, top: groupDragPreview.y }}
                >
                    <div className="flex max-w-[200px] items-center gap-1.5">
                        {groupDragPreview.kind === "file" ? (
                            <File className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
                        ) : groupDragPreview.kind === "member" ? (
                            <UserRound className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                        ) : groupDragPreview.kind === "annotation" ? (
                            <MessageCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        ) : (
                            <Boxes className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
                        )}
                        <span className="truncate text-[11px] text-[var(--fg)]">{groupDragPreview.label}</span>
                    </div>
                </div>
            )}

            {groupDropAnimations.map((animation) => {
                const deltaX = animation.toX - animation.fromX;
                const deltaY = animation.toY - animation.fromY;
                return (
                    <div
                        key={animation.id}
                        className="pointer-events-none fixed z-[88] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card-bg)]/90 shadow-sm"
                        style={{
                            left: animation.fromX,
                            top: animation.fromY,
                            width: animation.fromWidth,
                            height: animation.fromHeight,
                            transformOrigin: "top left",
                            transform: animation.started
                                ? `translate(${deltaX}px, ${deltaY}px) scale(0.1)`
                                : "translate(0px, 0px) scale(1)",
                            opacity: animation.started ? 0.02 : 0.96,
                            transition: "transform 320ms cubic-bezier(0.16, 0.84, 0.22, 1), opacity 320ms ease",
                        }}
                    >
                        <div className="flex h-full w-full items-center justify-center">
                            {animation.kind === "file" ? (
                                <File className="h-4 w-4 text-[var(--primary)]" />
                            ) : animation.kind === "member" ? (
                                <UserRound className="h-4 w-4 text-sky-500" />
                            ) : (
                                <MessageCircle className="h-4 w-4 text-amber-500" />
                            )}
                        </div>
                    </div>
                );
            })}

            {profileMenu && (
                <div
                    data-workspace-profile-menu="true"
                    className="fixed z-[70] min-w-[168px] border rounded-md shadow-md py-1"
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
                        {t("workspace.profile")}
                    </button>
                    {canMoveProfileMenuItem && (
                        <>
                            <div className="my-1 border-t border-[var(--border)]" />
                            <div className="group/move relative">
                                <div className="flex w-full items-center justify-between px-3 py-1.5 text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]">
                                    <span>{t("workspace.moveToGroup")}</span>
                                    <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)]" />
                                </div>
                                <div
                                    className={cn(
                                        "absolute top-0 z-10 hidden min-w-[188px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card-bg)] py-1 shadow-md group-hover/move:block group-focus-within/move:block",
                                        profileMenu?.roleSubmenuLeft ? "right-full mr-1" : "left-full ml-1"
                                    )}
                                >
                                    {workspaceGroups.length === 0 ? (
                                        <p className="px-3 py-2 text-xs text-[var(--muted)]">{t("workspace.noGroupsAvailable")}</p>
                                    ) : (
                                        <div className="max-h-60 overflow-auto">
                                            {workspaceGroups.map((group) => (
                                                <button
                                                    key={group.id}
                                                    type="button"
                                                    className="w-full px-3 py-1.5 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                                    onClick={() => moveProfileItemToGroupFromMenu(group.id)}
                                                >
                                                    <span className="flex items-center gap-2 min-w-0">
                                                        <Boxes className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
                                                        <span className="min-w-0 truncate">{group.name}</span>
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {canUngroupProfileMenuItem && (
                                <button
                                    type="button"
                                    className="w-full px-3 py-1.5 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                    onClick={removeProfileItemFromGroupsFromMenu}
                                >
                                    {t("workspace.removeFromGroup")}
                                </button>
                            )}
                            {canLeaveCommentProfileMenuItem && (
                                <button
                                    type="button"
                                    className="w-full px-3 py-1.5 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                    onClick={openProfileItemCommentFromMenu}
                                >
                                    {t("workspace.annotation.createComment")}
                                </button>
                            )}
                            {canRemoveProfileMenuItem && (
                                <button
                                    type="button"
                                    className="w-full px-3 py-1.5 text-left text-sm text-rose-500 hover:bg-[var(--card-bg-hover)]"
                                    onClick={removeProfileItemFromWorkspaceFromMenu}
                                >
                                    {t("workspace.removeFromWorkspace")}
                                </button>
                            )}
                        </>
                    )}
                    {canManageProfileMenuRole && (
                        <>
                            <div className="my-1 border-t border-[var(--border)]" />
                            <div className="group/role relative">
                                <div className="flex w-full items-center justify-between px-3 py-1.5 text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]">
                                    <span>{t("workspace.role")}</span>
                                    <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)]" />
                                </div>
                                <div
                                    className={cn(
                                        "absolute top-0 z-10 hidden min-w-[156px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card-bg)] py-1 shadow-md group-hover/role:block group-focus-within/role:block",
                                        profileMenu?.roleSubmenuLeft ? "right-full mr-1" : "left-full ml-1"
                                    )}
                                >
                                    <button
                                        type="button"
                                        className="w-full text-left px-3 py-1.5 text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)] disabled:text-[var(--muted)]"
                                        onClick={() => openRoleChangeConfirmFromMenu("Admin")}
                                        disabled={profileMenuTargetMember?.role === "Admin"}
                                    >
                                        {t("workspace.setAsAdmin")}
                                    </button>
                                    <button
                                        type="button"
                                        className="w-full text-left px-3 py-1.5 text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)] disabled:text-[var(--muted)]"
                                        onClick={() => openRoleChangeConfirmFromMenu("Member")}
                                        disabled={profileMenuTargetMember?.role === "Member"}
                                    >
                                        {t("workspace.setAsMember")}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {canvasMenu && (
                <div
                    data-workspace-canvas-menu="true"
                    className="fixed z-[72] inline-flex w-fit min-w-0 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card-bg)] py-1 shadow-md"
                    style={{ left: `${canvasMenu.x}px`, top: `${canvasMenu.y}px` }}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    <button
                        type="button"
                        className="whitespace-nowrap px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                        onClick={openCreateEntry}
                    >
                        {t("workspace.createFolder")}
                    </button>
                    <button
                        type="button"
                        className="whitespace-nowrap px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                        onClick={triggerImportFolders}
                    >
                        {t("workspace.importFolder")}
                    </button>
                    <button
                        type="button"
                        className="whitespace-nowrap px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                        onClick={triggerImportFiles}
                    >
                        {t("workspace.importFiles")}
                    </button>
                </div>
            )}

            {workspaceCanvasMenu && (
                <div
                    data-workspace-canvas-context-menu="true"
                    className="fixed z-[73] inline-flex w-fit min-w-0 flex-col overflow-visible rounded-md border border-[var(--border)] bg-[var(--card-bg)] py-1 shadow-md"
                    style={{ left: `${workspaceCanvasMenu.x}px`, top: `${workspaceCanvasMenu.y}px` }}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    {selectedCanvasItemKeys.length > 0 && (
                        <div className="group/move relative">
                            <div className="flex w-full items-center justify-between whitespace-nowrap px-3 py-2 text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]">
                                <span>{t("workspace.moveToGroup")}</span>
                                <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)]" />
                            </div>
                            <div
                                className={cn(
                                    "absolute top-0 z-10 hidden min-w-[188px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card-bg)] py-1 shadow-md group-hover/move:block group-focus-within/move:block",
                                    workspaceCanvasMenu?.moveSubmenuLeft ? "right-full mr-0" : "left-full ml-0"
                                )}
                            >
                                {workspaceGroups.length === 0 ? (
                                    <p className="px-3 py-2 text-xs text-[var(--muted)]">{t("workspace.noGroupsAvailable")}</p>
                                ) : (
                                    <div className="max-h-60 overflow-auto">
                                        {workspaceGroups.map((group) => (
                                            <button
                                                key={group.id}
                                                type="button"
                                                className="w-full px-3 py-1.5 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                                onClick={() => moveSelectedCanvasItemsToGroupFromMenu(group.id)}
                                            >
                                                <span className="flex items-center gap-2 min-w-0">
                                                    <Boxes className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
                                                    <span className="min-w-0 truncate">{group.name}</span>
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {workspaceMode === "my" && selectedCanvasItemKeys.length > 0 && (
                        <button
                            type="button"
                            className="whitespace-nowrap px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                            onClick={createGroupFromSelectedCanvasItems}
                        >
                            {t("workspace.createGroup")}
                        </button>
                    )}
                    {removableSelectedCanvasItems.length > 0 && (
                        <button
                            type="button"
                            className="whitespace-nowrap px-3 py-2 text-left text-sm text-rose-500 hover:bg-[var(--card-bg-hover)]"
                            onClick={removeSelectedCanvasItemsFromWorkspace}
                        >
                            {t("workspace.removeFromWorkspace")} ({removableSelectedCanvasItems.length})
                        </button>
                    )}
                    {workspaceCanvasMenu.mode !== "groupOnly" && (
                        <button
                            type="button"
                            className="whitespace-nowrap px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                            onClick={() => createWorkspaceAnnotation()}
                        >
                            {annotationActionLabel}
                        </button>
                    )}
                </div>
            )}

            {annotationItemMenu && (
                <div
                    data-workspace-annotation-item-menu="true"
                    className="fixed z-[74] min-w-[156px] rounded-md border border-[var(--border)] bg-[var(--card-bg)] py-1 shadow-md"
                    style={{ left: `${annotationItemMenu.x}px`, top: `${annotationItemMenu.y}px` }}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    <div className="group/move relative">
                        <div className="flex w-full items-center justify-between px-3 py-2 text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]">
                            <span>{t("workspace.moveToGroup")}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)]" />
                        </div>
                        <div className="absolute left-full top-0 z-10 ml-1 hidden min-w-[188px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card-bg)] py-1 shadow-md group-hover/move:block group-focus-within/move:block">
                            {workspaceGroups.length === 0 ? (
                                <p className="px-3 py-2 text-xs text-[var(--muted)]">{t("workspace.noGroupsAvailable")}</p>
                            ) : (
                                <div className="max-h-60 overflow-auto">
                                    {workspaceGroups.map((group) => (
                                        <button
                                            key={group.id}
                                            type="button"
                                            className="w-full px-3 py-1.5 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                            onClick={() => moveAnnotationItemToGroupFromMenu(group.id)}
                                        >
                                            <span className="flex items-center gap-2 min-w-0">
                                                <Boxes className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
                                                <span className="min-w-0 truncate">{group.name}</span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="my-1 border-t border-[var(--border)]" />
                    {canUngroupAnnotationItem && (
                        <>
                            <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                onClick={removeAnnotationItemFromGroupsFromMenu}
                            >
                                {t("workspace.removeFromGroup")}
                            </button>
                            <div className="my-1 border-t border-[var(--border)]" />
                        </>
                    )}
                    {canLeaveCommentAnnotationItem && (
                        <>
                            <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                onClick={openAnnotationItemCommentFromMenu}
                            >
                                {t("workspace.annotation.createComment")}
                            </button>
                        </>
                    )}
                    {!canUngroupAnnotationItem && (
                        <>
                            {canLeaveCommentAnnotationItem && <div className="my-1 border-t border-[var(--border)]" />}
                            <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm text-rose-500 hover:bg-[var(--card-bg-hover)]"
                                onClick={handleDeleteAnnotationFromMenu}
                            >
                                {t("workspace.removeFromWorkspace")}
                            </button>
                        </>
                    )}
                </div>
            )}

            {canvasFileItemMenu && (
                <div
                    data-workspace-canvas-file-item-menu="true"
                    className="fixed z-[74] min-w-[172px] rounded-md border border-[var(--border)] bg-[var(--card-bg)] py-1 shadow-md"
                    style={{ left: `${canvasFileItemMenu.x}px`, top: `${canvasFileItemMenu.y}px` }}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    <div className="group/move relative">
                        <div className="flex w-full items-center justify-between px-3 py-2 text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]">
                            <span>{t("workspace.moveToGroup")}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)]" />
                        </div>
                        <div className="absolute left-full top-0 z-10 ml-1 hidden min-w-[188px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card-bg)] py-1 shadow-md group-hover/move:block group-focus-within/move:block">
                            {workspaceGroups.length === 0 ? (
                                <p className="px-3 py-2 text-xs text-[var(--muted)]">{t("workspace.noGroupsAvailable")}</p>
                            ) : (
                                <div className="max-h-60 overflow-auto">
                                    {workspaceGroups.map((group) => (
                                        <button
                                            key={group.id}
                                            type="button"
                                            className="w-full px-3 py-1.5 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                            onClick={() => moveCanvasFileItemToGroupFromMenu(group.id)}
                                        >
                                            <span className="flex items-center gap-2 min-w-0">
                                                <Boxes className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
                                                <span className="min-w-0 truncate">{group.name}</span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    {canSendFileFromCanvasMenu && (
                        <>
                            <div className="my-1 border-t border-[var(--border)]" />
                            <div className="group/share relative">
                                <div className="flex w-full items-center justify-between px-3 py-2 text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]">
                                    <span>{t("workspace.sendFile")}</span>
                                    <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)]" />
                                </div>
                                <div
                                    className={cn(
                                        "absolute top-0 z-10 hidden min-w-[188px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card-bg)] py-1 shadow-md group-hover/share:block group-focus-within/share:block",
                                        canvasFileItemMenu?.shareSubmenuLeft ? "right-full mr-1" : "left-full ml-1"
                                    )}
                                >
                                    <div className="max-h-60 overflow-auto">
                                        {fileShareTargetMembers.map((member) => (
                                            <button
                                                key={member.userId}
                                                type="button"
                                                className="w-full px-3 py-1.5 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                                onClick={() => openFileShareFromCanvasMenu(member.userId)}
                                            >
                                                <span className="block truncate">{member.username || member.userId}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                    {canUngroupCanvasFileItem && (
                        <>
                            <div className="my-1 border-t border-[var(--border)]" />
                            <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                onClick={removeCanvasFileItemFromGroupsFromMenu}
                            >
                                {t("workspace.removeFromGroup")}
                            </button>
                        </>
                    )}
                    <div className="my-1 border-t border-[var(--border)]" />
                    <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                        onClick={openCanvasFileItemCommentFromMenu}
                    >
                        {t("workspace.annotation.createComment")}
                    </button>
                    {canRemoveCanvasFileItemFromWorkspace && (
                        <>
                            <div className="my-1 border-t border-[var(--border)]" />
                            <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm text-rose-500 hover:bg-[var(--card-bg-hover)]"
                                onClick={removeCanvasFileItemFromWorkspaceFromMenu}
                            >
                                {t("workspace.removeFromWorkspace")}
                            </button>
                        </>
                    )}
                </div>
            )}

            {fileItemMenu && (
                <div
                    data-workspace-file-item-menu="true"
                    className="fixed z-[73] min-w-[172px] overflow-visible rounded-md border border-[var(--border)] bg-[var(--card-bg)] py-1 shadow-md"
                    style={{ left: `${fileItemMenu.x}px`, top: `${fileItemMenu.y}px` }}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                        onClick={startInlineRenameFromMenu}
                    >
                        {t("workspace.rename")}
                    </button>
                    {!fileMenuTargetIsFolder && (
                        <div className="group/move relative">
                            <button
                                type="button"
                                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                onClick={openMoveFileFromMenu}
                            >
                                <span>{t("workspace.moveToFolder")}</span>
                                <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)]" />
                            </button>
                            <div
                                className={cn(
                                    "absolute top-0 z-10 hidden min-w-[188px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card-bg)] py-1 shadow-md group-hover/move:block group-focus-within/move:block",
                                    fileItemMenu?.moveSubmenuLeft ? "right-full mr-1" : "left-full ml-1"
                                )}
                            >
                                <div className="max-h-60 overflow-auto">
                                    <button
                                        type="button"
                                        className={cn(
                                            "w-full px-3 py-1.5 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]",
                                            !fileMenuCurrentFolderId && "cursor-default text-[var(--muted)] hover:bg-transparent"
                                        )}
                                        onClick={() => void moveFileToFolderFromMenu(null)}
                                        disabled={!fileMenuCurrentFolderId}
                                    >
                                        {t("workspace.root")}
                                    </button>
                                    {fileMenuMoveFolderOptions.map((folder) => {
                                        const isCurrent = folder.id === fileMenuCurrentFolderId;
                                        return (
                                            <button
                                                key={folder.id}
                                                type="button"
                                                className={cn(
                                                    "w-full px-3 py-1.5 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]",
                                                    isCurrent && "cursor-default text-[var(--muted)] hover:bg-transparent"
                                                )}
                                                onClick={() => void moveFileToFolderFromMenu(folder.id)}
                                                disabled={isCurrent}
                                            >
                                                <span className="block truncate">{getFolderLabel(folder.title)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                    {!fileMenuTargetIsFolder && (
                        <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                            onClick={openCreateEntryForFileFromMenu}
                        >
                            {t("workspace.createFolder")}
                        </button>
                    )}
                    {canSendFileFromSidebarMenu && (
                        <div className="group/share relative">
                            <div className="flex w-full items-center justify-between px-3 py-2 text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]">
                                <span>{t("workspace.sendFile")}</span>
                                <ChevronRight className="h-3.5 w-3.5 text-[var(--muted)]" />
                            </div>
                            <div
                                className={cn(
                                    "absolute top-0 z-10 hidden min-w-[188px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card-bg)] py-1 shadow-md group-hover/share:block group-focus-within/share:block",
                                    fileItemMenu?.shareSubmenuLeft ? "right-full mr-1" : "left-full ml-1"
                                )}
                            >
                                <div className="max-h-60 overflow-auto">
                                    {fileShareTargetMembers.map((member) => (
                                        <button
                                            key={member.userId}
                                            type="button"
                                            className="w-full px-3 py-1.5 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                            onClick={() => openFileShareFromSidebarMenu(member.userId)}
                                        >
                                            <span className="block truncate">{member.username || member.userId}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-rose-500 hover:bg-[var(--card-bg-hover)]"
                        onClick={() => void handleDeleteFileFromMenu()}
                    >
                        {t("workspace.delete")}
                    </button>
                </div>
            )}

            {groupMenu && (
                <div
                    data-workspace-group-menu="true"
                    className="fixed z-[73] min-w-[148px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card-bg)] py-1 shadow-md"
                    style={{ left: `${groupMenu.x}px`, top: `${groupMenu.y}px` }}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    {!groupMenu.groupId ? (
                        <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                            onClick={createEmptyWorkspaceGroupFromSidebar}
                        >
                            {t("workspace.createGroup")}
                        </button>
                    ) : groupMenu.source === "canvas" ? (
                        <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-rose-500 hover:bg-[var(--card-bg-hover)]"
                            onClick={handleHideCanvasGroupFromMenu}
                        >
                            {t("workspace.removeFromWorkspace")}
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                                onClick={startGroupInlineRenameFromMenu}
                            >
                                {t("workspace.rename")}
                            </button>
                            <button
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm text-rose-500 hover:bg-[var(--card-bg-hover)]"
                                onClick={handleDeleteGroupFromMenu}
                            >
                                {t("workspace.delete")}
                            </button>
                        </>
                    )}
                </div>
            )}

            {groupEntryMenu && (
                <div
                    data-workspace-group-entry-menu="true"
                    className="fixed z-[73] min-w-[156px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card-bg)] py-1 shadow-md"
                    style={{ left: `${groupEntryMenu.x}px`, top: `${groupEntryMenu.y}px` }}
                    onMouseDown={(event) => event.stopPropagation()}
                >
                    <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-rose-500 hover:bg-[var(--card-bg-hover)]"
                        onClick={handleRemoveGroupEntryFromMenu}
                    >
                        {t("workspace.removeFromGroup")}
                    </button>
                </div>
            )}
            {groupHintTooltip && (
                <div
                    className="pointer-events-none fixed z-[80] whitespace-nowrap rounded border border-[var(--border)] bg-[var(--card-bg)] px-2 py-1 text-[10px] text-[var(--fg)] shadow-md"
                    style={{ left: groupHintTooltip.x, top: groupHintTooltip.y, transform: "translateY(-50%)" }}
                >
                    {groupHintTooltipText}
                </div>
            )}

            <input
                ref={importFileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                    void handleImportFilesChange(event);
                }}
            />
            <input
                ref={importFolderInputRef}
                type="file"
                className="hidden"
                multiple
                {...({ webkitdirectory: "true", directory: "true" } as Record<string, string>)}
                onChange={(event) => {
                    void handleImportFoldersChange(event);
                }}
            />

            <ModalShell open={createEntryModal.open} onClose={closeCreateEntry} labelledBy={createEntryDialogTitleId}>
                <div className="border-b border-[var(--border)] px-5 py-4">
                    <h3 id={createEntryDialogTitleId} className="text-base font-semibold text-[var(--fg)]">
                        {t("workspace.createFolder")}
                    </h3>
                </div>
                <div className="space-y-2 px-5 py-4">
                    <label htmlFor={createEntryInputId} className="text-xs text-[var(--muted)]">
                        {t("workspace.name")}
                    </label>
                    <input
                        id={createEntryInputId}
                        value={createEntryModal.name}
                        onChange={(event) =>
                            setCreateEntryModal((prev) => ({
                                ...prev,
                                name: event.target.value.slice(0, 120),
                            }))
                        }
                        className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                        placeholder={t("workspace.folderName")}
                    />
                    {createEntryModal.error && <p className="text-xs text-rose-500">{createEntryModal.error}</p>}
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={closeCreateEntry}
                        disabled={createEntryModal.isSubmitting}
                    >
                        {t("common.cancel")}
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => void submitCreateEntry()}
                        disabled={createEntryModal.isSubmitting}
                    >
                        {createEntryModal.isSubmitting ? t("workspace.creating") : t("workspace.create")}
                    </Button>
                </div>
            </ModalShell>

            <ModalShell open={moveFileModal.open} onClose={closeMoveFile} labelledBy={moveFileDialogTitleId}>
                <div className="border-b border-[var(--border)] px-5 py-4">
                    <h3 id={moveFileDialogTitleId} className="text-base font-semibold text-[var(--fg)]">
                        {t("workspace.moveToFolder")}
                    </h3>
                </div>
                <div className="space-y-2 px-5 py-4">
                    <label htmlFor={moveFileSelectId} className="text-xs text-[var(--muted)]">
                        {t("workspace.destination")}
                    </label>
                    <select
                        id={moveFileSelectId}
                        value={moveFileModal.folderId}
                        onChange={(event) =>
                            setMoveFileModal((prev) => ({
                                ...prev,
                                folderId: event.target.value,
                            }))
                        }
                        className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                    >
                        <option value="">{t("workspace.root")}</option>
                        {moveFolderOptions.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                                {getFolderLabel(folder.title)}
                            </option>
                        ))}
                    </select>
                    {moveFileModal.error && <p className="text-xs text-rose-500">{moveFileModal.error}</p>}
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={closeMoveFile}
                        disabled={moveFileModal.isSubmitting}
                    >
                        {t("common.cancel")}
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => void submitMoveFile()}
                        disabled={moveFileModal.isSubmitting}
                    >
                        {moveFileModal.isSubmitting ? t("workspace.moving") : t("workspace.move")}
                    </Button>
                </div>
            </ModalShell>

            <ConfirmModal
                open={fileShareConfirm.open}
                title={fileShareConfirm.isResend ? t("workspace.resendFileRequest") : t("workspace.sendFileRequest")}
                message={
                    fileShareConfirm.isResend
                        ? t("workspace.fileShareResendMessage", { username: fileShareConfirm.toUsername })
                        : t("workspace.fileShareMessage", {
                            fileName: fileShareConfirm.fileName,
                            username: fileShareConfirm.toUsername,
                        })
                }
                confirmLabel={fileShareConfirm.isResend ? t("workspace.sendAgain") : t("workspace.send")}
                cancelLabel={t("common.cancel")}
                isProcessing={fileShareConfirm.isSubmitting}
                onCancel={closeFileShareConfirm}
                onConfirm={() => {
                    void submitFileShareConfirm();
                }}
            />

            <ConfirmModal
                open={roleChangeConfirm.open}
                title={t("workspace.changeRole")}
                message={t("workspace.changeRoleMessage", {
                    username: roleChangeConfirm.targetUsername,
                    role: getRoleLabel(roleChangeConfirm.nextRole),
                })}
                confirmLabel={t("workspace.change")}
                cancelLabel={t("common.cancel")}
                isProcessing={roleChangeConfirm.isSubmitting}
                onCancel={cancelRoleChangeConfirm}
                onConfirm={() => {
                    void confirmRoleChange();
                }}
            />

            <AlertModal
                open={notice.open}
                title={notice.title}
                message={notice.message}
                onClose={() => setNotice((prev) => ({ ...prev, open: false }))}
            />

            {activeItemCommentKey && canAddCommentToItem(activeItemCommentKey) && (
                <div
                    className="fixed z-[90] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card-bg)] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)]"
                    style={{
                        width: 280,
                        left: commentWindowPosition ? commentWindowPosition.x : "50%",
                        top: commentWindowPosition ? commentWindowPosition.y : "50%",
                        transform: commentWindowPosition ? "none" : "translate(-50%, -50%)",
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                >
                    <div
                        className="flex cursor-grab items-center justify-between border-b border-[var(--border)] bg-[var(--card-bg)] px-2.5 py-1.5 hover:bg-[var(--card-bg-hover)] active:cursor-grabbing"
                        onPointerDown={(e) => {
                            e.preventDefault();
                            const startX = e.clientX;
                            const startY = e.clientY;
                            const currentTarget = e.currentTarget.parentElement;
                            if (!currentTarget) return;
                            const rect = currentTarget.getBoundingClientRect();
                            const initialX = rect.left;
                            const initialY = rect.top;

                            const onMove = (moveEv: PointerEvent) => {
                                setCommentWindowPosition({
                                    x: initialX + (moveEv.clientX - startX),
                                    y: initialY + (moveEv.clientY - startY),
                                });
                            };
                            const onUp = () => {
                                window.removeEventListener("pointermove", onMove);
                                window.removeEventListener("pointerup", onUp);
                            };
                            window.addEventListener("pointermove", onMove);
                            window.addEventListener("pointerup", onUp);
                        }}
                    >
                        <p className="pointer-events-none text-xs font-semibold text-[var(--fg)]">
                            {t("workspace.annotation.commentTitle")} ({(itemCommentsByKey.get(activeItemCommentKey) || []).length})
                        </p>
                        <button
                            type="button"
                            onPointerDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                            }}
                            onClick={(event) => {
                                event.stopPropagation();
                                closeItemCommentComposer();
                            }}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-[var(--muted)] hover:text-[var(--fg)]"
                            aria-label={t("workspace.closeComment")}
                            title={t("workspace.closeComment")}
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <div className="max-h-44 space-y-1.5 overflow-auto p-2">
                        {(itemCommentsByKey.get(activeItemCommentKey) || []).length === 0 ? (
                            <p className="px-1 py-1 text-xs text-[var(--muted)]">{t("workspace.noContent")}</p>
                        ) : (
                            (itemCommentsByKey.get(activeItemCommentKey) || []).map((comment) => (
                                <div
                                    key={comment.id}
                                    className="rounded-md border border-[var(--border)] bg-[var(--card-bg-hover)] px-2 py-1.5"
                                >
                                    <div className="mb-0.5 flex items-center justify-between gap-2">
                                        <p className="truncate text-[10px] font-semibold text-[var(--fg)]">
                                            {comment.authorName || comment.authorUserId || t("workspace.unknown")}
                                        </p>
                                        <p className="shrink-0 text-[9px] text-[var(--muted)]">
                                            {new Date(comment.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                    <p className="whitespace-pre-wrap break-words text-[11px] text-[var(--fg)]">
                                        {comment.text}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="border-t border-[var(--border)] p-2">
                        <textarea
                            value={itemCommentDraft}
                            onChange={(event) => setItemCommentDraft(event.target.value.slice(0, 1000))}
                            onKeyDown={(event) => {
                                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                                    event.preventDefault();
                                    submitItemComment(activeItemCommentKey);
                                }
                            }}
                            className="h-16 w-full resize-none rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-2 py-1.5 text-xs text-[var(--fg)] focus:outline-none focus:border-[var(--ring)]"
                            placeholder={t("workspace.annotation.commentPlaceholder")}
                        />
                        <div className="mt-1.5 flex items-center justify-end gap-1.5">
                            <button
                                type="button"
                                onClick={closeItemCommentComposer}
                                className="rounded-sm border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--fg)] hover:bg-[var(--card-bg-hover)]"
                            >
                                {t("common.cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={() => submitItemComment(activeItemCommentKey)}
                                disabled={!String(itemCommentDraft || "").trim()}
                                className="rounded-sm border border-[var(--primary)] px-2 py-1 text-[11px] text-[var(--primary)] hover:bg-[var(--card-bg-hover)] disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                {t("workspace.send")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

