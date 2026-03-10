import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Groq API key not configured" }, { status: 500 });

    const { description } = await req.json();
    if (!description) return NextResponse.json({ error: "description is required" }, { status: 400 });

    const systemPrompt = `You are a food donation intake assistant for a food rescue logistics platform.
Extract structured donation fields from the donor's freeform description.
Return a JSON object with these exact fields:
{
  "food_type": string,
  "quantity_kg": number,
  "expiry_hours": number,
  "urgency": "LOW" | "MEDIUM" | "HIGH",
  "description": string,
  "confidence": number (0-1),
  "notes": string
}
If any field cannot be determined, use a sensible default and lower the confidence score.
quantity_kg must be a positive number. expiry_hours should be your best estimate of how many hours before the food expires.`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            max_tokens: 400,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: description },
            ],
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return NextResponse.json({ error: err?.error?.message || "OpenAI request failed" }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    try {
        return NextResponse.json(JSON.parse(content));
    } catch {
        return NextResponse.json({ error: "Failed to parse AI response", raw: content }, { status: 502 });
    }
}
