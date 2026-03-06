import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { getUserByEmail, verifyUserPassword } from "./db/users";

export function isAdmin(email?: string | null): boolean {
    if (!email) return false;
    const adminEmails = process.env.ADMIN_EMAILS || "";
    if (!adminEmails) return false;

    const adminList = adminEmails.split(",").map((e) => e.trim().toLowerCase());
    return adminList.includes(email.trim().toLowerCase());
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                try {
                    const email = String(credentials.email || "").trim().toLowerCase();
                    const user = await getUserByEmail(email);
                    if (!user) {
                        console.error("[NextAuth] User not found");
                        return null;
                    }

                    const isValid = await verifyUserPassword(user.userId, credentials.password);
                    if (!isValid) {
                        console.error("[NextAuth] Invalid password");
                        return null;
                    }

                    return {
                        id: user.userId,
                        email: user.email,
                        name: user.username, // usage of username as name
                        image: user.image,
                    };
                } catch (error) {
                    console.error("[NextAuth] Authorize Error:", error);
                    return null;
                }
            },
        }),
        ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
            ? [
                GithubProvider({
                    clientId: process.env.GITHUB_ID,
                    clientSecret: process.env.GITHUB_SECRET,
                }),
            ]
            : []),
        ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
            ? [
                GoogleProvider({
                    clientId: process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                }),
            ]
            : []),
    ],
    session: {
        strategy: "jwt",
    },
    callbacks: {
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).id = token.sub;
                session.user.name = token.name; // Ensure token name (username) propagates
                (session.user as any).isAdmin = isAdmin(session.user?.email);
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.sub = user.id;
                token.name = user.name; // This is actually our username mapped above
            }
            return token;
        },
    },
    pages: {
        signIn: "/login",
        error: "/login", // Redirect to login on error
    },
    secret: process.env.NEXTAUTH_SECRET,
    debug: process.env.NEXTAUTH_DEBUG === "true",
};
