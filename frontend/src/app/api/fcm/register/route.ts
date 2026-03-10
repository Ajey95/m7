import { NextRequest, NextResponse } from "next/server";

// Proxy FCM token registration to the FastAPI backend.
// This keeps the backend URL private from the browser.
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const authHeader = req.headers.get("authorization");

        const backendUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1/notifications/fcm-token`;

        const backendRes = await fetch(backendUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(authHeader ? { Authorization: authHeader } : {}),
            },
            body: JSON.stringify(body),
        });

        if (backendRes.status === 204) {
            return new NextResponse(null, { status: 204 });
        }

        const data = await backendRes.json().catch(() => ({}));
        return NextResponse.json(data, { status: backendRes.status });
    } catch {
        return NextResponse.json({ error: "Failed to register FCM token" }, { status: 500 });
    }
}
