const chat = document.getElementById("chat");
const input = document.getElementById("message");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

let history = [];

/*
==================================================
 تحويل Markdown إلى HTML
==================================================
*/

function escapeHTML(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function markdownToHTML(text) {
  if (!text) return "";

  let html = escapeHTML(String(text));

  /*
  الروابط
  */

  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  /*
  روابط مكتوبة مباشرة
  */

  html = html.replace(
    /(^|[\s>])(https?:\/\/[^\s<]+)/g,
    '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>'
  );

  /*
  كود داخل السطر
  */

  html = html.replace(
    /`([^`]+)`/g,
    "<code>$1</code>"
  );

  /*
  نص عريض:
  **النص**
  */

  html = html.replace(
    /\*\*(.+?)\*\*/gs,
    "<strong>$1</strong>"
  );

  /*
  نص مائل:
  *النص*
  */

  html = html.replace(
    /(^|[^\*])\*([^*\n]+)\*(?!\*)/g,
    "$1<em>$2</em>"
  );

  /*
  العناوين
  */

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

  /*
  القوائم المرقمة
  */

  html = html.replace(
    /^(?:\d+\.\s+.+(?:\n|$))+/gm,
    function (block) {
      const items = block
        .trim()
        .split("\n")
        .map(function (line) {
          return line.replace(
            /^\d+\.\s+/,
            ""
          );
        })
        .filter(Boolean);

      return (
        "<ol>" +
        items
          .map(function (item) {
            return "<li>" + item + "</li>";
          })
          .join("") +
        "</ol>"
      );
    }
  );

  /*
  القوائم بنقاط
  */

  html = html.replace(
    /^(?:[-•]\s+.+(?:\n|$))+/gm,
    function (block) {
      const items = block
        .trim()
        .split("\n")
        .map(function (line) {
          return line.replace(
            /^[-•]\s+/,
            ""
          );
        })
        .filter(Boolean);

      return (
        "<ul>" +
        items
          .map(function (item) {
            return "<li>" + item + "</li>";
          })
          .join("") +
        "</ul>"
      );
    }
  );

  /*
  الخط الفاصل
  */

  html = html.replace(
    /^---$/gm,
    "<hr>"
  );

  /*
  أسطر جديدة
  */

  html = html.replace(
    /\n/g,
    "<br>"
  );

  /*
  إزالة <br> الزائدة حول القوائم
  */

  html = html.replace(
    /<br>\s*<(ol|ul|h2|h3|h4|hr)/g,
    "<$1"
  );

  html = html.replace(
    /(<\/ol>|<\/ul>|<\/h2>|<\/h3>|<\/h4>|<hr>)\s*<br>/g,
    "$1"
  );

  return html;
}

/*
==================================================
 إضافة رسالة
==================================================
*/

function addMessage(text, role) {
  const row = document.createElement("div");

  row.className = `msg ${role}`;

  const bubble = document.createElement("div");

  bubble.className = "bubble";

  if (role === "ai") {
    bubble.innerHTML = markdownToHTML(text);
  } else {
    bubble.textContent = text;
  }

  row.appendChild(bubble);

  chat.appendChild(row);

  chat.scrollTop = chat.scrollHeight;

  return bubble;
}

/*
==================================================
 حالة التحميل
==================================================
*/

function setLoading(on) {
  sendBtn.disabled = on;
  input.disabled = on;

  if (on) {
    sendBtn.style.opacity = "0.6";
    sendBtn.style.cursor = "not-allowed";
  } else {
    sendBtn.style.opacity = "";
    sendBtn.style.cursor = "";
  }
}

/*
==================================================
 إرسال الرسالة
==================================================
*/

async function sendMessage() {
  const text = input.value.trim();

  if (!text || sendBtn.disabled) {
    return;
  }

  /*
  إزالة رسالة الترحيب
  */

  const welcome =
    chat.querySelector(".welcome");

  if (welcome) {
    welcome.remove();
  }

  /*
  عرض رسالة المستخدم
  */

  addMessage(text, "user");

  history.push({
    role: "user",
    content: text
  });

  /*
  تنظيف مربع الكتابة
  */

  input.value = "";

  input.style.height = "auto";

  setLoading(true);

  /*
  رسالة انتظار
  */

  const bubble =
    addMessage(
      "يكتب الآن…",
      "ai"
    );

  try {

    const response =
      await fetch(
        "/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            messages: history
          })
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        "حدث خطأ في الخادم."
      );
    }

    /*
    عرض إجابة الذكاء الاصطناعي
    بعد تحويل Markdown
    */

    bubble.innerHTML =
      markdownToHTML(
        data.reply || ""
      );

    /*
    حفظ الإجابة في المحادثة
    */

    history.push({
      role: "assistant",
      content: data.reply
    });

    /*
    التمرير للأسفل
    */

    chat.scrollTop =
      chat.scrollHeight;

  } catch (err) {

    console.error(
      "Anas AI Error:",
      err
    );

    bubble.textContent =
      "حدث خطأ: " +
      err.message;

  } finally {

    setLoading(false);

    input.focus();
  }
}

/*
==================================================
 زر الإرسال
==================================================
*/

sendBtn.addEventListener(
  "click",
  sendMessage
);

/*
==================================================
 Enter لإرسال الرسالة
 Shift + Enter = سطر جديد
==================================================
*/

input.addEventListener(
  "keydown",
  function (e) {

    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {

      e.preventDefault();

      sendMessage();
    }
  }
);

/*
==================================================
 تكبير مربع الكتابة تلقائيًا
==================================================
*/

input.addEventListener(
  "input",
  function () {

    input.style.height =
      "auto";

    input.style.height =
      Math.min(
        input.scrollHeight,
        140
      ) + "px";
  }
);

/*
==================================================
 زر مسح المحادثة
==================================================
*/

clearBtn.addEventListener(
  "click",
  function () {

    history = [];

    chat.innerHTML = `
      <section class="welcome">
        <div class="welcome-icon">✦</div>
        <h2>مرحبًا بك في Anas AI</h2>
        <p>اكتب سؤالك وسأحاول مساعدتك.</p>
      </section>
    `;

    input.value = "";

    input.style.height =
      "auto";

    input.focus();
  }
);
