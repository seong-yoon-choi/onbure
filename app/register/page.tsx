"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Eye, EyeOff, UserPlus, CheckCircle2 } from "lucide-react";
import {
    ALL_SIGNUP_COUNTRIES,
    resolveSignupConsentRegion,
    isCookieConsentRequired,
} from "@/lib/signup-consent";
import { getIubendaLegalUrl } from "@/lib/iubenda";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_IUBENDA_PRIVACY_URL = "https://www.iubenda.com/privacy-policy/31787811";
const DEFAULT_IUBENDA_COOKIE_URL = "https://www.iubenda.com/privacy-policy/31787811/cookie-policy";
const EMAIL_RESEND_COOLDOWN_SECONDS = 30;

export default function RegisterPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [email, setEmail] = useState("");
    const [country, setCountry] = useState("KR");
    const [showPassword, setShowPassword] = useState(false);
    const [capsLockOn, setCapsLockOn] = useState(false);

    // Email Verification State
    const [isSendingCode, setIsSendingCode] = useState(false);
    const [isVerifyingCode, setIsVerifyingCode] = useState(false);
    const [verificationStep, setVerificationStep] = useState<"email" | "otp">("email");
    const [otp, setOtp] = useState("");
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [verificationMsg, setVerificationMsg] = useState("");
    const [resendCooldown, setResendCooldown] = useState(0);

    // Consent State
    const [isOver14, setIsOver14] = useState(false);
    const [isPrivacyAgreed, setIsPrivacyAgreed] = useState(false);
    const [isCookieAgreed, setIsCookieAgreed] = useState(false);
    const [isMarketingConsent, setIsMarketingConsent] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);

    const passwordInputId = "register-password";
    const countryInputId = "register-country";
    const genderInputId = "register-gender";

    const isEmailValid = EMAIL_REGEX.test(email.trim());

    const region = resolveSignupConsentRegion(country);
    const cookieRequired = isCookieConsentRequired(region);
    const privacyLink = isHydrated
        ? String(getIubendaLegalUrl("privacy") || DEFAULT_IUBENDA_PRIVACY_URL).trim()
        : DEFAULT_IUBENDA_PRIVACY_URL;
    const cookieLink = isHydrated
        ? String(getIubendaLegalUrl("cookie") || DEFAULT_IUBENDA_COOKIE_URL).trim()
        : DEFAULT_IUBENDA_COOKIE_URL;
    const marketingCommunicationsLink = "/legal/marketing-communications";

    const getLegalLinkClassName = (href: string) => {
        const isIubendaLink = /^https?:\/\/(www\.)?iubenda\.com/i.test(href);
        return `text-sm text-[var(--primary)] hover:underline${isIubendaLink ? " iubenda-white iubenda-noiframe iubenda-embed" : ""}`;
    };

    useEffect(() => {
        setIsHydrated(true);
    }, []);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setInterval(() => {
            setResendCooldown((current) => (current > 1 ? current - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [resendCooldown]);

    const handlePasswordKeyState = (event: React.KeyboardEvent<HTMLInputElement>) => {
        setCapsLockOn(event.getModifierState("CapsLock"));
    };

    async function sendVerificationCode() {
        if (!isEmailValid || isSendingCode) return;
        setIsSendingCode(true);
        setError("");
        setVerificationMsg("");
        try {
            const res = await fetch("/api/register/email-code/send", {
                method: "POST",
                body: JSON.stringify({ email: email.trim() }),
                headers: { "Content-Type": "application/json" },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to send code");

            setVerificationStep("otp");
            setOtp("");
            setResendCooldown(EMAIL_RESEND_COOLDOWN_SECONDS);
            setVerificationMsg("Verification code sent to your email.");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSendingCode(false);
        }
    }

    async function verifyEmailCode() {
        if (!otp.trim() || isVerifyingCode) return;
        setIsVerifyingCode(true);
        setError("");
        try {
            const res = await fetch("/api/register/email-code/verify", {
                method: "POST",
                body: JSON.stringify({ email: email.trim(), code: otp.trim() }),
                headers: { "Content-Type": "application/json" },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Invalid code");

            setIsEmailVerified(true);
            setVerificationMsg("");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsVerifyingCode(false);
        }
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");

        if (!isEmailVerified) {
            setError("Please verify your email address first.");
            return;
        }

        if (!isOver14) {
            setError("You must be at least 14 years old to register.");
            return;
        }
        if (!isPrivacyAgreed) {
            setError("You must agree to the Privacy Policy.");
            return;
        }
        if (cookieRequired && !isCookieAgreed) {
            setError("You must agree to the Cookie Policy.");
            return;
        }

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
                    over14Agreed: isOver14,
                    privacyAgreed: isPrivacyAgreed,
                    cookieAgreed: isCookieAgreed,
                    marketingDataConsent: isMarketingConsent,
                    adsReceiveConsent: isMarketingConsent,
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
                            <div className="flex items-end gap-2">
                                <div className="flex-1">
                                    <Input
                                        name="email"
                                        type="email"
                                        label="Email"
                                        placeholder="name@example.com"
                                        value={email}
                                        onChange={(event) => {
                                            if (!isEmailVerified) setEmail(event.target.value);
                                        }}
                                        required
                                        disabled={isEmailVerified}
                                    />
                                </div>
                                {!isEmailVerified && verificationStep === "email" && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={sendVerificationCode}
                                        disabled={!isEmailValid || isSendingCode}
                                        className="mb-0.5"
                                    >
                                        {isSendingCode ? "Sending..." : "Send Code"}
                                    </Button>
                                )}
                                {isEmailVerified && (
                                    <div className="flex items-center gap-1.5 px-3 py-2 text-emerald-500 text-sm font-medium mb-0.5">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Verified
                                    </div>
                                )}
                            </div>

                            {!isEmailVerified && verificationStep === "otp" && (
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="flex-1">
                                        <Input
                                            placeholder="Enter 6-digit code"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                            maxLength={6}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={verifyEmailCode}
                                        disabled={otp.length < 6 || isVerifyingCode}
                                    >
                                        {isVerifyingCode ? "Verifying..." : "Verify"}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={sendVerificationCode}
                                        disabled={!isEmailValid || isSendingCode || resendCooldown > 0}
                                        className="text-xs text-[var(--muted)]"
                                    >
                                        {isSendingCode
                                            ? "Sending..."
                                            : resendCooldown > 0
                                                ? `Resend in ${resendCooldown}s`
                                                : "Resend code"}
                                    </Button>
                                </div>
                            )}

                            {verificationMsg && (
                                <p className="text-xs text-blue-500 ml-1">{verificationMsg}</p>
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
                                onChange={(event) => setCountry(event.target.value)}
                                className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40 focus:border-[var(--ring)] transition-all"
                            >
                                {ALL_SIGNUP_COUNTRIES.map((item) => (
                                    <option key={item.code} value={item.code}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Consent Checkboxes */}
                        <div className="space-y-3 pt-2 border-t border-[var(--border)]">
                            <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider ml-1 mb-1">
                                Consents
                            </p>

                            <label className="flex items-start gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={isOver14}
                                    onChange={(e) => setIsOver14(e.target.checked)}
                                    className="mt-1 w-4 h-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--ring)]"
                                />
                                <span className="text-sm text-[var(--fg)]">
                                    I confirm I am at least 14 years old. (Required)
                                </span>
                            </label>

                            <label className="flex items-start gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={isPrivacyAgreed}
                                    onChange={(e) => setIsPrivacyAgreed(e.target.checked)}
                                    className="mt-1 w-4 h-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--ring)]"
                                />
                                <span className="text-sm text-[var(--fg)]">
                                    I agree to the{" "}
                                    <Link
                                        href={privacyLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={getLegalLinkClassName(privacyLink)}
                                    >
                                        Privacy Policy
                                    </Link>
                                    . (Required)
                                </span>
                            </label>

                            <label className="flex items-start gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={isCookieAgreed}
                                    onChange={(e) => setIsCookieAgreed(e.target.checked)}
                                    className="mt-1 w-4 h-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--ring)]"
                                />
                                <span className="text-sm text-[var(--fg)]">
                                    I agree to the{" "}
                                    <Link
                                        href={cookieLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={getLegalLinkClassName(cookieLink)}
                                    >
                                        Cookie Policy
                                    </Link>
                                    {cookieRequired ? ". (Required in your region)" : ". (Optional)"}
                                </span>
                            </label>

                            <label className="flex items-start gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={isMarketingConsent}
                                    onChange={(e) => setIsMarketingConsent(e.target.checked)}
                                    className="mt-1 w-4 h-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--ring)]"
                                />
                                <span className="text-sm text-[var(--fg)]">
                                    I agree to{" "}
                                    <Link
                                        href={marketingCommunicationsLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={getLegalLinkClassName(marketingCommunicationsLink)}
                                    >
                                        marketing communications
                                    </Link>
                                    . (Optional)
                                </span>
                            </label>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full" size="lg" isLoading={loading} disabled={!isEmailVerified}>
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
