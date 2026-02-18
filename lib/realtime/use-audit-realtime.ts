"use client";

import { useEffect, useRef } from "react";
import { AuditLogRealtimeRow, subscribeToAuditLogRealtime } from "@/lib/realtime/supabase-realtime-client";

export function useAuditRealtime(
    enabled: boolean,
    onRow: (row: AuditLogRealtimeRow) => void
) {
    const onRowRef = useRef(onRow);

    useEffect(() => {
        onRowRef.current = onRow;
    }, [onRow]);

    useEffect(() => {
        if (!enabled) return;
        return subscribeToAuditLogRealtime((row) => {
            onRowRef.current(row);
        });
    }, [enabled]);
}
