import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Groq API key not configured" }, { status: 500 });

    const { ngo_name, funder, program_type, impact_stats } = await req.json();
    if (!funder || !ngo_name)
        return NextResponse.json({ error: "ngo_name and funder are required" }, { status: 400 });

    const statsText = impact_stats
        ? `- Total meals served: ${impact_stats.total_meals || "N/A"}
- Total food redistributed: ${impact_stats.total_kg || "N/A"} kg
- Beneficiaries reached: ${impact_stats.beneficiaries || "N/A"}
- CO₂ prevented: ${impact_stats.co2_kg || "N/A"} kg
- Active months: ${impact_stats.months_active || "N/A"}`
        : "Impact statistics not provided.";

    const systemPrompt = `You are an expert NGO grant writing assistant for a food rescue logistics platform.
Generate a compelling, specific grant application draft section tailored to the funder's priorities, pre-filled with the NGO's real platform data.
Use formal grant writing language. Be specific with numbers. Emphasize impact metrics.

Return JSON with this structure:
{
  "executive_summary": string (2-3 sentences),
  "problem_statement": string (2-3 sentences),
  "proposed_solution": string (3-4 sentences referencing the NGO's actual work),
  "impact_metrics": string (bullet-point string with real numbers),
  "budget_justification_hint": string (1-2 sentences),
  "alignment_statement": string (2 sentences tying NGO work to funder priorities),
  "word_count_estimate": number
}`;

    const userMsg = `Generate a grant draft for:
NGO: ${ngo_name}
Funder: ${funder}
Program type: ${program_type || "Hunger Relief / Food Security"}

NGO Impact Data from platform:
${statsText}

Tailor the draft to ${funder}'s known priorities in ${program_type || "hunger relief"}.`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            max_tokens: 1000,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMsg },
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
