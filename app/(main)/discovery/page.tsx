import { Suspense } from "react";
import DiscoveryClientPage from "./discovery-client";

export default function DiscoveryPage() {
    return (
        <Suspense fallback={<div className="text-[var(--muted)]">Loading...</div>}>
            <DiscoveryClientPage />
        </Suspense>
    );
}
