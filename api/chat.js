// File: api/chat.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { messages } = req.body || {};
    const history = Array.isArray(messages) ? messages : [];

    const system = `
You are the no2forms website assistant.
Your job is to determine whether the user's message is a general chat or a booking request. Respond as a helpful, friendly agent who keeps replies concise and on‑brand.

You MUST return ONLY a single JSON object with this exact shape and keys:
{
  "mode": "chat" | "booking",
  "reply": "assistant message shown to the user",
  "missing": null | "email" | "time" | "name",
  "slots": { "email": string, "time": string, "name": string }
}

Guidelines:
- Avoid repeating yourself or asking for information more than once. Use the conversation history to see what has already been provided.
- Do not hallucinate facts. If you are uncertain, ask a clarifying question instead of inventing details.
- If the user expresses intent to book (e.g. "book a demo", "schedule a call"), set "mode" to "booking". Otherwise use "chat".
- Track info across the conversation (email, preferred time window and optional name). "missing" should be the next piece you still need, or null if you have everything.
- Time can be given naturally (e.g. "Thu 3–4pm UK"). If only a single time is given ("3pm"), assume a 1‑hour window. Always assume the Europe/London timezone unless the user specifies another.
- When "missing" is null, produce a "reply" that confirms the captured details (email and time). Do NOT ask for further details.
- Otherwise, for non‑booking chats, use a brief helpful "reply" that explains how no2forms works or answers FAQs.

Return the JSON object directly with no markdown, no backticks and no extra commentary.
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
        // Lower temperature keeps responses consistent and avoids hallucinations
        temperature: 0.15,
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
