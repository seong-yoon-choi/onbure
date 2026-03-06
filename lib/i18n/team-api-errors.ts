type TranslateParams = Record<string, string | number>;
type TranslateFn = (key: string, params?: TranslateParams) => string;

const TEAM_API_ERROR_KEY_MAP: Record<string, string> = {
    "Team not found.": "team.notFound",
    "Team name is required.": "createTeam.error.nameRequired",
    "Password is required.": "team.error.passwordRequired",
};

export function resolveTeamApiErrorMessage(rawError: unknown, t: TranslateFn, fallbackKey: string): string {
    const normalizedError = String(rawError || "").trim();
    if (!normalizedError) return t(fallbackKey);

    const mappedKey = TEAM_API_ERROR_KEY_MAP[normalizedError];
    if (mappedKey) return t(mappedKey);

    return t(fallbackKey);
}
