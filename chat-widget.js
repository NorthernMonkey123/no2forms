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
  `;
  document.head.appendChild(style);

  // ---------- Booking support helpers ----------
  const PHONE_EVENT_URL = "https://calendly.com/basicmonkey321/30min";
  const MEET_EVENT_URL  = "https://calendly.com/basicmonkey321/google-meet";

  function ensureCalendlyAssets() {
    if (!document.getElementById("calendly-widget-css")) {
      const l = document.createElement("link");
      l.id = "calendly-widget-css";
      l.rel = "stylesheet";
      l.href = "https://assets.calendly.com/assets/external/widget.css";
      document.head.appendChild(l);
    }
    if (!document.getElementById("calendly-widget-js")) {
      const s = document.createElement("script");
      s.id = "calendly-widget-js";
      s.src = "https://assets.calendly.com/assets/external/widget.js";
      s.async = true;
      document.body.appendChild(s);
    }
  }

  function openCalendly(url) {
    ensureCalendlyAssets();
    if (window.Calendly && Calendly.initPopupWidget) {
      Calendly.initPopupWidget({ url });
    } else {
      window.open(url, "_blank");
    }
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

  // ---------- Conversation state ----------
  const history = [];
  const State = { IDLE:"idle", BOOKING:"booking" };
  let state = State.IDLE;
  let slots = { email:"", time:"", name:"", isoKey:"" };
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

  async function askAgent() {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    return res.json();
  }

  // ---------- Send handler ----------
  const onSend = async () => {
    const text = input.value.trim();
    if (!text) return;
    appendMsg(text, "user");
    input.value = "";

    history.push({ role: "user", content: text });
    try {
      const agent = await askAgent();

      if (agent.reply) {
        appendMsg(agent.reply, "bot");
        history.push({ role: "assistant", content: agent.reply });
      }

      if (agent.mode === "booking") {
        state = State.BOOKING;
        if (agent.missing === "time" && !slots.time) {
          // 👇 Show choice between Phone and Google Meet
          ensureCalendlyAssets();
          const html = `
            <div class="n2f-msg n2f-bot">
              <div style="margin-bottom:6px">Do you prefer <strong>phone</strong> or <strong>Google Meet</strong>?</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="n2f-book-phone">📞 Phone</button>
                <button class="n2f-book-meet">🎥 Google Meet</button>
              </div>
            </div>
          `;
          messages.insertAdjacentHTML("beforeend", html);
          messages.scrollTop = messages.scrollHeight;
          return;
        }
      }
    } catch (e) {
      console.error(e);
      appendMsg("I’m here to help explain no2forms and book a quick call. Ask me anything — or say “book a demo”.", "bot");
    }
  };

  // ---------- Event delegation for booking buttons ----------
  panel.addEventListener("click", (e) => {
    if (e.target.closest(".n2f-book-phone")) {
      openCalendly(PHONE_EVENT_URL);
    }
    if (e.target.closest(".n2f-book-meet")) {
      openCalendly(MEET_EVENT_URL);
    }
  });

  // ---------- UI Events ----------
  fab.addEventListener("click", () => {
    panel.style.display = panel.style.display === "flex" ? "none" : "flex";
    panel.style.flexDirection = "column";
    if (panel.style.display === "flex" && messages.childElementCount === 0) {
      const welcome = "Hi! I’m the no2forms assistant. Ask anything — or say “book a demo” and I’ll sort it.";
      appendMsg(welcome, "bot");
      history.push({ role: "assistant", content: welcome });
    }
  });
  closeBtn.addEventListener("click", () => (panel.style.display = "none"));
  sendBtn.addEventListener("click", onSend);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") onSend(); });
})();
