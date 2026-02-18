"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { UserPlus } from "lucide-react";

export default function RegisterPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError("");

        const formData = new FormData(e.currentTarget);
        const username = formData.get("username") as string;
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        try {
            const res = await fetch("/api/register", {
                method: "POST",
                body: JSON.stringify({ username, email, password }),
                headers: { "Content-Type": "application/json" },
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Registration failed");
            }

            const loginRes = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (loginRes?.error) {
                throw new Error("Login failed");
            }

            router.push("/discovery");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[url('/grid.svg')] bg-center">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center space-y-2">
                    <div className="flex justify-center">
                        <div className="bg-emerald-500/10 p-4 rounded-2xl ring-1 ring-emerald-500/20">
                            <UserPlus className="w-8 h-8 text-emerald-500" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-[var(--fg)] mt-6">Create account</h1>
                    <p className="text-[var(--muted)]">Join Onbure and start collaborating</p>
                </div>

                <Card className="p-8 space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            name="username"
                            label="User Name"
                            placeholder="JohnDoe"
                            required
                        />
                        <Input
                            name="email"
                            type="email"
                            label="Email"
                            placeholder="name@example.com"
                            required
                        />
                        <Input
                            name="password"
                            type="password"
                            label="Password"
                            placeholder="Minimum 8 characters"
                            required
                            minLength={8}
                        />

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full" size="lg" isLoading={loading}>
                            Sign Up
                        </Button>
                    </form>

                    <div className="text-center text-sm">
                        <span className="text-[var(--muted)]">Already have an account? </span>
                        <Link href="/login" className="text-[var(--primary)] hover:opacity-90 font-medium">
                            Sign in
                        </Link>
                    </div>
                </Card>
            </div>
        </div>
    );
}
