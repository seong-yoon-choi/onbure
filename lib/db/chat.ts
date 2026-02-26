import { notion, getDatabaseId, getTextValue } from "@/lib/notion-client";
import { isSupabaseBackend } from "@/lib/db/backend";
import { supabaseRest } from "@/lib/supabase-rest";
import { v4 as uuidv4 } from "uuid";

const DB_THREAD_ID = getDatabaseId(["NOTION_DB_THREADS", "NOTION_DB_CHAT_THREADS"]);
const DB_MESSAGE_ID = getDatabaseId(["NOTION_DB_MESSAGES", "NOTION_DB_CHAT_MESSAGES"]);

export interface Thread {
    id: string; // Notion Page ID
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
    if (isSupabaseBackend()) {
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

    const response = await notion.databases.query({
        database_id: DB_THREAD_ID,
        filter: {
            property: "thread_id",
            rich_text: {
                equals: threadId,
            },
        },
    });

    if (response.results.length === 0) return null;
    const props = (response.results[0] as any).properties;

    return {
        id: response.results[0].id,
        threadId: getTextValue(props.thread_id),
        type: (props.type?.select?.name as "DM" | "TEAM") || "DM",
        teamId: getTextValue(props.team_id),
        participants: getTextValue(props.participants).split(",").map((s: string) => s.trim()).filter(Boolean),
    };
}

export async function getMessages(threadId: string): Promise<Message[]> {
    if (isSupabaseBackend()) {
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

    const response = await notion.databases.query({
        database_id: DB_MESSAGE_ID,
        filter: {
            property: "thread_id",
            rich_text: {
                equals: threadId,
            },
        },
        sorts: [{ timestamp: "created_time", direction: "ascending" }],
    });

    return response.results.map((page: any) => {
        const props = page.properties;
        return {
            id: page.id,
            messageId: getTextValue(props.message_id),
            threadId: getTextValue(props.thread_id),
            senderId: getTextValue(props.sender_user_id),
            bodyOriginal: getTextValue(props.body_original),
            bodyTranslated: getTextValue(props.body_translated),
            langOriginal: getTextValue(props.lang_original),
            langTarget: getTextValue(props.lang_target),
            createdAt: page.created_time,
        };
    });
}

export async function sendMessage(threadId: string, senderId: string, content: string, targetLang: string = "en") {
    const messageId = uuidv4();
    const translated = `[${targetLang}] ${content}`; // Mock translation

    if (isSupabaseBackend()) {
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

    await notion.pages.create({
        parent: { database_id: DB_MESSAGE_ID },
        properties: {
            message_id: { rich_text: [{ text: { content: messageId } }] },
            thread_id: { rich_text: [{ text: { content: threadId } }] },
            sender_user_id: { rich_text: [{ text: { content: senderId } }] },
            body_original: { rich_text: [{ text: { content } }] },
            body_translated: { rich_text: [{ text: { content: translated } }] },
            lang_original: { rich_text: [{ text: { content: "auto" } }] },
            lang_target: { rich_text: [{ text: { content: targetLang } }] },
        },
    });

    return { messageId, content, translated };
}
