// File: api/chat.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { messages } = req.body || {};
    const history = Array.isArray(messages) ? messages : [];

    const system = `
You are the no2forms website assistant.
Decide if the user's message is general chat or a booking request.
Keep replies short, friendly, and on-brand.

Return ONLY a single JSON object with this exact shape:
{
  "mode": "chat" | "booking",
  "reply": "assistant message shown to the user",
  "missing": null | "email" | "time" | "name",
  "slots": { "email": string, "time": string, "name": string }
}

Rules:
- If user expresses intent to book/schedule, set "mode":"booking".
- Track info already provided across the conversation (email/time/name).
- "missing" is the NEXT piece you still need for booking, or null if you have all.
- Time can be natural language ("Thu 3–4pm UK"). If only a single time is given (e.g., "3pm"), assume a 1-hour window.
- Default timezone: Europe/London unless user specifies otherwise.
- When email + time are present ("missing": null), the "reply" should confirm details.
- Otherwise (no booking intent), use "mode":"chat" and a concise helpful "reply".

Return JSON only. No markdown, no code fences.
    `.trim();

    const examples = [
      { role: "user", content: "hi" },
      { role: "assistant", content: JSON.stringify({mode:"chat", reply:"Hi! I can explain how no2forms replaces forms with chat, or book a quick call if you’d like.", missing:null, slots:{email:"",time:"",name:""}}) },
      { role: "user", content: "book a demo" },
      { role: "assistant", content: JSON.stringify({mode:"booking", reply:"Great — what’s your email address?", missing:"email", slots:{email:"",time:"",name:""}}) }
    ];

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          { role: "system", content: system },
          ...examples,
          ...history
        ],
      }),
    });

    const data = await openaiRes.json();
    if (!openaiRes.ok) {
      console.error("OpenAI API error:", data);
      return res.status(500).json({ error: data.error || data });
    }

    const raw = data?.choices?.[0]?.message?.content || "";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fallback for safety
      parsed = {
        mode: "chat",
        reply: raw || "Happy to help! Ask me anything — or say “book a demo”.",
        missing: null,
        slots: { email:"", time:"", name:"" }
      };
    }

    // Minimal schema guard
    if (!parsed || typeof parsed !== "object" || !("mode" in parsed) || !("reply" in parsed)) {
      parsed = { mode: "chat", reply: "Happy to help! Ask me anything — or say “book a demo”.", missing: null, slots: { email:"", time:"", name:"" } };
    }

    res.status(200).json(parsed);
  } catch (e) {
    console.error("Server error:", e);
    res.status(500).json({ error: e.message || "Server error" });
  }
}
