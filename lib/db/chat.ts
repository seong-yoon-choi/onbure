import { supabaseRest } from "@/lib/supabase-rest";
import { v4 as uuidv4 } from "uuid";

export interface Thread {
    id: string; // Notion Page ID fallback
    threadId: string;
    type: "DM" | "TEAM";
    teamId?: string;
    participants: string[]; // User IDs (comma separated string in DB)
}

export interface Message {
    id: string;
    messageId: string;
    threadId: string;
    senderId: string;
    bodyOriginal: string;
    bodyTranslated: string;
    langOriginal: string;
    langTarget: string;
    createdAt: string;
}

export async function getThread(threadId: string): Promise<Thread | null> {
    const rows = (await supabaseRest(
        `/threads?select=*&thread_id=eq.${encodeURIComponent(threadId)}&limit=1`
    )) as Array<{
        thread_id: string;
        type: string;
        team_id: string | null;
        participants_user_ids: string[] | null;
    }>;
    if (!rows.length) return null;
    const row = rows[0];
    return {
        id: row.thread_id,
        threadId: row.thread_id,
        type: String(row.type || "").toUpperCase() === "TEAM" ? "TEAM" : "DM",
        teamId: row.team_id || undefined,
        participants: Array.isArray(row.participants_user_ids) ? row.participants_user_ids : [],
    };
}

export async function getMessages(threadId: string): Promise<Message[]> {
    const rows = (await supabaseRest(
        `/messages?select=*&thread_id=eq.${encodeURIComponent(threadId)}&order=created_at.asc`
    )) as Array<{
        message_id: string;
        thread_id: string;
        sender_user_id: string;
        body_original: string;
        body_translated: string | null;
        translated_lang: string | null;
        created_at: string;
    }>;

    return rows.map((row) => ({
        id: row.message_id,
        messageId: row.message_id,
        threadId: row.thread_id,
        senderId: row.sender_user_id,
        bodyOriginal: row.body_original,
        bodyTranslated: row.body_translated || "",
        langOriginal: "auto",
        langTarget: row.translated_lang || "",
        createdAt: row.created_at,
    }));
}

export async function sendMessage(threadId: string, senderId: string, content: string, targetLang: string = "en") {
    const messageId = uuidv4();
    const translated = `[${targetLang}] ${content}`; // Mock translation

    await supabaseRest("/messages", {
        method: "POST",
        prefer: "return=minimal",
        body: {
            message_id: messageId,
            thread_id: threadId,
            sender_user_id: senderId,
            body_original: content,
            body_translated: translated,
            translated_lang: targetLang,
        },
    });
    await supabaseRest(
        `/threads?thread_id=eq.${encodeURIComponent(threadId)}`,
        {
            method: "PATCH",
            prefer: "return=minimal",
            body: { last_message_at: new Date().toISOString() },
        }
    );
    return { messageId, content, translated };
}
