/* =========================================================
   CHAT AI PRO - SCRIPT
========================================================= */

const chat = document.getElementById("chat");
const messageInput = document.getElementById("message");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

/* =========================================================
   CHAT HISTORY
========================================================= */

let history = [];

/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================================================
   MARKDOWN TO HTML
========================================================= */

function markdownToHTML(text) {
  if (!text) {
    return "";
  }

  let html = escapeHTML(text);

  /* -----------------------------------------
     CODE BLOCKS
  ----------------------------------------- */

  html = html.replace(
    /```([\s\S]*?)```/g,
    function (_, code) {
      return (
        '<pre class="code-block"><code>' +
        code.trim() +
        "</code></pre>"
      );
    }
  );

  /* -----------------------------------------
     INLINE CODE
  ----------------------------------------- */

  html = html.replace(
    /`([^`\n]+)`/g,
    "<code>$1</code>"
  );

  /* -----------------------------------------
     LINKS
  ----------------------------------------- */

  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  /* -----------------------------------------
     HEADINGS
  ----------------------------------------- */

  html = html.replace(
    /^### (.+)$/gm,
    "<h4>$1</h4>"
  );

  html = html.replace(
    /^## (.+)$/gm,
    "<h3>$1</h3>"
  );

  html = html.replace(
    /^# (.+)$/gm,
    "<h2>$1</h2>"
  );

  /* -----------------------------------------
     BOLD
  ----------------------------------------- */

  html = html.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>"
  );

  /* -----------------------------------------
     ITALIC
  ----------------------------------------- */

  html = html.replace(
    /(^|[^\*])\*([^*\n]+)\*/g,
    "$1<em>$2</em>"
  );

  /* -----------------------------------------
     UNORDERED LISTS
  ----------------------------------------- */

  html = html.replace(
    /^(?:[-*]) (.+)$/gm,
    "<li>$1</li>"
  );

  html = html.replace(
    /(<li>.*<\/li>\n?)+/g,
    function (match) {
      return "<ul>" + match + "</ul>";
    }
  );

  /* -----------------------------------------
     ORDERED LISTS
  ----------------------------------------- */

  html = html.replace(
    /^(?:\d+)\. (.+)$/gm,
    "<li>$1</li>"
  );

  /* -----------------------------------------
     HORIZONTAL LINE
  ----------------------------------------- */

  html = html.replace(
    /^---$/gm,
    "<hr>"
  );

  /* -----------------------------------------
     NEW LINES
  ----------------------------------------- */

  html = html.replace(
    /\n/g,
    "<br>"
  );

  /* -----------------------------------------
     FIX BLOCK ELEMENT BR TAGS
  ----------------------------------------- */

  html = html.replace(
    /<\/h2><br>/g,
    "</h2>"
  );

  html = html.replace(
    /<\/h3><br>/g,
    "</h3>"
  );

  html = html.replace(
    /<\/h4><br>/g,
    "</h4>"
  );

  html = html.replace(
    /<\/pre><br>/g,
    "</pre>"
  );

  html = html.replace(
    /<\/ul><br>/g,
    "</ul>"
  );

  html = html.replace(
    /<hr><br>/g,
    "<hr>"
  );

  return html;
}

/* =========================================================
   REMOVE WELCOME SCREEN
========================================================= */

function removeWelcome() {
  const welcome =
    document.querySelector(".welcome");

  if (welcome) {
    welcome.remove();
  }
}

/* =========================================================
   ADD USER MESSAGE
========================================================= */

function addUserMessage(text) {
  removeWelcome();

  const message =
    document.createElement("div");

  message.className =
    "message user-message";

  message.innerHTML = `
    <div class="bubble">
      ${escapeHTML(text)}
    </div>
  `;

  chat.appendChild(message);

  scrollToBottom();
}

/* =========================================================
   ADD AI MESSAGE
========================================================= */

function addAIMessage(text) {
  removeWelcome();

  const message =
    document.createElement("div");

  message.className =
    "message ai-message";

  message.innerHTML = `
    <div class="bubble ai-bubble">
      ${markdownToHTML(text)}
    </div>
  `;

  chat.appendChild(message);

  scrollToBottom();

  return message;
}

/* =========================================================
   ADD LOADING MESSAGE
========================================================= */

function addLoadingMessage() {
  removeWelcome();

  const message =
    document.createElement("div");

  message.className =
    "message ai-message loading-message";

  message.innerHTML = `
    <div class="bubble ai-bubble loading-bubble">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>
  `;

  chat.appendChild(message);

  scrollToBottom();

  return message;
}

/* =========================================================
   REMOVE LOADING
========================================================= */

function removeLoadingMessage(message) {
  if (
    message &&
    message.parentNode
  ) {
    message.remove();
  }
}

/* =========================================================
   SCROLL
========================================================= */

function scrollToBottom() {
  requestAnimationFrame(() => {
    chat.scrollTop =
      chat.scrollHeight;
  });
}

/* =========================================================
   SET BUTTON STATE
========================================================= */

function setSendingState(sending) {
  sendBtn.disabled = sending;
  messageInput.disabled = sending;

  if (sending) {
    sendBtn.style.opacity = "0.6";
    sendBtn.style.cursor = "wait";
  } else {
    sendBtn.style.opacity = "";
    sendBtn.style.cursor = "";
    messageInput.disabled = false;
  }
}

/* =========================================================
   SEND MESSAGE
========================================================= */

async function sendMessage() {
  const text =
    messageInput.value.trim();

  if (!text) {
    return;
  }

  /* منع الإرسال المكرر */
  if (sendBtn.disabled) {
    return;
  }

  /* عرض رسالة المستخدم */
  addUserMessage(text);

  /* حفظ الرسالة */
  history.push({
    role: "user",
    content: text,
  });

  /* تنظيف مربع الكتابة */
  messageInput.value = "";

  autoResizeTextarea();

  /* حالة التحميل */
  setSendingState(true);

  const loadingMessage =
    addLoadingMessage();

  try {
    const response =
      await fetch("/api/chat", {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          messages: history,
        }),
      });

    /* محاولة قراءة JSON */
    const data =
      await response.json().catch(
        () => ({})
      );

    /* إذا كان السيرفر أعاد خطأ */
    if (!response.ok) {
      throw new Error(
        data?.error ||
          `HTTP ${response.status}`
      );
    }

    /*
      السيرفر الحالي يرجع:
      {
        answer: "..."
      }

      ونضع reply كاحتياط
      لو كانت نسخة قديمة من السيرفر.
    */

    const answer =
      typeof data?.answer === "string"
        ? data.answer
        : typeof data?.reply === "string"
        ? data.reply
        : "";

    /* حذف رسالة التحميل */
    removeLoadingMessage(
      loadingMessage
    );

    /* التأكد من وجود إجابة */
    if (!answer.trim()) {
      throw new Error(
        "السيرفر أعاد إجابة فارغة."
      );
    }

    /* عرض الإجابة */
    const aiMessage =
      addAIMessage(answer);

    /*
      حفظ إجابة المساعد
      داخل المحادثة
    */

    history.push({
      role: "assistant",
      content: answer,
    });

    return aiMessage;
  } catch (error) {
    console.error(
      "Chat error:",
      error
    );

    /* إزالة التحميل */
    removeLoadingMessage(
      loadingMessage
    );

    /* عرض رسالة الخطأ */
    addAIMessage(
      "حدث خطأ: تعذر الحصول على إجابة حاليًا. حاول مرة أخرى بعد قليل."
    );
  } finally {
    setSendingState(false);

    messageInput.focus();

    scrollToBottom();
  }
}

/* =========================================================
   CLEAR CHAT
========================================================= */

function clearChat() {
  history = [];

  chat.innerHTML = `
    <section class="welcome">

      <div class="welcome-icon">
        <img
          src="icon.png"
          alt="Chat AI Pro"
        >
      </div>

      <h2>
        مرحبًا بك في Chat AI Pro
      </h2>

      <p>
        اكتب سؤالك وسأحاول مساعدتك.
      </p>

    </section>
  `;

  messageInput.value = "";

  autoResizeTextarea();

  messageInput.focus();
}

/* =========================================================
   TEXTAREA AUTO RESIZE
========================================================= */

function autoResizeTextarea() {
  messageInput.style.height =
    "auto";

  const maxHeight = 150;

  messageInput.style.height =
    Math.min(
      messageInput.scrollHeight,
      maxHeight
    ) + "px";
}

/* =========================================================
   ENTER KEY
========================================================= */

messageInput.addEventListener(
  "keydown",
  function (event) {
    /*
      Enter = إرسال
      Shift + Enter = سطر جديد
    */

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      sendMessage();
    }
  }
);

/* =========================================================
   INPUT
========================================================= */

messageInput.addEventListener(
  "input",
  function () {
    autoResizeTextarea();
  }
);

/* =========================================================
   SEND BUTTON
========================================================= */

sendBtn.addEventListener(
  "click",
  function () {
    sendMessage();
  }
);

/* =========================================================
   CLEAR BUTTON
========================================================= */

clearBtn.addEventListener(
  "click",
  function () {
    clearChat();
  }
);

/* =========================================================
   INITIAL STATE
========================================================= */

autoResizeTextarea();

messageInput.focus();

/* =========================================================
   CONSOLE
========================================================= */

console.log(
  "Chat AI Pro loaded successfully."
);
