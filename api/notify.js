// api/notify.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { email, time, name, notes } = req.body || {};
    if (!email || !time) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }

    // -----------------------------------------------------------------------------
    // Booking management
    // We persist bookings to a local JSON file. Each entry contains the time string.
    // If the requested time is already booked we return an error so the client can
    // prompt the user to choose another slot. Otherwise we append and continue.
    // Note: this is a simple in-memory solution for demonstration and should be
    // replaced with a real calendar integration in production.
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataDir = path.join(process.cwd(), 'data');
    const file = path.join(dataDir, 'bookings.json');
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch {
      /* ignore */
    }
    let bookings = [];
    try {
      const json = await fs.readFile(file, 'utf8');
      bookings = JSON.parse(json);
    } catch {
      bookings = [];
    }
    // Normalise the time string: lowercase and remove all whitespace and dash/ndash/emdash
    const normalise = (str) => String(str || '')
      .toLowerCase()
      .replace(/[\s\u2013\u2014-]/g, '');
    const timeKey = normalise(time);
    const exists = bookings.find((b) => normalise(b.time) === timeKey);
    if (exists) {
      return res.status(200).json({ ok: false, error: 'slot_unavailable' });
    }
    bookings.push({ email, time, name: name || '', notes: notes || '' });
    try {
      await fs.writeFile(file, JSON.stringify(bookings, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to persist booking:', err);
    }

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
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "no2forms <onboarding@resend.dev>",
            to: [process.env.BOOKINGS_TO_EMAIL],
            reply_to: email,
            subject: "New no2forms booking",
            text: lines.join("\n"),
          }),
        });
        if (!r.ok) {
          const err = await r.text();
          console.error("Resend error:", err);
        }
      } catch (err) {
        console.error('Resend send failed:', err);
      }
    }

    // Optional Slack
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: lines.join("\n") }),
        });
      } catch (err) {
        console.error('Slack webhook failed:', err);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("notify error", e);
    return res.status(500).json({ ok: false, error: e.message || "server_error" });
  }
}
