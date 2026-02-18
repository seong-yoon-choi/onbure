"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { LockKeyhole } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError("");

        const formData = new FormData(e.currentTarget);
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        const res = await signIn("credentials", {
            email,
            password,
            redirect: false,
        });

        if (res?.error) {
            setError("Invalid credentials");
            setLoading(false);
        } else {
            router.push("/discovery");
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[url('/grid.svg')] bg-center">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center space-y-2">
                    <div className="flex justify-center">
                        <div className="bg-[var(--primary)]/10 p-4 rounded-2xl ring-1 ring-[var(--primary)]/20">
                            <LockKeyhole className="w-8 h-8 text-[var(--primary)]" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-[var(--fg)] mt-6">Welcome back</h1>
                    <p className="text-[var(--muted)]">Sign in to your account</p>
                </div>

                <Card className="p-8 space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
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
                            placeholder="Enter your password"
                            required
                        />

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full" size="lg" isLoading={loading}>
                            Sign In
                        </Button>
                    </form>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-[var(--border)]" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-[var(--card-bg)] px-2 text-[var(--muted)]">Or</span>
                        </div>
                    </div>

                    <div className="text-center text-sm">
                        <span className="text-[var(--muted)]">Don&apos;t have an account? </span>
                        <Link href="/register" className="text-[var(--primary)] hover:opacity-90 font-medium">
                            Create account
                        </Link>
                    </div>
                </Card>
            </div>
        </div>
    );
}
