/* =========================================================
   CHAT AI PRO - SCRIPT.JS
========================================================= */


/* =========================================================
   ELEMENTS
========================================================= */

const chat = document.getElementById("chat");
const messageInput = document.getElementById("message");
const sendBtn = document.getElementById("sendBtn");

const clearBtn = document.getElementById("clearBtn");

const sidebar = document.querySelector(".sidebar");
const sidebarOverlay = document.querySelector(".sidebar-overlay");
const conversationList =
  document.querySelector(".conversation-list");

const newChatBtn =
  document.querySelector(".new-chat-btn");

const menuBtn =
  document.querySelector(".menu-btn");


/* =========================================================
   STATE
========================================================= */

let conversations = [];

let currentConversationId = null;

let isSending = false;


/* =========================================================
   LOCAL STORAGE
========================================================= */

const STORAGE_KEY =
  "chat_ai_pro_conversations";


function saveConversations() {

  try {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(conversations)
    );

  } catch (error) {

    console.error(
      "تعذر حفظ المحادثات:",
      error
    );

  }

}


function loadConversations() {

  try {

    const saved =
      localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      conversations = [];
      return;
    }

    const parsed =
      JSON.parse(saved);

    if (Array.isArray(parsed)) {

      conversations = parsed;

    } else {

      conversations = [];

    }

  } catch (error) {

    console.error(
      "تعذر تحميل المحادثات:",
      error
    );

    conversations = [];

  }

}


/* =========================================================
   ID
========================================================= */

function createId() {

  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .substring(2, 9)
  );

}


/* =========================================================
   DATE
========================================================= */

function formatDate(timestamp) {

  const date =
    new Date(timestamp);

  return date.toLocaleDateString(
    "ar-SA",
    {
      day: "numeric",
      month: "short"
    }
  );

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


/* =========================================================
   MARKDOWN TO HTML
   - Fixes <br>
   - Supports bold
   - Supports lists
   - Supports headings
   - Supports code
========================================================= */

function markdownToHTML(text) {

  if (!text) {
    return "";
  }


  /*
    الذكاء الاصطناعي أحيانًا يرسل
    <br> أو <br/>
    لذلك نحولها إلى سطر جديد أولًا.
  */

  text = String(text)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/br>/gi, "\n");


  /*
    نحمي النص من HTML الحقيقي
  */

  let html =
    escapeHTML(text);


  /* =======================================================
     CODE BLOCKS
  ======================================================= */

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


  /* =======================================================
     INLINE CODE
  ======================================================= */

  html = html.replace(
    /`([^`\n]+)`/g,
    "<code>$1</code>"
  );


  /* =======================================================
     LINKS
  ======================================================= */

  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    function (_, url) {

      return (
        '<a href="' +
        url +
        '" target="_blank" rel="noopener noreferrer">' +
        url +
        "</a>"
      );

    }
  );


  /* =======================================================
     HEADINGS
  ======================================================= */

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


  /* =======================================================
     BOLD
  ======================================================= */

  html = html.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>"
  );


  /* =======================================================
     ITALIC
  ======================================================= */

  html = html.replace(
    /(^|[^\*])\*([^*\n]+)\*/g,
    "$1<em>$2</em>"
  );


  /* =======================================================
     BULLET LIST
  ======================================================= */

  html = html.replace(
    /^(?:[-*]) (.+)$/gm,
    "<li>$1</li>"
  );


  html = html.replace(
    /(<li>.*<\/li>\n?)+/g,
    function (match) {

      return (
        "<ul>" +
        match +
        "</ul>"
      );

    }
  );


  /* =======================================================
     NUMBERED LIST
  ======================================================= */

  html = html.replace(
    /^(?:\d+)\. (.+)$/gm,
    "<li>$1</li>"
  );


  /* =======================================================
     HORIZONTAL LINE
  ======================================================= */

  html = html.replace(
    /^---$/gm,
    "<hr>"
  );


  /* =======================================================
     NEW LINES
  ======================================================= */

  html = html.replace(
    /\n/g,
    "<br>"
  );


  /* =======================================================
     REMOVE UNNECESSARY BR AFTER BLOCK ELEMENTS
  ======================================================= */

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
   WELCOME SCREEN
========================================================= */

function showWelcome() {

  if (!chat) {
    return;
  }

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

}


/* =========================================================
   ADD MESSAGE TO SCREEN
========================================================= */

function addMessage(
  text,
  role,
  saveToConversation = true
) {

  if (!chat) {
    return null;
  }


  /*
    إذا كانت شاشة الترحيب موجودة
    نحذفها عند أول رسالة.
  */

  const welcome =
    chat.querySelector(".welcome");

  if (welcome) {
    welcome.remove();
  }


  const wrapper =
    document.createElement("div");


  wrapper.className =
    "message " +
    (
      role === "user"
        ? "user-message"
        : "ai-message"
    );


  const bubble =
    document.createElement("div");


  bubble.className =
    "bubble " +
    (
      role === "assistant"
        ? "ai-bubble"
        : ""
    );


  if (role === "user") {

    /*
      رسالة المستخدم تعرض كنص عادي
      لمنع أي HTML.
    */

    bubble.textContent =
      text;

  } else {

    /*
      رسالة الذكاء الاصطناعي
      تمر عبر Markdown.
    */

    bubble.innerHTML =
      markdownToHTML(text);

  }


  wrapper.appendChild(
    bubble
  );


  chat.appendChild(
    wrapper
  );


  scrollToBottom();


  /*
    حفظ الرسالة في المحادثة الحالية
  */

  if (
    saveToConversation &&
    currentConversationId
  ) {

    const conversation =
      conversations.find(
        item =>
          item.id ===
          currentConversationId
      );

    if (conversation) {

      conversation.messages.push({
        role:
          role === "user"
            ? "user"
            : "assistant",

        content:
          String(text),

        timestamp:
          Date.now()
      });


      conversation.updatedAt =
        Date.now();


      saveConversations();

      renderConversationList();

    }

  }


  return wrapper;

}


/* =========================================================
   LOADING MESSAGE
========================================================= */

function addLoadingMessage() {

  if (!chat) {
    return null;
  }


  const wrapper =
    document.createElement("div");


  wrapper.className =
    "message ai-message";


  const bubble =
    document.createElement("div");


  bubble.className =
    "bubble ai-bubble loading-bubble";


  bubble.innerHTML = `
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
  `;


  wrapper.appendChild(
    bubble
  );


  chat.appendChild(
    wrapper
  );


  scrollToBottom();


  return wrapper;

}


/* =========================================================
   SCROLL
========================================================= */

function scrollToBottom() {

  if (!chat) {
    return;
  }

  requestAnimationFrame(
    () => {

      chat.scrollTop =
        chat.scrollHeight;

    }
  );

}


/* =========================================================
   CREATE NEW CONVERSATION
========================================================= */

function createNewConversation() {

  const id =
    createId();


  const now =
    Date.now();


  const conversation = {

    id,

    title:
      "محادثة جديدة",

    createdAt:
      now,

    updatedAt:
      now,

    messages:
      []

  };


  conversations.unshift(
    conversation
  );


  currentConversationId =
    id;


  saveConversations();

  renderConversationList();

  showWelcome();

  closeSidebarMobile();

  if (messageInput) {

    messageInput.value = "";

    autoResizeTextarea();

    messageInput.focus();

  }

}


/* =========================================================
   LOAD CONVERSATION
========================================================= */

function loadConversation(id) {

  const conversation =
    conversations.find(
      item =>
        item.id === id
    );


  if (!conversation) {
    return;
  }


  currentConversationId =
    id;


  if (!chat) {
    return;
  }


  chat.innerHTML = "";


  if (
    !conversation.messages ||
    conversation.messages.length === 0
  ) {

    showWelcome();

  } else {

    conversation.messages.forEach(
      message => {

        addMessage(
          message.content,
          message.role,
          false
        );

      }
    );

  }


  renderConversationList();

  closeSidebarMobile();

  scrollToBottom();

}


/* =========================================================
   DELETE CONVERSATION
========================================================= */

function deleteConversation(
  id,
  event
) {

  if (event) {
    event.stopPropagation();
  }


  const index =
    conversations.findIndex(
      item =>
        item.id === id
    );


  if (index === -1) {
    return;
  }


  conversations.splice(
    index,
    1
  );


  saveConversations();


  /*
    إذا حذفنا المحادثة الحالية
  */

  if (
    currentConversationId === id
  ) {

    currentConversationId =
      null;


    if (
      conversations.length > 0
    ) {

      loadConversation(
        conversations[0].id
      );

    } else {

      showWelcome();

      renderConversationList();

    }

  } else {

    renderConversationList();

  }

}


/* =========================================================
   RENAME CONVERSATION
========================================================= */

function renameConversation(
  id,
  event
) {

  if (event) {
    event.stopPropagation();
  }


  const conversation =
    conversations.find(
      item =>
        item.id === id
    );


  if (!conversation) {
    return;
  }


  const newTitle =
    prompt(
      "اكتب اسم المحادثة الجديد:",
      conversation.title
    );


  if (
    newTitle === null
  ) {
    return;
  }


  const title =
    newTitle.trim();


  if (!title) {
    return;
  }


  conversation.title =
    title;


  conversation.updatedAt =
    Date.now();


  saveConversations();

  renderConversationList();

}


/* =========================================================
   GET CONVERSATION TITLE
========================================================= */

function getConversationTitle(
  conversation
) {

  if (
    conversation.title &&
    conversation.title !== "محادثة جديدة"
  ) {

    return conversation.title;

  }


  const firstUserMessage =
    conversation.messages?.find(
      message =>
        message.role === "user"
    );


  if (
    firstUserMessage &&
    firstUserMessage.content
  ) {

    let title =
      firstUserMessage.content
        .replace(/\s+/g, " ")
        .trim();


    if (title.length > 32) {

      title =
        title.substring(0, 32) +
        "...";

    }


    return title;

  }


  return "محادثة جديدة";

}


/* =========================================================
   RENDER SIDEBAR HISTORY
========================================================= */

function renderConversationList() {

  if (!conversationList) {
    return;
  }


  conversationList.innerHTML = "";


  if (
    conversations.length === 0
  ) {

    conversationList.innerHTML = `
      <div class="empty-history">
        لا توجد محادثات سابقة بعد.<br>
        ابدأ محادثة جديدة وستظهر هنا.
      </div>
    `;

    return;

  }


  /*
    الأحدث أولًا
  */

  const sorted =
    [...conversations].sort(
      (a, b) =>
        (b.updatedAt || 0) -
        (a.updatedAt || 0)
    );


  sorted.forEach(
    conversation => {

      const item =
        document.createElement("div");


      item.className =
        "conversation-item";


      if (
        conversation.id ===
        currentConversationId
      ) {

        item.classList.add(
          "active"
        );

      }


      const main =
        document.createElement("div");


      main.className =
        "conversation-main";


      const name =
        document.createElement("div");


      name.className =
        "conversation-name";


      name.textContent =
        getConversationTitle(
          conversation
        );


      const date =
        document.createElement("div");


      date.className =
        "conversation-date";


      date.textContent =
        formatDate(
          conversation.updatedAt ||
          conversation.createdAt
        );


      main.appendChild(
        name
      );

      main.appendChild(
        date
      );


      const actions =
        document.createElement("div");


      actions.className =
        "conversation-actions";


      const renameBtn =
        document.createElement("button");


      renameBtn.className =
        "conversation-action";


      renameBtn.type =
        "button";


      renameBtn.title =
        "إعادة تسمية";


      renameBtn.textContent =
        "✎";


      renameBtn.addEventListener(
        "click",
        event => {

          renameConversation(
            conversation.id,
            event
          );

        }
      );


      const deleteBtn =
        document.createElement("button");


      deleteBtn.className =
        "conversation-action delete";


      deleteBtn.type =
        "button";


      deleteBtn.title =
        "حذف";


      deleteBtn.textContent =
        "×";


      deleteBtn.addEventListener(
        "click",
        event => {

          deleteConversation(
            conversation.id,
            event
          );

        }
      );


      actions.appendChild(
        renameBtn
      );

      actions.appendChild(
        deleteBtn
      );


      item.appendChild(
        main
      );

      item.appendChild(
        actions
      );


      item.addEventListener(
        "click",
        () => {

          loadConversation(
            conversation.id
          );

        }
      );


      conversationList.appendChild(
        item
      );

    }
  );

}


/* =========================================================
   SEND MESSAGE
========================================================= */

async function sendMessage() {

  if (isSending) {
    return;
  }


  if (!messageInput) {
    return;
  }


  const text =
    messageInput.value.trim();


  if (!text) {
    return;
  }


  /*
    إذا لم توجد محادثة
    ننشئ واحدة تلقائيًا.
  */

  if (!currentConversationId) {

    createNewConversation();

  }


  /*
    تأكيد وجود المحادثة
  */

  let conversation =
    conversations.find(
      item =>
        item.id ===
        currentConversationId
    );


  if (!conversation) {

    createNewConversation();


    conversation =
      conversations.find(
        item =>
          item.id ===
          currentConversationId
      );

  }


  if (!conversation) {
    return;
  }


  isSending = true;


  if (sendBtn) {
    sendBtn.disabled = true;
  }


  /*
    إضافة رسالة المستخدم
  */

  addMessage(
    text,
    "user",
    true
  );


  /*
    تحديث اسم المحادثة
    من أول رسالة.
  */

  if (
    conversation.title ===
    "محادثة جديدة"
  ) {

    conversation.title =
      getConversationTitle(
        conversation
      );

  }


  conversation.updatedAt =
    Date.now();


  saveConversations();

  renderConversationList();


  /*
    تنظيف مربع الكتابة
  */

  messageInput.value = "";

  autoResizeTextarea();


  /*
    Loading
  */

  const loading =
    addLoadingMessage();


  try {

    /*
      نرسل سجل المحادثة كاملًا
      إلى السيرفر.
    */

    const history =
      conversation.messages.map(
        message => ({

          role:
            message.role,

          content:
            message.content

        })
      );


    const response =
      await fetch(
        "/api/chat",
        {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              messages:
                history
            })

        }
      );


    /*
      محاولة قراءة JSON
    */

    let data = null;


    try {

      data =
        await response.json();

    } catch (jsonError) {

      data = null;

    }


    /*
      إذا كان السيرفر أعاد خطأ
    */

    if (!response.ok) {

      const serverMessage =
        data?.error ||
        data?.message ||
        "حدث خطأ في الخادم.";

      throw new Error(
        serverMessage
      );

    }


    /*
      استخراج الإجابة
      مهما كان شكلها البسيط.
    */

    let answer =
      data?.reply ||
      data?.response ||
      data?.message ||
      data?.text ||
      data?.content;


    /*
      بعض السيرفرات قد ترجع:
      { answer: "..." }
    */

    if (!answer) {

      answer =
        data?.answer;

    }


    /*
      حماية إضافية إذا رجعت
      البيانات بشكل مختلف.
    */

    if (
      typeof answer !==
      "string"
    ) {

      answer =
        String(
          answer || ""
        );

    }


    answer =
      answer.trim();


    if (!answer) {

      throw new Error(
        "لم تصل إجابة من الذكاء الاصطناعي."
      );

    }


    /*
      إزالة Loading
    */

    if (loading) {
      loading.remove();
    }


    /*
      إضافة الإجابة
    */

    addMessage(
      answer,
      "assistant",
      true
    );


  } catch (error) {

    console.error(
      "Chat API Error:",
      error
    );


    /*
      إزالة Loading
    */

    if (loading) {
      loading.remove();
    }


    /*
      رسالة الخطأ للمستخدم
    */

    addMessage(
      "حدث خطأ أثناء الحصول على الإجابة. حاول مرة أخرى بعد قليل.",
      "assistant",
      false
    );

  } finally {

    isSending = false;


    if (sendBtn) {
      sendBtn.disabled = false;
    }


    if (messageInput) {
      messageInput.focus();
    }

  }

}


/* =========================================================
   TEXTAREA AUTO RESIZE
========================================================= */

function autoResizeTextarea() {

  if (!messageInput) {
    return;
  }


  messageInput.style.height =
    "auto";


  const maxHeight =
    150;


  const newHeight =
    Math.min(
      messageInput.scrollHeight,
      maxHeight
    );


  messageInput.style.height =
    newHeight + "px";

}


/* =========================================================
   CLEAR CURRENT CHAT
========================================================= */

function clearCurrentChat() {

  /*
    إذا كانت هناك محادثة حالية
    نحذفها من السجل أيضًا.
  */

  if (currentConversationId) {

    conversations =
      conversations.filter(
        conversation =>
          conversation.id !==
          currentConversationId
      );

  }


  currentConversationId =
    null;


  saveConversations();

  renderConversationList();

  showWelcome();


  if (messageInput) {

    messageInput.value = "";

    autoResizeTextarea();

    messageInput.focus();

  }

}


/* =========================================================
   MOBILE SIDEBAR
========================================================= */

function openSidebarMobile() {

  if (!sidebar) {
    return;
  }

  sidebar.classList.add(
    "open"
  );


  if (sidebarOverlay) {

    sidebarOverlay.classList.add(
      "active"
    );

  }

}


function closeSidebarMobile() {

  if (!sidebar) {
    return;
  }

  sidebar.classList.remove(
    "open"
  );


  if (sidebarOverlay) {

    sidebarOverlay.classList.remove(
      "active"
    );

  }

}


/* =========================================================
   EVENT LISTENERS
========================================================= */


/*
  إرسال بالزر
*/

if (sendBtn) {

  sendBtn.addEventListener(
    "click",
    sendMessage
  );

}


/*
  Enter = إرسال
  Shift + Enter = سطر جديد
*/

if (messageInput) {

  messageInput.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {

        event.preventDefault();

        sendMessage();

      }

    }
  );


  messageInput.addEventListener(
    "input",
    autoResizeTextarea
  );

}


/*
  محادثة جديدة
*/

if (newChatBtn) {

  newChatBtn.addEventListener(
    "click",
    createNewConversation
  );

}


/*
  زر المحادثة الجديدة الموجود
  في أعلى الصفحة
*/

if (clearBtn) {

  clearBtn.addEventListener(
    "click",
    createNewConversation
  );

}


/*
  فتح القائمة في الجوال
*/

if (menuBtn) {

  menuBtn.addEventListener(
    "click",
    openSidebarMobile
  );

}


/*
  إغلاق القائمة
*/

if (sidebarOverlay) {

  sidebarOverlay.addEventListener(
    "click",
    closeSidebarMobile
  );

}


/* =========================================================
   INITIALIZATION
========================================================= */

function initializeApp() {

  /*
    تحميل المحادثات
  */

  loadConversations();


  /*
    عرض سجل المحادثات
  */

  renderConversationList();


  /*
    إذا كان هناك محادثات محفوظة
    افتح آخر محادثة.
  */

  if (
    conversations.length > 0
  ) {

    const latest =
      [...conversations].sort(
        (a, b) =>
          (b.updatedAt || 0) -
          (a.updatedAt || 0)
      )[0];


    if (latest) {

      loadConversation(
        latest.id
      );

    }

  } else {

    /*
      لا توجد محادثات
    */

    showWelcome();

  }


  /*
    ضبط مربع الكتابة
  */

  autoResizeTextarea();

}


/* =========================================================
   START
========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initializeApp
  );

} else {

  initializeApp();

}
