"use client";

import { useSession as useNextAuthSession } from "next-auth/react";

export function useSession() {
    // Keep this wrapper so legacy imports can migrate without splitting
    // session state across NextAuth and Supabase Auth on the client.
    return useNextAuthSession();
}
