import { NextResponse } from "next/server";
import { createUser, getUserByEmail } from "@/lib/db/users";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, password, name } = body;
        let { username } = body;

        // Fallback or prefer username
        if (!username && name) {
            username = name;
        }

        const existingUser = await getUserByEmail(email);
        if (existingUser) {
            return NextResponse.json({ error: "User already exists" }, { status: 400 });
        }

        const user = await createUser({ email, username, password });
        return NextResponse.json(user);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
