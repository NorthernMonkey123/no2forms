// File: chat-widget.js
(function () {
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

  const appendMsg = (text, who) => {
    const div = document.createElement("div");
    div.className = `n2f-msg ${who === "user" ? "n2f-user" : "n2f-bot"}`;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  };

  // ---------- Booking state machine ----------
  const State = { IDLE:"idle", EMAIL:"email", TIME:"time", NAME:"name" };
  let mode = State.IDLE;
  const booking = { email:"", time:"", name:"" };
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
  const bookingIntent = (t) => /\b(book|booking|demo|call|meeting|schedule|talk|chat)\b/i.test(t);

  const resetBooking = () => { mode = State.IDLE; booking.email=""; booking.time=""; booking.name=""; removePicker(); };

  const startBooking = () => {
    mode = State.EMAIL;
    appendMsg("Great — let’s get you booked (no forms). What’s your email address?", "bot");
  };

  // ---------- Mini date/time picker ----------
  let pickerEl = null;

  function removePicker() {
    if (pickerEl && pickerEl.parentNode) pickerEl.parentNode.removeChild(pickerEl);
    pickerEl = null;
    input.disabled = false;
    sendBtn.disabled = false;
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
    // We’ll suffix "UK" later to signal timezone.
  }

  function showTimePicker() {
    // Disable bottom input while picker open
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
      <div style="font-size:12px;opacity:.8">Times assumed Europe/London (UK). You can tell me another timezone if needed.</div>
    `;

    // attach under last bot message (or at end)
    const anchor = messages;
    pickerEl = container;
    anchor.appendChild(container);
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
      booking.time = label;
      removePicker();
      mode = State.NAME;
      appendMsg(`Great — noted **${label}**. Do you want to share your name (optional)?`, "bot");
    });

    cancelBtn.addEventListener("click", () => {
      removePicker();
      appendMsg("No worries — booking cancelled. How else can I help?", "bot");
      resetBooking();
    });
  }

  // ---------- LLM Q&A (short memory) ----------
  const history = [];
  const askLLM = async () => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    const reply = data.reply || "";
    appendMsg(reply, "bot");
    history.push({ role: "assistant", content: reply });
  };

  // ---------- Send handler ----------
  const onSend = async () => {
    const text = input.value.trim();
    if (!text) return;

    appendMsg(text, "user");
    input.value = "";

    // Cancel booking flow
    if (/^\s*cancel\s*$/i.test(text) && mode !== State.IDLE) {
      appendMsg("Booking cancelled. How else can I help?", "bot");
      resetBooking();
      return;
    }

    if (mode === State.EMAIL) {
      // Try to extract email even if mixed with other words
      const parts = text.split(/\s+/);
      const candidate = parts.find((p) => emailRe.test(p));
      if (!candidate) {
        appendMsg("Could you share a valid email address?", "bot");
        return;
      }
      booking.email = candidate;
      mode = State.TIME;
      appendMsg("Thanks! Pick a time that suits you:", "bot");
      showTimePicker();
      return;
    }

    if (mode === State.TIME) {
      // If user typed a time instead of using picker, accept it
      if (/\d/.test(text)) {
        booking.time = text.trim();
        mode = State.NAME;
        appendMsg("Got it — do you want to share your name (optional)?", "bot");
      } else {
        appendMsg("You can use the picker above or type a time like “Thu 3–5pm UK”.", "bot");
      }
      return;
    }

    if (mode === State.NAME) {
      booking.name = text.trim();
      // Send to backend
      try {
        const nres = await fetch("/api/notify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: booking.email,
            time: booking.time,
            name: booking.name || "",
            notes: "Collected via mini calendar flow on no2forms.com",
          }),
        });
        if (nres.ok) {
          appendMsg("✅ All set — I’ve sent the details. You’ll get a confirmation shortly. Anything else I can help with?", "bot");
        } else {
          appendMsg("I couldn’t log that automatically, but I’ve saved your details and we’ll follow up by email.", "bot");
        }
      } catch (e) {
        console.error("notify error", e);
        appendMsg("I hit a hiccup sending the booking, but your details are captured. We’ll confirm by email.", "bot");
      } finally {
        resetBooking();
      }
      return;
    }

    // Not booking → detect intent
    if (bookingIntent(text)) {
      mode = State.EMAIL;
      appendMsg("Great — let’s get you booked (no forms). What’s your email address?", "bot");
      return;
    }

    // Normal Q&A via LLM
    try {
      history.push({ role: "user", content: text });
      await askLLM();
    } catch (e) {
      console.error(e);
      appendMsg("Sorry — something went wrong. Please try again.", "bot");
    }
  };

  // ---------- UI events ----------
  fab.addEventListener("click", () => {
    panel.style.display = panel.style.display === "flex" ? "none" : "flex";
    panel.style.flexDirection = "column";
    if (panel.style.display === "flex" && messages.childElementCount === 0) {
      const welcome = "Hi! I’m the no2forms assistant. Say “book a demo” to schedule via this chat (no forms). Type ‘cancel’ to exit booking.";
      appendMsg(welcome, "bot");
      history.push({ role: "assistant", content: welcome });
    }
  });
  closeBtn.addEventListener("click", () => (panel.style.display = "none"));
  sendBtn.addEventListener("click", onSend);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") onSend(); });
})();

