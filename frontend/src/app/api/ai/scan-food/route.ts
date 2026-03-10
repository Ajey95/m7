import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Groq API key not configured" }, { status: 500 });

    const body = await req.json();
    const { image_base64, mime_type = "image/jpeg" } = body;
    if (!image_base64) return NextResponse.json({ error: "image_base64 is required" }, { status: 400 });

    const systemPrompt = `You are a food safety expert AI for a food rescue logistics platform.
Analyse the food image and return a JSON object with these exact fields:
{
  "food_type": string,
  "freshness_window_hours": number,
  "spoilage_risk": "LOW" | "MEDIUM" | "HIGH",
  "portion_count_estimate": number,
  "safe_to_redistribute": boolean,
  "notes": string
}
Be conservative on safety. If in doubt, set spoilage_risk HIGH.`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            max_tokens: 500,
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Analyse this food and return the safety assessment JSON." },
                        { type: "image_url", image_url: { url: `data:${mime_type};base64,${image_base64}`, detail: "low" } },
                    ],
                },
            ],
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return NextResponse.json({ error: err?.error?.message || "Groq request failed" }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    try {
        return NextResponse.json(JSON.parse(content));
    } catch {
        return NextResponse.json({ error: "Failed to parse AI response", raw: content }, { status: 502 });
    }
}
