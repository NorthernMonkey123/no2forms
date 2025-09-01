// api/notify.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { email, time, name, notes } = req.body || {};
    if (!email || !time) return res.status(400).json({ error: "Missing email or time" });

    const lines = [
      "🗓️ New no2forms booking request",
      `• Email: ${email}`,
      `• Time: ${time}`,
      name ? `• Name: ${name}` : null,
      notes ? `• Notes: ${notes}` : null,
      `• Source: no2forms.com`
    ].filter(Boolean);

    // Send email via Resend
    if (process.env.RESEND_API_KEY && process.env.BOOKINGS_TO_EMAIL) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          // You can change "from" later to hello@no2forms.com after domain setup
          from: "no2forms <onboarding@resend.dev>", 
          to: [process.env.BOOKINGS_TO_EMAIL],
          reply_to: process.env.BOOKINGS_TO_EMAIL,  
          subject: "New no2forms booking",
          text: lines.join("\n"),
        }),
      });
      if (!r.ok) {
        const err = await r.text();
        console.error("Resend error:", err);
      }
    }

    // Optional Slack (add SLACK_WEBHOOK_URL later if you want)
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: lines.join("\n") }),
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("notify error", e);
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
