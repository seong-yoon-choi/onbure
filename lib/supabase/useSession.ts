"use client";

import { useEffect, useState } from "react";
import { createClient } from "./client";
import { User } from "@supabase/supabase-js";

export function useSession() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        let mounted = true;

        async function getSession() {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (mounted) {
                    setUser(session?.user ?? null);
                }
            } catch (error) {
                console.error("Error getting session:", error);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        getSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setUser(session?.user ?? null);
            }
        );

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [supabase.auth]);

    // Return a shape somewhat mimicking next-auth for easier migration
    return {
        data: user ? {
            user: {
                id: user.id,
                email: user.email,
                name: user.user_metadata?.username,
            }
        } : null,
        status: loading ? "loading" : (user ? "authenticated" : "unauthenticated"),
    };
}
