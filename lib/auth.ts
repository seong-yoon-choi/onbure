import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { getUserByEmail } from "./db/users";
import bcrypt from "bcryptjs";

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
                    const user = await getUserByEmail(credentials.email);
                    if (!user || !user.passwordHash) {
                        console.error("[NextAuth] User not found or missing password hash"); // Secure log
                        return null;
                    }

                    const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
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
    debug: process.env.NODE_ENV !== "production",
};
