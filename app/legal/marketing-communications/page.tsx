import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const runtime = "nodejs";

export const metadata: Metadata = buildPageMetadata({
    title: "Marketing Communications",
    description:
        "Learn how Onbure handles optional marketing communications, consent preferences, delivery channels, and opt-out controls.",
    pathname: "/legal/marketing-communications",
    keywords: ["marketing communications", "consent", "email preferences"],
    openGraphType: "article",
});

export default function MarketingCommunicationsPage() {
    return (
        <main className="min-h-screen bg-white text-black">
            <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">
                <header className="space-y-2">
                    <h1 className="text-2xl font-semibold">Marketing Communications</h1>
                    <p className="text-sm text-gray-700">Effective Date: 2026-02-26</p>
                    <p className="text-sm text-gray-700">Last Updated: 2026-02-26</p>
                </header>

                <section className="space-y-3 border-t border-gray-200 pt-6">
                    <h2 className="text-xl font-semibold">1. Scope</h2>
                    <p className="text-sm leading-7 text-gray-900">
                        This notice explains how Onbure handles optional marketing communications, including what
                        we send, how we choose recipients, and how you can control your preferences. It applies to
                        promotional emails and in-product promotional notices associated with your account.
                    </p>
                </section>

                <section className="space-y-3 border-t border-gray-200 pt-6">
                    <h2 className="text-xl font-semibold">2. Message Types and Purposes</h2>
                    <p className="text-sm leading-7 text-gray-900">
                        If you opt in, we may send product announcements, feature spotlights, service updates,
                        campaign notices, event invitations, educational resources, and limited-time offers.
                        Messages are intended to improve product discovery, increase relevance of updates, and
                        provide actionable information about available capabilities.
                    </p>
                    <p className="text-sm leading-7 text-gray-900">
                        We do not promise delivery frequency, discounts, or specific campaign benefits. Promotions
                        may vary by geography, account status, language support, and operational constraints.
                    </p>
                </section>

                <section className="space-y-3 border-t border-gray-200 pt-6">
                    <h2 className="text-xl font-semibold">3. Consent and Legal Basis</h2>
                    <p className="text-sm leading-7 text-gray-900">
                        Marketing communications are optional and not required for core service access. In regions
                        where consent is required for direct marketing, we process marketing preferences only after
                        an affirmative opt-in. In regions where applicable law allows legitimate-interest outreach,
                        we still provide straightforward opt-out controls.
                    </p>
                    <p className="text-sm leading-7 text-gray-900">
                        Your preference is stored as a consent signal associated with your account and may include
                        timestamps and channel-level status used for compliance and audit purposes.
                    </p>
                </section>

                <section className="space-y-3 border-t border-gray-200 pt-6">
                    <h2 className="text-xl font-semibold">4. Channels, Cadence, and Delivery</h2>
                    <p className="text-sm leading-7 text-gray-900">
                        Marketing communications may be delivered by email and in-app channels where available.
                        Delivery can depend on your notification settings, provider policies, spam filtering rules,
                        and technical deliverability conditions outside our direct control.
                    </p>
                    <p className="text-sm leading-7 text-gray-900">
                        We aim to avoid excessive frequency by applying campaign controls and suppression rules.
                        Some users may still receive multiple messages within a short period when participating in
                        multiple campaigns or product launches.
                    </p>
                </section>

                <section className="space-y-3 border-t border-gray-200 pt-6">
                    <h2 className="text-xl font-semibold">5. Data Used for Marketing Relevance</h2>
                    <p className="text-sm leading-7 text-gray-900">
                        To personalize communications, we may use limited categories of data such as account region,
                        language preference, feature usage patterns, plan status, prior campaign interactions, and
                        high-level engagement signals. We do not use sensitive personal data for promotional
                        targeting unless explicitly permitted by law and user consent where required.
                    </p>
                    <p className="text-sm leading-7 text-gray-900">
                        Relevance models and audience segmentation are designed to reduce irrelevant outreach and
                        improve message quality. These processes may be periodically revised as product capabilities
                        and compliance requirements evolve.
                    </p>
                </section>

                <section className="space-y-3 border-t border-gray-200 pt-6">
                    <h2 className="text-xl font-semibold">6. Preference Management and Opt-Out</h2>
                    <p className="text-sm leading-7 text-gray-900">
                        You can opt out at any time from account settings or, when available, from an unsubscribe
                        link included in promotional emails. Preference changes are applied without undue delay, but
                        previously queued campaigns may still be delivered for a limited period.
                    </p>
                    <p className="text-sm leading-7 text-gray-900">
                        If you believe opt-out has not been respected, contact support with your account email and
                        message details so we can investigate and apply corrective controls.
                    </p>
                </section>

                <section className="space-y-3 border-t border-gray-200 pt-6">
                    <h2 className="text-xl font-semibold">7. Service Notices vs. Marketing</h2>
                    <p className="text-sm leading-7 text-gray-900">
                        Security alerts, account verification, billing notices, legal/policy updates, and incident
                        notifications are operational notices. These notices are separate from marketing and may be
                        sent even when promotional consent is disabled.
                    </p>
                </section>

                <section className="space-y-3 border-t border-gray-200 pt-6">
                    <h2 className="text-xl font-semibold">8. Retention and Compliance Records</h2>
                    <p className="text-sm leading-7 text-gray-900">
                        We retain marketing preference records, suppression lists, and campaign audit metadata for
                        compliance, dispute handling, and fraud-prevention purposes for a period consistent with
                        legal obligations and operational necessity.
                    </p>
                    <p className="text-sm leading-7 text-gray-900">
                        When retention is no longer required, records are deleted or de-identified according to
                        applicable internal controls and legal requirements.
                    </p>
                </section>

                <section className="space-y-3 border-t border-gray-200 pt-6">
                    <h2 className="text-xl font-semibold">9. Processors and Cross-Border Handling</h2>
                    <p className="text-sm leading-7 text-gray-900">
                        We may use third-party communication providers to support campaign delivery and analytics.
                        Where data is transferred across borders, we apply appropriate transfer safeguards required
                        by applicable law.
                    </p>
                </section>

                <section className="space-y-3 border-t border-gray-200 pt-6">
                    <h2 className="text-xl font-semibold">10. Updates to this Notice</h2>
                    <p className="text-sm leading-7 text-gray-900">
                        We may update this notice to reflect legal, operational, or product changes. Material
                        updates may be posted on this page and, where required, communicated through account or
                        in-product notices.
                    </p>
                </section>

                <section className="space-y-3 border-t border-gray-200 pt-6">
                    <h2 className="text-xl font-semibold">11. Contact</h2>
                    <p className="text-sm leading-7 text-gray-900">
                        For questions about marketing communications or consent preferences, contact Onbure support
                        through the official service channels available in the product.
                    </p>
                </section>
            </div>
        </main>
    );
}
