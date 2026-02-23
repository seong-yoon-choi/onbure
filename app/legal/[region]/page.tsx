import { notFound } from "next/navigation";
import { getRegionLegalDocument } from "@/lib/legal-documents";

export const runtime = "nodejs";

type LegalRegionPageProps = {
    params: Promise<{ region: string }>;
};

export default async function LegalRegionPage({ params }: LegalRegionPageProps) {
    const { region } = await params;
    const doc = getRegionLegalDocument(region);
    if (!doc) notFound();

    return (
        <main className="min-h-screen bg-white text-black">
            <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
                <header className="space-y-2">
                    <h1 className="text-2xl font-semibold">{doc.title}</h1>
                    <p className="text-sm text-gray-700">Effective Date: {doc.effectiveDate}</p>
                    <p className="text-sm text-gray-700">Last Updated: {doc.lastUpdated}</p>
                    <p className="text-sm text-gray-700">Locale: {doc.locale}</p>
                </header>

                {doc.sections.map((section) => (
                    <section id={section.id} key={section.id} className="space-y-3 border-t border-gray-200 pt-6">
                        <h2 className="text-xl font-semibold">{section.title}</h2>
                        {section.paragraphs.map((paragraph, index) => (
                            <p key={`${section.id}-${index}`} className="text-sm leading-7 text-gray-900">
                                {paragraph}
                            </p>
                        ))}
                    </section>
                ))}
            </div>
        </main>
    );
}
