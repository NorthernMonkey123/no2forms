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

  // ---------- Mini date/time picker ----------
  let pickerEl = null;
  function removePicker() {
    if (pickerEl && pickerEl.parentNode) pickerEl.parentNode.removeChild(pickerEl);
    pickerEl = null;
    input.disabled = false;
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
      removePicker();
      opts?.onConfirm?.(label);
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
  let slots = { email:"", time:"", name:"" }; // local mirror of server "slots"
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
    return data; // {mode, reply, missing, slots}
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
          notes: "Collected via AI agent flow on no2forms.com",
        }),
      });
      if (nres.ok) {
        appendMsg("✅ All set — I’ve sent the details. You’ll get a confirmation shortly. Anything else I can help with?", "bot");
      } else {
        appendMsg("I couldn’t log that automatically, but I’ve saved your details and we’ll follow up by email.", "bot");
      }
    } catch (err) {
      console.error("notify error", err);
      appendMsg("I hit a hiccup sending the booking, but your details are captured. We’ll confirm by email.", "bot");
    } finally {
      state = State.IDLE;
      slots = { email:"", time:"", name:"" };
      removePicker();
    }
  }

  // ---------- Send handler ----------
  const onSend = async () => {
    const text = input.value.trim();
    if (!text) return;

    appendMsg(text, "user");
    input.value = "";

    // cancel booking flow
    if (/^\s*cancel\s*$/i.test(text) && state === State.BOOKING) {
      state = State.IDLE;
      slots = { email:"", time:"", name:"" };
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
          // Show mini picker to supply time deterministically
          showTimePicker({
            onConfirm: async (label) => {
              slots.time = label;
              history.push({ role: "user", content: `Time chosen: ${label}` });
              const follow = await askAgent();
              if (follow.reply) {
                appendMsg(follow.reply, "bot");
                history.push({ role: "assistant", content: follow.reply });
              }
              const s = follow.slots || slots;
              if (follow.missing === null && (s.email || slots.email) && (s.time || slots.time)) {
                await notifyAndReset(s);
              }
            },
            onCancel: () => {
              appendMsg("No worries — booking cancelled. How else can I help?", "bot");
              state = State.IDLE;
              slots = { email:"", time:"", name:"" };
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
})();
