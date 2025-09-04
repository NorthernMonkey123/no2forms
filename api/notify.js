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
    // Determine a unique key for the booking.
    // 1. Prefer isoKey if provided by the client (computed from the date & start time when using the mini picker).
    // 2. Otherwise, try to parse the "time" string into an ISO timestamp using the Date constructor. Many browser
    //    and Node runtimes understand common date formats (e.g. "15 Dec 14:00", "2025‑12‑15 14:00"). If parsing
    //    succeeds, trim to minutes (YYYY-MM-DDTHH:MM) to act as the key. This helps deduplicate bookings even
    //    when users type times manually.
    // 3. As a last resort, normalise the raw time string by stripping whitespace, dashes and punctuation.
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
          // toISOString returns in UTC; slice to get YYYY-MM-DDTHH:MM
          return d.toISOString().slice(0, 16).toLowerCase();
        }
      } catch {}
      return null;
    };
    let key;
    if (isoKey) {
      key = String(isoKey).toLowerCase();
    } else {
      const parsed = parseToIsoKey(time);
      key = parsed || normalise(time);
    }
    const exists = bookings.find((b) => {
      let bKey;
      if (b.isoKey) {
        bKey = String(b.isoKey).toLowerCase();
      } else {
        const parsed = parseToIsoKey(b.time);
        bKey = parsed || normalise(b.time);
      }
      return bKey === key;
    });
    if (exists) {
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
