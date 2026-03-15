import literalMessagesData from "@/lib/i18n/literal-messages.json";
import { AppLanguage } from "@/lib/i18n/messages";

type LiteralMessages = Record<AppLanguage, Record<string, string>>;

const LITERAL_MESSAGES = literalMessagesData as LiteralMessages;

type PatternTranslator = (language: AppLanguage, match: RegExpMatchArray) => string;

const DYNAMIC_PATTERNS: Array<{ pattern: RegExp; translate: PatternTranslator }> = [
    {
        pattern: /^Step (\d+) \/ (\d+)$/,
        translate: (language, match) => {
            const current = match[1];
            const total = match[2];
            if (language === "ko") return `단계 ${current} / ${total}`;
            if (language === "ja") return `ステップ ${current} / ${total}`;
            if (language === "fr") return `Étape ${current} / ${total}`;
            if (language === "es") return `Paso ${current} / ${total}`;
            return `Step ${current} / ${total}`;
        },
    },
    {
        pattern: /^Team: (.+)$/,
        translate: (language, match) => {
            const value = match[1];
            if (language === "ko") return `팀: ${value}`;
            if (language === "ja") return `チーム: ${value}`;
            if (language === "fr") return `Équipe : ${value}`;
            if (language === "es") return `Equipo: ${value}`;
            return `Team: ${value}`;
        },
    },
    {
        pattern: /^To: (.+)$/,
        translate: (language, match) => {
            const value = match[1];
            if (language === "ko") return `대상: ${value}`;
            if (language === "ja") return `宛先: ${value}`;
            if (language === "fr") return `À : ${value}`;
            if (language === "es") return `Para: ${value}`;
            return `To: ${value}`;
        },
    },
    {
        pattern: /^(.+)\s-\sTeams\s(\d+),\sPeople\s(\d+)$/,
        translate: (language, match) => {
            const query = match[1];
            const teams = match[2];
            const people = match[3];
            if (language === "ko") return `${query} - 팀 ${teams}, 사람 ${people}`;
            if (language === "ja") return `${query} - チーム ${teams}、人 ${people}`;
            if (language === "fr") return `${query} - Équipes ${teams}, Personnes ${people}`;
            if (language === "es") return `${query} - Equipos ${teams}, Personas ${people}`;
            return `${query} - Teams ${teams}, People ${people}`;
        },
    },
    {
        pattern: /^Resend in (\d+)s$/,
        translate: (language, match) => {
            const seconds = match[1];
            if (language === "ko") return `${seconds}초 후 재전송`;
            if (language === "ja") return `${seconds}秒後に再送信`;
            if (language === "fr") return `Renvoyer dans ${seconds}s`;
            if (language === "es") return `Reenviar en ${seconds}s`;
            return `Resend in ${seconds}s`;
        },
    },
];

export function translateLiteral(language: AppLanguage, value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const direct = LITERAL_MESSAGES[language]?.[trimmed];
    if (direct) return direct;

    for (const item of DYNAMIC_PATTERNS) {
        const match = trimmed.match(item.pattern);
        if (match) return item.translate(language, match);
    }

    return null;
}
