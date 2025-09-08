// api/notify.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { email, time, name, notes, isoKey } = req.body || {};
    if (!email || !time) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }

    // -----------------------------------------------------------------------------
    // Booking management
    // In earlier iterations we attempted to prevent double‑booking by storing
    // requested slots in a JSON file and rejecting duplicates. Now that the site
    // uses Google Calendar’s appointment scheduling to handle availability, this
    // endpoint simply persists the request for record‑keeping and notifies the
    // operator via email or Slack. We do not perform any duplicate checks here.
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
    // Persist the booking request. We include the optional isoKey when provided.
    // Before saving we check if the requested slot is already booked. This
    // prevents double‑booking by comparing a normalised key for each booking.
    const normalise = (str) => String(str || '')
      .toLowerCase()
      .replace(/\s+/g, '')          // remove all whitespace
      .replace(/[\u2013\u2014\-]/g, '') // remove en/em dashes and hyphens
      .replace(/[–—]/g, '')          // double safety for different dash chars
      .replace(/[:.,]/g, '');        // strip common punctuation
    const parseToIsoKey = (str) => {
      try {
        const d = new Date(str);
        if (!isNaN(d)) {
          return d.toISOString().slice(0, 16).toLowerCase();
        }
      } catch {}
      return null;
    };
    let requestedKey;
    if (isoKey) {
      requestedKey = String(isoKey).toLowerCase();
    } else {
      const parsed = parseToIsoKey(time);
      requestedKey = parsed || normalise(time);
    }
    const exists = bookings.find((b) => {
      let bKey;
      if (b.isoKey) {
        bKey = String(b.isoKey).toLowerCase();
      } else {
        const parsed = parseToIsoKey(b.time);
        bKey = parsed || normalise(b.time);
      }
      return bKey === requestedKey;
    });
    if (exists) {
      // Slot already taken. Inform client so they can prompt user to pick a different time.
      return res.status(200).json({ ok: false, error: 'slot_unavailable' });
    }
    bookings.push({ email, time, name: name || '', notes: notes || '', isoKey: isoKey || '' });
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
