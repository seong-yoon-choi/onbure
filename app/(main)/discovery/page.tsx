import { permanentRedirect } from "next/navigation";

interface DiscoveryPageProps {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DiscoveryPage({ searchParams }: DiscoveryPageProps) {
    const resolvedSearchParams = (await searchParams) ?? {};
    const rawQuery = resolvedSearchParams.q;
    const initialSearchQuery = Array.isArray(rawQuery) ? (rawQuery[0] ?? "") : (rawQuery ?? "");
    const redirectTarget = initialSearchQuery
        ? `/?q=${encodeURIComponent(initialSearchQuery)}`
        : "/";

    permanentRedirect(redirectTarget);
}
