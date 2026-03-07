import DiscoveryClientPage from "./discovery-client";

interface DiscoveryPageProps {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export const dynamic = "force-dynamic";

export default async function DiscoveryPage({ searchParams }: DiscoveryPageProps) {
    const resolvedSearchParams = (await searchParams) ?? {};
    const rawQuery = resolvedSearchParams.q;
    const initialSearchQuery = Array.isArray(rawQuery) ? (rawQuery[0] ?? "") : (rawQuery ?? "");

    return <DiscoveryClientPage initialSearchQuery={initialSearchQuery} />;
}
