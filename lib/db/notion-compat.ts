const REMOVED_BACKEND_ERROR = "Notion backend is removed. Use Supabase-backed db modules only.";

const removed = async (): Promise<any> => {
    throw new Error(REMOVED_BACKEND_ERROR);
};

// Kept for compatibility with legacy branches that are no longer used in Supabase mode.
export const notion = {
    databases: {
        query: async (_args: any): Promise<any> => {
            void _args;
            return removed();
        },
        retrieve: async (_databaseId: string): Promise<any> => {
            void _databaseId;
            return removed();
        },
    },
    pages: {
        create: async (_args: any): Promise<any> => {
            void _args;
            return removed();
        },
        update: async (_args: any): Promise<any> => {
            void _args;
            return removed();
        },
        retrieve: async (_pageId: string): Promise<any> => {
            void _pageId;
            return removed();
        },
    },
};

// Must not throw at module load because some files compute constants from these values.
export function getDatabaseId(_key: keyof NodeJS.ProcessEnv | string[]): string {
    void _key;
    return "";
}

export function getSelectValue(property: any): string | undefined {
    return property?.select?.name || property?.status?.name || undefined;
}

export function getTextValue(property: any): string {
    if (property?.title) {
        return property.title.map((item: any) => item.plain_text).join("");
    }
    if (property?.rich_text) {
        return property.rich_text.map((item: any) => item.plain_text).join("");
    }
    return "";
}

export async function getDatabaseSchema(
    _databaseId: string,
    _options?: { forceRefresh?: boolean }
): Promise<any> {
    void _databaseId;
    void _options;
    throw new Error(REMOVED_BACKEND_ERROR);
}

export function assertDatabaseHasProperties(_schema: any, _requiredProps: Record<string, string>) {
    void _schema;
    void _requiredProps;
    throw new Error(REMOVED_BACKEND_ERROR);
}

export function getTitlePropertyName(schema: any): string {
    const props = schema?.properties || {};
    for (const key of Object.keys(props)) {
        if (props[key]?.type === "title") return key;
    }
    return "title";
}

export function buildProps(_schema: any, _data: Record<string, any>): Record<string, any> {
    void _schema;
    void _data;
    throw new Error(REMOVED_BACKEND_ERROR);
}
