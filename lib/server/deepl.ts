import { normalizeLanguage } from "@/lib/i18n";
import { AppLanguage } from "@/lib/i18n/messages";

const APP_TO_DEEPL_TARGET: Record<AppLanguage, string> = {
    ko: "KO",
    ja: "JA",
    en: "EN-US",
    fr: "FR",
    es: "ES",
};

const DEFAULT_DEEPL_BASE_URL = "https://api-free.deepl.com";
const MAX_BATCH_SIZE = 50;
const MAX_CACHE_ENTRIES = 2000;

declare global {
    var __onbureDeepLTranslationCache: Map<string, string> | undefined;
}

const translationCache =
    globalThis.__onbureDeepLTranslationCache ||
    (globalThis.__onbureDeepLTranslationCache = new Map<string, string>());

function trimTrailingSlashes(value: string) {
    return value.replace(/\/+$/, "");
}

function getDeepLApiKey() {
    return String(process.env.DEEPL_API_KEY || "").trim();
}

function getDeepLBaseUrl() {
    const configured = String(process.env.DEEPL_API_BASE_URL || "").trim();
    return trimTrailingSlashes(configured || DEFAULT_DEEPL_BASE_URL);
}

function chunkValues(values: string[], chunkSize: number): string[][] {
    const safeChunkSize = Math.max(1, Math.floor(chunkSize));
    const chunks: string[][] = [];
    for (let index = 0; index < values.length; index += safeChunkSize) {
        chunks.push(values.slice(index, index + safeChunkSize));
    }
    return chunks;
}

function toCacheKey(targetLanguage: string, sourceText: string) {
    return `${targetLanguage}::${sourceText}`;
}

function setCache(cacheKey: string, translatedText: string) {
    translationCache.set(cacheKey, translatedText);
    if (translationCache.size <= MAX_CACHE_ENTRIES) return;
    const oldestKey = translationCache.keys().next().value;
    if (oldestKey) {
        translationCache.delete(oldestKey);
    }
}

export function resolveDeepLTargetLanguage(input: string | null | undefined) {
    const appLanguage = normalizeLanguage(input);
    return {
        appLanguage,
        deepLTargetLanguage: APP_TO_DEEPL_TARGET[appLanguage],
    };
}

export async function translateTextsWithDeepL(
    texts: string[],
    targetLanguageInput: string | null | undefined
): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const normalizedTexts = Array.from(
        new Set(
            texts
                .map((text) => String(text || ""))
                .map((text) => text.trim())
                .filter(Boolean)
        )
    );
    if (!normalizedTexts.length) return result;

    const apiKey = getDeepLApiKey();
    if (!apiKey) return result;

    const { deepLTargetLanguage } = resolveDeepLTargetLanguage(targetLanguageInput);
    const missingTexts: string[] = [];
    for (const sourceText of normalizedTexts) {
        const cacheKey = toCacheKey(deepLTargetLanguage, sourceText);
        const cached = translationCache.get(cacheKey);
        if (typeof cached === "string" && cached.trim()) {
            result.set(sourceText, cached);
            continue;
        }
        missingTexts.push(sourceText);
    }
    if (!missingTexts.length) return result;

    const baseUrl = getDeepLBaseUrl();
    for (const chunk of chunkValues(missingTexts, MAX_BATCH_SIZE)) {
        try {
            const response = await fetch(`${baseUrl}/v2/translate`, {
                method: "POST",
                headers: {
                    Authorization: `DeepL-Auth-Key ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    text: chunk,
                    target_lang: deepLTargetLanguage,
                    preserve_formatting: true,
                }),
                cache: "no-store",
            });

            if (!response.ok) {
                const body = await response.text();
                console.error(
                    `DeepL translate failed [${response.status}] for target ${deepLTargetLanguage}: ${body}`
                );
                continue;
            }

            const payload = (await response.json()) as { translations?: Array<{ text?: string }> };
            const translatedRows = Array.isArray(payload.translations) ? payload.translations : [];
            for (let index = 0; index < chunk.length; index += 1) {
                const sourceText = chunk[index];
                const translatedText = String(translatedRows[index]?.text || "").trim();
                if (!translatedText) continue;
                result.set(sourceText, translatedText);
                setCache(toCacheKey(deepLTargetLanguage, sourceText), translatedText);
            }
        } catch (error) {
            console.error(`DeepL translate threw for target ${deepLTargetLanguage}:`, error);
        }
    }

    return result;
}
