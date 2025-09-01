// File: api/chat.js
export const config = { runtime: "edge" }; // Fast, global

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const userMessage = (body && body.message) || "";

    if (!userMessage) {
      return new Response(JSON.stringify({ error: "Missing message" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Call OpenAI (server-side: your key stays secret)
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // cost-effective, responsive
        messages: [
          {
            role: "system",
            content:
              "You are the no2forms site assistant. Be concise, friendly, and helpful. Explain how no2forms replaces contact forms with AI that handles inquiries, bookings, and info requests. If asked about pricing or onboarding, say it's early access and to leave contact info.",
          },
          { role: "user", content: userMessage },
        ],
        temperature: 0.6,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return new Response(JSON.stringify({ error: errText }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    const data = await openaiRes.json();
    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "Sorry — I couldn't generate a response.";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "Server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
