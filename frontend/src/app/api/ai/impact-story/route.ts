import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Groq API key not configured" }, { status: 500 });

    const { food_type, quantity_kg, ngo_name, meals_served, co2_saved_kg, donor_name, tier } = await req.json();

    const treesEquiv = Math.round((co2_saved_kg || 0) / 21);
    const co2Cars = Math.round((co2_saved_kg || 0) / 0.21);
    const estimatedMeals = meals_served || Math.round((quantity_kg || 0) * 4);

    const systemPrompt = `You are a creative impact storytelling AI for a food rescue platform.
Generate a short (3-4 sentences), emotionally resonant, shareable impact narrative for a completed food rescue.
Tone: warm, celebratory, specific. Include real numbers. End with a motivational call-to-action sentence.
Return JSON: { "headline": string, "story": string, "stats_line": string, "hashtags": string[] }`;

    const userMsg = `Rescue completed:
- Donor: ${donor_name || "An anonymous donor"} (${tier || "Bronze"} tier)
- Food rescued: ${quantity_kg}kg of ${food_type}
- Delivered to: ${ngo_name || "an NGO"}
- Estimated meals provided: ${estimatedMeals}
- CO₂ prevented: ${co2_saved_kg || (quantity_kg * 2.5).toFixed(1)}kg (≈${treesEquiv} trees, ${co2Cars}km of car travel)`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            max_tokens: 400,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMsg },
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
        return NextResponse.json({ ...JSON.parse(content), estimated_meals: estimatedMeals, trees_equiv: treesEquiv });
    } catch {
        return NextResponse.json({ error: "Failed to parse AI response", raw: content }, { status: 502 });
    }
}
