const REMOVED_BACKEND_ERROR =
    "Legacy data adapter has been removed. Use Supabase-backed db modules only.";

const removed = async (): Promise<any> => {
    throw new Error(REMOVED_BACKEND_ERROR);
};

// Kept only for backward compatibility with remaining imports.
export const notion = {
    databases: {
        query: async (args: { database_id: string; filter?: any; sorts?: any; page_size?: number }): Promise<any> => {
            void args;
            return removed();
        },
        retrieve: async (databaseId: string): Promise<any> => {
            void databaseId;
            return removed();
        },
    },
    pages: {
        create: async (args: { parent: { database_id: string }; properties: any }): Promise<any> => {
            void args;
            return removed();
        },
        update: async (args: { page_id: string; properties?: any; archived?: boolean }): Promise<any> => {
            void args;
            return removed();
        },
        retrieve: async (pageId: string): Promise<any> => {
            void pageId;
            return removed();
        },
    },
};

// Compatibility helper for legacy callers. Supabase-only runtime does not use these IDs.
export const getDatabaseId = (key: keyof NodeJS.ProcessEnv | string[]) => {
    void key;
    return "";
};

export const getSelectValue = (property: any) => {
    return property?.select?.name || property?.status?.name || null;
};

export const getTextValue = (property: any) => {
    if (property?.title) {
        return property.title.map((t: any) => t.plain_text).join("");
    }
    if (property?.rich_text) {
        return property.rich_text.map((t: any) => t.plain_text).join("");
    }
    return "";
};
