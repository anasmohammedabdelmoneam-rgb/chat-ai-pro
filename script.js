const chat = document.getElementById("chat");
const input = document.getElementById("message");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

let history = [];

function addMessage(text, role) {
  const row = document.createElement("div");
  row.className = `msg ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  row.appendChild(bubble);
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
  return bubble;
}

function setLoading(on) {
  sendBtn.disabled = on;
  input.disabled = on;
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text || sendBtn.disabled) return;

  const welcome = chat.querySelector(".welcome");
  if (welcome) welcome.remove();

  addMessage(text, "user");
  history.push({ role: "user", content: text });
  input.value = "";
  input.style.height = "auto";
  setLoading(true);

  const bubble = addMessage("يكتب الآن…", "ai");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "حدث خطأ في الخادم.");

    bubble.textContent = data.reply;
    history.push({ role: "assistant", content: data.reply });
  } catch (err) {
    bubble.textContent = "تعذر الاتصال بالذكاء الاصطناعي. تأكد أن الـBackend يعمل وأن مفتاح API مضبوط.";
    console.error(err);
  } finally {
    setLoading(false);
    input.focus();
  }
}

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 140) + "px";
});
clearBtn.addEventListener("click", () => {
  history = [];
  chat.innerHTML = `<section class="welcome"><div class="welcome-icon">✦</div><h2>مرحبًا بك في Anas AI</h2><p>اكتب سؤالك وسأحاول مساعدتك.</p></section>`;
  input.focus();
});
