// File: chat-widget.js
(function () {
  // ---------- Styles ----------
  const style = document.createElement("style");
  style.textContent = `
    .n2f-fab { position: fixed; right: 20px; bottom: 20px; width: 56px; height: 56px;
      border-radius: 9999px; background: #111827; color: #fff; border: 1px solid #30363d;
      display:flex; align-items:center; justify-content:center; cursor:pointer; z-index: 99999; }
    .n2f-fab:hover { filter: brightness(1.1); }

    .n2f-panel { position: fixed; right: 20px; bottom: 88px; width: 320px; max-height: 60vh;
      background: #0b0f16; color: #e5e7eb; border: 1px solid #30363d; border-radius: 12px;
      overflow: hidden; display: none; flex-direction: column; z-index: 99999; box-shadow: 0 10px 30px rgba(0,0,0,.4); }

    .n2f-header { padding: 12px 14px; font-weight: 600; background: #111827; border-bottom: 1px solid #30363d; display:flex; justify-content:space-between; align-items:center; }
    .n2f-close { cursor:pointer; opacity:.8; }
    .n2f-close:hover{ opacity:1; }

    .n2f-messages { padding: 12px; overflow-y: auto; flex: 1; display:flex; flex-direction:column; gap: 10px; }
    .n2f-msg { padding: 10px 12px; border-radius: 10px; line-height: 1.4; font-size: 14px; max-width: 85%; white-space: pre-wrap; }
    .n2f-user { align-self: flex-end; background: #1f2937; }
    .n2f-bot { align-self: flex-start; background: #0f172a; border: 1px solid #30363d; }

    .n2f-input { display:flex; gap:8px; border-top: 1px solid #30363d; padding: 10px; background:#0b0f16; }
    .n2f-input input { flex:1; background:#0b0f16; color:#e5e7eb; border:1px solid #30363d; border-radius:8px; padding:10px; outline:none; }
    .n2f-input button { background:#2563eb; color:#fff; border:none; padding:10px 12px; border-radius:8px; cursor:pointer; }
    .n2f-input button:disabled { opacity:.6; cursor:not-allowed; }

    /* mini picker */
    .n2f-picker { margin-top: 6px; border:1px solid #30363d; background:#0b1220; padding:10px; border-radius:10px; display:grid; gap:8px; }
    .n2f-row { display:flex; gap:8px; }
    .n2f-picker input, .n2f-picker select, .n2f-picker button { width:100%; background:#0b0f16; color:#e5e7eb; border:1px solid #30363d; border-radius:8px; padding:8px; }
    .n2f-actions { display:flex; gap:8px; }
  `;
  document.head.appendChild(style);

  // ---------- DOM ----------
  const fab = document.createElement("button");
  fab.className = "n2f-fab";
  fab.title = "Chat with no2forms";
  fab.innerHTML = "💬";

  const panel = document.createElement("div");
  panel.className = "n2f-panel";
  panel.innerHTML = `
    <div class="n2f-header">
      <div>no2forms Assistant</div>
      <div class="n2f-close" title="Close">✕</div>
    </div>
    <div class="n2f-messages"></div>
    <div class="n2f-input">
      <input type="text" placeholder="Ask about no2forms…" />
      <button>Send</button>
    </div>
  `;
  document.body.appendChild(fab);
  document.body.appendChild(panel);

  const closeBtn = panel.querySelector(".n2f-close");
  const messages = panel.querySelector(".n2f-messages");
  const input = panel.querySelector("input");
  const sendBtn = panel.querySelector("button");

  // ---------- Helpers ----------
  const appendMsg = (text, who) => {
    const div = document.createElement("div");
    div.className = `n2f-msg ${who === "user" ? "n2f-user" : "n2f-bot"}`;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  };
  // ---------- HTML message helper ----------
  const appendHtml = (html, who) => {
    const div = document.createElement("div");
    div.className = `n2f-msg ${who === "user" ? "n2f-user" : "n2f-bot"}`;
    div.innerHTML = html;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  };

  // ---------- Calendly inline embed ----------
  const CALENDLY_URL = "https://calendly.com/basicmonkey321/30min";
  function ensureCalendlyAssets() {
    if (!document.querySelector('link[href="https://assets.calendly.com/assets/external/widget.css"]')) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "https://assets.calendly.com/assets/external/widget.css";
      document.head.appendChild(l);
    }
    if (!document.querySelector('script[src="https://assets.calendly.com/assets/external/widget.js"]')) {
      const s = document.createElement("script");
      s.async = true;
      s.type = "text/javascript";
      s.src = "https://assets.calendly.com/assets/external/widget.js";
      document.head.appendChild(s);
    }
  }
  function showCalendlyInline() {
    ensureCalendlyAssets();
    const existing = panel.querySelector(".calendly-inline-widget");
    if (existing && existing.parentNode) existing.parentNode.remove();
    const wrap = document.createElement("div");
    wrap.className = "n2f-msg n2f-bot";
    const cal = document.createElement("div");
    cal.className = "calendly-inline-widget";
    cal.setAttribute("data-url", CALENDLY_URL);
    cal.style.minWidth = "280px";
    cal.style.height = "700px";
    wrap.appendChild(cal);
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
  }

  panel.addEventListener("click", (e) => {
    const a = e.target.closest("a.n2f-book-link");
    if (a) { e.preventDefault(); showCalendlyInline(); }
  });


  // ---------- Mini date/time picker ----------
  let pickerEl = null;
  function removePicker() {
    if (pickerEl && pickerEl.parentNode) pickerEl.parentNode.removeChild(pickerEl);
    pickerEl = null;
    input.disabled = false;
  }

  // ---------- Availability helper ----------
  // Fetch available booking slots from the server. Returns an array of
  // { date: 'YYYY-MM-DD', times: ['HH:MM', ...] } objects. We keep the
  // params modest (5 days, hour interval) to reduce payload.
  async function fetchAvailability() {
    try {
      const res = await fetch('/api/availability?days=5&startHour=9&endHour=17&interval=60');
      if (!res.ok) return [];
      const data = await res.json();
      return data.days || [];
    } catch (err) {
      console.error('availability fetch error', err);
      return [];
    }
  }
  function pad(n){ return String(n).padStart(2,"0"); }
  function addMinutes(hhmm, minutes) {
    const [h, m] = hhmm.split(":").map(Number);
    const total = h*60 + m + minutes;
    const eh = Math.floor((total % (24*60))/60);
    const em = total % 60;
    return `${pad(eh)}:${pad(em)}`;
  }
  function weekdayAndDM(date) {
    const d = new Date(date + "T00:00:00");
    const wk = d.toLocaleDateString("en-GB", { weekday: "short" });
    const dm = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    return `${wk} ${dm}`;
  }
  function showTimePicker(opts) {
    // opts: { onConfirm(label), onCancel() }
    input.disabled = true;
    const container = document.createElement("div");
    container.className = "n2f-picker";

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = pad(today.getMonth() + 1);
    const dd = pad(today.getDate());
    const todayStr = `${yyyy}-${mm}-${dd}`;

    container.innerHTML = `
      <div style="font-weight:600">Pick a date & time (UK)</div>
      <div class="n2f-row">
        <input type="date" id="n2f-date" min="${todayStr}" value="${todayStr}">
      </div>
      <div class="n2f-row">
        <input type="time" id="n2f-start" value="15:00" step="900">
        <select id="n2f-dur">
          <option value="30">30 min</option>
          <option value="60" selected>60 min</option>
          <option value="90">90 min</option>
        </select>
      </div>
      <div class="n2f-actions">
        <button id="n2f-confirm">Confirm</button>
        <button id="n2f-cancel">Cancel</button>
      </div>
      <div style="font-size:12px;opacity:.8">Times assumed Europe/London (UK). Tell me another timezone if needed.</div>
    `;
    pickerEl = container;
    messages.appendChild(container);
    messages.scrollTop = messages.scrollHeight;

    const dateEl = container.querySelector("#n2f-date");
    const startEl = container.querySelector("#n2f-start");
    const durEl = container.querySelector("#n2f-dur");
    const confirmBtn = container.querySelector("#n2f-confirm");
    const cancelBtn = container.querySelector("#n2f-cancel");

    confirmBtn.addEventListener("click", () => {
      const d = dateEl.value;
      const s = startEl.value;
      const dur = parseInt(durEl.value, 10);
      if (!d || !s) { appendMsg("Please choose a date and start time.", "bot"); return; }
      const end = addMinutes(s, dur);
      const label = `${weekdayAndDM(d)}, ${s}–${end} UK`;
      // Compose an ISO-like key for duplicate detection (YYYY-MM-DDTHH:MM)
      const isoKey = `${d}T${s}`;
      removePicker();
      // Pass both the label and isoKey to the caller
      opts?.onConfirm?.({ label, isoKey });
    });
    cancelBtn.addEventListener("click", () => {
      removePicker();
      opts?.onCancel?.();
    });
  }

  // ---------- Conversation state ----------
  const history = []; // messages for LLM: [{role:"user"|"assistant", content:"..."}]
  const State = { IDLE:"idle", BOOKING:"booking" };
  let state = State.IDLE;
  let slots = { email:"", time:"", name:"", isoKey:"" }; // local mirror of server "slots"
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

  // ---------- API calls ----------
 const askAgent = async () => {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: history }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");

  // Defensive: if server is still returning legacy { reply: "..." }
  if (typeof data?.reply === "string" && !data.mode) {
    return { mode: "chat", reply: data.reply, missing: null, slots: { email:"", time:"", name:"" } };
  }

  return data; // expected: { mode, reply, missing, slots }
};


  async function notifyAndReset(finalSlots) {
    try {
      const nres = await fetch("/api/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: finalSlots.email || slots.email,
          time: finalSlots.time || slots.time,
          name: finalSlots.name || slots.name || "",
          isoKey: finalSlots.isoKey || slots.isoKey || undefined,
          notes: "Collected via AI agent flow on no2forms.com",
        }),
      });
      let data = {};
      try {
        data = await nres.json();
      } catch {}
      if (data && data.ok) {
        appendMsg("✅ All set — I’ve sent the details. You’ll get a confirmation shortly. Anything else I can help with?", "bot");
        // reset state after successful booking
        state = State.IDLE;
        slots = { email:"", time:"", name:"", isoKey:"" };
        removePicker();
      } else if (data && data.error === 'slot_unavailable') {
        // Requested time slot is already booked; ask for another
        appendMsg("That time isn’t available — please choose another slot.", "bot");
        // Clear the stored time so we prompt again
        slots.time = "";
        // reopen the picker for the user to select a new time
        showTimePicker({
          onConfirm: async ({ label, isoKey }) => {
            // Update both human-friendly label and isoKey when user selects a new time
            slots.time = label;
            slots.isoKey = isoKey;
            // Immediately call notify again with updated slots
            await notifyAndReset({ email: slots.email, time: slots.time, name: slots.name, isoKey: slots.isoKey });
          },
          onCancel: () => {
            appendMsg("No worries — booking cancelled. How else can I help?", "bot");
            state = State.IDLE;
            slots = { email:"", time:"", name:"", isoKey:"" };
            removePicker();
          }
        });
      } else {
        // Generic failure
        appendMsg("I couldn’t log that automatically, but I’ve saved your details and we’ll follow up by email.", "bot");
        state = State.IDLE;
        slots = { email:"", time:"", name:"", isoKey:"" };
        removePicker();
      }
    } catch (err) {
      console.error("notify error", err);
      appendMsg("I hit a hiccup sending the booking, but your details are captured. We’ll confirm by email.", "bot");
      state = State.IDLE;
      slots = { email:"", time:"", name:"", isoKey:"" };
      removePicker();
    }
  }

  // ---------- Send handler ----------
  const onSend = async () => {
    const text = input.value.trim();
    if (!text) return;

    appendMsg(text, "user");
    // If user asks to book, offer inline Calendly link
    if (/\b(book|booking|schedule|meeting|appointment)\b/i.test(text)) {
      appendHtml('I can help you book. <a href="#" class="n2f-book-link">Open calendar</a>.', 'bot');
      return;
    }
    // HTML message helper
const appendHtml = (html, who) => {
  const div = document.createElement("div");
  div.className = `n2f-msg ${who === "user" ? "n2f-user" : "n2f-bot"}`;
  div.innerHTML = html;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
};

// Calendly loader (waits until Calendly is ready)
function ensureCalendlyAssets() {
  return new Promise((resolve) => {
    function done() {
      if (window.Calendly && typeof window.Calendly.initInlineWidget === "function") resolve();
    }
    if (window.Calendly && typeof window.Calendly.initInlineWidget === "function") return resolve();

    if (!document.querySelector('link[href="https://assets.calendly.com/assets/external/widget.css"]')) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "https://assets.calendly.com/assets/external/widget.css";
      document.head.appendChild(l);
    }
    let s = document.querySelector('script[src="https://assets.calendly.com/assets/external/widget.js"]');
    if (!s) {
      s = document.createElement("script");
      s.async = true;
      s.type = "text/javascript";
      s.src = "https://assets.calendly.com/assets/external/widget.js";
      s.onload = done;
      document.head.appendChild(s);
    }
    if (s && s.readyState === "complete") done();
    const t = setInterval(() => { if (window.Calendly) { clearInterval(t); done(); } }, 50);
  });
}

const CALENDLY_URL = "https://calendly.com/basicmonkey321/30min";

// Mount Calendly inline inside the chat
function showCalendlyInline() {
  ensureCalendlyAssets().then(() => {
    const existing = panel.querySelector(".n2f-calendly-wrap");
    if (existing && existing.parentNode) existing.parentNode.remove();

    const wrap = document.createElement("div");
    wrap.className = "n2f-msg n2f-bot n2f-calendly-wrap";
    wrap.style.padding = "0";

    const mount = document.createElement("div");
    mount.style.minWidth = "280px";
    mount.style.height = "700px";
    wrap.appendChild(mount);
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;

    window.Calendly.initInlineWidget({
      url: CALENDLY_URL,
      parentElement: mount,
      prefill: {},
      utm: {}
    });
  });
}

// Delegate clicks from the booking link in messages
panel.addEventListener("click", (e) => {
  const a = e.target.closest("a.n2f-book-link");
  if (a) { e.preventDefault(); showCalendlyInline(); }
});

    
    input.value = "";

    // cancel booking flow
    if (/^\s*cancel\s*$/i.test(text) && state === State.BOOKING) {
      state = State.IDLE;
      slots = { email:"", time:"", name:"", isoKey:"" };
      removePicker();
      appendMsg("Booking cancelled. How else can I help?", "bot");
      return;
    }

    // push user msg to history
    history.push({ role: "user", content: text });

    try {
      const agent = await askAgent(); // {mode, reply, missing, slots}
      if (agent.slots && typeof agent.slots === "object") {
        // merge any extracted slots (e.g., email pulled from text)
        slots = { ...slots, ...agent.slots };
      }

      if (agent.reply) {
        appendMsg(agent.reply, "bot");
        history.push({ role: "assistant", content: agent.reply });
      }

      if (agent.mode === "booking") {
        state = State.BOOKING;

        // enforce email format if model thinks it has one but it's invalid
        if (slots.email && !emailRe.test(slots.email)) slots.email = "";

        // Decide next UI action based on missing field:
        if (agent.missing === "email" && !slots.email) {
          // Do nothing special; user will type email next turn and model will re-evaluate.
          return;
        }
        if (agent.missing === "time" && !slots.time) {
          // Offer Calendly inline option instead of the mini picker
          appendHtml('Choose a time in your calendar: <a href="#" class="n2f-book-link">Open calendar</a>.', 'bot');
          // Skip mini picker in favor of Calendly
          return;
    
          // Before prompting for a time, fetch and display available slots to the user.
          const availability = await fetchAvailability();
          if (Array.isArray(availability) && availability.length > 0) {
            // Build a simple summary of the next few available times.
            const summaries = [];
            for (const day of availability) {
              if (!day.times || day.times.length === 0) continue;
              // Show up to the first 3 available times per day for brevity
              const examples = day.times.slice(0, 3).join(", ");
              const more = day.times.length > 3 ? ", …" : "";
              summaries.push(`${day.date}: ${examples}${more}`);
            }
            if (summaries.length > 0) {
              appendMsg(
                `Here are some available slots:\n${summaries.join("\n")}`,
                "bot"
              );
            }
          }
          // Show mini picker to supply time deterministically
          showTimePicker({
            onConfirm: async ({ label, isoKey }) => {
              // Store both the display label and iso key for duplicate detection
              slots.time = label;
              slots.isoKey = isoKey;
              history.push({ role: "user", content: `Time chosen: ${label}` });
              const follow = await askAgent();
              if (follow.reply) {
                appendMsg(follow.reply, "bot");
                history.push({ role: "assistant", content: follow.reply });
              }
              const s = follow.slots || slots;
              if (follow.missing === null && (s.email || slots.email) && (s.time || slots.time)) {
                // include isoKey when notifying
                await notifyAndReset({ email: s.email || slots.email, time: s.time || slots.time, name: s.name || slots.name, isoKey: slots.isoKey });
              }
            },
            onCancel: () => {
              appendMsg("No worries — booking cancelled. How else can I help?", "bot");
              state = State.IDLE;
              slots = { email:"", time:"", name:"", isoKey:"" };
            }
          });
          return;
        }
        if (agent.missing === "name") {
          // name is optional; we'll just wait for user input, then model will confirm
          return;
        }
        // missing === null => we have enough to notify
        if (agent.missing === null && (slots.email || agent.slots?.email) && (slots.time || agent.slots?.time)) {
          await notifyAndReset(agent.slots || slots);
          return;
        }
      } else {
        state = State.IDLE;
      }
    } catch (e) {
      console.error(e);
      appendMsg(
        "I’m here to help explain no2forms and book a quick call. Ask me anything — or say “book a demo” and I’ll schedule it (no forms).",
        "bot"
      );
      history.push({ role: "assistant", content: "I’m here to help explain no2forms and book a quick call. Ask me anything — or say “book a demo” and I’ll schedule it (no forms)." });
    }
  };

  // ---------- UI Events ----------
  fab.addEventListener("click", () => {
    panel.style.display = panel.style.display === "flex" ? "none" : "flex";
    panel.style.flexDirection = "column";
    if (panel.style.display === "flex" && messages.childElementCount === 0) {
      const welcome = "Hi! I’m the no2forms assistant. Ask anything — or say “book a demo” and I’ll sort it (no forms). Type ‘cancel’ to exit booking.";
      appendMsg(welcome, "bot");
      history.push({ role: "assistant", content: welcome });
    }
  });
  closeBtn.addEventListener("click", () => (panel.style.display = "none"));
  sendBtn.addEventListener("click", onSend);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") onSend(); });

  // Listen for external slot selection (e.g. from availability table)
  window.addEventListener('no2chat:pickSlot', async (e) => {
    const detail = e?.detail || {};
    const label = detail.label;
    const isoKey = detail.isoKey;
    if (!label || !isoKey) return;
    // Open chat if not already visible
    if (typeof fab !== 'undefined') {
      // Trigger fab click to open the panel if closed
      if (panel.style.display !== 'flex') fab.click();
    }
    // Set booking state and slots
    state = State.BOOKING;
    slots.time = label;
    slots.isoKey = isoKey;
    // Prompt user for email if missing
    if (!slots.email) {
      appendMsg(`Great! You've chosen ${label}. Please enter your email to confirm.`, 'bot');
      return;
    }
    // If email already collected, proceed to notify and reset
    await notifyAndReset({ email: slots.email, time: slots.time, name: slots.name || '', isoKey: isoKey });
  });
})();
