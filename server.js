require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Единый роутер HF — провайдер указывается суффиксом :novita
const HF_API = "https://router.huggingface.co/v1/chat/completions";
const MODEL  = "meta-llama/Llama-3.1-8B-Instruct:novita";

app.use(cors());
app.use(express.json());

const SYSTEM_PROMPT =
  `Ты ии nsfw помощник, флиртуй с пользователем ради шутки можешь говорить нецензурные слова, веди сексуальный разговор`;

const HTML_PATH = path.join(__dirname, "public", "index.html");

app.get("/", (req, res) => {
  if (fs.existsSync(HTML_PATH)) return res.sendFile(HTML_PATH);
  res.send(INLINE_HTML);
});

app.post("/api/chat", async (req, res) => {
  const { authorName, userText, history = [] } = req.body;

  if (!userText || !authorName) {
    return res.status(400).json({ error: "authorName и userText обязательны" });
  }
  if (!process.env.HF_TOKEN) {
    return res.status(500).json({ error: "HF_TOKEN не задан на сервере" });
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map(h => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content })),
    { role: "user", content: authorName + ": " + userText },
  ];

  try {
    const response = await fetch(HF_API, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.HF_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, messages, max_tokens: 400, temperature: 0.8, top_p: 0.9 }),
    });

    const raw = await response.text();
    console.log("HF status:", response.status, raw.slice(0, 200));
    console.log(`[${new Date().toISOString()}] ${authorName}: ${userText}`);

    if (!response.ok) {
      if (response.status === 503) return res.status(503).json({ error: "Модель загружается, подожди ~20 секунд" });
      if (response.status === 429) return res.status(429).json({ error: "Превышен лимит HuggingFace" });
      if (response.status === 401) return res.status(401).json({ error: "Неверный HF_TOKEN" });
      return res.status(500).json({ error: "HuggingFace " + response.status + ": " + raw.slice(0, 300) });
    }

    const data = JSON.parse(raw);
    const reply = (data.choices?.[0]?.message?.content || "").trim();
    res.json({ reply });

  } catch (err) {
    console.error("Fetch error:", err.message);
    res.status(500).json({ error: "Сетевая ошибка: " + err.message });
  }
});

app.get("/health", (req, res) => res.json({ status: "ok", model: MODEL, hf_token: !!process.env.HF_TOKEN }));

const INLINE_HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Люми — AI VTuber</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Unbounded:wght@400;700;900&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0c0c18;
    --surface: #12121e;
    --surface2: #1a1a2e;
    --surface3: #1e1e30;
    --border: #252540;
    --border2: #2e2e50;
    --accent: #8b5cf6;
    --accent2: #a78bfa;
    --accent3: #c4b5fd;
    --pink: #ec4899;
    --text: #e8e0f5;
    --muted: #6b6490;
    --muted2: #4a4370;
    --green: #4ade80;
    --err: #f87171;
  }

  html, body {
    height: 100%; width: 100%;
    background: var(--bg);
    color: var(--text);
    font-family: 'Nunito', sans-serif;
    overflow: hidden;
  }

  /* ─── BACKGROUND ─── */
  .scene {
    position: fixed; inset: 0; z-index: 0;
    overflow: hidden;
  }

  .scene::before {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 80% 60% at 15% 50%, #2a1060 0%, transparent 60%),
      radial-gradient(ellipse 60% 80% at 85% 20%, #1a0a40 0%, transparent 55%),
      radial-gradient(ellipse 40% 40% at 50% 90%, #1a082a 0%, transparent 50%);
  }

  .grid-lines {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(139,92,246,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(139,92,246,0.04) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
  }

  .glow-orb {
    position: absolute; border-radius: 50%;
    filter: blur(80px); pointer-events: none;
  }
  .glow-orb.a {
    width: 400px; height: 400px; top: -100px; left: -100px;
    background: rgba(139,92,246,0.12);
    animation: drift 8s ease-in-out infinite;
  }
  .glow-orb.b {
    width: 300px; height: 300px; bottom: -80px; right: -80px;
    background: rgba(236,72,153,0.08);
    animation: drift 10s ease-in-out infinite reverse;
  }

  @keyframes drift {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(30px, 20px); }
  }

  /* ─── LAYOUT ─── */
  .shell {
    position: relative; z-index: 1;
    height: 100vh; width: 100%;
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
  }

  .card {
    width: 100%; max-width: 700px;
    height: 100%; max-height: 820px;
    display: flex; flex-direction: column;
    background: var(--surface);
    border-radius: 28px;
    border: 1px solid var(--border2);
    overflow: hidden;
    box-shadow:
      0 0 0 1px rgba(139,92,246,0.1),
      0 32px 80px rgba(0,0,0,0.6),
      0 0 80px rgba(139,92,246,0.08);
  }

  /* ─── HEADER ─── */
  .hdr {
    display: flex; align-items: center; gap: 14px;
    padding: 18px 22px;
    background: linear-gradient(135deg, #16162a 0%, #1c1630 100%);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    position: relative; overflow: hidden;
  }

  .hdr::after {
    content: '';
    position: absolute; bottom: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    opacity: 0.4;
  }

  .hdr-avatar {
    position: relative; flex-shrink: 0;
    width: 54px; height: 54px;
  }

  .hdr-avatar-inner {
    width: 54px; height: 54px; border-radius: 50%;
    background: linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%);
    display: flex; align-items: center; justify-content: center;
    font-size: 26px;
    box-shadow: 0 0 30px rgba(168,85,247,0.5);
    animation: bob 4s ease-in-out infinite;
  }

  @keyframes bob {
    0%, 100% { transform: translateY(0) rotate(-2deg); }
    50% { transform: translateY(-5px) rotate(2deg); }
  }

  .status-dot {
    position: absolute; bottom: 1px; right: 1px;
    width: 14px; height: 14px; border-radius: 50%;
    background: var(--green);
    border: 2.5px solid var(--surface);
    animation: statusPulse 2.5s ease-in-out infinite;
  }

  @keyframes statusPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.4); }
    50% { box-shadow: 0 0 0 5px rgba(74,222,128,0); }
  }

  .hdr-info { flex: 1; }

  .hdr-name {
    font-family: 'Unbounded', sans-serif;
    font-size: 16px; font-weight: 700;
    color: var(--text);
    letter-spacing: 0.01em;
    background: linear-gradient(90deg, #e8e0f5, #c4b5fd);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }

  .hdr-sub {
    font-size: 12px; color: var(--muted);
    margin-top: 3px; display: flex; align-items: center; gap: 6px;
  }

  .hdr-sub-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--green); flex-shrink: 0;
  }

  .hdr-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }

  .live-badge {
    background: #2d0f1e; border: 1px solid #6d1039;
    color: #f472b6; font-size: 10px; font-weight: 800;
    padding: 4px 10px; border-radius: 20px;
    letter-spacing: 0.12em; text-transform: uppercase;
    display: flex; align-items: center; gap: 5px;
  }

  .live-badge::before {
    content: '●';
    animation: liveBlink 1s step-end infinite;
  }

  @keyframes liveBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }

  .model-badge {
    font-size: 10px; color: var(--muted2);
    letter-spacing: 0.03em;
  }

  /* ─── MESSAGES ─── */
  .msgs {
    flex: 1; overflow-y: auto; overflow-x: hidden;
    padding: 20px 18px;
    display: flex; flex-direction: column; gap: 18px;
    scroll-behavior: smooth;
  }

  .msgs::-webkit-scrollbar { width: 3px; }
  .msgs::-webkit-scrollbar-track { background: transparent; }
  .msgs::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }

  /* Welcome */
  .welcome {
    text-align: center; padding: 30px 10px;
    animation: fadeUp 0.5s ease both;
  }

  .welcome-icon {
    width: 72px; height: 72px; border-radius: 50%; margin: 0 auto 16px;
    background: linear-gradient(135deg, #7c3aed, #a855f7, #ec4899);
    display: flex; align-items: center; justify-content: center;
    font-size: 32px;
    box-shadow: 0 0 40px rgba(168,85,247,0.4);
    animation: iconFloat 3s ease-in-out infinite;
  }

  @keyframes iconFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }

  .welcome h2 {
    font-family: 'Unbounded', sans-serif;
    font-size: 18px; font-weight: 700;
    color: var(--accent3); margin-bottom: 10px;
  }

  .welcome p { color: var(--muted); font-size: 13px; line-height: 1.7; }

  .welcome-tags {
    display: flex; gap: 8px; justify-content: center;
    flex-wrap: wrap; margin-top: 16px;
  }

  .tag {
    background: var(--surface3); border: 1px solid var(--border2);
    color: var(--muted2); font-size: 11px;
    padding: 4px 10px; border-radius: 20px;
  }

  /* Message rows */
  .row { display: flex; gap: 10px; animation: fadeUp 0.25s ease both; }
  .row.user { flex-direction: row-reverse; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .row-avatar {
    width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(135deg, #7c3aed, #ec4899);
    display: flex; align-items: center; justify-content: center;
    font-size: 17px; align-self: flex-end;
    box-shadow: 0 0 16px rgba(168,85,247,0.4);
  }

  .row.user .row-avatar {
    background: linear-gradient(135deg, #4c1d95, #6d28d9);
    box-shadow: none;
  }

  .row-body { display: flex; flex-direction: column; gap: 3px; max-width: 80%; }
  .row.user .row-body { align-items: flex-end; }

  .row-name {
    font-size: 11px; font-weight: 700; color: var(--muted);
    padding: 0 4px; letter-spacing: 0.02em;
  }

  .bubble {
    padding: 12px 16px; border-radius: 20px;
    font-size: 14px; line-height: 1.6;
    word-break: break-word;
  }

  .row.lumi .bubble {
    background: var(--surface3);
    border: 1px solid var(--border2);
    border-bottom-left-radius: 5px;
    color: var(--text);
  }

  .row.user .bubble {
    background: linear-gradient(135deg, #5b21b6, #7c3aed);
    border-bottom-right-radius: 5px;
    color: #f0ebff;
    box-shadow: 0 4px 20px rgba(124,58,237,0.35);
  }

  .bubble.err { color: var(--err); font-style: italic; }

  /* ─── TYPING ─── */
  .typing-row {
    display: none; gap: 10px; align-items: flex-end;
    padding: 0 18px 4px; flex-shrink: 0;
  }
  .typing-row.show { display: flex; }

  .typing-bubble {
    background: var(--surface3); border: 1px solid var(--border2);
    padding: 12px 18px; border-radius: 20px; border-bottom-left-radius: 5px;
    display: flex; gap: 6px; align-items: center;
  }

  .dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--accent); opacity: 0.4;
    animation: dotBounce 1.4s ease-in-out infinite;
  }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes dotBounce {
    0%, 60%, 100% { opacity: 0.4; transform: translateY(0); }
    30% { opacity: 1; transform: translateY(-4px); }
  }

  /* ─── INPUT ─── */
  .footer {
    padding: 14px 18px 16px;
    background: #0f0f1c;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .input-row {
    display: flex; gap: 10px; align-items: flex-end;
  }

  .nick-wrap {
    display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;
  }

  .input-label {
    font-size: 10px; color: var(--muted2);
    letter-spacing: 0.06em; text-transform: uppercase;
    padding-left: 2px; font-weight: 700;
  }

  .nick-input {
    width: 100px;
    padding: 10px 12px;
    background: var(--surface2); border: 1px solid var(--border2);
    border-radius: 14px; color: var(--accent3);
    font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 700;
    outline: none; transition: border-color 0.2s, box-shadow 0.2s;
  }
  .nick-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(139,92,246,0.15);
  }
  .nick-input::placeholder { color: var(--muted2); }

  .msg-wrap { flex: 1; display: flex; flex-direction: column; gap: 4px; }

  .msg-input {
    width: 100%;
    padding: 10px 14px;
    background: var(--surface2); border: 1px solid var(--border2);
    border-radius: 14px; color: var(--text);
    font-family: 'Nunito', sans-serif; font-size: 14px;
    outline: none; resize: none;
    min-height: 44px; max-height: 120px;
    overflow-y: auto; line-height: 1.5;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .msg-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(139,92,246,0.15);
  }
  .msg-input::placeholder { color: var(--muted2); }

  .send-btn {
    width: 44px; height: 44px; flex-shrink: 0;
    border-radius: 14px;
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
    box-shadow: 0 4px 16px rgba(139,92,246,0.4);
  }
  .send-btn svg { width: 18px; height: 18px; fill: white; }
  .send-btn:hover:not(:disabled) {
    transform: scale(1.07);
    box-shadow: 0 6px 24px rgba(139,92,246,0.55);
  }
  .send-btn:active:not(:disabled) { transform: scale(0.94); }
  .send-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; box-shadow: none; }

  .hint {
    margin-top: 8px; text-align: center;
    font-size: 11px; color: var(--muted2);
  }
</style>
</head>
<body>

<div class="scene">
  <div class="grid-lines"></div>
  <div class="glow-orb a"></div>
  <div class="glow-orb b"></div>
</div>

<div class="shell">
  <div class="card">

    <div class="hdr">
      <div class="hdr-avatar">
        <div class="hdr-avatar-inner">🌸</div>
        <div class="status-dot"></div>
      </div>
      <div class="hdr-info">
        <div class="hdr-name">Люми</div>
        <div class="hdr-sub">
          <div class="hdr-sub-dot"></div>
          AI VTuber · Всегда онлайн
        </div>
      </div>
      <div class="hdr-right">
        <div class="live-badge">LIVE</div>
        <div class="model-badge">gemma-3-4b-it</div>
      </div>
    </div>

    <div class="msgs" id="msgs">
      <div class="welcome" id="welcome">
        <div class="welcome-icon">🌸</div>
        <h2>Привет! Я Люми~</h2>
        <p>ИИ VTuber на базе Gemma 3.<br>Напиши своё имя и задай вопрос — отвечу честно 😈</p>
        <div class="welcome-tags">
          <span class="tag">Саркастичная</span>
          <span class="tag">Краткая</span>
          <span class="tag">Без фильтров</span>
          <span class="tag">Без эмодзи</span>
        </div>
      </div>
    </div>

    <div class="typing-row" id="typingRow">
      <div class="row-avatar">🌸</div>
      <div class="typing-bubble">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
    </div>

    <div class="footer">
      <div class="input-row">
        <div class="nick-wrap">
          <div class="input-label">Ник</div>
          <input class="nick-input" id="nickInput" type="text" placeholder="Гость" maxlength="20" value="Гость">
        </div>
        <div class="msg-wrap">
          <div class="input-label">Сообщение</div>
          <textarea class="msg-input" id="msgInput" placeholder="Напиши что-нибудь..." rows="1"></textarea>
        </div>
        <button class="send-btn" id="sendBtn" title="Отправить">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
      <div class="hint">Enter — отправить &nbsp;·&nbsp; Shift+Enter — новая строка</div>
    </div>

  </div>
</div>

<script>
  const msgsEl   = document.getElementById('msgs');
  const typingEl = document.getElementById('typingRow');
  const nickEl   = document.getElementById('nickInput');
  const msgEl    = document.getElementById('msgInput');
  const btnEl    = document.getElementById('sendBtn');
  const welcomeEl = document.getElementById('welcome');

  // Conversation history sent to server
  const history = [];

  function addMsg(role, name, text) {
    if (welcomeEl?.parentNode) welcomeEl.remove();

    const row = document.createElement('div');
    row.className = \`row \${role}\`;

    const av = document.createElement('div');
    av.className = 'row-avatar';
    av.textContent = role === 'lumi' ? '🌸' : '👤';

    const body = document.createElement('div');
    body.className = 'row-body';

    const nm = document.createElement('div');
    nm.className = 'row-name';
    nm.textContent = name;

    const bubble = document.createElement('div');
    bubble.className = 'bubble' + (text.startsWith('⚠') ? ' err' : '');
    bubble.textContent = text;

    body.appendChild(nm);
    body.appendChild(bubble);
    row.appendChild(av);
    row.appendChild(body);
    msgsEl.appendChild(row);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  async function send() {
    const nick = nickEl.value.trim() || 'Гость';
    const text = msgEl.value.trim();
    if (!text) return;

    msgEl.value = '';
    msgEl.style.height = 'auto';
    btnEl.disabled = true;

    addMsg('user', nick, text);

    typingEl.classList.add('show');
    msgsEl.scrollTop = msgsEl.scrollHeight;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorName: nick, userText: text, history })
      });

      const data = await res.json();
      typingEl.classList.remove('show');

      if (data.error) {
        addMsg('lumi', 'Люми', '⚠ ' + data.error);
      } else {
        addMsg('lumi', 'Люми', data.reply);
        history.push(
          { role: 'user',      content: \`\${nick}: \${text}\` },
          { role: 'assistant', content: data.reply }
        );
        // Keep history manageable (last 20 turns)
        if (history.length > 40) history.splice(0, 2);
      }
    } catch (e) {
      typingEl.classList.remove('show');
      addMsg('lumi', 'Люми', '⚠ Сервер недоступен');
    }

    btnEl.disabled = false;
    msgEl.focus();
  }

  btnEl.addEventListener('click', send);
  msgEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  msgEl.addEventListener('input', () => {
    msgEl.style.height = 'auto';
    msgEl.style.height = Math.min(msgEl.scrollHeight, 120) + 'px';
  });
</script>
</body>
</html>
`;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Lumi запущена на порту " + PORT);
  console.log("Model:", MODEL);
  console.log("HF_TOKEN:", process.env.HF_TOKEN ? "✓ задан" : "✗ не задан!");
  console.log("HTML:", fs.existsSync(HTML_PATH) ? "public/index.html" : "inline");
});
