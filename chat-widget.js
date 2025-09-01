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
  };

  // Detect "BOOKING|email|time|name|notes" line
  const maybeNotifyBooking = async (reply) => {
    if (!reply || !reply.startsWith("BOOKING|")) return;

    const parts = reply.split("|");
    const email = (parts[1] || "").trim();
    const time = (parts[2] || "").trim();
    const name = (parts[3] || "").trim();
    const notes = (parts[4] || "").trim();

    try {
      const nres = await fetch("/api/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, time, name, notes }),
      });
      if (nres.ok) {
        appendMsg(
          "✅ All set — I’ve passed your details to the team. You’ll get a confirmation shortly (no forms needed).",
          "bot"
        );
      } else {
        appendMsg(
          "I tried to log your booking but hit a snag. I’ve still captured your details — we’ll follow up.",
          "bot"
        );
      }
    } catch (e) {
      console.error("notify error", e);
      appendMsg(
        "I couldn’t reach our booking service just now, but I’ve kept your details. We’ll confirm by email.",
        "bot"
      );
    }
  };

  const ask = async (text) => {
    sendBtn.disabled = true;
    appendMsg(text, "user");
    input.value = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      const reply = data.reply || "";
      appendMsg(reply, "bot");

      // Booking detection + notify
      await maybeNotifyBooking(reply);
    } catch (e) {
      console.error(e);
      appendMsg("Sorry — something went wrong. Please try again.", "bot");
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  };

  fab.addEventListener("click", () => {
    panel.style.display = panel.style.display === "flex" ? "none" : "flex";
    panel.style.flexDirection = "column";
    if (panel.style.display === "flex" && messages.childElementCount === 0) {
      appendMsg(
        "Hi! I’m the no2forms assistant. Ask me anything — and if you want a demo, just say when works and your email, I’ll handle the rest.",
        "bot"
      );
    }
  });
  closeBtn.addEventListener("click", () => (panel.style.display = "none"));
  sendBtn.addEventListener("click", () => {
    const text = input.value.trim();
    if (text) ask(text);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const text = input.value.trim();
      if (text) ask(text);
    }
  });
})();
