export interface Rect { x: number; y: number; width: number; height: number; }

export interface DmUserItem {
    id: string;
    userId: string;
    username: string;
    language?: string;
    skills?: string[];
}

export interface TeamItem {
    id: string;
    teamId: string;
    name: string;
    visibility?: string;
}

export interface ThreadItem {
    id: string;
    threadId: string;
    type: "dm" | "team";
    title: string;
    participantsUserIds: string[];
    teamId?: string;
}

export interface MessageItem {
    id: string;
    messageId: string;
    threadId: string;
    senderId: string;
    senderUsername?: string;
    bodyOriginal: string;
    bodyTranslated?: string;
    translatedLang?: string;
    createdAt: string;
}

export interface ThreadDirectoryItem {
    threadId: string;
    type: "DM" | "TEAM";
    participantsUserIds?: string[];
    dmSeenMap?: Record<string, number>;
    teamId?: string | null;
    lastMessageAt?: string;
    lastSenderId?: string;
    lastBodyOriginal?: string;
    unreadCount?: number;
}

export interface DmReadReceipt {
    threadId: string;
    available: boolean;
    otherUserId?: string;
    otherSeenAt?: number;
}

export interface ProfileMenuState {
    x: number;
    y: number;
    targetType: "user" | "team";
    targetId: string;
}

export interface OpenDmRequest {
    userId: string;
    username?: string;
    token: number;
}
