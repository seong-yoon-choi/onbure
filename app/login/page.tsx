"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Eye, EyeOff, LockKeyhole, Globe } from "lucide-react";
import { useLanguage } from "@/components/providers";
import { APP_LANGUAGES } from "@/lib/i18n/messages";
import { normalizeLanguage } from "@/lib/i18n";

export default function LoginPage() {
    const router = useRouter();
    const { t, language, setLanguage } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [capsLockOn, setCapsLockOn] = useState(false);
    const passwordInputId = "login-password";

    const handlePasswordKeyState = (event: React.KeyboardEvent<HTMLInputElement>) => {
        setCapsLockOn(event.getModifierState("CapsLock"));
    };

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
            setError(t("auth.login.invalidCredentials"));
            setLoading(false);
        } else {
            // Update profile with the selected language
            try {
                const currentLang = normalizeLanguage(document.documentElement.lang);
                await fetch("/api/profile", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ language: currentLang })
                });
            } catch (err) {
                // Non-blocking error
                console.error("Failed to sync language on login", err);
            }
            router.push("/discovery");
        }
    }

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4 bg-[url('/grid.svg')] bg-center">
            <div className="absolute top-6 left-6 right-6 md:top-8 md:left-8 md:right-8 z-10 flex items-center justify-between">
                <Link href="/" className="text-xl font-bold bg-gradient-to-r from-violet-500 to-emerald-500 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
                    Onbure
                </Link>
                <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[var(--muted)]" />
                    <select
                        value={language}
                        onChange={(e) => setLanguage(normalizeLanguage(e.target.value))}
                        className="bg-transparent border-none text-sm text-[var(--muted)] hover:text-[var(--fg)] focus:outline-none focus:ring-0 cursor-pointer"
                        aria-label="Select Language"
                    >
                        {APP_LANGUAGES.map((code) => (
                            <option key={code} value={code} className="bg-[var(--card-bg)] text-[var(--fg)]">
                                {code === "ko"
                                    ? t("language.korean")
                                    : code === "ja"
                                        ? t("language.japanese")
                                        : code === "fr"
                                            ? t("language.french")
                                            : code === "es"
                                                ? t("language.spanish")
                                                : t("language.english")}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="w-full max-w-md space-y-8 mt-12 md:mt-0">
                <div className="text-center space-y-2">
                    <div className="flex justify-center">
                        <div className="bg-[var(--primary)]/10 p-4 rounded-2xl ring-1 ring-[var(--primary)]/20">
                            <LockKeyhole className="w-8 h-8 text-[var(--primary)]" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-[var(--fg)] mt-6">{t("auth.login.title")}</h1>
                    <p className="text-[var(--muted)]">{t("auth.login.subtitle")}</p>
                </div>

                <Card className="p-8 space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            name="email"
                            type="email"
                            label={t("auth.common.emailLabel")}
                            placeholder={t("auth.common.emailPlaceholder")}
                            required
                        />
                        <div className="w-full space-y-1.5">
                            <label htmlFor={passwordInputId} className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider ml-1">
                                {t("auth.common.passwordLabel")}
                            </label>
                            <div className="relative">
                                <input
                                    id={passwordInputId}
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder={t("auth.login.passwordPlaceholder")}
                                    required
                                    onKeyDown={handlePasswordKeyState}
                                    onKeyUp={handlePasswordKeyState}
                                    onBlur={() => setCapsLockOn(false)}
                                    className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 pr-10 text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40 focus:border-[var(--ring)] transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    aria-label={showPassword ? t("auth.login.hidePasswordAria") : t("auth.login.showPasswordAria")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded text-[var(--muted)] hover:text-[var(--fg)]"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {capsLockOn && (
                                <p className="ml-1 text-xs text-amber-500">{t("auth.common.capsLockOn")}</p>
                            )}
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full" size="lg" isLoading={loading}>
                            {t("auth.login.submit")}
                        </Button>
                    </form>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-[var(--border)]" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-[var(--card-bg)] px-2 text-[var(--muted)]">{t("auth.common.or")}</span>
                        </div>
                    </div>

                    <div className="text-center text-sm">
                        <span className="text-[var(--muted)]">{t("auth.login.noAccount")} </span>
                        <Link href="/register" className="text-[var(--primary)] hover:opacity-90 font-medium">
                            {t("auth.login.createAccount")}
                        </Link>
                    </div>
                </Card>
            </div>
        </div>
    );
}
