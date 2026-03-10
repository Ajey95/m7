import { NextRequest, NextResponse } from "next/server";

// Search aliases for each city (PredictHQ free tier uses text search, not geo-filter)
const CITY_SEARCH: Record<string, string[]> = {
    "Bengaluru": ["Bangalore", "Bengaluru"],
    "Mumbai":    ["Mumbai", "Bombay"],
    "Delhi":     ["Delhi", "New Delhi"],
    "Chennai":   ["Chennai", "Madras"],
    "Hyderabad": ["Hyderabad"],
};

const FALLBACK_EVENTS: Record<string, { name: string; date: string; venue: string; type: string }[]> = {
    "Bengaluru": [
        { name: "Holi Mela — Community Celebration", date: "March 14, 2026", venue: "Cubbon Park, Bengaluru", type: "festival" },
        { name: "IPL 2026 — Season Opener RCB vs CSK", date: "March 22, 2026", venue: "M. Chinnaswamy Stadium, Bengaluru", type: "cricket" },
        { name: "Ugadi Celebrations & Food Fair", date: "March 30, 2026", venue: "Palace Grounds, Bengaluru", type: "festival" },
        { name: "Bangalore Tech Summit 2026", date: "March 18, 2026", venue: "KTPO, Whitefield, Bengaluru", type: "conference" },
    ],
};

async function fetchRealEvents(city: string): Promise<{ name: string; date: string; venue: string; type: string }[]> {
    const token = process.env.PREDICTHQ_API_TOKEN;
    if (!token) return FALLBACK_EVENTS[city] ?? FALLBACK_EVENTS["Bengaluru"];

    const today = new Date();
    const inNinetyDays = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
    const startDate = today.toISOString().slice(0, 10);
    const endDate = inNinetyDays.toISOString().slice(0, 10);

    const aliases = CITY_SEARCH[city] ?? [city];
    const allEvents: { name: string; date: string; venue: string; type: string }[] = [];

    for (const alias of aliases) {
        const params = new URLSearchParams({
            q: alias,
            "active.gte": startDate,
            "active.lte": endDate,
            sort: "predicted_event_spend",
            limit: "6",
        });

        try {
            const res = await fetch(`https://api.predicthq.com/v1/events/?${params}`, {
                headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
                next: { revalidate: 3600 }, // cache for 1 hour
            });
            if (!res.ok) continue;
            const data = await res.json();
            for (const e of (data.results ?? [])) {
                if (allEvents.some(ev => ev.name === e.title)) continue; // deduplicate
                const venue = e.entities?.find((ent: any) => ent.type === "venue")?.name ?? `${city}`;
                allEvents.push({
                    name: e.title,
                    date: e.start
                        ? new Date(e.start).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
                        : "Upcoming",
                    venue,
                    type: e.category ?? "event",
                });
            }
        } catch {
            // silently skip if one alias fails
        }
    }

    return allEvents.length > 0 ? allEvents.slice(0, 8) : (FALLBACK_EVENTS[city] ?? FALLBACK_EVENTS["Bengaluru"]);
}

export async function POST(req: NextRequest) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Groq API key not configured" }, { status: 500 });

    const body = await req.json();
    const { city = "Bengaluru", zone = "all zones" } = body;

    const events = await fetchRealEvents(city);

    const eventsContext = events.map(
        (e) => `- ${e.name} (${e.date}) at ${e.venue} [${e.type}]`
    ).join("\n");

    const systemPrompt = `You are a food surplus prediction AI for a food rescue logistics platform in ${city}.
You reason over upcoming local events to predict food surplus spikes and proactively alert NGOs and volunteers.

Return a JSON object with this structure:
{
  "predictions": [
    {
      "event_name": string,
      "event_type": string,
      "event_date": string,
      "predicted_surplus_kg": number,
      "spike_pct": number,
      "affected_zone": string,
      "recommended_action": string,
      "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "ngo_capacity_needed": number
    }
  ],
  "summary": string,
  "top_alert": string
}`;

    const userMsg = `Upcoming events in ${city}, ${zone}:\n${eventsContext}\n\nBased on historical surplus patterns for similar events, predict food surplus spikes and recommend proactive actions.`;

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
        return NextResponse.json({ ...JSON.parse(content), events_ingested: events });
    } catch {
        return NextResponse.json({ error: "Failed to parse AI response", raw: content }, { status: 502 });
    }
}
