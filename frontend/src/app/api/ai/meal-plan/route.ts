import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Groq API key not configured" }, { status: 500 });

    const { ingredients, beneficiary_count, dietary_restrictions = [] } = await req.json();
    if (!ingredients || !beneficiary_count)
        return NextResponse.json({ error: "ingredients and beneficiary_count are required" }, { status: 400 });

    const restrictionText = dietary_restrictions.length > 0
        ? `Dietary restrictions: ${dietary_restrictions.join(", ")}.`
        : "No specific dietary restrictions.";

    const ingredientList = Array.isArray(ingredients)
        ? ingredients.map((i: { food_type: string; quantity_kg: number }) => `${i.food_type}: ${i.quantity_kg}kg`).join(", ")
        : ingredients;

    const systemPrompt = `You are a nutritionist and kitchen planner for an NGO food rescue platform.
Given a list of incoming food donations and the number of beneficiaries, generate an optimized 3-day meal plan.
${restrictionText}

Return JSON with this exact structure:
{
  "meal_plan": [
    {
      "day": 1,
      "meals": [
        {
          "meal_type": "Breakfast" | "Lunch" | "Dinner",
          "dish_name": string,
          "ingredients_used": [{"item": string, "quantity_kg": number}],
          "servings": number,
          "calories_per_serving": number,
          "protein_g": number,
          "notes": string
        }
      ]
    }
  ],
  "nutritional_summary": {
    "avg_daily_calories": number,
    "avg_protein_g": number,
    "coverage_pct": number
  },
  "waste_reduction_tip": string
}`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            max_tokens: 1200,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: `Incoming ingredients: ${ingredientList}. Beneficiaries to serve: ${beneficiary_count} people. Generate a 3-day meal plan.`,
                },
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
