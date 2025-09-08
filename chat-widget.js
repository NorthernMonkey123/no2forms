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

  // ---------- Booking support helpers ----------
  // State flag used to detect when the user has opened Calendly in a new tab and returned.
  var awaitingBooking = false;
  // URL to your Calendly booking page. Update this to your desired scheduling link.
  const CALENDLY_URL = "https://calendly.com/basicmonkey321/30min";
  /**
   * Append an HTML string to the messages list. This helper allows links and other markup
   * to be inserted into the chat. Messages will scroll to the bottom automatically.
   * Note: this uses the `messages` element defined later in the script; it will be resolved
   * at runtime when called.
   * @param {string} html - HTML content to append.
   * @param {"bot"|"user"} who - Identifier for styling the message bubble.
   * @returns {HTMLElement} The inserted message element.
   */
  function appendHtml(html, who) {
    const div = document.createElement("div");
    div.className = `n2f-msg ${who === "user" ? "n2f-user" : "n2f-bot"}`;
    div.innerHTML = html;
    if (typeof messages !== "undefined" && messages) {
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }
    return div;
  }

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
  // Mark booking intent on link click without blocking default navigation
  panel.addEventListener('click', (e) => {
    const a = e.target.closest('a.n2f-book-link');
    if (!a) return;
    // Capture happens before default navigation; avoid heavy work here
    awaitingBooking = true;
    // Defer helper UI to next frame (and avoid duplicates)
    requestAnimationFrame(() => {
      if (!panel.querySelector('.n2f-done-booking')) {
        appendHtml('I opened Calendly in a new tab. When you\'re done, <a href="#" class="n2f-done-booking">tap here</a> and I\'ll tidy up.', 'bot');
      }
    });
  }, { capture: true, passive: true });


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
        // Requested time slot is already booked; offer the Calendly link again so the user can pick another time.
        appendMsg("That time isn’t available — please choose another slot.", "bot");
        slots.time = "";
        // Present a new Calendly link for the user to select an alternate time
        appendHtml(`Please select another time: <a href="${CALENDLY_URL}" target="_blank" rel="noopener" class="n2f-book-link">📅 Open calendar</a>.`, 'bot');
        state = State.BOOKING;
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
    input.value = "";

    // Offer Calendly link immediately if user expresses booking intent. This avoids the legacy picker flow.
    if (/\b(book|booking|schedule|meeting|appointment)\b/i.test(text)) {
      appendHtml(`Great — I can set that up. <a href="${CALENDLY_URL}" target="_blank" rel="noopener" class="n2f-book-link">📅 Open calendar</a>.`, 'bot');
      return;
    }

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
          // Instead of invoking the legacy time picker, offer a single Calendly link.
          appendHtml(`Choose a time: <a href="${CALENDLY_URL}" target="_blank" rel="noopener" class="n2f-book-link">📅 Open calendar</a>.`, 'bot');
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

// === no2forms: Google Meet booking (Calendly) ===
(function() {
  // Avoid duplicate injection
  if (window.__n2fMeetInjected) return;
  window.__n2fMeetInjected = true;

  // Config: your Calendly Google Meet event URL
  const N2F_MEET_EVENT_URL = "https://calendly.com/basicmonkey321/google-meet";

  // Load Calendly widget script once
  function ensureCalendlyScript() {
    if (document.getElementById("calendly-widget-js")) return;
    const s = document.createElement("script");
    s.id = "calendly-widget-js";
    s.src = "https://assets.calendly.com/assets/external/widget.js";
    s.async = true;
    document.body.appendChild(s);
  }
  // Load Calendly CSS once
  function ensureCalendlyCss() {
    if (document.getElementById("calendly-widget-css")) return;
    const l = document.createElement("link");
    l.id = "calendly-widget-css";
    l.rel = "stylesheet";
    l.href = "https://assets.calendly.com/assets/external/widget.css";
    document.head.appendChild(l);
  }

  function openCalendlyPopup(url) {
    const params = new URLSearchParams({
      utm_source: "chatbot",
      utm_medium: "website",
      utm_campaign: "booking"
    }).toString();
    const full = url.includes("?") ? url + "&" + params : url + "?" + params;
    if (window.Calendly && typeof window.Calendly.initPopupWidget === "function") {
      window.Calendly.initPopupWidget({ url: full });
    } else {
      window.open(full, "_blank", "noopener,noreferrer");
    }
  }

  function insertMeetCta() {
    // Find the chat panel and messages container created by this widget
    const panel = document.querySelector(".n2f-panel");
    const messages = panel ? panel.querySelector(".n2f-messages") : null;
    if (!panel || !messages) return;

    // Prevent duplicates
    if (messages.querySelector(".n2f-meet-cta")) return;

    // Build a bot message bubble that contains the Google Meet button
    const bubble = document.createElement("div");
    bubble.className = "n2f-msg n2f-bot n2f-meet-cta";
    bubble.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px">
        <div>Would you like to book a <strong>Google Meet</strong> with us?</div>
        <div style="display:flex; gap:8px; flex-wrap:wrap">
          <button type="button" class="n2f-btn-meet" aria-label="Book a Google Meet"
            style="padding:.55rem .9rem; border-radius:10px; border:1px solid #111; background:#111; color:#fff; cursor:pointer">
            🎥 Book Google Meet
          </button>
        </div>
        <small style="opacity:.7">A Calendly popup will open. If it doesn’t, we’ll open a new tab.</small>
      </div>
    `;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;

    const btn = bubble.querySelector(".n2f-btn-meet");
    btn.addEventListener("click", () => openCalendlyPopup(N2F_MEET_EVENT_URL));

    // Optional: listen for Calendly booking completion
    window.addEventListener("message", (e) => {
      if (!e?.data || typeof e.data.event !== "string") return;
      if (e.data.event === "calendly.event_scheduled") {
        // Show a simple confirmation bubble
        const ok = document.createElement("div");
        ok.className = "n2f-msg n2f-bot";
        ok.textContent = "You're all booked! Check your email for the Google Meet link. Anything else I can help with?";
        messages.appendChild(ok);
        messages.scrollTop = messages.scrollHeight;
      }
    }, { once: true });
  }

  // Ensure assets, then insert CTA after the widget panel is in DOM
  ensureCalendlyCss();
  ensureCalendlyScript();

  // Try now; if panel isn't ready yet, retry shortly
  if (document.querySelector(".n2f-panel .n2f-messages")) {
    insertMeetCta();
  } else {
    const obs = new MutationObserver((list, observer) => {
      if (document.querySelector(".n2f-panel .n2f-messages")) {
        insertMeetCta();
        observer.disconnect();
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    // Safety timeout
    setTimeout(() => obs.disconnect(), 8000);
  }
})();
// === /no2forms: Google Meet booking (Calendly) ===

})();

  // Close chat gracefully when the user returns from the Calendly tab. If `awaitingBooking` is true,
  // the booking is considered complete, so we send a friendly message and hide the chat after a short delay.
  window.addEventListener('focus', () => {
    if (awaitingBooking) {
      awaitingBooking = false;
      appendMsg("You're all booked! Is there anything else I can help you with today?", "bot");
      setTimeout(() => { panel.style.display = "none"; }, 1200);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && awaitingBooking) {
      awaitingBooking = false;
      appendMsg("You're all booked! Is there anything else I can help you with today?", "bot");
      setTimeout(() => { panel.style.display = "none"; }, 1200);
    }
  });


  // Minimal click for the "done" confirmation
  panel.addEventListener('click', (e) => {
    const done = e.target.closest('a.n2f-done-booking');
    if (!done) return;
    e.preventDefault();
    awaitingBooking = false;
    appendMsg("You're all booked! Is there anything else I can help you with today?", "bot");
    setTimeout(() => { panel.style.display = "none"; }, 1200);
  });
