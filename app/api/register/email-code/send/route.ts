import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
    void req;
    return NextResponse.json(
        { error: "Email verification is disabled for now." },
        { status: 410 }
    );
}
