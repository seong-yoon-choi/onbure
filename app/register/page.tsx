"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { ALL_SIGNUP_COUNTRIES } from "@/lib/signup-consent";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [email, setEmail] = useState("");
    const [country, setCountry] = useState("KR");
    const [showPassword, setShowPassword] = useState(false);
    const [capsLockOn, setCapsLockOn] = useState(false);
    const passwordInputId = "register-password";
    const countryInputId = "register-country";
    const genderInputId = "register-gender";

    const isEmailValid = EMAIL_REGEX.test(email.trim());

    const handlePasswordKeyState = (event: React.KeyboardEvent<HTMLInputElement>) => {
        setCapsLockOn(event.getModifierState("CapsLock"));
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");

        const formData = new FormData(e.currentTarget);
        const username = String(formData.get("username") || "");
        const password = String(formData.get("password") || "");
        const gender = String(formData.get("gender") || "");
        const age = String(formData.get("age") || "");

        setLoading(true);

        try {
            const res = await fetch("/api/register", {
                method: "POST",
                body: JSON.stringify({
                    username,
                    email,
                    password,
                    gender,
                    age,
                    country,
                }),
                headers: { "Content-Type": "application/json" },
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(String(data?.error || "Registration failed"));
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
            setError(String(err?.message || "Registration failed"));
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

                        <div className="space-y-2">
                            <Input
                                name="email"
                                type="email"
                                label="Email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                required
                            />
                            {isEmailValid && (
                                <p className="text-xs text-[var(--muted)]">
                                    Email verification is disabled for now.
                                </p>
                            )}
                        </div>

                        <div className="w-full space-y-1.5">
                            <label htmlFor={passwordInputId} className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider ml-1">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id={passwordInputId}
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Minimum 8 characters"
                                    required
                                    minLength={8}
                                    autoComplete="new-password"
                                    onKeyDown={handlePasswordKeyState}
                                    onKeyUp={handlePasswordKeyState}
                                    onBlur={() => setCapsLockOn(false)}
                                    className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 pr-10 text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40 focus:border-[var(--ring)] transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)]"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {capsLockOn && (
                                <p className="ml-1 text-xs text-amber-500">Caps Lock is on.</p>
                            )}
                        </div>

                        <div className="w-full space-y-1.5">
                            <label htmlFor={genderInputId} className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider ml-1">
                                Gender
                            </label>
                            <select
                                id={genderInputId}
                                name="gender"
                                required
                                className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40 focus:border-[var(--ring)] transition-all"
                                defaultValue=""
                            >
                                <option value="" disabled>
                                    Select gender
                                </option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        <Input
                            name="age"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            label="Age"
                            placeholder="Enter age"
                            required
                            maxLength={3}
                            onInput={(event) => {
                                const target = event.currentTarget;
                                target.value = target.value.replace(/[^\d]/g, "").replace(/^0+(\d)/, "$1");
                            }}
                        />

                        <div className="w-full space-y-1.5">
                            <label htmlFor={countryInputId} className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider ml-1">
                                Country
                            </label>
                            <select
                                id={countryInputId}
                                name="country"
                                required
                                value={country}
                                onChange={(event) => {
                                    setCountry(event.target.value);
                                }}
                                className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40 focus:border-[var(--ring)] transition-all"
                            >
                                {ALL_SIGNUP_COUNTRIES.map((item) => (
                                    <option key={item.code} value={item.code}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                        </div>

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


